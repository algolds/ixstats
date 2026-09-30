/** @jest-environment node */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { evaluate } from "../../../scripts/verification/check-entrypoints";
import {
  findGrowth,
  findPassing,
  loadQuarantine,
  parseArgs,
  parseQuarantine,
  QUARANTINE_PATH,
  toIgnorePattern,
  validateQuarantine,
  type QuarantineEntry,
  type QuarantineFile,
} from "../../../scripts/verification/run-jest-with-quarantine";

const rootDir = path.resolve(__dirname, "../../..");
const thisFile = path.relative(rootDir, __filename);
const otherFile = "src/tests/scripts/verification-gates.test.ts";

function entry(entryPath: string, owner = "plan 326"): QuarantineEntry {
  return { path: entryPath, reason: "pre-existing failure", owner };
}

function quarantine(tests: QuarantineEntry[], entrypoints: QuarantineEntry[] = []): QuarantineFile {
  return { ceiling: tests.length, tests, entrypoints };
}

describe("run-jest-with-quarantine", () => {
  describe("validateQuarantine", () => {
    it("returns no errors for a valid quarantine whose paths exist", () => {
      const q = quarantine([entry(thisFile), entry(otherFile)], [entry("server.mjs")]);
      expect(validateQuarantine(q, rootDir)).toEqual([]);
    });

    it("flags a ceiling that does not match the number of tests", () => {
      const q = { ...quarantine([entry(thisFile)]), ceiling: 2 };
      expect(validateQuarantine(q, rootDir)).toEqual([
        "ceiling is 2 but tests has 1 entries; they must match",
      ]);
    });

    it("flags duplicate paths", () => {
      const q = quarantine([entry(thisFile), entry(thisFile)]);
      expect(validateQuarantine(q, rootDir)).toEqual([`duplicate path: ${thisFile}`]);
    });

    it("flags a path that does not exist on disk", () => {
      const q = quarantine([entry("src/tests/does-not-exist.test.ts")]);
      expect(validateQuarantine(q, rootDir)).toEqual([
        "path does not exist: src/tests/does-not-exist.test.ts",
      ]);
    });

    it("flags an empty owner", () => {
      const q = quarantine([entry(thisFile, " ")]);
      expect(validateQuarantine(q, rootDir)).toEqual([`empty owner: ${thisFile}`]);
    });

    it("accepts the checked-in test-quarantine.json", () => {
      const q = loadQuarantine(path.join(rootDir, QUARANTINE_PATH));
      expect(validateQuarantine(q, rootDir)).toEqual([]);
    });
  });

  describe("parseQuarantine", () => {
    it("throws on a malformed quarantine file", () => {
      expect(() =>
        parseQuarantine('{"ceiling":0,"tests":[{"path":"a"}],"entrypoints":[]}', "x")
      ).toThrow(/tests\[0\]/);
      expect(() => parseQuarantine('{"tests":[],"entrypoints":[]}', "x")).toThrow(/ceiling/);
    });
  });

  describe("findGrowth", () => {
    it("reports a path added relative to the base", () => {
      const base = quarantine([entry("a.test.ts")]);
      const current = quarantine([entry("a.test.ts"), entry("b.test.ts")]);
      expect(findGrowth(current, base)).toEqual([
        "b.test.ts is not quarantined on the base branch; the quarantine may only shrink",
      ]);
    });

    it("reports nothing when the current quarantine is a subset of the base", () => {
      const base = quarantine([entry("a.test.ts"), entry("b.test.ts")], [entry("server.mjs")]);
      const current = quarantine([entry("b.test.ts")]);
      expect(findGrowth(current, base)).toEqual([]);
    });
  });

  describe("toIgnorePattern", () => {
    it("anchors at <rootDir> and escapes regex characters", () => {
      expect(toIgnorePattern("src/tests/a.b.test.ts")).toBe(
        "<rootDir>/src/tests/a\\.b\\.test\\.ts$"
      );
    });

    it("matches only the quarantined file, not a sibling with a longer name", () => {
      const pattern = new RegExp(toIgnorePattern("src/a.test.ts").replace("<rootDir>", "/repo"));
      expect(pattern.test("/repo/src/a.test.ts")).toBe(true);
      expect(pattern.test("/repo/src/a.test.tsx")).toBe(false);
      expect(pattern.test("/repo/src/aXtest.ts")).toBe(false);
    });
  });

  describe("parseArgs", () => {
    it("consumes --compare-base and --verify-quarantine and forwards everything else to Jest", () => {
      expect(parseArgs(["--", "--compare-base", "origin/v2", "--verbose"])).toEqual({
        compareBase: "origin/v2",
        verify: false,
        jestArgs: ["--verbose"],
      });
      expect(parseArgs(["--verify-quarantine"])).toEqual({
        compareBase: null,
        verify: true,
        jestArgs: [],
      });
    });
  });

  describe("findPassing", () => {
    it("lists quarantined files whose Jest result passed", () => {
      const report = {
        testResults: [
          { name: path.join(rootDir, "a.test.ts"), status: "passed" },
          { name: path.join(rootDir, "b.test.ts"), status: "failed" },
        ],
      };
      const tests = [entry("a.test.ts"), entry("b.test.ts"), entry("c.test.ts")];
      expect(findPassing(tests, report, rootDir)).toEqual(["a.test.ts"]);
    });
  });
});

describe("check-entrypoints evaluate", () => {
  const knownBroken = new Map([["server.mjs", "plan 330"]]);

  it("errors when an unlisted entrypoint fails to parse", () => {
    const result = evaluate(
      [{ file: "cron-runner.mjs", ok: false, output: "SyntaxError" }],
      knownBroken
    );
    expect(result.errors).toEqual(["cron-runner.mjs fails node --check:\nSyntaxError"]);
    expect(result.warnings).toEqual([]);
  });

  it("warns when a quarantined entrypoint still fails to parse", () => {
    const result = evaluate(
      [{ file: "server.mjs", ok: false, output: "SyntaxError" }],
      knownBroken
    );
    expect(result).toEqual({ errors: [], warnings: ["server.mjs still broken (owner: plan 330)"] });
  });

  it("errors when a quarantined entrypoint parses again", () => {
    const result = evaluate([{ file: "server.mjs", ok: true, output: "" }], knownBroken);
    expect(result).toEqual({
      errors: ["server.mjs now parses — remove it from test-quarantine.json entrypoints"],
      warnings: [],
    });
  });

  it("reports nothing for a passing unlisted entrypoint", () => {
    const result = evaluate([{ file: "ws-backend.mjs", ok: true, output: "" }], knownBroken);
    expect(result).toEqual({ errors: [], warnings: [] });
  });

  it("the real check passes against the checked-in quarantine", () => {
    const script = path.join(rootDir, "scripts/verification/check-entrypoints.ts");
    const result = spawnSync("bun", [script], { cwd: rootDir, encoding: "utf-8" });
    expect(result.status).toBe(0);
  });
});
