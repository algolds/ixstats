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

describe("atlasError", () => {
  it("maps a MapImportError to its code", () => {
    expect(() => atlasError(new MapImportError("CONFLICT", "busy"))).toThrow(
      expect.objectContaining({ code: "CONFLICT", message: "busy" })
    );
  });

  it("maps a ZodError to BAD_REQUEST", () => {
    try {
      atlasError(new ZodError([]));
    } catch (error) {
      expect(error).toBeInstanceOf(TRPCError);
      expect(error).toMatchObject({
        code: "BAD_REQUEST",
        message: expect.stringMatching(/stored settings/i),
      });
    }
    expect.assertions(2);
  });

  it("rethrows anything else", () => {
    const other = new Error("boom");
    expect(() => atlasError(other)).toThrow(other);
  });
});
