/** The card workshop's refusals, and how they reach the player. */
import { TRPCError } from "@trpc/server";
import { CapacityError } from "~/lib/cards/capacity";
import { LedgerError } from "~/lib/vault/vault-ledger";
import { vaultsBusyError } from "~/lib/vault/vault-locks";

/** Not enough dust of a realm, or a credit past what a balance holds. */
export class DustError extends Error {
  readonly code = "PRECONDITION_FAILED" as const;

  constructor(message: string) {
    super(message);
    this.name = "DustError";
  }
}

const BUSY = "Something else changed these cards at the same moment. Try again.";

/**
 * Runs a workshop call, turning its expected refusals into client-safe tRPC errors: too little dust or a full
 * collection is a PRECONDITION_FAILED, a ledger refusal (too few credits, a switch off) a BAD_REQUEST, and a lost
 * deadlock a CONFLICT to retry (the transaction rolled back whole). Anything else passes through.
 */
export async function workshopCall<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    if (error instanceof DustError || error instanceof CapacityError) {
      throw new TRPCError({ code: "PRECONDITION_FAILED", message: error.message });
    }
    if (error instanceof LedgerError) {
      throw new TRPCError({ code: "BAD_REQUEST", message: error.message });
    }
    if (error instanceof Error && vaultsBusyError(error)) {
      throw new TRPCError({ code: "CONFLICT", message: BUSY });
    }
    throw error;
  }
}
