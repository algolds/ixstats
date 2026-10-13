/** @jest-environment node */
/** atlasError: service errors become tRPC errors. */
jest.mock("~/env", () => ({
  env: { DATABASE_URL: "file:./test.db", NODE_ENV: "test", CRON_ENABLED_JOBS: "" },
}));
jest.mock("~/server/db", () => ({ db: {} }));

import { TRPCError } from "@trpc/server";
import { ZodError } from "zod";
import { atlasError } from "~/server/api/routers/atlas/errors";
import { MapImportError } from "~/server/modules/maps/map-import.realm";
import { WorldPresetError } from "~/server/modules/maps/world-presets";
import { RealmCreateError } from "~/server/modules/realms/realms.create-from-world";

describe("atlasError", () => {
  it("maps a MapImportError to its code", () => {
    expect(() => atlasError(new MapImportError("CONFLICT", "busy"))).toThrow(
      expect.objectContaining({ code: "CONFLICT", message: "busy" })
    );
  });

  it.each([
    ["a WorldPresetError", new WorldPresetError("NOT_FOUND", "no such preset"), "NOT_FOUND"],
    ["a RealmCreateError", new RealmCreateError("CONFLICT", "slug taken"), "CONFLICT"],
  ])("maps %s to its code, as the preset and Studio routers do", (_name, error, code) => {
    expect(() => atlasError(error)).toThrow(
      expect.objectContaining({ code, message: error.message })
    );
  });

  it("maps a ZodError to BAD_REQUEST", () => {
    try {
      atlasError(new ZodError([]));
    } catch (error) {
      expect(error).toBeInstanceOf(TRPCError);
      expect(error).toMatchObject({
        code: "BAD_REQUEST",
        message: "The stored settings are not valid",
      });
    }
    expect.assertions(2);
  });

  it("rethrows anything else", () => {
    const other = new Error("boom");
    expect(() => atlasError(other)).toThrow(other);
  });
});
