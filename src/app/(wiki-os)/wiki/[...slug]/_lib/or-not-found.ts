import "server-only";

import { TRPCError } from "@trpc/server";
import { notFound } from "next/navigation";

/** The answer of a server-side tRPC call, or a 404 when the procedure says NOT_FOUND. Other errors propagate. */
export async function orNotFound<T>(call: Promise<T>): Promise<T> {
  try {
    return await call;
  } catch (error) {
    if (error instanceof TRPCError && error.code === "NOT_FOUND") notFound();
    throw error;
  }
}
