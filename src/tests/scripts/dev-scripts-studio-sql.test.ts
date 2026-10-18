import { describe, it, expect } from "@jest/globals";
import { readFileSync } from "node:fs";

const SQL = "prisma/migrations/20261023120000_atlas_studio/migration.sql";
const RUN = `bunx prisma db execute --schema prisma/schema --file ${SQL}`;
const VAULT_SQL = "prisma/migrations/20261024120000_vault_hub/migration.sql";
const VAULT_RUN = `bunx prisma db execute --schema prisma/schema --file ${VAULT_SQL}`;
const DROP_READERS_SQL = "prisma/migrations/20261027120000_drop_forum_readers/migration.sql";
const DROP_READERS_RUN = `bunx prisma db execute --schema prisma/schema --file ${DROP_READERS_SQL}`;

describe.each([
  ["start-development.sh", "start-development.sh"],
  ["scripts/refresh-local-db.sh", "scripts/refresh-local-db.sh"],
])("%s applies the Atlas Studio SQL before db push", (_name, path) => {
  const script = readFileSync(path, "utf8");

  it("runs it before the schema push, which cannot drop a table that has rows", () => {
    const studio = script.indexOf(RUN);
    const push = script.indexOf("bun run db:push:force");
    expect(studio).toBeGreaterThanOrEqual(0);
    expect(push).toBeGreaterThan(studio);
  });

  it("runs the Vault hub SQL right after the Atlas Studio SQL, before the push", () => {
    const studio = script.indexOf(RUN);
    const vault = script.indexOf(VAULT_RUN);
    const push = script.indexOf("bun run db:push:force");
    expect(vault).toBeGreaterThan(studio);
    expect(push).toBeGreaterThan(vault);
  });

  it("drops forum_readers right after the Vault hub SQL, before the push", () => {
    const vault = script.indexOf(VAULT_RUN);
    const drop = script.indexOf(DROP_READERS_RUN);
    const push = script.indexOf("bun run db:push:force");
    expect(drop).toBeGreaterThan(vault);
    expect(push).toBeGreaterThan(drop);
  });

  it("does not go on to the push if the SQL fails", () => {
    const line = script.split("\n").find((l) => l.includes(RUN)) ?? "";
    // Either the script stops on any failure, or the push is chained behind the SQL
    expect(
      /^set -e/m.test(script) ||
        line.includes(`${SQL} && ${VAULT_RUN} && ${DROP_READERS_RUN} && bun run db:push:force`)
    ).toBe(true);
  });
});
