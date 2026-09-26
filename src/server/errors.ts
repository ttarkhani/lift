import { z } from "zod";

export type ErrorCode =
  | "validation"
  | "unauthenticated"
  | "forbidden"
  | "not_found"
  | "conflict";

const statusByCode: Record<ErrorCode, number> = {
  validation: 400,
  unauthenticated: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
};

export class AppError extends Error {
  readonly status: number;

  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = new.target.name;
    this.status = statusByCode[code];
  }
}

export class ValidationError extends AppError {
  constructor(message = "Check the highlighted fields.", details?: unknown) {
    super("validation", message, details);
  }
}

export class UnauthenticatedError extends AppError {
  constructor(message = "Log in to continue.") {
    super("unauthenticated", message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "You don't have access to this.") {
    super("forbidden", message);
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Not found.") {
    super("not_found", message);
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super("conflict", message);
  }
}

export type ErrorBody = {
  error: { code: ErrorCode | "internal"; message: string; details?: unknown };
};

/** Turns any thrown value into a JSON response. Unknown errors become a 500 without leaking internals. */
export function errorResponse(error: unknown): Response {
  if (error instanceof z.ZodError) {
    error = new ValidationError(undefined, z.flattenError(error));
  }
  if (error instanceof AppError) {
    const body: ErrorBody = {
      error: { code: error.code, message: error.message },
    };
    if (error.details !== undefined) body.error.details = error.details;
    return Response.json(body, { status: error.status });
  }
  console.error(error);
  const body: ErrorBody = {
    error: { code: "internal", message: "Something went wrong." },
  };
  return Response.json(body, { status: 500 });
}
