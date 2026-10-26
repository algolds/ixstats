/**
 * @jest-environment node
 *
 * The pure parts of the `wikios-proof` CLI (scripts/audit/wikios-proof.ts): the three profiles and the harness
 * commands they run, the environment each profile insists on, the arguments, the git tree state, the checks the CLI
 * adds around the gate (harness exits, render state recorded, every namespace), pruning, and the pre-deploy lines.
 * `main()` is never run here.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  DEFAULT_KEEP,
  HARNESS_SCRIPTS,
  assertProfileEnvironment,
  benchPageList,
  evaluateBench,
  evaluatePredeploy,
  evaluateProof,
  parseCli,
  leaseCheck,
  parseThresholds,
  predeployFilesToPrune,
  predeployReport,
  profileCommands,
  releasesLease,
  profileDefaults,
  proofStamp,
  resolveRunConfig,
  runsToPrune,
  treeState,
  wikiosTreeKey,
  type Check,
  type ParityReport,
  type ProofThresholds,
  type RoundTripReport,
} from "../../../scripts/lib/wikios-proof-gate";

const THRESHOLDS_FILE = resolve(__dirname, "../../../scripts/audit/wikios-proof-thresholds.json");
const thresholds = (): ProofThresholds => parseThresholds(readFileSync(THRESHOLDS_FILE, "utf8"));

const PROOF_DB = "postgresql://postgres:secret@localhost:5433/ixstats_proof?connection_limit=5";

const SERVER_ENV = {
  NODE_ENV: "production",
  DATABASE_URL: "postgresql://postgres:secret@localhost:5433/ixstats",
  WIKIOS_MEDIAWIKI_INTERNAL_URL: "http://127.0.0.1:8081/api.php",
  NEXT_PUBLIC_MEDIAWIKI_URL: "https://ixwiki.com",
  NEXT_PUBLIC_APP_URL: "https://ixwiki.com/ignored/path",
  BASE_PATH: "/projects/ixstates",
  PORT: "3550",
};

const flagValue = (argv: readonly string[], flag: string): string | undefined => {
  const index = argv.indexOf(flag);
  return index === -1 ? undefined : argv[index + 1];
};

const byName = (checks: readonly Check[], name: string): Check => {
  const check = checks.find((c) => c.name === name);
  if (!check) throw new Error(`no check ${name} in ${checks.map((c) => c.name).join(", ")}`);
  return check;
};

const failing = (checks: readonly Check[]): string[] =>
  checks.filter((c) => !c.passed && c.skipped === null).map((c) => c.name);

function localConfig(): ReturnType<typeof resolveRunConfig> {
  return resolveRunConfig(
    "local",
    {},
    { DATABASE_URL: PROOF_DB },
    ".bench-out/proof/20261025-1200-local"
  );
}

// ---------------------------------------------------------------------------
// Profiles and commands
// ---------------------------------------------------------------------------

describe("profileCommands", () => {
  it("profileCommands for local matches the scripts' flags, with parity every 2000 ms and bench checks skipped", () => {
    const cfg = localConfig();
    const commands = profileCommands(cfg);
    expect(commands.map((c) => c.name)).toEqual(["roundtrip", "parity", "bench"]);
    const [roundtrip, parity, bench] = commands;
    const dir = ".bench-out/proof/20261025-1200-local";

    expect(roundtrip.argv).toEqual([
      HARNESS_SCRIPTS.roundtrip,
      "--source",
      "db",
      "--namespaces",
      "all",
      "--limit",
      "1000000",
      "--out",
      `${dir}/roundtrip.json`,
    ]);
    expect(roundtrip.out).toBe(`${dir}/roundtrip.json`);

    expect(parity.argv).toEqual([
      HARNESS_SCRIPTS.parity,
      "--mw-api",
      "https://ixwiki.com/api.php",
      "--wikios",
      "http://localhost:3200",
      "--pages",
      `${dir}/corpus-titles.json`,
      "--sample",
      "500",
      "--interval-ms",
      "2000",
      "--out",
      `${dir}/parity.json`,
    ]);

    expect(bench.argv).toEqual([
      HARNESS_SCRIPTS.bench,
      "--mw",
      "https://ixwiki.com",
      "--wikios",
      "http://localhost:3200",
      "--pages",
      `${dir}/bench-pages.json`,
      "--runs",
      "2",
      "--interval-ms",
      "2000",
      "--out",
      `${dir}/bench.json`,
    ]);

    // Review Focus 7: nothing the local profile runs asks classic more often than every 2 s.
    for (const command of commands) {
      const interval = flagValue(command.argv, "--interval-ms");
      if (interval !== undefined) expect(Number(interval)).toBeGreaterThanOrEqual(2000);
    }
    expect(evaluateBench(null, thresholds(), "local").every((c) => c.skipped !== null)).toBe(true);
  });

  it("the harness script paths exist", () => {
    for (const script of Object.values(HARNESS_SCRIPTS)) {
      expect(() => readFileSync(resolve(__dirname, "../../..", script))).not.toThrow();
    }
  });

  it("the local profile refuses a parity interval under 2000 ms", () => {
    expect(() =>
      resolveRunConfig("local", { parityIntervalMs: 1999 }, { DATABASE_URL: PROOF_DB }, "d")
    ).toThrow(/2000 ms/);
    expect(
      resolveRunConfig("local", { parityIntervalMs: 2000 }, { DATABASE_URL: PROOF_DB }, "d")
        .parityIntervalMs
    ).toBe(2000);
  });

  it("parity with sample all passes no --sample, so the whole corpus is scored", () => {
    const cfg = resolveRunConfig("launch", {}, SERVER_ENV, "d");
    const parity = profileCommands(cfg)[1];
    expect(parity.argv).not.toContain("--sample");
    expect(flagValue(parity.argv, "--pages")).toBe("d/corpus-titles.json");
  });

  it("local reads the MediaWiki URL from NEXT_PUBLIC_MEDIAWIKI_URL, its origin for the bench", () => {
    const defaults = profileDefaults("local", {
      NEXT_PUBLIC_MEDIAWIKI_URL: "https://wiki.example.org/",
    });
    expect(defaults.mwApi).toBe("https://wiki.example.org/api.php");
    expect(defaults.mw).toBe("https://wiki.example.org");
    expect(defaults.wikiosPublic).toBe(defaults.wikios);
  });

  it("launch uses the loopback renderer and IxStates under its base path", () => {
    const defaults = profileDefaults("launch", SERVER_ENV);
    expect(defaults).toEqual({
      mwApi: "http://127.0.0.1:8081/api.php",
      wikios: "http://127.0.0.1:3550/projects/ixstates",
      mw: "https://ixwiki.com",
      wikiosPublic: "https://ixwiki.com/projects/ixstates",
      paritySample: "all",
      parityIntervalMs: 200,
      benchPages: 200,
      benchRuns: 2,
      benchIntervalMs: 1000,
    });
    const [, parity, bench] = profileCommands(resolveRunConfig("launch", {}, SERVER_ENV, "d"));
    expect(flagValue(parity.argv, "--mw-api")).toBe("http://127.0.0.1:8081/api.php");
    expect(flagValue(parity.argv, "--wikios")).toBe("http://127.0.0.1:3550/projects/ixstates");
    expect(flagValue(bench.argv, "--wikios")).toBe("https://ixwiki.com/projects/ixstates");
  });

  it("launch defaults the port to 3550 and the base path to none, and APP_URL wins over NEXT_PUBLIC_APP_URL", () => {
    const { PORT: _port, BASE_PATH: _base, ...env } = SERVER_ENV;
    const defaults = profileDefaults("launch", { ...env, APP_URL: "https://app.example.org/x" });
    expect(defaults.wikios).toBe("http://127.0.0.1:3550");
    expect(defaults.wikiosPublic).toBe("https://app.example.org");
  });

  it("blank or padded variables are trimmed, and a blank one counts as unset", () => {
    const defaults = profileDefaults("launch", {
      ...SERVER_ENV,
      WIKIOS_MEDIAWIKI_INTERNAL_URL: "  http://127.0.0.1:8081/api.php  ",
      PORT: "   ",
    });
    expect(defaults.mwApi).toBe("http://127.0.0.1:8081/api.php");
    expect(defaults.wikios).toBe("http://127.0.0.1:3550/projects/ixstates");
    expect(() =>
      profileDefaults("launch", { ...SERVER_ENV, WIKIOS_MEDIAWIKI_INTERNAL_URL: " " })
    ).toThrow(/WIKIOS_MEDIAWIKI_INTERNAL_URL/);
  });

  it("a server profile without IxStates' public URL refuses", () => {
    const { NEXT_PUBLIC_APP_URL: _app, ...env } = SERVER_ENV;
    expect(() => profileDefaults("launch", env)).toThrow(/APP_URL/);
  });

  it("recurring samples 200 parity pages every 500 ms and benches 50 pages once", () => {
    const defaults = profileDefaults("recurring", SERVER_ENV);
    expect(defaults).toMatchObject({
      paritySample: 200,
      parityIntervalMs: 500,
      benchPages: 50,
      benchRuns: 1,
      mwApi: "http://127.0.0.1:8081/api.php",
    });
  });

  it("flags override the profile defaults and are checked as URLs", () => {
    const cfg = resolveRunConfig(
      "local",
      { wikios: "http://localhost:3300/", paritySample: "all", benchPages: 10, benchRuns: 3 },
      { DATABASE_URL: PROOF_DB },
      "d"
    );
    expect(cfg).toMatchObject({
      wikios: "http://localhost:3300",
      paritySample: "all",
      benchPages: 10,
      benchRuns: 3,
    });
    expect(() =>
      resolveRunConfig("local", { mw: "ftp://x" }, { DATABASE_URL: PROOF_DB }, "d")
    ).toThrow(/--mw/);
    const publicUrl = { wikiosPublic: "http://localhost:3300/" };
    expect(resolveRunConfig("local", publicUrl, { DATABASE_URL: PROOF_DB }, "d").wikiosPublic).toBe(
      "http://localhost:3300"
    );
    expect(() =>
      resolveRunConfig("local", { wikiosPublic: "localhost" }, { DATABASE_URL: PROOF_DB }, "d")
    ).toThrow(/--wikios-public/);
    expect(() =>
      resolveRunConfig("local", { mwApi: "api.php" }, { DATABASE_URL: PROOF_DB }, "d")
    ).toThrow(/--mw-api/);
  });
});

describe("benchPageList", () => {
  const defaults = ["A", "B", "C"];
  const corpus = ["A", "D", "E", "F", "G", "H"];

  it("the defaults alone, the defaults plus an even corpus sample, or everything", () => {
    expect(benchPageList(defaults, corpus, "defaults")).toEqual(["A", "B", "C"]);
    expect(benchPageList(defaults, corpus, 5)).toEqual(["A", "B", "C", "D", "F"]);
    expect(benchPageList(defaults, corpus, 2)).toEqual(["A", "B"]);
    expect(benchPageList(defaults, corpus, "all")).toEqual([
      "A",
      "B",
      "C",
      "D",
      "E",
      "F",
      "G",
      "H",
    ]);
  });
});

// ---------------------------------------------------------------------------
// Environment
// ---------------------------------------------------------------------------

describe("assertProfileEnvironment", () => {
  it("the local profile refuses any database but ixstats_proof, and the tunnel port", () => {
    expect(() => assertProfileEnvironment("local", { DATABASE_URL: PROOF_DB })).not.toThrow();
    expect(() =>
      assertProfileEnvironment("local", {
        DATABASE_URL: "postgresql://u:p@127.0.0.1:5433/ixstats_proof",
      })
    ).not.toThrow();
    const refused = [
      undefined,
      "",
      "not a url",
      "postgresql://u:p@localhost:5433/ixstats",
      "postgresql://u:p@localhost:5433/ixstats_wv1",
      "postgresql://u:p@localhost:5433/ixstats_proof_old",
      "postgresql://u:p@localhost:15433/ixstats_proof",
      "postgresql://u:p@localhost/ixstats_proof",
      "postgresql://u:p@db.example.org:5433/ixstats_proof",
    ];
    for (const DATABASE_URL of refused) {
      expect(() => assertProfileEnvironment("local", { DATABASE_URL })).toThrow(
        "the local proof reads only the ixstats_proof clone"
      );
    }
  });

  it("the refusal names the host and database but never the password", () => {
    let message = "";
    try {
      assertProfileEnvironment("local", {
        DATABASE_URL: "postgresql://u:hunter2@localhost:15433/ixstats",
      });
    } catch (error) {
      message = error instanceof Error ? error.message : "";
    }
    expect(message).toContain("localhost:15433/ixstats");
    expect(message).not.toContain("hunter2");
  });

  it("launch refuses without NODE_ENV=production or the internal URL", () => {
    for (const profile of ["launch", "recurring"] as const) {
      expect(() => assertProfileEnvironment(profile, SERVER_ENV)).not.toThrow();
      expect(() =>
        assertProfileEnvironment(profile, { ...SERVER_ENV, NODE_ENV: "development" })
      ).toThrow(/NODE_ENV/);
      expect(() =>
        assertProfileEnvironment(profile, { ...SERVER_ENV, WIKIOS_MEDIAWIKI_INTERNAL_URL: " " })
      ).toThrow(/WIKIOS_MEDIAWIKI_INTERNAL_URL/);
      expect(() =>
        assertProfileEnvironment(profile, {
          ...SERVER_ENV,
          WIKIOS_MEDIAWIKI_INTERNAL_URL: "https://ixwiki.com/api.php",
        })
      ).toThrow(/WIKIOS_MEDIAWIKI_INTERNAL_URL/);
    }
  });

  it("a server profile refuses a database that is not on the server itself", () => {
    expect(() =>
      assertProfileEnvironment("launch", {
        ...SERVER_ENV,
        DATABASE_URL: "postgresql://u:p@localhost:15433/ixstats",
      })
    ).toThrow(/DATABASE_URL/);
    expect(() =>
      assertProfileEnvironment("recurring", {
        ...SERVER_ENV,
        DATABASE_URL: "postgresql://u:p@db.example.org/x",
      })
    ).toThrow(/DATABASE_URL/);
  });
});

// ---------------------------------------------------------------------------
// Arguments
// ---------------------------------------------------------------------------

describe("parseCli", () => {
  it("reads run with its overrides", () => {
    expect(
      parseCli([
        "run",
        "--profile",
        "local",
        "--wikios",
        "http://localhost:3300",
        "--parity-sample",
        "all",
        "--parity-interval-ms",
        "3000",
        "--bench-pages",
        "40",
        "--bench-runs",
        "1",
        "--keep",
        "4",
        "--out-dir",
        "x",
      ])
    ).toEqual({
      command: "run",
      profile: "local",
      overrides: {
        wikios: "http://localhost:3300",
        paritySample: "all",
        parityIntervalMs: 3000,
        benchPages: 40,
        benchRuns: 1,
      },
      outDir: "x",
      keep: 4,
    });
  });

  it("run defaults to keeping 12 and no overrides", () => {
    expect(parseCli(["run", "--profile", "recurring"])).toEqual({
      command: "run",
      profile: "recurring",
      overrides: {},
      outDir: null,
      keep: 12,
    });
  });

  it("reads gate and predeploy", () => {
    expect(
      parseCli([
        "gate",
        "--profile",
        "local",
        "--roundtrip",
        "r.json",
        "--parity",
        "p.json",
        "--bench",
        "b.json",
      ])
    ).toEqual({
      command: "gate",
      profile: "local",
      roundtrip: "r.json",
      parity: "p.json",
      bench: "b.json",
      outDir: null,
    });
    expect(
      parseCli([
        "gate",
        "--profile",
        "launch",
        "--roundtrip",
        "r",
        "--parity",
        "p",
        "--out-dir",
        "o",
      ])
    ).toEqual({
      command: "gate",
      profile: "launch",
      roundtrip: "r",
      parity: "p",
      bench: null,
      outDir: "o",
    });
    expect(parseCli(["predeploy"])).toEqual({ command: "predeploy" });
    expect(parseCli(["deployed"])).toEqual({ command: "deployed" });
  });

  it("help with no command, --help or help", () => {
    expect(parseCli([])).toEqual({ command: "help" });
    expect(parseCli(["--help"])).toEqual({ command: "help" });
    expect(parseCli(["help"])).toEqual({ command: "help" });
    expect(parseCli(["run", "--help"])).toEqual({ command: "help" });
  });

  it("rejects an unknown command, a missing or unknown profile, a flag of another command and bad numbers", () => {
    expect(() => parseCli(["deploy"])).toThrow(/command/);
    expect(() => parseCli(["run"])).toThrow(/--profile/);
    expect(() => parseCli(["run", "--profile", "prod"])).toThrow(/--profile/);
    expect(() => parseCli(["run", "--profile", "local", "--parity", "p"])).toThrow();
    expect(() => parseCli(["gate", "--profile", "local", "--parity", "p"])).toThrow(/--roundtrip/);
    expect(() => parseCli(["gate", "--profile", "local", "--roundtrip", "r"])).toThrow(/--parity/);
    expect(() => parseCli(["predeploy", "--profile", "local"])).toThrow();
    expect(() => parseCli(["deployed", "--profile", "local"])).toThrow();
    expect(() => parseCli(["run", "--profile", "local", "--keep", "0"])).toThrow(/--keep/);
    expect(() => parseCli(["run", "--profile", "local", "--bench-runs", "1.5"])).toThrow(
      /--bench-runs/
    );
    expect(() => parseCli(["run", "--profile", "local", "--parity-sample", "some"])).toThrow(
      /--parity-sample/
    );
    expect(() => parseCli(["run", "--profile", "local", "--parity-interval-ms", "-1"])).toThrow(
      /--parity-interval-ms/
    );
    expect(() => parseCli(["run", "--profile", "local", "stray"])).toThrow();
  });

  it("flags not given leave the profile's defaults in place", () => {
    const parsed = parseCli(["run", "--profile", "local", "--wikios", "http://localhost:3300"]);
    if (parsed.command !== "run") throw new Error("expected run");
    expect(Object.keys(parsed.overrides)).toEqual(["wikios"]);
    const cfg = resolveRunConfig("local", parsed.overrides, { DATABASE_URL: PROOF_DB }, "d");
    expect(cfg).toMatchObject({
      wikios: "http://localhost:3300",
      mwApi: "https://ixwiki.com/api.php",
      paritySample: 500,
      parityIntervalMs: 2000,
      benchPages: "defaults",
      benchRuns: 2,
    });
  });

  it("an interval of 0 is allowed on a server profile", () => {
    const parsed = parseCli(["run", "--profile", "launch", "--parity-interval-ms", "0"]);
    expect(parsed).toMatchObject({ overrides: { parityIntervalMs: 0 } });
  });
});

// ---------------------------------------------------------------------------
// Stamps, git and pruning
// ---------------------------------------------------------------------------

describe("proofStamp", () => {
  it("is yyyymmdd-HHMM in UTC", () => {
    expect(proofStamp(new Date("2026-03-04T05:06:59.999Z"))).toBe("20260304-0506");
    expect(proofStamp(new Date("2026-10-25T23:59:00+02:00"))).toBe("20261025-2159");
  });
});

describe("treeState", () => {
  const ok = (stdout: string) => ({ status: 0, stdout });

  it("keys the committed tree, reads the commit and the dirty flag", () => {
    const lsTree = "100644 blob abc\tsrc/lib/wiki-os/a.ts\n";
    expect(treeState(ok(lsTree), ok(""), ok("deadbeef\n"))).toEqual({
      commit: "deadbeef",
      treeKey: wikiosTreeKey(lsTree),
      dirty: false,
    });
    expect(treeState(ok(lsTree), ok(" M src/lib/wiki-os/a.ts\n"), ok("deadbeef")).dirty).toBe(true);
  });

  it("outside a git checkout the key is no-git and the tree counts as dirty", () => {
    const failed = { status: 128, stdout: "" };
    const none = { status: null, stdout: "" };
    expect(treeState(failed, ok(""), ok("x"))).toEqual({
      commit: "no-git",
      treeKey: "no-git",
      dirty: true,
    });
    expect(treeState(ok("100644 blob a\tx\n"), none, ok("x"))).toEqual({
      commit: "no-git",
      treeKey: "no-git",
      dirty: true,
    });
    expect(treeState(ok("100644 blob a\tx\n"), ok(""), failed)).toEqual({
      commit: "no-git",
      treeKey: "no-git",
      dirty: true,
    });
  });
});

describe("runsToPrune", () => {
  it("runsToPrune keeps the newest 12 server runs and never a local run", () => {
    const server = Array.from({ length: 15 }, (_, i) => {
      const day = String(i + 1).padStart(2, "0");
      return `202610${day}-0530-${i % 2 === 0 ? "recurring" : "launch"}`;
    });
    const others = [
      "20260901-0530-local",
      "predeploy-20260901-0530.json",
      "predeploy-20260901-0530.txt",
      "20260901-0530-recurring-gate",
      "notes",
    ];
    const shuffled = [...others, ...server].reverse();
    expect(runsToPrune(shuffled, 12)).toEqual(server.slice(0, 3));
    expect(runsToPrune(shuffled, 15)).toEqual([]);
    expect(runsToPrune(shuffled, 20)).toEqual([]);
    expect(runsToPrune(others, 0)).toEqual([]);
  });
});

describe("predeployFilesToPrune", () => {
  it("keeps the newest 12 predeploy runs, report and log together, and never anything else", () => {
    const stamps = Array.from(
      { length: 14 },
      (_, i) => `202610${String(i + 1).padStart(2, "0")}-0912`
    );
    const files = stamps.flatMap((stamp) => [`predeploy-${stamp}.json`, `predeploy-${stamp}.txt`]);
    const others = [
      "20260901-0530-recurring",
      "20260901-0530-local",
      "predeploy-notes.txt",
      "predeploy-20260901-0912.json.bak",
      "launch.out",
    ];
    // A report without its log (or the reverse) still counts as a run.
    const shuffled = [...others, ...files, "predeploy-20260930-2359.txt"].reverse();
    expect(DEFAULT_KEEP).toBe(12);
    expect(predeployFilesToPrune(shuffled, 12)).toEqual([
      "predeploy-20260930-2359.txt",
      "predeploy-20261001-0912.json",
      "predeploy-20261001-0912.txt",
      "predeploy-20261002-0912.json",
      "predeploy-20261002-0912.txt",
    ]);
    expect(predeployFilesToPrune(shuffled, 15)).toEqual([]);
    expect(predeployFilesToPrune(shuffled, 16)).toEqual([]);
    expect(predeployFilesToPrune(others, 0)).toEqual([]);
  });
});

describe("leaseCheck", () => {
  it("passes when the deploy took the wikios-proof lease", () => {
    expect(leaseCheck({ state: "taken" })).toEqual({
      name: "proof.lease",
      passed: true,
      skipped: null,
      measured: "taken for this deploy",
      threshold: "free: no weekly proof running",
    });
  });

  it("fails while the weekly proof holds it, saying until when", () => {
    const check = leaseCheck({
      state: "held",
      holder: "ixwiki:4242:abc",
      expiresAt: "2026-10-26T07:00:00.000Z",
    });
    expect(check.passed).toBe(false);
    expect(check.measured).toBe(
      "the weekly proof is running (lease held by ixwiki:4242:abc until 2026-10-26T07:00:00.000Z); deploy once it finishes"
    );
  });

  it("fails when the lease cannot be read or taken", () => {
    const check = leaseCheck({ state: "error", message: "relation job_leases does not exist" });
    expect(check.passed).toBe(false);
    expect(check.measured).toBe("could not take the lease: relation job_leases does not exist");
  });
});
describe("releasesLease", () => {
  it("a refused predeploy gives back the lease it took, and only then", () => {
    const held = { state: "held", holder: "x", expiresAt: "t" } as const;
    expect(releasesLease(1, { state: "taken" })).toBe(true);
    expect(releasesLease(0, { state: "taken" })).toBe(false);
    expect(releasesLease(1, held)).toBe(false);
    expect(releasesLease(1, { state: "error", message: "down" })).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Evaluation around the gate
// ---------------------------------------------------------------------------

function roundTrip(
  count: number,
  namespaces: RoundTripReport["meta"]["namespaces"] = "all"
): RoundTripReport {
  return {
    meta: { namespaces },
    skipped: [],
    pages: Array.from({ length: count }, (_, i) => ({
      title: `P${i}`,
      identical: true,
      complete: true,
    })),
  };
}

function parity(count: number, settled = true): ParityReport {
  const pages = Array.from({ length: count }, (_, i) => ({
    title: `P${i}`,
    scores: { overall: 100 },
    renderQuality: "rendered" as const,
    stale: false,
    templates: [],
  }));
  const titles = pages.map((p) => p.title);
  return { meta: settled ? { titles, settleMs: 8000 } : { titles }, pages };
}

describe("evaluateProof", () => {
  const t = thresholds();
  const good = {
    roundTrip: roundTrip(t.roundTrip.minPages),
    parity: parity(t.parity.minPages),
    bench: null,
  };

  it("full reports pass on the local profile, with the bench skipped", () => {
    const checks = evaluateProof("local", good, t, []);
    expect(failing(checks)).toEqual([]);
    expect(byName(checks, "roundTrip.namespaces").passed).toBe(true);
    expect(byName(checks, "parity.settleMs").measured).toBe("8000 ms");
  });

  it("a parity report without meta.settleMs is refused: it has no render state", () => {
    const checks = evaluateProof(
      "local",
      { ...good, parity: parity(t.parity.minPages, false) },
      t,
      []
    );
    expect(failing(checks)).toEqual(["parity.settleMs"]);
    expect(byName(checks, "parity.fallbackRenders").passed).toBe(true);
  });

  it("the local and launch profiles require a round trip of every namespace; recurring does not check it", () => {
    const articlesOnly = { ...good, roundTrip: roundTrip(t.roundTrip.minPages, [0]) };
    expect(failing(evaluateProof("local", articlesOnly, t, []))).toEqual(["roundTrip.namespaces"]);
    expect(failing(evaluateProof("launch", articlesOnly, t, []))).toContain("roundTrip.namespaces");
    const unrecorded = { ...good, roundTrip: roundTrip(t.roundTrip.minPages, null) };
    expect(byName(evaluateProof("local", unrecorded, t, []), "roundTrip.namespaces")).toMatchObject(
      {
        passed: false,
        measured: "not recorded",
      }
    );
    expect(
      evaluateProof("recurring", articlesOnly, t, []).some((c) => c.name === "roundTrip.namespaces")
    ).toBe(false);
  });

  it("a missing report fails its own check", () => {
    const checks = evaluateProof("local", { roundTrip: null, parity: null, bench: null }, t, []);
    expect(failing(checks)).toEqual(["roundTrip.report", "parity.report"]);
  });

  it("a harness that exited non-zero fails harness.<name>, and the extra checks come first", () => {
    const checks = evaluateProof("local", good, t, [
      { name: "parity", code: 1 },
      { name: "roundtrip", code: 0 },
      { name: "bench", code: null },
    ]);
    expect(failing(checks)).toEqual(["harness.parity", "harness.bench"]);
    expect(checks.slice(0, 2).map((c) => c.name)).toEqual(["harness.parity", "harness.bench"]);
    expect(byName(checks, "harness.parity").measured).toBe("exit 1");
    expect(byName(checks, "harness.bench").measured).toBe("killed");
  });
});

describe("predeploy", () => {
  const t = thresholds();

  it("evaluates the round-trip checks only, with every namespace and the harness exit", () => {
    const checks = evaluatePredeploy({ ok: true }, roundTrip(t.roundTrip.minPages), t, {
      name: "roundtrip",
      code: 0,
    });
    expect(checks.map((c) => c.name)).toEqual([
      "proof.committed",
      "roundTrip.namespaces",
      "roundTrip.pages",
      "roundTrip.nonIdentical",
      "roundTrip.incomplete",
      "roundTrip.errors",
    ]);
    expect(failing(checks)).toEqual([]);
  });

  it("a stale proof, a failed harness and a missing report each fail", () => {
    const checks = evaluatePredeploy({ ok: false, reason: "WikiOS code changed" }, null, t, {
      name: "roundtrip",
      code: 2,
    });
    expect(failing(checks)).toEqual(["proof.committed", "harness.roundtrip", "roundTrip.report"]);
    expect(byName(checks, "proof.committed").measured).toBe("WikiOS code changed");
  });

  it("prints one line per check, the failures with their fix, and exits 1 on a failure", () => {
    const checks = evaluatePredeploy(
      { ok: false, reason: "No committed proof" },
      roundTrip(t.roundTrip.minPages),
      t,
      {
        name: "roundtrip",
        code: 0,
      }
    );
    const { lines, exitCode } = predeployReport(checks, false);
    expect(exitCode).toBe(1);
    expect(lines).toHaveLength(checks.length);
    expect(lines[0]).toMatch(/^FAIL proof\.committed: No committed proof/);
    expect(lines[0]).toContain("run the local proof, docs/audits/wikios-proof/README.md");
    expect(lines[1]).toMatch(/^ok {3}roundTrip\.namespaces/);
    expect(lines.some((line) => line.includes("OVERRIDDEN"))).toBe(false);
  });

  it("WIKIOS_PROOF_OVERRIDE prints the override before each failure and exits 0", () => {
    const checks = evaluatePredeploy({ ok: false, reason: "stale" }, null, t, {
      name: "roundtrip",
      code: 0,
    });
    const { lines, exitCode } = predeployReport(checks, true);
    expect(exitCode).toBe(0);
    const failures = lines.filter((line) => line.includes("FAIL"));
    expect(failures).toHaveLength(2);
    for (const line of failures)
      expect(line.startsWith("WIKIOS PROOF OVERRIDDEN: FAIL ")).toBe(true);
  });

  it("a skipped check prints its reason and does not fail the deploy", () => {
    const skipped: Check = {
      name: "bench.p95",
      passed: false,
      skipped: "dev server: reference only",
      measured: "900 ms",
      threshold: "<= 800 ms",
    };
    const { lines, exitCode } = predeployReport([skipped], false);
    expect(lines).toEqual(["skip bench.p95: 900 ms (dev server: reference only)"]);
    expect(exitCode).toBe(0);
  });

  it("all passing exits 0 with or without the override", () => {
    const checks = evaluatePredeploy({ ok: true }, roundTrip(t.roundTrip.minPages), t, {
      name: "roundtrip",
      code: 0,
    });
    expect(predeployReport(checks, false).exitCode).toBe(0);
    expect(predeployReport(checks, true).lines.every((line) => line.startsWith("ok "))).toBe(true);
  });
});
