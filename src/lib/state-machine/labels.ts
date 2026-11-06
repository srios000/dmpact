import type { CommissionState } from "./rules";

export const STATE_LABELS: Record<CommissionState, string> = {
  draft: "Draft",
  negotiating: "Negotiating",
  agreed: "Agreed",
  dp_paid: "Deposit paid",
  in_progress: "In progress",
  delivered: "Delivered",
  fully_paid: "Fully paid",
  cancelled: "Cancelled",
};
