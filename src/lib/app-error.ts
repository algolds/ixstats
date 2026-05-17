export type ErrorCode =
  | "NOT_FOUND"
  | "BAD_REQUEST"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "INTERNAL_SERVER_ERROR"
  | "CONFLICT"
  | "PRECONDITION_FAILED"
  | "RATE_LIMITED"
  | "VALIDATION"
  | "SECURITY";

const CODE_TO_HTTP_STATUS: Record<ErrorCode, number> = {
  NOT_FOUND: 404,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  INTERNAL_SERVER_ERROR: 500,
  CONFLICT: 409,
  PRECONDITION_FAILED: 412,
  RATE_LIMITED: 429,
  VALIDATION: 400,
  SECURITY: 400,
};

const CODE_TO_TRPC_CODE: Record<ErrorCode, string> = {
  NOT_FOUND: "NOT_FOUND",
  BAD_REQUEST: "BAD_REQUEST",
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  INTERNAL_SERVER_ERROR: "INTERNAL_SERVER_ERROR",
  CONFLICT: "CONFLICT",
  PRECONDITION_FAILED: "PRECONDITION_FAILED",
  RATE_LIMITED: "TOO_MANY_REQUESTS",
  VALIDATION: "BAD_REQUEST",
  SECURITY: "BAD_REQUEST",
};

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly statusCode: number;
  readonly trpcCode: string;
  readonly context?: Record<string, unknown>;

  constructor(code: ErrorCode, message: string, context?: Record<string, unknown>) {
    super(message);
    this.name = `AppError.${code}`;
    this.code = code;
    this.statusCode = CODE_TO_HTTP_STATUS[code];
    this.trpcCode = CODE_TO_TRPC_CODE[code];
    this.context = context;
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id?: string, context?: Record<string, unknown>) {
    const message = id ? `${resource} not found: ${id}` : `${resource} not found`;
    super("NOT_FOUND", message, { ...context, resource, ...(id ? { id } : {}) });
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Authentication required") {
    super("UNAUTHORIZED", message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Access denied") {
    super("FORBIDDEN", message);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super("VALIDATION", message, details);
  }
}

export class SecurityError extends AppError {
  constructor(message = "Security violation") {
    super("SECURITY", message);
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super("CONFLICT", message);
  }
}

export class PreconditionFailedError extends AppError {
  constructor(message: string) {
    super("PRECONDITION_FAILED", message);
  }
}

export class RateLimitError extends AppError {
  readonly resetAt: Date;

  constructor(message: string, resetAt: Date) {
    super("RATE_LIMITED", message, { resetAt: resetAt.toISOString() });
    this.resetAt = resetAt;
  }
}

export class InternalError extends AppError {
  constructor(message = "Internal server error") {
    super("INTERNAL_SERVER_ERROR", message);
  }
}

export function isAppError(error: Error | undefined): error is AppError {
  return error instanceof AppError;
}
