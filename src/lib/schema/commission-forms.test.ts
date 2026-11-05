import { describe, expect, it } from "vitest";
import {
  clientTokenSchema,
  confirmAgreementSchema,
  createCommissionSchema,
  transitionCommissionSchema,
} from "./commission-forms";
import { exampleAgreement } from "./example-agreement";

describe("createCommissionSchema", () => {
  it("defaults a new commission to a 50% deposit", () => {
    const agreement: Partial<typeof exampleAgreement> = { ...exampleAgreement };
    delete agreement.deposit;
    const parsed = createCommissionSchema.parse({ sourceDm: "dm", agreement });
    expect(parsed.agreement.deposit).toEqual({
      type: "percent",
      percent: 50,
      fixed_amount: null,
    });
  });

  it("keeps an explicit no-deposit choice", () => {
    const deposit = { type: "none", percent: null, fixed_amount: null };
    const parsed = createCommissionSchema.parse({
      sourceDm: "dm",
      agreement: { ...exampleAgreement, deposit },
    });
    expect(parsed.agreement.deposit).toEqual(deposit);
  });

  it("rejects an invalid agreement", () => {
    const result = createCommissionSchema.safeParse({
      sourceDm: "dm",
      agreement: { ...exampleAgreement, title: "" },
    });
    expect(result.success).toBe(false);
  });
});

describe("transitionCommissionSchema", () => {
  const commissionId = crypto.randomUUID();

  it.each(["in_progress", "delivered", "cancelled"])("accepts %s", (to) => {
    expect(
      transitionCommissionSchema.safeParse({ commissionId, to }).success,
    ).toBe(true);
  });

  it.each(["negotiating", "agreed", "dp_paid", "fully_paid"])(
    "keeps %s out of the creator's reach",
    (to) => {
      expect(
        transitionCommissionSchema.safeParse({ commissionId, to }).success,
      ).toBe(false);
    },
  );
});

describe("confirmAgreementSchema", () => {
  it("requires a SHA-256 version hash", () => {
    const token = "a".repeat(22);
    expect(
      confirmAgreementSchema.safeParse({ token, versionHash: "abc" }).success,
    ).toBe(false);
    expect(
      confirmAgreementSchema.safeParse({ token, versionHash: "a".repeat(64) })
        .success,
    ).toBe(true);
  });
});

describe("clientTokenSchema", () => {
  it("accepts only 22-character base64url tokens", () => {
    expect(clientTokenSchema.safeParse("Ab0_-".padEnd(22, "x")).success).toBe(
      true,
    );
    for (const token of [
      "",
      "a".repeat(21),
      "a".repeat(23),
      "a".repeat(21) + "=",
      "a".repeat(21) + "/",
      "a".repeat(21) + "+",
    ]) {
      expect(clientTokenSchema.safeParse(token).success).toBe(false);
    }
  });
});
