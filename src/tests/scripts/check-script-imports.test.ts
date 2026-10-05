import { describe, it, expect } from "@jest/globals";
import {
  collectTargets,
  extractScriptTargets,
} from "../../../scripts/verification/check-script-imports";

describe("check-script-imports target extraction", () => {
  it("finds scripts run with bun, tsx and node", () => {
    expect(extractScriptTargets("bun scripts/set-admin-role.ts")).toEqual([
      "scripts/set-admin-role.ts",
    ]);
    expect(extractScriptTargets("bunx tsx ./scripts/a.ts && node scripts/b.mjs")).toEqual([
      "scripts/a.ts",
      "scripts/b.mjs",
    ]);
  });

  it("ignores package scripts and shell scripts", () => {
    expect(extractScriptTargets("bun run db:generate && ./scripts/deploy.sh")).toEqual([]);
  });

  it("maps each file to the package scripts that run it", () => {
    const targets = collectTargets({
      "wiki:sync:full": "bun scripts/sync-ixwiki-full.ts",
      "wiki:sync:full:force": "bun scripts/sync-ixwiki-full.ts --force",
    });
    expect(targets.get("scripts/sync-ixwiki-full.ts")).toEqual([
      "wiki:sync:full",
      "wiki:sync:full:force",
    ]);
  });
});
