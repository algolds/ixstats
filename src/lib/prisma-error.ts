import { Prisma } from "@prisma/client";
import { NotFoundError, ConflictError, ValidationError, InternalError } from "~/lib/app-error";

export interface ParsedPrismaError {
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
        message: `Foreign key constraint failed${modelName ? ` on ${modelName}` : ""}${fieldName ? ` (${fieldName})` : ""}`,
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
