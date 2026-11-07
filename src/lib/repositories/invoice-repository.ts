import "server-only";
import { db } from "@/lib/db";
import {
  getPayPalClient,
  PayPalError,
  invoiceNumber,
  toDbInvoiceStatus,
  type Invoice as PayPalInvoice,
  type PayPalClient,
} from "@/lib/paypal";
import { planBalanceInvoice } from "@/lib/paypal/balance-invoice";
import {
  planDepositInvoice,
  type PlanDepositInvoiceInput,
  type DepositInvoicePlan,
} from "@/lib/paypal/deposit-invoice";
import {
  agreementInForce,
  lockCommission,
  notFound,
  readAgreement,
  utcToday,
} from "./shared";

type InvoiceKind = "deposit" | "balance";

const PLANNERS: Record<
  InvoiceKind,
  (input: PlanDepositInvoiceInput) => DepositInvoicePlan
> = {
  deposit: planDepositInvoice,
  balance: planBalanceInvoice,
};

export type IssueInvoiceOptions = {
  paypal?: PayPalClient;
  appBaseUrl?: string;
  /** YYYY-MM-DD (UTC) */
  today?: string;
};

/** Kept for existing callers. */
export type IssueDepositInvoiceOptions = IssueInvoiceOptions;

export type IssueInvoiceResult =
  | { status: "skipped"; reason: string }
  | { status: "exists"; invoiceId: string }
  | {
      status: "sent";
      invoiceId: string;
      paypalInvoiceId: string;
      payLink: string | null;
    };

export type IssueDepositInvoiceResult = IssueInvoiceResult;

async function defaultAppBaseUrl(): Promise<string> {
  // Loaded lazily so importing this module doesn't validate every env var.
  const { env } = await import("@/lib/env");
  return env.APP_BASE_URL;
}

/**
 * Side effect of negotiating -> agreed: creates and sends the deposit invoice
 * for the agreement in force, and stores it on `invoices`.
 *
 * Safe to call more than once (retries, re-confirmed deadline changes): a sent
 * or paid deposit invoice is never duplicated, and a half-finished attempt
 * (row saved, PayPal call failed) is resumed instead of starting over.
 *
 * Called by the state machine and by the creator's retry, never by clients.
 */
export function issueDepositInvoice(
  commissionId: string,
  options: IssueInvoiceOptions = {},
): Promise<IssueInvoiceResult> {
  return issueInvoice(commissionId, "deposit", options);
}

/**
 * Side effect of in_progress -> delivered: creates and sends the balance
 * invoice (total − deposit, due in 7 days). Skipped for a zero balance, which
 * the state machine moves straight to fully_paid. Same idempotency as the
 * deposit invoice. When it's paid, the webhook or the polling fallback moves
 * the commission delivered -> fully_paid.
 */
export function issueBalanceInvoice(
  commissionId: string,
  options: IssueInvoiceOptions = {},
): Promise<IssueInvoiceResult> {
  return issueInvoice(commissionId, "balance", options);
}

async function issueInvoice(
  commissionId: string,
  kind: InvoiceKind,
  options: IssueInvoiceOptions,
): Promise<IssueInvoiceResult> {
  const appBaseUrl = options.appBaseUrl ?? (await defaultAppBaseUrl());
  const today = options.today ?? utcToday();

  // 1. Under a row lock, find or reserve the invoice row.
  const reserved = await db.$transaction(async (tx) => {
    await lockCommission(tx, commissionId);
    const commission = await tx.commission.findUnique({
      where: { id: commissionId },
      include: {
        creator: { select: { paypalEmail: true } },
        agreementVersions: {
          orderBy: { version: "desc" },
          include: { confirmations: true },
        },
        invoices: { where: { kind }, orderBy: { createdAt: "asc" } },
      },
    });
    if (!commission) throw notFound();

    const open = commission.invoices.find((i) => i.status !== "cancelled");
    if (open && open.status !== "draft") {
      return { kind: "exists" as const, invoiceId: open.id };
    }

    const inForce = agreementInForce(commission.agreementVersions);
    if (!inForce) {
      throw new Error("No agreement version is confirmed by both parties.");
    }

    const plan = PLANNERS[kind]({
      agreement: readAgreement(inForce.content),
      version: inForce.version,
      contentHash: inForce.contentHash,
      creatorPaypalEmail: commission.creator.paypalEmail,
      clientToken: commission.clientToken,
      appBaseUrl,
      today,
    });
    if (plan.skip) return { kind: "skipped" as const, reason: plan.reason };

    const row =
      open ??
      (await tx.invoice.create({
        data: {
          commissionId,
          kind,
          status: "draft",
          amount: plan.amount,
          currency: plan.currency,
          dueDate: new Date(`${plan.dueDate}T00:00:00Z`),
        },
      }));
    const cancelled = commission.invoices.filter(
      (i) => i.status === "cancelled",
    ).length;

    return {
      kind: "pending" as const,
      row: {
        id: row.id,
        paypalInvoiceId: row.paypalInvoiceId,
        dueDate: row.dueDate,
      },
      plan,
      attempt: cancelled + 1,
    };
  });

  if (reserved.kind === "skipped") {
    return { status: "skipped", reason: reserved.reason };
  }
  if (reserved.kind === "exists") {
    return { status: "exists", invoiceId: reserved.invoiceId };
  }

  const { row, plan, attempt } = reserved;
  const paypal = options.paypal ?? getPayPalClient();

  // 2. Create the PayPal invoice, or pick up the one a failed attempt left.
  let invoice: PayPalInvoice;
  if (row.paypalInvoiceId) {
    invoice = await paypal.getInvoice(row.paypalInvoiceId);
  } else {
    const number = invoiceNumber(commissionId, kind, attempt);
    try {
      invoice = await paypal.createInvoice({
        commissionId,
        kind,
        attempt,
        invoicerEmail: plan.invoicerEmail,
        recipientEmail: plan.recipientEmail,
        recipientName: plan.recipientName,
        currency: plan.currency,
        amount: plan.amount,
        itemName: plan.itemName,
        note: plan.note,
        dueDate: row.dueDate?.toISOString().slice(0, 10) ?? plan.dueDate,
      });
    } catch (error) {
      if (!(error instanceof PayPalError && error.isDuplicateInvoiceNumber)) {
        throw error;
      }
      const existing = await paypal.findInvoiceByNumber(number);
      if (!existing) throw error;
      invoice = existing;
    }
    await db.invoice.update({
      where: { id: row.id },
      data: { paypalInvoiceId: invoice.id },
    });
  }

  // 3. Send it (DRAFT -> SENT) and store the pay link.
  if (invoice.status === "DRAFT") {
    invoice = await paypal.sendInvoice(invoice.id);
  }
  await db.invoice.update({
    where: { id: row.id },
    data: {
      status: toDbInvoiceStatus(invoice.status),
      payLink: invoice.payLink,
    },
  });
  await db.commissionEvent.create({
    data: {
      commissionId,
      type: "invoice_sent",
      actor: "system",
      meta: {
        kind,
        invoiceId: row.id,
        paypalInvoiceId: invoice.id,
        amount: plan.amount,
        currency: plan.currency,
      },
    },
  });

  return {
    status: "sent",
    invoiceId: row.id,
    paypalInvoiceId: invoice.id,
    payLink: invoice.payLink,
  };
}
