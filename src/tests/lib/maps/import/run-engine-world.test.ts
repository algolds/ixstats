/** @jest-environment node */
import { runImportEngineInline } from "~/lib/maps/import/run-engine";
import { mapImportOptionsSchema } from "~/lib/maps/import/options";

describe("runImportEngineInline", () => {
  it("never reads a world bundle as a map", async () => {
    await expect(
      runImportEngineInline(
        "world",
        new Uint8Array([0x1f, 0x8b, 0x08]),
        mapImportOptionsSchema.parse({}),
        () => {}
      )
    ).rejects.toThrow(/World tab/);
  });
});
