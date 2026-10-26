/** @jest-environment node */
import fs from "fs";
import path from "path";
/**
 * A9: the WikiOS sync, mirror and save suites run in both modes, `v1` (WIKIOS_V1_ENABLED on) and `editing-switch` (the
 * admin switch on, v1 off), because the paths differ between them. A suite passes when it calls
 * `describeEachWikiosMode`, or when it uses `describe.each(WIKIOS_MODES)` with `seedWikiosMode` (the form for suites
 * with in-memory tables). See src/tests/helpers/wikios-modes.ts.
 *
 * The suites are found by name, so a new suite of the same family is held to the rule without editing this file. A
 * suite that reads neither the database nor either switch goes on EXEMPT with its reason.
 */
const TESTS = path.resolve(__dirname, "..");

/** The families of Tasks 2 and 5 to 15 of the data-safety plan, by file name. */
const FAMILY_PREFIX = /^(conflict|inbound|mirror|save)-/;
const FAMILY_NAMES = new Set([
  "article-repository",
  "article-head",
  "auto-sync-service",
  "wikios-edit-conflict",
  "revert-conflict",
]);

/**
 * The plan's own list: each must exist and be found by the glob, so a rename that drops one out of the families fails
 * here instead of silently leaving the ratchet.
 */
const REQUIRED = [
  "lib/wiki-os/article-repository.test.ts",
  "lib/wiki-os/article-head.test.ts",
  "lib/wiki-os/auto-sync-service.test.ts",
  "lib/wiki-os/conflict-log.test.ts",
  "lib/wiki-os/conflict-notices.test.ts",
  "lib/wiki-os/conflict-restore.test.ts",
  "lib/wiki-os/conflict-rule.test.ts",
  "lib/wiki-os/inbound-dead-letters.test.ts",
  "lib/wiki-os/inbound-log-events.test.ts",
  "lib/wiki-os/inbound-quarantined-parents.test.ts",
  "lib/wiki-os/mirror-page-ops.test.ts",
  "lib/wiki-os/mirror-revision.test.ts",
  "lib/wiki-os/mirror-worker.test.ts",
  "lib/wiki-os/save-concurrency.test.ts",
  "lib/wiki-os/save-rate-limit.test.ts",
  "scenarios/wikios/inbound-quarantine.test.ts",
  "scenarios/wikios/inbound-sync-mirror.test.ts",
  "server/api/routers/wikios-edit-conflict.test.ts",
];

/** Suites of the families that read neither the database nor either switch, each with the reason. */
const EXEMPT: Record<string, string> = {
  // pickRunnable and pickBatch are pure; the queue's writes go to a mocked db and the worker is mocked out
  "lib/wiki-os/mirror-queue.test.ts": "pure queue ordering; no switch is read",
  // noticeCopy and lossOf build strings from PageChange values
  "lib/wiki-os/conflict-notice-copy.test.ts": "pure notice copy",
  // latestClassicDelete reads only classic's delete log, through a mocked client; db is an empty object
  "lib/wiki-os/mirror-history.test.ts": "reads classic's log only",
  // saveFailureMessage maps an error to the editor's sentence
  "lib/wiki-os/editor/save-failure.test.ts": "pure error-to-message mapping",
  // the four below render a component over a mocked tRPC client: no database, no switch reaches them
  "components/wiki-os/revert-conflict.test.tsx": "UI over mocked tRPC",
  "components/wiki-os/conflict-log-section.test.tsx": "UI over mocked tRPC",
  "components/wiki-os/inbound-quarantine-section.test.tsx": "UI over mocked tRPC",
  "components/wiki-os/mirror-status-section.test.tsx": "UI over mocked tRPC",
};

const SUITE = /\.test\.tsx?$/;

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return SUITE.test(entry.name) ? [full] : [];
  });
}

function inFamily(file: string): boolean {
  const name = path.basename(file).replace(SUITE, "");
  return FAMILY_PREFIX.test(name) || FAMILY_NAMES.has(name);
}

/** True when the source runs its cases in both WikiOS modes. */
function runsBothModes(source: string): boolean {
  if (/\bdescribeEachWikiosMode\s*\(/.test(source)) return true;
  return (
    /\bdescribe\.each\(\s*WIKIOS_MODES\s*\)/.test(source) && /\bseedWikiosMode\s*\(/.test(source)
  );
}

const family = walk(TESTS)
  .filter(inFamily)
  .map((file) => path.relative(TESTS, file).split(path.sep).join("/"))
  .sort();
const read = (relative: string) => fs.readFileSync(path.join(TESTS, relative), "utf8");

describe("WikiOS data-safety suites run in both modes (A9)", () => {
  it("finds every suite of the plan's list by its name", () => {
    expect(REQUIRED.filter((suite) => !family.includes(suite))).toEqual([]);
  });

  it("every suite of the families runs both modes, or is exempt with a reason", () => {
    const singleMode = family.filter((suite) => !(suite in EXEMPT) && !runsBothModes(read(suite)));
    expect(singleMode).toEqual([]);
  });

  it("an exemption names a suite of the families that still runs one mode, and says why", () => {
    for (const [suite, reason] of Object.entries(EXEMPT)) {
      expect([suite, family.includes(suite)]).toEqual([suite, true]);
      expect([suite, runsBothModes(read(suite))]).toEqual([suite, false]);
      expect(reason.trim()).not.toBe("");
    }
  });

  it("recognises both accepted forms, and neither half of the second alone", () => {
    expect(runsBothModes('describeEachWikiosMode("saves", (mode) => {})')).toBe(true);
    expect(
      runsBothModes(
        'describe.each(WIKIOS_MODES)("x [%s]", (mode) => { restore = await seedWikiosMode(db, mode); })'
      )
    ).toBe(true);
    expect(runsBothModes('describe.each(WIKIOS_MODES)("x [%s]", () => {})')).toBe(false);
    expect(runsBothModes('restore = await seedWikiosMode(db, "v1");')).toBe(false);
    expect(runsBothModes('import { describeEachWikiosMode } from "x";')).toBe(false);
  });
});
