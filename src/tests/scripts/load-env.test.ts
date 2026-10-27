/** @jest-environment node */
// Plan 415 review (m7): a script that reads `wikiosConfig` must load its env files BEFORE `config.ts` runs, which
// builds the config from `process.env` when it loads. `scripts/lib/load-env.ts` does that as a first import.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const SCRIPTS = [
  "scripts/sync-ixwiki-live.ts",
  "scripts/sync-ixwiki-media.ts",
  "scripts/sync-ixwiki-full.ts",
  "scripts/audit/audit-wikios-parity.ts",
];

describe("the scripts that build wikiosConfig", () => {
  it.each(SCRIPTS)("%s: load-env is its first import and nothing loads dotenv after it", (file) => {
    const source = fs.readFileSync(path.join(process.cwd(), file), "utf8");
    const imports = source.match(/^import .*$/gm) ?? [];

    expect(imports[0]).toMatch(/^import "(?:\.\/|\.\.\/)lib\/load-env";/);
    expect(source).not.toMatch(/dotenv/);
  });
});

describe("scripts/lib/load-env", () => {
  const KEYS = ["NEXT_PUBLIC_MEDIAWIKI_URL", "WIKIOS_MEDIAWIKI_BOT_USER"] as const;
  const saved = Object.fromEntries(KEYS.map((key) => [key, process.env[key]]));
  const cwd = process.cwd();
  let dir = "";

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "load-env-"));
    for (const key of KEYS) delete process.env[key];
  });

  afterEach(() => {
    process.chdir(cwd);
    fs.rmSync(dir, { recursive: true, force: true });
    for (const key of KEYS) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  });

  it("makes wikiosConfig see the files, in the old order (the first file to set a variable wins)", () => {
    fs.writeFileSync(path.join(dir, ".env.local.dev"), "NEXT_PUBLIC_MEDIAWIKI_URL=https://dev.wiki.test\n");
    fs.writeFileSync(path.join(dir, ".env.local"), "NEXT_PUBLIC_MEDIAWIKI_URL=https://local.wiki.test\nWIKIOS_MEDIAWIKI_BOT_USER=Bot@one\n");
    fs.writeFileSync(path.join(dir, ".env"), "WIKIOS_MEDIAWIKI_BOT_USER=Bot@two\n");
    process.chdir(dir);

    let loaded: { publicBaseUrl: string; mediawiki: { botUser: string | undefined } } | null = null;
    jest.isolateModules(() => {
      require("../../../scripts/lib/load-env");
      loaded = require("~/lib/wiki-os/config").wikiosConfig;
    });

    expect(loaded).toMatchObject({
      publicBaseUrl: "https://dev.wiki.test",
      mediawiki: { botUser: "Bot@one" },
    });
  });
});
