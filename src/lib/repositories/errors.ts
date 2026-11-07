export type RepositoryErrorCode =
  | "unauthorized"
  | "not_found"
  | "stale_version"
  | "edit_not_allowed"
  | "invalid_agreement"
  | "retry_not_allowed"
  | "invoice_failed"
  | "storage_unavailable"
  | "upload_not_allowed"
  | "invalid_upload"
  | "download_not_allowed"
  | "dispute_failed";

export class RepositoryError extends Error {
  readonly code: RepositoryErrorCode;

  constructor(code: RepositoryErrorCode, message: string) {
    super(message);
    this.name = "RepositoryError";
    this.code = code;
  }
}
