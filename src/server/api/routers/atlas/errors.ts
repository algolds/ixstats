/**
 * Map import services throw MapImportError (and zod errors for stored settings), the preset and realm creation
 * services their own coded errors; Atlas answers them all as tRPC errors.
 */
import { TRPCError } from "@trpc/server";
import { ZodError } from "zod";
import { MapImportError } from "~/server/modules/maps/map-import.realm";
import { WorldPresetError } from "~/server/modules/maps/world-presets";
import { RealmCreateError } from "~/server/modules/realms/realms.create-from-world";

export function atlasError(error: Error): never {
  if (
    error instanceof MapImportError ||
    error instanceof WorldPresetError ||
    error instanceof RealmCreateError
  )
    throw new TRPCError({ code: error.code, message: error.message });
  if (error instanceof ZodError) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "The stored settings are not valid",
    });
  }
  throw error;
}
