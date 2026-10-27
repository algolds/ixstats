/** @jest-environment node */
import fs from "fs";
import path from "path";
/**
 * Realm time design (2026-10-25) §3: platform-wide systems (Vault, the exchange, cards, achievements, the forum and
 * ThinkPages, sports) run on real time. IxTime is Ixnay's realm clock, so none of their code imports it; a platform
 * file that reads a nation's budget year or vote stamp uses that nation's realm clock (`~/server/shared/realm-time`).
 */
const ROOT = path.resolve(__dirname, "../../..");
const PLATFORM_ROOTS = [
  "src/lib/vault",
  "src/server/modules/vault",
  "src/server/api/routers/vault",
  "src/components/vault",
  "src/app/vault",
  "src/lib/exchange",
  "src/server/api/routers/exchange",
  "src/components/exchange",
  "src/lib/cards",
  "src/server/modules/cards",
  "src/server/api/routers/cards",
  "src/lib/achievements",
  "src/components/achievements",
  "src/components/thinkpages",
  "src/components/thinkpages-forum",
  "src/server/api/routers/thinkpages",
  "src/server/api/routers/thinkpagesForum",
  "src/server/modules/thinkpages-forum",
  "src/lib/sports",
  "src/server/api/routers/sports",
  "src/components/sports",
  "src/components/halo/plugins/sports",
  "src/app/myclub",
];
const IXTIME_IMPORT = /from\s+["'](~\/lib\/ixtime|(\.\.\/)+ixtime)(\/[\w-]+)?["']/;

function walk(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return /\.(ts|tsx)$/.test(entry.name) ? [full] : [];
  });
}

describe("platform systems run on real time", () => {
  it("no platform file imports IxTime", () => {
    const offenders = PLATFORM_ROOTS.flatMap((dir) => walk(path.join(ROOT, dir)))
      .map((file) => path.relative(ROOT, file))
      .filter((file) => IXTIME_IMPORT.test(fs.readFileSync(path.join(ROOT, file), "utf8")));
    expect(offenders).toEqual([]);
  });

  it("the guard recognises the import forms in use", () => {
    for (const line of [
      'import { IxTime } from "~/lib/ixtime";',
      'import { IxTime } from "../ixtime";',
      'import { roundToIxDay } from "~/lib/ixtime/day";',
    ]) {
      expect(IXTIME_IMPORT.test(line)).toBe(true);
    }
  });
});
