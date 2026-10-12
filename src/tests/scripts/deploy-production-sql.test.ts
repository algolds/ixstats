import { describe, it, expect } from "@jest/globals";
import { readFileSync } from "node:fs";

const script = readFileSync("scripts/deploy-production.sh", "utf8");

describe("deploy-production.sh applies the SQL db push cannot", () => {
  it("runs the Atlas R0 SQL after the schema push and before the build, and stops the deploy if it fails", () => {
    const push = script.indexOf("bun run db:push:force");
    const atlas = script.indexOf(
      "bunx prisma db execute --schema prisma/schema --file prisma/migrations/20261021120000_atlas_r0/migration.sql || exit 1"
    );
    const build = script.indexOf("bun run build");
    expect(push).toBeGreaterThanOrEqual(0);
    expect(atlas).toBeGreaterThan(push);
    expect(build).toBeGreaterThan(atlas);
  });

  it("runs the Atlas RA SQL after the Atlas R0 SQL and before the build, and stops the deploy if it fails", () => {
    const r0 = script.indexOf("prisma/migrations/20261021120000_atlas_r0/migration.sql");
    const ra = script.indexOf(
      "bunx prisma db execute --schema prisma/schema --file prisma/migrations/20261022120000_atlas_ra/migration.sql || exit 1"
    );
    const build = script.indexOf("bun run build");
    expect(r0).toBeGreaterThanOrEqual(0);
    expect(ra).toBeGreaterThan(r0);
    expect(build).toBeGreaterThan(ra);
  });

  it("runs the Atlas Studio SQL before the schema push, after the backup, and stops the deploy if it fails", () => {
    const backup = script.indexOf("bun run db:backup");
    const studio = script.indexOf(
      "bunx prisma db execute --schema prisma/schema --file prisma/migrations/20261023120000_atlas_studio/migration.sql || exit 1"
    );
    const push = script.indexOf("bun run db:push:force");
    expect(backup).toBeGreaterThanOrEqual(0);
    expect(studio).toBeGreaterThan(backup);
    expect(push).toBeGreaterThan(studio);
  });
});
