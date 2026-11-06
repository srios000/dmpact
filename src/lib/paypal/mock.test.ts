import { describe, expect, it } from "vitest";
import { createMockPayPalClient } from "./mock";
import type { CreateInvoiceInput } from "./types";

const input: CreateInvoiceInput = {
  commissionId: "abcd1234-0000",
  kind: "deposit",
  invoicerEmail: "creator@business.example.com",
  recipientEmail: "client@personal.example.com",
  currency: "JPY",
  amount: "15000",
  itemName: "Deposit",
  dueDate: "2026-11-07",
};

describe("createMockPayPalClient", () => {
  it("runs the full create -> send -> pay lifecycle", async () => {
    const pp = createMockPayPalClient();
    const draft = await pp.createInvoice(input);
    expect(draft).toMatchObject({
      status: "DRAFT",
      invoiceNumber: "CD-ABCD12340000-DP",
      amount: { currency: "JPY", value: "15000" },
    });

    const sent = await pp.sendInvoice(draft.id);
    expect(sent.status).toBe("SENT");
    expect(sent.payLink).toContain(draft.id);

    await pp.remindInvoice(draft.id);
    expect(pp.markPaid(draft.id).status).toBe("PAID");
    await expect(pp.cancelInvoice(draft.id)).rejects.toThrow(/PAID/);
  });

  it("rejects duplicate invoice numbers like PayPal", async () => {
    const pp = createMockPayPalClient();
    await pp.createInvoice(input);
    const err = await pp.createInvoice(input).catch((e) => e);
    expect(err.isDuplicateInvoiceNumber).toBe(true);
    expect(
      (await pp.createInvoice({ ...input, attempt: 2 })).invoiceNumber,
    ).toBe("CD-ABCD12340000-DP-2");
  });
});
