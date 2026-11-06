import "server-only";
import { todayInZone } from "@/lib/ai/extract";
import type { ModelClient } from "@/lib/ai/gemini";
import { writeNudge, type NudgeTone } from "@/lib/ai/nudge/nudge";
import { db } from "@/lib/db";
import { currencyExponent } from "@/lib/money/decimal";
import { getPayPalClient, type PayPalClient } from "@/lib/paypal";
import type { Actor } from "@/lib/state-machine/rules";
import {
  agreementInForce,
  notFound,
  readAgreement,
  requireCreator,
} from "./shared";

/**
 * Overdue reminders (#18, FR-6.5). For each unpaid invoice past its due date:
 * ask PayPal to email the client a reminder, draft a copyable nudge with the
 * AI nudge writer, and store it on the commission as an `invoice_reminded`
 * event. At most one reminder per invoice per 24 hours.
 */

export const REMIND_INTERVAL_MS = 24 * 60 * 60 * 1000;

/** States where an unpaid invoice is still worth chasing. */
const CHASED_STATES = ["agreed", "delivered"] as const;

export type ReminderOptions = {
  /** null skips the PayPal reminder (no credentials). Defaults to the shared client. */
  paypal?: PayPalClient | null;
  /** null always uses the template nudge. */
  model?: ModelClient | null;
  /** YYYY-MM-DD (defaults to today in the creator's timezone). */
  today?: string;
  now?: Date;
  actor?: Actor;
};

export type Nudge = {
  invoiceId: string;
  kind: "deposit" | "balance";
  message: string;
  tone: NudgeTone;
  daysOverdue: number;
  /** True when PayPal also emailed the client. */
  remindedAtPayPal: boolean;
  at: string;
};

type OutcomeBase = { invoiceId: string; commissionId: string };

export type ReminderOutcome =
  | (OutcomeBase & { status: "reminded"; nudge: Nudge })
  | (OutcomeBase & { status: "skipped"; reason: string })
  | (OutcomeBase & { status: "failed"; error: string });

type DueInvoice = Awaited<ReturnType<typeof findDueInvoices>>[number];

function dueInvoiceQuery(today: string, now: Date) {
  const cutoff = new Date(now.getTime() - REMIND_INTERVAL_MS);
  return {
    status: "sent" as const,
    dueDate: { lt: new Date(`${today}T00:00:00Z`) },
    OR: [{ lastRemindedAt: null }, { lastRemindedAt: { lte: cutoff } }],
  };
}

async function findDueInvoices(
  today: string,
  now: Date,
  scope: { commissionId?: string } = {},
) {
  return db.invoice.findMany({
    where: {
      ...dueInvoiceQuery(today, now),
      commission: {
        state: { in: [...CHASED_STATES] },
        ...(scope.commissionId ? { id: scope.commissionId } : {}),
      },
    },
    orderBy: { dueDate: "asc" },
    include: {
      commission: {
        select: {
          agreementVersions: {
            orderBy: { version: "desc" },
            include: { confirmations: true },
          },
        },
      },
    },
  });
}

async function remindOne(
  invoice: DueInvoice,
  options: Required<Pick<ReminderOptions, "today" | "now" | "actor">> &
    Pick<ReminderOptions, "paypal" | "model">,
): Promise<ReminderOutcome> {
  const { today, now, actor } = options;
  const ids = { invoiceId: invoice.id, commissionId: invoice.commissionId };
  if (!invoice.dueDate) {
    return { ...ids, status: "skipped", reason: "No due date." };
  }

  // Claim the invoice first so two runs can't both remind it.
  const previous = invoice.lastRemindedAt;
  const claimed = await db.invoice.updateMany({
    where: { id: invoice.id, ...dueInvoiceQuery(today, now) },
    data: { lastRemindedAt: now },
  });
  if (claimed.count === 0) {
    return {
      ...ids,
      status: "skipped",
      reason: "Already reminded in the last 24 hours.",
    };
  }

  try {
    let remindedAtPayPal = false;
    if (invoice.paypalInvoiceId && options.paypal) {
      await options.paypal.remindInvoice(invoice.paypalInvoiceId);
      remindedAtPayPal = true;
    }

    const inForce = agreementInForce(invoice.commission.agreementVersions);
    const agreement = inForce ? readAgreement(inForce.content) : null;
    const dueDate = invoice.dueDate.toISOString().slice(0, 10);
    const result = await writeNudge(
      {
        kind: invoice.kind,
        amount: invoice.amount.toFixed(currencyExponent(invoice.currency)),
        currency: invoice.currency,
        dueDate,
        today,
        payLink: invoice.payLink,
        clientName: agreement?.parties?.client?.display_name ?? null,
        title: agreement?.title ?? "your commission",
      },
      options.model ?? null,
    );

    const nudge: Nudge = {
      invoiceId: invoice.id,
      kind: invoice.kind,
      message: result.message,
      tone: result.tone,
      daysOverdue: result.days_overdue,
      remindedAtPayPal,
      at: now.toISOString(),
    };
    await db.commissionEvent.create({
      data: {
        commissionId: invoice.commissionId,
        type: "invoice_reminded",
        actor,
        reason: `${invoice.kind === "deposit" ? "Deposit" : "Balance"} is ${result.days_overdue} day${result.days_overdue === 1 ? "" : "s"} overdue.`,
        meta: { ...nudge, fallback: result.fallback },
      },
    });
    return { ...ids, status: "reminded", nudge };
  } catch (error) {
    // Give the claim back so the next run tries again.
    await db.invoice.update({
      where: { id: invoice.id },
      data: { lastRemindedAt: previous },
    });
    return {
      ...ids,
      status: "failed",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/** The shared PayPal client, or null when it isn't configured. */
function paypalOrNull(): PayPalClient | null {
  try {
    return getPayPalClient();
  } catch (error) {
    // Without PayPal credentials reminders still draft nudges.
    console.error("Overdue reminders running without PayPal.", error);
    return null;
  }
}

function resolve(options: ReminderOptions, defaultActor: Actor = "system") {
  const now = options.now ?? new Date();
  return {
    paypal: options.paypal === undefined ? paypalOrNull() : options.paypal,
    model: options.model ?? null,
    today: options.today ?? todayInZone(undefined, now),
    now,
    actor: options.actor ?? defaultActor,
  };
}

/**
 * The daily job (`GET /api/cron/overdue`): reminds every overdue invoice of
 * every creator. One invoice failing doesn't stop the others.
 */
export async function runOverdueReminders(
  options: ReminderOptions = {},
): Promise<ReminderOutcome[]> {
  const resolved = resolve(options, "system");
  const invoices = await findDueInvoices(resolved.today, resolved.now);
  const outcomes: ReminderOutcome[] = [];
  for (const invoice of invoices) {
    outcomes.push(await remindOne(invoice, resolved));
  }
  return outcomes;
}

/** Extracts the latest nudge from an ordered list of commission events. */
export function latestNudgeFromEvents(
  events: readonly { type: string; meta?: unknown }[],
): Nudge | null {
  for (let i = events.length - 1; i >= 0; i--) {
    const event = events[i];
    if (event.type === "invoice_reminded" && event.meta) {
      return event.meta as Nudge;
    }
  }
  return null;
}

/** The latest nudge stored on a commission, if any. */
export async function latestNudge(commissionId: string): Promise<Nudge | null> {
  const event = await db.commissionEvent.findFirst({
    where: { commissionId, type: "invoice_reminded" },
    orderBy: { at: "desc" },
    select: { meta: true },
  });
  return event?.meta ? (event.meta as unknown as Nudge) : null;
}

/**
 * "Run reminder" on the commission page (demo trigger). Same rules as the
 * daily job, for one commission the signed-in creator owns. Returns the
 * newest nudge to copy, even when the 24-hour limit skipped this run.
 */
export async function runCommissionReminder(
  commissionId: string,
  options: ReminderOptions = {},
): Promise<{ outcomes: ReminderOutcome[]; nudge: Nudge | null }> {
  const creator = await requireCreator();
  const owned = await db.commission.findFirst({
    where: { id: commissionId, creatorId: creator.id },
    select: { id: true },
  });
  if (!owned) throw notFound();

  const resolved = resolve(options, "creator");
  const invoices = await findDueInvoices(resolved.today, resolved.now, {
    commissionId,
  });
  const outcomes: ReminderOutcome[] = [];
  for (const invoice of invoices) {
    outcomes.push(await remindOne(invoice, resolved));
  }
  return { outcomes, nudge: await latestNudge(commissionId) };
}
