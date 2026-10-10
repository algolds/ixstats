/** @jest-environment node */
// Forum phase 4 (I3): under --production the runners load `.env.production.local` first, so production's
// DATABASE_URL and UPLOAD_DIR win over a stale `.env`.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DEFAULT_ENV_FILES, envFiles, PRODUCTION_ENV_FILE } from "../../../scripts/lib/env-files";
import { parseExportArgs } from "../../../scripts/migrations/export-xenforo-forum-args";
import { parseLegacyRedirectArgs } from "../../../scripts/ops/forum-legacy-redirect-args";

const RUNNERS = [
  "scripts/migrations/import-xenforo-forum.ts",
  "scripts/migrations/export-xenforo-forum.ts",
  "scripts/ops/forum-legacy-redirect.ts",
];

describe("envFiles", () => {
  it("loads the production file first under --production, else the default files only", () => {
    expect(envFiles(["--snapshot", "d"])).toEqual([...DEFAULT_ENV_FILES]);
    expect(envFiles(["--snapshot", "d", "--production"])).toEqual([
      PRODUCTION_ENV_FILE,
      ".env.local.dev",
      ".env.local",
      ".env",
    ]);
    expect(envFiles(["--production-ish"])).toEqual([...DEFAULT_ENV_FILES]);
  });
});

describe("the forum phase 4 runners", () => {
  it.each(RUNNERS)("%s: load-runner-env is its first import", (file) => {
    const source = fs.readFileSync(path.join(process.cwd(), file), "utf8");
    const imports = source.match(/^import .*$/gm) ?? [];
    expect(imports[0]).toBe('import "../lib/load-runner-env";');
    expect(source).not.toMatch(/dotenv|lib\/load-env"/);
  });
});

describe("scripts/lib/load-runner-env", () => {
  const KEYS = ["DATABASE_URL", "UPLOAD_DIR"] as const;
  const saved = Object.fromEntries(KEYS.map((key) => [key, process.env[key]]));
  const savedArgv = process.argv;
  const cwd = process.cwd();
  let dir = "";

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "runner-env-"));
    for (const key of KEYS) delete process.env[key];
    fs.writeFileSync(
      path.join(dir, ".env"),
      "DATABASE_URL=postgresql://h/stale\nUPLOAD_DIR=/stale\n"
    );
    fs.writeFileSync(path.join(dir, PRODUCTION_ENV_FILE), "DATABASE_URL=postgresql://h/ixstats\n");
    process.chdir(dir);
  });

  afterEach(() => {
    process.chdir(cwd);
    process.argv = savedArgv;
    fs.rmSync(dir, { recursive: true, force: true });
    for (const key of KEYS) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  });

  const load = (argv: string[]) => {
    process.argv = ["bun", "runner.ts", ...argv];
    jest.isolateModules(() => {
      require("../../../scripts/lib/load-runner-env");
    });
    return { db: process.env.DATABASE_URL, uploads: process.env.UPLOAD_DIR };
  };

  it("lets the production file win under --production, the other files filling the rest", () => {
    expect(load(["--production", "on"])).toEqual({
      db: "postgresql://h/ixstats",
      uploads: "/stale",
    });
  });

  it("ignores the production file without --production", () => {
    expect(load(["on"])).toEqual({ db: "postgresql://h/stale", uploads: "/stale" });
  });
});

describe("parseLegacyRedirectArgs", () => {
  it("takes --production before or after the verb", () => {
    for (const argv of [
      ["--production", "on"],
      ["on", "--production"],
      ["--", "--production", "off"],
    ]) {
      expect(parseLegacyRedirectArgs(argv)).toEqual({
        command: argv.includes("on") ? "on" : "off",
        production: true,
      });
    }
    expect(parseLegacyRedirectArgs(["status"])).toEqual({ command: "status", production: false });
    expect(parseLegacyRedirectArgs(["--production", "status"])).toEqual({
      command: "status",
      production: true,
    });
  });

  it("refuses anything else with the usage line", () => {
    for (const argv of [[], ["toggle"], ["on", "off"], ["on", "--prod"], ["--production"]]) {
      expect(parseLegacyRedirectArgs(argv)).toEqual({ error: expect.stringMatching(/^Usage:/) });
    }
  });
});

describe("parseExportArgs", () => {
  it("accepts --production anywhere and keeps the defaults", () => {
    expect(parseExportArgs(["--production", "--out", "snap"])).toEqual({
      out: "snap",
      rps: 0.9,
      nodes: null,
      resetFilter: false,
      attachments: true,
      maxAttachmentMb: 25,
      bypass: "auto",
      retryMismatch: false,
      skipFailing: false,
      production: true,
    });
    expect(
      parseExportArgs(["--out", "snap", "--nodes", "12,13", "--no-bypass-permissions"])
    ).toMatchObject({
      nodes: [12, 13],
      bypass: false,
      production: false,
    });
    expect(parseExportArgs(["--out", "snap", "--retry-mismatch", "--skip-failing"])).toMatchObject({
      retryMismatch: true,
      skipFailing: true,
    });
  });

  it("needs --out and positive numbers", () => {
    expect(() => parseExportArgs(["--production"])).toThrow(/--out/);
    expect(() => parseExportArgs(["--out", "--production"])).toThrow(/--out/);
    expect(() => parseExportArgs(["--out", "s", "--rps", "0"])).toThrow(/--rps/);
  });
});
