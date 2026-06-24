export type ErrorIssue = {
  path: string;
  message: string;
};

export class HttpError extends Error {
  readonly status: number;
  readonly code: string;
  readonly issues?: ErrorIssue[];

  constructor(status: number, code: string, message: string, issues?: ErrorIssue[]) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.code = code;
    this.issues = issues;
  }
}

export function notFound(message = "Resource not found.") {
  return new HttpError(404, "NOT_FOUND", message);
}

export function unauthorized(message = "Authentication is required.") {
  return new HttpError(401, "UNAUTHORIZED", message);
}

export function notImplemented(message = "This endpoint is reserved for a later MVP phase.") {
  return new HttpError(501, "NOT_IMPLEMENTED", message);
}
