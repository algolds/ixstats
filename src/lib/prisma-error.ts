import { Prisma } from "@prisma/client";
import { NotFoundError, ConflictError, ValidationError, InternalError } from "~/lib/app-error";

const FOREIGN_KEY_PREFIX = "Foreign key constraint failed";

interface ParsedPrismaError {
  type: "unique_constraint" | "not_found" | "foreign_key" | "constraint" | "timeout" | "unknown";
  model?: string;
  field?: string;
  message: string;
}

export function parsePrismaError(error: unknown): ParsedPrismaError | null {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return null;

  const meta = error.meta ?? {};
  const modelName = typeof meta.modelName === "string" ? meta.modelName : undefined;

  switch (error.code) {
    case "P2002": {
      const target = Array.isArray(meta.target) ? meta.target[0] : undefined;
      return {
        type: "unique_constraint",
        model: modelName,
        field: typeof target === "string" ? target : undefined,
        message: `Unique constraint violation${modelName ? ` on ${modelName}` : ""}${target ? ` (${target})` : ""}`,
      };
    }
    case "P2025": {
      return {
        type: "not_found",
        model: modelName,
        message: error.message,
      };
    }
    case "P2003": {
      const fieldName = typeof meta.field_name === "string" ? meta.field_name : undefined;
      return {
        type: "foreign_key",
        model: modelName,
        field: fieldName,
        message: `${FOREIGN_KEY_PREFIX}${modelName ? ` on ${modelName}` : ""}${fieldName ? ` (${fieldName})` : ""}`,
      };
    }
    case "P2014": {
      return {
        type: "constraint",
        model: modelName,
        message: error.message,
      };
    }
    case "P1001":
    case "P1008": {
      return {
        type: "timeout",
        message: "Database connection timeout",
      };
    }
    default: {
      return {
        type: "unknown",
        message: error.message,
      };
    }
  }
}

export function prismaErrorToAppError(error: unknown): never {
  const parsed = parsePrismaError(error);

  if (!parsed) {
    // Not a Prisma error — rethrow as-is
    throw error;
  }

  switch (parsed.type) {
    case "unique_constraint":
      throw new ConflictError(parsed.message);
    case "not_found":
      throw new NotFoundError(parsed.model ?? "Record", undefined, { prismaError: parsed.message });
    case "foreign_key":
    case "constraint":
      throw new ValidationError(parsed.message, { model: parsed.model, field: parsed.field });
    case "timeout":
    case "unknown":
      throw new InternalError(parsed.message);
  }
}

/**
 * A unique-index violation (P2002), however it arrives: the raw Prisma error from a bare client (matched by its `code`,
 * so a duplicated Prisma module cannot defeat it), or the `ConflictError` that `~/server/db` wraps every model
 * operation's failure into. `field` narrows it to a violation that names that column (the raw `meta.target`, or the
 * column in the wrapped message).
 */
export function isUniqueViolation(error: unknown, field?: string): boolean {
  if (error instanceof ConflictError) return field === undefined || error.message.includes(field);
  if (!(error instanceof Error) || !("code" in error) || error.code !== "P2002") return false;
  const meta = "meta" in error && typeof error.meta === "object" ? error.meta : null;
  const target = meta && "target" in meta ? String(meta.target) : "";
  return field === undefined || target.includes(field);
}

/**
 * A row deleted under a write: P2025 (record not found) or P2003 (an insert whose parent is gone), however it arrives:
 * the raw Prisma error from a bare client, or what `~/server/db` wraps it into (a `NotFoundError` carrying the Prisma
 * message in its context, a `ValidationError` for the foreign key). A `NotFoundError` or `ValidationError` raised by
 * application code is not taken for one.
 */
export function isMissingRecord(error: unknown): boolean {
  if (error instanceof NotFoundError) return typeof error.context?.prismaError === "string";
  if (error instanceof ValidationError) return error.message.startsWith(FOREIGN_KEY_PREFIX);
  return (
    error instanceof Error && "code" in error && (error.code === "P2025" || error.code === "P2003")
  );
}
