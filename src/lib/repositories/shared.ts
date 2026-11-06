import "server-only";
import { randomBytes } from "node:crypto";
import { getCurrentCreator } from "@/lib/auth/get-current-creator";
import type { Prisma } from "@/generated/prisma/client";
import { agreementSchema, type Agreement } from "@/lib/schema/agreement";
import {
  CLIENT_TOKEN_BYTES,
  clientTokenSchema,
} from "@/lib/schema/commission-forms";
import { readAgreementFacts } from "@/lib/state-machine/agreement-facts";
import { RepositoryError } from "./errors";

export type Tx = Prisma.TransactionClient;

type VersionWithConfirmations = {
  version: number;
  contentHash: string;
  confirmations: { party: string; contentHash: string }[];
};

export async function requireCreator() {
  const creator = await getCurrentCreator();
  if (!creator) throw new RepositoryError("unauthorized", "Sign in first.");
  return creator;
}

export function notFound(): RepositoryError {
  return new RepositoryError("not_found", "Commission not found.");
}

export function newClientToken(): string {
  return randomBytes(CLIENT_TOKEN_BYTES).toString("base64url");
}

export function isClientToken(token: string): boolean {
  return clientTokenSchema.safeParse(token).success;
}

export async function lockCommission(tx: Tx, commissionId: string) {
  await tx.$queryRaw`SELECT id FROM commissions WHERE id = ${commissionId}::uuid FOR UPDATE`;
}

export async function latestVersion(tx: Tx, commissionId: string) {
  const latest = await tx.agreementVersion.findFirst({
    where: { commissionId },
    orderBy: { version: "desc" },
    include: { confirmations: true },
  });
  if (!latest) throw notFound();
  return latest;
}

export function readAgreement(content: unknown): Agreement {
  return agreementSchema.parse(content);
}

export function isConfirmedBy(
  version: VersionWithConfirmations,
  party: "creator" | "client",
): boolean {
  return version.confirmations.some(
    (c) => c.party === party && c.contentHash === version.contentHash,
  );
}

export function agreementInForce<T extends VersionWithConfirmations>(
  versions: T[],
): T | null {
  return (
    [...versions]
      .sort((a, b) => b.version - a.version)
      .find((v) => isConfirmedBy(v, "creator") && isConfirmedBy(v, "client")) ??
    null
  );
}

export function toJson(agreement: Agreement): Prisma.InputJsonObject {
  return agreement as unknown as Prisma.InputJsonObject;
}

export function utcToday(): string {
  return new Date().toISOString().slice(0, 10);
}

export type InvoiceRow = {
  kind: "deposit" | "balance";
  status: "draft" | "sent" | "paid" | "cancelled";
  payLink: string | null;
  paidAt: Date | null;
  createdAt: Date;
};

export type PaymentStatus = {
  status: "not_required" | "not_created" | InvoiceRow["status"];
  payLink: string | null;
  paidAt: string | null;
};

function paymentStatus(
  invoices: InvoiceRow[],
  kind: InvoiceRow["kind"],
  required: boolean,
): PaymentStatus {
  const invoice = invoices
    .filter((i) => i.kind === kind)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
  if (!invoice) {
    return {
      status: required ? "not_created" : "not_required",
      payLink: null,
      paidAt: null,
    };
  }
  return {
    status: invoice.status,
    payLink: invoice.payLink,
    paidAt: invoice.paidAt?.toISOString() ?? null,
  };
}

export function paymentsOf(content: unknown, invoices: InvoiceRow[]) {
  const facts = readAgreementFacts(content);
  return {
    deposit: paymentStatus(invoices, "deposit", facts.depositType !== "none"),
    balance: paymentStatus(invoices, "balance", !facts.balanceIsZero),
  };
}
