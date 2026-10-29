import type { TransitionErrorCode } from "./rules";

export type TransitionFailure = TransitionErrorCode | "not_found" | "conflict";

const STATUS: Record<TransitionFailure, number> = {
  not_found: 404,
  actor_not_allowed: 403,
  not_allowed: 409,
  guard_failed: 409,
  conflict: 409,
};

export class TransitionError extends Error {
  readonly code: TransitionFailure;
  readonly status: number;

  constructor(code: TransitionFailure, message: string) {
    super(message);
    this.name = "TransitionError";
    this.code = code;
    this.status = STATUS[code];
  }
}
