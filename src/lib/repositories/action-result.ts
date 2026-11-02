import type { z } from "zod";
import { TransitionError } from "@/lib/state-machine/errors";
import { RepositoryError } from "./errors";

export type ActionFailure = {
  ok: false;
  error: { code: string; message: string };
};

export type ActionResult<T> = { ok: true; data: T } | ActionFailure;

export function invalidInput(error: z.ZodError): ActionFailure {
  const [issue] = error.issues;
  const path = issue?.path.join(".");
  return {
    ok: false,
    error: {
      code: "invalid_input",
      message: path ? `${path}: ${issue.message}` : (issue?.message ?? ""),
    },
  };
}

export function toActionFailure(error: unknown): ActionFailure {
  if (error instanceof RepositoryError || error instanceof TransitionError) {
    return { ok: false, error: { code: error.code, message: error.message } };
  }
  throw error;
}
