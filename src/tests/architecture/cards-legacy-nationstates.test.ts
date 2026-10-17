/** Card surfaces the cards refresh removed (spec §2.4) stay gone: nationstates. */
import { existsSync } from "node:fs";

describe("removed card surfaces", () => {
  it("has no old NationStates suite, sync router or health monitor (Task 11)", () => {
    expect(existsSync("src/app/admin/cards/NSImportSuiteAdmin.tsx")).toBe(false);
    expect(existsSync("src/server/api/routers/ns-import/sync.ts")).toBe(false);
    expect(existsSync("src/lib/nationstates/sync-monitor.ts")).toBe(false);
  });
});
