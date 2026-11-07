import { describe, expect, it } from "vitest";
import { createPayPalClient } from "./client";
import {
  buildEvidenceForm,
  canProvideEvidence,
  invoiceTransactionIds,
  normalizeDispute,
} from "./disputes";
import { createMockPayPalClient } from "./mock";
import type { TokenProvider } from "./token";

const base = "https://api-m.sandbox.paypal.com";
const tokens: TokenProvider = {
  getToken: async () => "T",
  invalidate: () => {},
};

const rawDispute = {
  dispute_id: "PP-D-27803",
  status: "WAITING_FOR_SELLER_RESPONSE",
  reason: "MERCHANDISE_OR_SERVICE_NOT_RECEIVED",
  dispute_life_cycle_stage: "INQUIRY",
  dispute_amount: { currency_code: "USD", value: "75.00" },
  seller_response_due_date: "2026-11-30T00:00:00.000Z",
  disputed_transactions: [
    {
      buyer_transaction_id: "BUYERTX",
      seller_transaction_id: "SELLERTX",
      invoice_number: "CD-ABC-DP",
    },
  ],
};

describe("normalizeDispute", () => {
  it("keeps the fields used for matching and evidence", () => {
    expect(normalizeDispute(rawDispute)).toEqual({
      id: "PP-D-27803",
      status: "WAITING_FOR_SELLER_RESPONSE",
      reason: "MERCHANDISE_OR_SERVICE_NOT_RECEIVED",
      stage: "INQUIRY",
      amount: { currency: "USD", value: "75.00" },
      sellerResponseDueDate: "2026-11-30T00:00:00.000Z",
      createdAt: null,
      transactionIds: ["SELLERTX", "BUYERTX"],
      invoiceNumbers: ["CD-ABC-DP"],
    });
  });

  it("only allows evidence while PayPal waits for the seller", () => {
    expect(canProvideEvidence(normalizeDispute(rawDispute))).toBe(true);
    expect(
      canProvideEvidence(
        normalizeDispute({ ...rawDispute, status: "UNDER_REVIEW" }),
      ),
    ).toBe(false);
  });
});

describe("buildEvidenceForm", () => {
  it("sends the input JSON and the PDF as file1", async () => {
    const form = buildEvidenceForm({
      pdf: new Uint8Array([37, 80, 68, 70]),
      filename: "evidence.pdf",
      notes: "Evidence pack",
    });

    const input = form.get("input") as Blob;
    expect(input.type).toBe("application/json");
    expect(JSON.parse(await input.text())).toEqual({
      evidences: [{ evidence_type: "OTHER", notes: "Evidence pack" }],
    });
    const file = form.get("file1") as File;
    expect(file.name).toBe("evidence.pdf");
    expect(file.type).toBe("application/pdf");
    expect(file.size).toBe(4);
  });
});

describe("PayPal client disputes", () => {
  function client(route: (url: string, init: RequestInit) => Response) {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const fetch = (async (url: string, init: RequestInit = {}) => {
      calls.push({ url, init });
      return route(url, init);
    }) as unknown as typeof globalThis.fetch;
    return {
      calls,
      pp: createPayPalClient({
        baseUrl: base,
        clientId: "",
        clientSecret: "",
        fetch,
        tokenProvider: tokens,
      }),
    };
  }

  it("lists disputes for a transaction", async () => {
    const { pp, calls } = client(
      () => new Response(JSON.stringify({ items: [rawDispute] })),
    );
    const disputes = await pp.listDisputesForTransaction("SELLER TX");

    expect(calls[0].url).toBe(
      `${base}/v1/customer/disputes?disputed_transaction_id=SELLER%20TX`,
    );
    expect(disputes.map((d) => d.id)).toEqual(["PP-D-27803"]);
  });

  it("uploads evidence as multipart without a JSON content type", async () => {
    const { pp, calls } = client(() => new Response(null, { status: 200 }));
    await pp.provideDisputeEvidence("PP-D-27803", {
      pdf: new Uint8Array([1]),
      filename: "evidence.pdf",
      notes: "x",
    });

    expect(calls[0].url).toBe(
      `${base}/v1/customer/disputes/PP-D-27803/provide-evidence`,
    );
    expect(calls[0].init.body).toBeInstanceOf(FormData);
    const headers = calls[0].init.headers as Record<string, string>;
    expect(headers["Content-Type"]).toBeUndefined();
    expect(headers.Authorization).toBe("Bearer T");
  });
});

describe("mock disputes", () => {
  it("opens a dispute on a paid invoice and accepts evidence once", async () => {
    const pp = createMockPayPalClient();
    const draft = await pp.createInvoice({
      commissionId: "abcd1234",
      kind: "deposit",
      invoicerEmail: "creator@business.example.com",
      recipientEmail: "ren@example.com",
      currency: "USD",
      amount: "75.00",
      itemName: "Deposit",
      dueDate: "2026-11-08",
    });
    await pp.sendInvoice(draft.id);
    const paid = pp.markPaid(draft.id);
    const [transactionId] = invoiceTransactionIds(paid);
    expect(transactionId).toBe(`MOCKTX-${draft.id}`);

    const dispute = pp.openDispute(draft.id);
    const found = await pp.listDisputesForTransaction(transactionId);
    expect(found.map((d) => d.id)).toEqual([dispute.id]);

    const evidence = {
      pdf: new Uint8Array([1]),
      filename: "e.pdf",
      notes: "n",
    };
    await pp.provideDisputeEvidence(dispute.id, evidence);
    expect(pp.evidence).toHaveLength(1);
    await expect(
      pp.provideDisputeEvidence(dispute.id, evidence),
    ).rejects.toThrow(/UNDER_REVIEW/);
  });
});
