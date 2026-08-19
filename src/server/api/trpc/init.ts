/**
 * tRPC API Initialization & Core Factories
 */

import { initTRPC } from "@trpc/server";
import superjson from "superjson";
import { ZodError } from "zod";
import { ErrorLogger } from "~/lib/logging";
import { AppError } from "~/lib/app-error";
import type { createTRPCContext } from "./context";

export const t = initTRPC.context<typeof createTRPCContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error, path, ctx }) {
    // Log all tRPC errors in production (except validation errors)
    if (process.env.NODE_ENV === "production" && error.code !== "BAD_REQUEST") {
      ErrorLogger.logAPIError(path || "unknown", error as Error, {
        userId: ctx?.auth?.userId ?? undefined,
        countryId: ctx?.user?.countryId ?? undefined,
        path: path || "unknown",
        action: "TRPC_ERROR",
        metadata: {
          code: error.code,
          httpStatus: shape.data.httpStatus,
        },
      }).catch((logError) => {
        console.error("[TRPC] Failed to log error:", logError);
      });
    }

    if (error.cause instanceof AppError) {
      return {
        ...shape,
        data: {
          ...shape.data,
          httpStatus: error.cause.statusCode,
          code: error.cause.trpcCode as any,
          context: error.cause.context,
        },
      };
    }

    return {
      ...shape,
      data: {
        ...shape.data,
        zodError: error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

export const createCallerFactory = t.createCallerFactory;
export const createTRPCRouter = t.router;
export const mergeRouters = t.mergeRouters;
export const middleware = t.middleware;
export const procedure = t.procedure;
