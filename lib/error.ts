export type ErrorCode =
  | "INTERNAL_SERVER_ERROR"
  | "BAD_REQUEST"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "METHOD_NOT_SUPPORTED"
  | "TIMEOUT"
  | "CONFLICT"
  | "PRECONDITION_FAILED"
  | "PAYLOAD_TOO_LARGE"
  | "UNPROCESSABLE_CONTENT"
  | "TOO_MANY_REQUESTS"
  | "CLIENT_CLOSED_REQUEST"
  | "PARSE_ERROR";

export interface APIErrorOptions {
  code: ErrorCode;
  message: string;
  cause?: unknown;
}

export class APIError extends Error {
  public readonly code: ErrorCode;
  public readonly cause?: unknown;

  constructor(options: APIErrorOptions) {
    super(options.message);
    this.name = "APIError";
    this.code = options.code;
    this.cause = options.cause;

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, APIError);
    }
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      cause: this.cause,
    };
  }
}

export function getStatusCodeFromErrorCode(code: string): number {
  switch (code) {
    case "BAD_REQUEST":
      return 400;
    case "UNAUTHORIZED":
      return 401;
    case "FORBIDDEN":
      return 403;
    case "NOT_FOUND":
      return 404;
    case "TOO_MANY_REQUESTS":
      return 429;
    case "INTERNAL_SERVER_ERROR":
    default:
      return 500;
  }
}

// Example usage:
// throw new APIError({
//   code: "INTERNAL_SERVER_ERROR",
//   message: "Error fetching from Semantic Scholar API",
//   cause: error,
// });
