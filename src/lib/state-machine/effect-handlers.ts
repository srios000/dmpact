import {
  issueBalanceInvoice,
  issueDepositInvoice,
} from "@/lib/repositories/invoice-repository";
import type { EffectHandlers } from "./transition";

export const effectHandlers: EffectHandlers = {
  createDepositInvoice: async (commissionId) => {
    await issueDepositInvoice(commissionId);
  },
  createBalanceInvoice: async (commissionId) => {
    await issueBalanceInvoice(commissionId);
  },
};
