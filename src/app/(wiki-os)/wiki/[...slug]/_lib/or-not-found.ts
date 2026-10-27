import "server-only";

import { TRPCError } from "@trpc/server";
import { notFound } from "next/navigation";

/**
 * The answer of a server-side tRPC call, or a 404 when the procedure says NOT_FOUND or refuses the
 * input (BAD_REQUEST: a title, file name or cursor too long to be one is not a page). Other errors
 * propagate.
 */
export async function orNotFound<T>(call: Promise<T>): Promise<T> {
  try {
    return await call;
  } catch (error) {
    if (
      error instanceof TRPCError &&
      (error.code === "NOT_FOUND" || error.code === "BAD_REQUEST")
    ) {
      notFound();
    }
    throw error;
  }
}
