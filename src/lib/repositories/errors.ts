export type RepositoryErrorCode =
  | "unauthorized"
  | "not_found"
  | "stale_version"
  | "edit_not_allowed"
  | "invalid_agreement";

export class RepositoryError extends Error {
  readonly code: RepositoryErrorCode;

  constructor(code: RepositoryErrorCode, message: string) {
    super(message);
    this.name = "RepositoryError";
    this.code = code;
  }
}
