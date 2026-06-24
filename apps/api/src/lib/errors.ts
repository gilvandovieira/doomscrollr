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

export function forbidden(message = "You do not have permission to do that.") {
  return new HttpError(403, "FORBIDDEN", message);
}

export function conflict(code: string, message: string) {
  return new HttpError(409, code, message);
}

export function tooManyRequests(message = "Too many requests. Slow down.") {
  return new HttpError(429, "RATE_LIMITED", message);
}

export function badRequest(message: string, issues?: ErrorIssue[]) {
  return new HttpError(400, "BAD_REQUEST", message, issues);
}

export function notImplemented(message = "This endpoint is reserved for a later MVP phase.") {
  return new HttpError(501, "NOT_IMPLEMENTED", message);
}
