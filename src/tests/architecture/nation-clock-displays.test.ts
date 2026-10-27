/** @jest-environment node */
import fs from "fs";
import path from "path";
/**
 * Realm time design (2026-10-25) §1, 10-14 spec §4: a nation's pages (MyCountry, the country profile, the executive
 * components, action links) show its time on its realm's clock (`useNationClock`, `useCountryClock`), never the
 * global IxTime: no import of `~/lib/ixtime` or the IxTime store, no `getCurrentIxTime`, and no budget year read
 * without the nation's clock. `IXNAY_ONLY` lists views that are Ixnay's by design; it may only shrink.
 */
const ROOT = path.resolve(__dirname, "../../..");
const NATION_ROOTS = [
  "src/components/mycountry",
  "src/components/country-profile",
  "src/components/executive",
  "src/components/action-links",
  "src/app/countries",
];
const IXNAY_ONLY: string[] = [];

const GLOBAL_CLOCK = [
  /from\s+["'](~\/lib\/ixtime|(\.\.\/)+(lib\/)?ixtime)(\/[\w-]+)?["']/,
  /from\s+["']~\/stores\/ixtime-store["']/,
  /from\s+["']~\/context\/IxTimeContext["']/,
  /getCurrentIxTime/,
  /currentBudgetYear\(\)/,
];

function walk(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return /\.(ts|tsx)$/.test(entry.name) ? [full] : [];
  });
}

const readsGlobalClock = (source: string) => GLOBAL_CLOCK.some((rule) => rule.test(source));

describe("a nation's pages read its realm clock", () => {
  it("no nation view reads the global IxTime", () => {
    const offenders = NATION_ROOTS.flatMap((dir) => walk(path.join(ROOT, dir)))
      .map((file) => path.relative(ROOT, file))
      .filter((file) => !IXNAY_ONLY.includes(file))
      .filter((file) => readsGlobalClock(fs.readFileSync(path.join(ROOT, file), "utf8")));
    expect(offenders).toEqual([]);
  });

  it("the Ixnay-only exceptions still read IxTime (drop them from the list once moved)", () => {
    for (const file of IXNAY_ONLY) {
      expect(readsGlobalClock(fs.readFileSync(path.join(ROOT, file), "utf8"))).toBe(true);
    }
  });

  it("the guard recognises the forms in use", () => {
    for (const line of [
      'import { IxTime } from "~/lib/ixtime";',
      'import { getIxCutoff } from "~/lib/ixtime/range";',
      'import { useIxTimeStore } from "~/stores/ixtime-store";',
      "const now = IxTime.getCurrentIxTime();",
      "const t = api.system.getCurrentIxTime.useQuery();",
      "const year = currentBudgetYear();",
    ]) {
      expect(readsGlobalClock(line)).toBe(true);
    }
    expect(readsGlobalClock("const year = currentBudgetYear(clock.now());")).toBe(false);
    expect(readsGlobalClock('import type { TimeRange } from "~/types/ixtime";')).toBe(false);
  });
});
