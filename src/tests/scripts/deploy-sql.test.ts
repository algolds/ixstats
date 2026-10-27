/** @jest-environment node */
/**
 * The deploy re-runs every hand-written SQL file it names on each release. Each must be a no-op the second time, stop
 * the deploy when it fails, and run after the backup. SQL that drops a table or converts a column type runs before
 * db push, which would otherwise refuse the drop or drop and re-add the column. The dev scripts (start-development.sh,
 * scripts/refresh-local-db.sh) run the same before-push steps in the deploy's order and stop before their push when one
 * fails, and deploy-ixworld.sh copies data/ without the tile cache (the disk-fill incident).
 *
 * Folds dev-scripts-studio-sql and deploy-ixworld-data.
 */
import { existsSync, readFileSync } from "node:fs";

const script = readFileSync("scripts/deploy-production.sh", "utf8");
const runs = [
  ...script.matchAll(/prisma db execute --schema prisma\/schema --file (\S+\.sql)(.*)/g),
].map((m) => ({
  file: m[1]!,
  rest: m[2]!,
  at: m.index,
}));
const backup = script.indexOf("bun run db:backup");
const additive = script.indexOf("bun scripts/deployment/apply-additive-schema.ts --apply || exit 1");
const push = script.indexOf("bun run db:push:force");
const build = script.indexOf("bun run build");

const sql = (file: string) =>
  readFileSync(file, "utf8")
    .replace(/--[^\n]*/g, "")
    .replace(/\s+/g, " ");
/** What a re-run executes unguarded: DO blocks (which check before they act) and function bodies stripped. */
const unguarded = (file: string) =>
  sql(file)
    .replace(/DO \$\$.*?\$\$;/g, "")
    .replace(/\$\$.*?\$\$/g, "");

const UNSAFE = [
  /CREATE TABLE (?!IF NOT EXISTS)/i,
  /ADD COLUMN (?!IF NOT EXISTS)/i,
  /CREATE (UNIQUE )?INDEX (?!IF NOT EXISTS)/i,
  /DROP (TABLE|COLUMN|INDEX|TYPE|TRIGGER|CONSTRAINT|FUNCTION) (?!IF EXISTS)/i,
  /CREATE (FUNCTION|TYPE)/i,
  /ADD CONSTRAINT/i,
  /RENAME (COLUMN|TO)/i,
];

/** The data SQL that waits for the new code to be live (run_post_deploy_sql); every other file runs before the build. */
const postDeployAt = script.indexOf("run_post_deploy_sql() {");
const postDeploy = runs.filter((run) => run.at > postDeployAt && postDeployAt > 0);
const schemaRuns = runs.filter((run) => !postDeploy.includes(run));

describe("the SQL the deploy runs", () => {
  it.each(schemaRuns)(
    "$file runs after the backup and before the build, and a failure stops the deploy",
    (run) => {
      expect(existsSync(run.file)).toBe(true);
      expect(run.rest.trim()).toBe("|| exit 1");
      expect(run.at).toBeGreaterThan(backup);
      expect(run.at).toBeLessThan(build);
    }
  );

  it.each(runs)("$file is a no-op when the deploy runs it again", ({ file }) => {
    const body = unguarded(file);
    for (const pattern of UNSAFE) expect(body).not.toMatch(pattern);
    for (const [, name] of body.matchAll(/CREATE TRIGGER (\S+)/gi)) {
      expect(body.indexOf(`DROP TRIGGER IF EXISTS ${name}`)).toBeGreaterThanOrEqual(0);
      expect(body.indexOf(`DROP TRIGGER IF EXISTS ${name}`)).toBeLessThan(
        body.indexOf(`CREATE TRIGGER ${name}`)
      );
    }
  });

  it("touches a column another deploy file drops only inside a block that checks it is still there", () => {
    // `ALTER TABLE "T" ... DROP COLUMN IF EXISTS "c"`: every re-run after the first finds the column gone
    const dropped = runs.flatMap(({ file }) =>
      [...sql(file).matchAll(/ALTER TABLE "?(\w+)"? ([^;]*)/gi)].flatMap(([, table, body]) =>
        [...body!.matchAll(/DROP COLUMN IF EXISTS "?(\w+)"?/gi)].map(([, column]) => ({
          table: table!,
          column: column!,
        }))
      )
    );
    expect(dropped).toContainEqual({ table: "MilitaryUnit", column: "readiness" });
    // A write to the table that names the column (the statement's target, so a join's alias is not mistaken for it)
    const writes = (statement: string, table: string, column: string) =>
      new RegExp(`^\\s*(UPDATE|INSERT INTO|DELETE FROM) "?${table}"?[\\s(]`, "i").test(statement) &&
      new RegExp(`"${column}"|\\b${column}\\b`).test(statement);
    const offenders = runs.flatMap(({ file }) =>
      unguarded(file)
        .split(";")
        .flatMap((statement) =>
          dropped
            .filter(({ table, column }) => writes(statement, table, column))
            .map(({ table, column }) => `${file}: ${table}.${column}`)
        )
    );
    expect(offenders).toEqual([]);
  });

  it("runs SQL that drops a table or converts a column type before db push", () => {
    const destructive = runs.filter(({ file }) =>
      /DROP TABLE|ALTER COLUMN \S+ (SET DATA )?TYPE/i.test(sql(file))
    );
    expect(destructive.length).toBeGreaterThan(0);
    for (const run of destructive) expect(run.at).toBeLessThan(push);
  });

  it("backfills the cards between their additive SQL and the constraints that need the backfill", () => {
    const at = (needle: string) => script.indexOf(needle);
    const backfill = at("bun scripts/cards/backfill-cards-refresh.ts --apply || exit 1");
    expect(backfill).toBeGreaterThan(at("20261027120000_cards_foundations/migration.sql"));
    expect(backfill).toBeLessThan(at("20261027120001_cards_foundations_constraints/migration.sql"));
  });

  it("runs the card categories SQL after the economy SQL and before the push", () => {
    const at = (needle: string) => script.indexOf(needle);
    const categories = at("20261102120000_cards_categories/migration.sql");
    expect(categories).toBeGreaterThan(at("20261101120000_cards_economy/migration.sql"));
    expect(categories).toBeLessThan(push);
  });

  it("runs the IxnayID claims SQL after the card categories SQL and before the push", () => {
    const at = (needle: string) => script.indexOf(needle);
    const claims = at("20261103120000_ixnayid_claims/migration.sql");
    expect(claims).toBeGreaterThan(at("20261102120000_cards_categories/migration.sql"));
    expect(claims).toBeLessThan(push);
  });

  it("converts the IxWiki links after the claims SQL and before the push", () => {
    const at = (needle: string) => script.indexOf(needle);
    const convert = at("bun scripts/identity/convert-wiki-name-claims.ts --apply || exit 1");
    expect(convert).toBeGreaterThan(at("20261103120000_ixnayid_claims/migration.sql"));
    expect(convert).toBeLessThan(push);
  });

  it("deletes the IxWiki links after the conversion and before the push", () => {
    const at = (needle: string) => script.indexOf(needle);
    const drop = at("20261103120001_ixnayid_drop_legacy/migration.sql");
    expect(drop).toBeGreaterThan(at("bun scripts/identity/convert-wiki-name-claims.ts --apply"));
    expect(drop).toBeLessThan(push);
  });

  it("keeps one approved owner per wiki name in SQL, where Prisma cannot say it", () => {
    const body = sql("prisma/migrations/20261103120000_ixnayid_claims/migration.sql");
    expect(body).toMatch(
      /CREATE UNIQUE INDEX IF NOT EXISTS "wiki_name_claims_one_approved_key"[\s\S]*WHERE "status" = 'APPROVED'/
    );
    expect(body).toMatch(
      /CREATE UNIQUE INDEX IF NOT EXISTS "wiki_name_claims_one_pending_key"[\s\S]*WHERE "status" = 'PENDING'/
    );
  });
});

/** Each step that must run before db push: a hand-written SQL file, the cards backfill or the IxWiki link conversion. */
const STEP =
  /bunx prisma db execute --schema prisma\/schema --file (\S+\.sql)|bun (scripts\/(?:cards\/backfill-cards-refresh|identity\/convert-wiki-name-claims)\.ts --apply)/g;
const beforePush = (text: string) => {
  const pushAt = text.indexOf("bun run db:push:force");
  return [...text.matchAll(STEP)].filter((m) => m.index < pushAt).map((m) => (m[1] ?? m[2])!);
};

describe.each(["start-development.sh", "scripts/refresh-local-db.sh"])("%s", (file) => {
  const text = readFileSync(file, "utf8");

  it("runs the deploy's before-push steps, in the deploy's order, before its own db push", () => {
    expect(beforePush(text)).toEqual(beforePush(script));
  });

  it("does not go on to the push if a step fails", () => {
    const stepLines = text.split("\n").filter((line) => new RegExp(STEP.source).test(line));
    const stops = (line: string) =>
      // one && chain ending in the push, or a plain top-level command under set -e
      (line.includes("&& bun run db:push:force") && !/\|\||;\s*bun/.test(line)) ||
      (/^set -e/m.test(text) && /^(bunx|bun) /.test(line.trim()) && !line.includes("||"));
    expect(stepLines.length).toBeGreaterThan(0);
    expect(stepLines.filter((line) => !stops(line))).toEqual([]);
  });
});

describe("the WikiOS proof check", () => {
  const check = script.indexOf("bun scripts/audit/wikios-proof.ts predeploy || exit 1");

  it("the proof check runs after the backup and the additive step (which creates job_leases), before any SQL", () => {
    expect(script.indexOf("bun run db:generate")).toBeGreaterThan(0);
    expect(check).toBeGreaterThan(backup);
    expect(check).toBeGreaterThan(additive);
    expect(check).toBeLessThan(Math.min(...runs.map((run) => run.at)));
    expect(check).toBeLessThan(push);
  });

  it("releases the proof's lease after the PM2 reload, and a failed release never fails the deploy", () => {
    const release = script.indexOf("bun scripts/audit/wikios-proof.ts deployed || true");
    expect(release).toBeGreaterThan(script.indexOf("pm2 startOrReload ecosystem.config.cjs"));
    expect(release).toBeLessThan(script.indexOf("./start-production.sh"));
  });
});

describe("the schema steps", () => {
  const at = (needle: string) => script.indexOf(needle);

  it("applies the additive schema after the backup and before the first SQL file", () => {
    expect(additive).toBeGreaterThan(backup);
    expect(additive).toBeLessThan(Math.min(...runs.map((run) => run.at)));
  });

  it("drops world_configs and territory_claims after the backup and before the push", () => {
    const drop = at("scripts/migrations/2026-10-realms/drop-world-configs.sql");
    expect(drop).toBeGreaterThan(backup);
    expect(drop).toBeLessThan(push);
    expect(sql("scripts/migrations/2026-10-realms/drop-world-configs.sql")).toMatch(
      /DROP TABLE IF EXISTS "territory_claims".*DROP TABLE IF EXISTS "world_configs"/
    );
  });

  it("runs every ThinkPages forum migration before the push, in order, and before forum_readers is dropped", () => {
    const forum = [
      "20261008120000_thinkpages_forum",
      "20261009120000_thinkpages_forum_realms",
      "20261010030000_uploaded_assets",
      "20261010120000_thinkpages_forum_moderation",
      "20261011120000_thinkpages_forum_import",
      "20261012120000_thinkpages_forum_followups",
      "20261013120000_thinkpages_forum_foundation",
      "20261014120000_thinkpages_realm_board",
      "20261015120000_thinkpages_forum_engagement",
      "20261016120000_thinkpages_forum_reactions",
      "20261017120000_action_link_rewards",
      "20261018120000_thinkpages_realm_adverts",
    ].map((dir) => at(`prisma/migrations/${dir}/migration.sql`));
    expect(forum.every((index) => index > 0)).toBe(true);
    expect([...forum].sort((a, b) => a - b)).toEqual(forum);
    expect(forum.at(-1)).toBeLessThan(at("20261027120000_drop_forum_readers/migration.sql"));
    expect(forum.at(-1)).toBeLessThan(push);
  });

  it("skips the additive step, the SQL and the push under SKIP_SCHEMA_SYNC=1, but never the backup", () => {
    const blocks = [...script.matchAll(/if \[ "\$\{SKIP_SCHEMA_SYNC:-\}" (!?=) "1" \]; then/g)];
    expect(blocks.map((m) => m[1])).toEqual(["!=", "="]);
    const [skipAdditive, skipSql] = blocks.map((m) => m.index);
    expect(skipAdditive).toBeGreaterThan(backup);
    expect(skipAdditive).toBeLessThan(additive);
    expect(skipSql).toBeLessThan(Math.min(...runs.map((run) => run.at)));
    // the SQL and the push sit in that block's else branch, which closes before the build
    const close = script.indexOf("\nfi\n", push);
    expect(close).toBeLessThan(build);
    expect(Math.max(...schemaRuns.map((run) => run.at))).toBeLessThan(close);
  });
});

describe("the post-deploy data SQL", () => {
  const calls = [...script.matchAll(/^\s*run_post_deploy_sql$/gm)].map((m) => m.index);

  it("rewrites the legacy notification links only after the new server answers, and only then", () => {
    expect(postDeploy.map((run) => run.file)).toEqual([
      "prisma/migrations/20261028120000_rewrite_legacy_notification_links/migration.sql",
    ]);
    // once in each server path, each right after the new server answered
    expect(calls).toHaveLength(2);
    for (const index of calls) {
      expect(index).toBeGreaterThan(build);
      expect(script.lastIndexOf("if wait_for_web; then", index)).toBeGreaterThan(index - 300);
    }
  });

  it("never fails the live release, and never runs under SKIP_SCHEMA_SYNC (a rollback's old code)", () => {
    for (const run of postDeploy) expect(run.rest).toMatch(/^ \|\| echo /);
    const body = script.slice(postDeployAt, script.indexOf("\n}\n", postDeployAt));
    expect(body).toContain('[ "${SKIP_SCHEMA_SYNC:-}" = "1" ] && return 0');
  });
});

describe("the live build", () => {
  const at = (needle: string) => script.indexOf(needle);

  it("is never deleted up front: no `bun run clean`, and nothing touches .next before the push", () => {
    expect(script).not.toContain("bun run clean");
    expect(script.slice(0, push)).not.toMatch(/^\s*(rm|mv|cp)\b.*\.next\b/m);
    expect(at('mv .next "$NEXT_PREV"')).toBeGreaterThan(push);
    expect(at('mv .next "$NEXT_PREV"')).toBeLessThan(build);
  });

  it("moves aside before the build and comes back if the deploy stops before the new server answers", () => {
    expect(at("trap restore_previous_build EXIT")).toBeGreaterThan(at('mv .next "$NEXT_PREV"'));
    expect(at("trap restore_previous_build EXIT")).toBeLessThan(build);
    expect(script).toMatch(/restore_previous_build\(\) \{[\s\S]*?rm -rf \.next\n\s*mv "\$NEXT_PREV" \.next/);
  });

  it("is deleted only after the new server answers, under PM2 or in the foreground", () => {
    const deletes = [...script.matchAll(/rm -rf "\$NEXT_PREV"/g)].map((m) => m.index);
    // the leftover of an earlier deploy (when .next is a finished build), then the two server paths
    expect(deletes).toHaveLength(3);
    for (const index of deletes.slice(1)) {
      expect(script.lastIndexOf("if wait_for_web; then", index)).toBeGreaterThan(build);
      expect(index - script.lastIndexOf("if wait_for_web; then", index)).toBeLessThan(40);
    }
  });

  it("starts the web app under PM2 when the ecosystem file defines ixstats-web, else in the foreground", () => {
    expect(script).toContain('a.name === "ixstats-web"');
    expect(at('if [ "$WEB_UNDER_PM2" = "1" ]; then')).toBeLessThan(at("pm2 startOrReload ecosystem.config.cjs"));
    expect(at("exec ./start-production.sh")).toBeGreaterThan(at("pm2 startOrReload ecosystem.config.cjs"));
  });

  it("stops the old server with SIGTERM, waits, and only then sends SIGKILL", () => {
    expect(script).not.toContain("kill -9");
    expect(script).not.toContain("fuser -k");
    const stop = script.slice(at("stop_port() {"), at("stop_port() {") + 900);
    expect(stop.indexOf("kill -TERM")).toBeGreaterThan(0);
    expect(stop.indexOf("sleep 1")).toBeGreaterThan(stop.indexOf("kill -TERM"));
    expect(stop.indexOf("kill -KILL")).toBeGreaterThan(stop.indexOf("sleep 1"));
  });
});

describe("rollback-deployment.sh", () => {
  const rollback = readFileSync("scripts/deployment/rollback-deployment.sh", "utf8");

  it("runs this release's deploy script, copied before the checkout, with no schema sync", () => {
    expect(rollback.indexOf("cp scripts/deploy-production.sh")).toBeGreaterThan(0);
    expect(rollback.indexOf("cp scripts/deploy-production.sh")).toBeLessThan(rollback.indexOf("git checkout"));
    expect(rollback).toMatch(/ALLOW_NON_MASTER_DEPLOY=1 SKIP_SCHEMA_SYNC=1 exec "\$DEPLOY_SCRIPT"/);
    expect(rollback).not.toContain("exec ./scripts/deploy-production.sh");
  });
});

describe("deploy-ixworld.sh, a manual standalone build", () => {
  const ixworld = readFileSync("scripts/deploy-ixworld.sh", "utf8");

  it("is not run by the deploy: maps.ixwiki.com is the main app's /maps page", () => {
    expect(script).not.toContain("./scripts/deploy-ixworld.sh");
  });

  it("builds the commit deploy-production.sh built, without syncing git again, when given one", () => {
    expect(script).toMatch(/IXSTATS_DEPLOY_COMMIT="\$\(git rev-parse HEAD/);
    const pinned = ixworld.indexOf('if [ -n "${IXSTATS_DEPLOY_COMMIT:-}" ]; then');
    expect(pinned).toBeGreaterThan(0);
    // the git reset lives only in the elif branch taken when the variable is unset
    expect(ixworld.indexOf("git reset --hard FETCH_HEAD")).toBeGreaterThan(ixworld.indexOf("elif ", pinned));
  });

  it("does not read a refused connection as healthy (curl prints 000 itself)", () => {
    expect(ixworld).not.toContain("|| echo 000");
  });

  it("excludes the default tile folder from the data/ rsync, which has no --delete", () => {
    const line = readFileSync("scripts/deploy-ixworld.sh", "utf8")
      .split("\n")
      .find((l) => /rsync .* data\/ "\$IXWORLD_DIR\/data\/"/.test(l));
    expect(line).toBeDefined();
    expect(line).toContain("--exclude '/cache/map-tiles'");
    expect(line).not.toContain("--delete");
  });
});
