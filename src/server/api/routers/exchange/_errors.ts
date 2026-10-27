import { TRPCError } from "@trpc/server";
import { ExchangeError, type ExchangeErrorCode } from "~/lib/vault/exchange-service";
import { LedgerError } from "~/lib/vault/vault-ledger";

const EXCHANGE_CODE: Record<ExchangeErrorCode, TRPCError["code"]> = {
  INVALID_AMOUNT: "BAD_REQUEST",
  INSUFFICIENT_SOVEREIGNS: "BAD_REQUEST",
  USER_NOT_FOUND: "NOT_FOUND",
  DISABLED: "PRECONDITION_FAILED",
  MAINTENANCE: "PRECONDITION_FAILED",
  DAILY_CAP_REACHED: "BAD_REQUEST",
  LIMIT_REACHED: "BAD_REQUEST",
  NOT_FOUND: "NOT_FOUND",
  FORBIDDEN: "FORBIDDEN",
  CONFLICT: "CONFLICT",
};

const SWITCHED_OFF = new Set([
  "MAINTENANCE",
  "EARNING_DISABLED",
  "STORE_DISABLED",
  "PACKS_DISABLED",
]);

/** Map Exchange and vault ledger failures to tRPC errors; anything unknown is a 500. */
export function toTRPCError(error: unknown, label: string): TRPCError {
  if (error instanceof TRPCError) return error;
  if (error instanceof ExchangeError) {
    return new TRPCError({ code: EXCHANGE_CODE[error.code], message: error.message });
  }
  if (error instanceof LedgerError) {
    return new TRPCError({
      code: SWITCHED_OFF.has(error.code) ? "PRECONDITION_FAILED" : "BAD_REQUEST",
      message: error.message,
    });
  }
  console.error(`[Exchange Router] ${label} failed:`, error);
  return new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `Failed to ${label}` });
}

/** Run a handler and rethrow its failure as a tRPC error. */
export async function guard<T>(label: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    throw toTRPCError(error, label);
  }
}
