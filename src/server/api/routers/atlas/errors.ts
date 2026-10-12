/** Map import services throw MapImportError (and zod errors for stored settings); Atlas answers them as tRPC errors. */
import { TRPCError } from "@trpc/server";
import { ZodError } from "zod";
import { MapImportError } from "~/server/modules/maps/map-import.realm";

export function atlasError(error: Error): never {
  if (error instanceof MapImportError)
    throw new TRPCError({ code: error.code, message: error.message });
  if (error instanceof ZodError) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "The job's stored settings are not valid",
    });
  }
  throw error;
}
