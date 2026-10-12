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
});
