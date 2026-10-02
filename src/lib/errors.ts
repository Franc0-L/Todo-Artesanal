export type AppErrorCode =
  | "VALIDATION_ERROR"
  | "DATABASE_ERROR"
  | "NOT_FOUND"
  | "CONFLICT"
  | "FORBIDDEN"
  | "UNAUTHORIZED"
  | "WEEK_LOCKED"
  | "BUSINESS_RULE"
  | "UNKNOWN_ERROR";

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly details?: unknown;

  constructor(
    code: AppErrorCode,
    message: string,
    options?: {
      cause?: unknown;
      details?: unknown;
    },
  ) {
    super(message, { cause: options?.cause });

    this.name = "AppError";
    this.code = code;
    this.details = options?.details;

    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
