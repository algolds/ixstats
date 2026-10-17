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

  it("runs the Vault hub SQL right after the Atlas Studio SQL, before the schema push, and stops the deploy if it fails", () => {
    const studio = script.indexOf(
      "bunx prisma db execute --schema prisma/schema --file prisma/migrations/20261023120000_atlas_studio/migration.sql || exit 1"
    );
    const vault = script.indexOf(
      "bunx prisma db execute --schema prisma/schema --file prisma/migrations/20261024120000_vault_hub/migration.sql || exit 1"
    );
    const push = script.indexOf("bun run db:push:force");
    expect(vault).toBeGreaterThan(studio);
    expect(push).toBeGreaterThan(vault);
  });

  it("runs the cards additive SQL, the cards backfill and the cards constraints, in order, after the Vault hub SQL and before the push", () => {
    const vault = script.indexOf("prisma/migrations/20261024120000_vault_hub/migration.sql");
    const additive = script.indexOf(
      "bunx prisma db execute --schema prisma/schema --file prisma/migrations/20261027120000_cards_foundations/migration.sql || exit 1"
    );
    const backfill = script.indexOf(
      "bun scripts/cards/backfill-cards-refresh.ts --apply || exit 1"
    );
    const constraints = script.indexOf(
      "bunx prisma db execute --schema prisma/schema --file prisma/migrations/20261027120001_cards_foundations_constraints/migration.sql || exit 1"
    );
    const push = script.indexOf("bun run db:push:force");
    expect(vault).toBeGreaterThan(0);
    expect(additive).toBeGreaterThan(vault);
    expect(backfill).toBeGreaterThan(additive);
    expect(constraints).toBeGreaterThan(backfill);
    expect(push).toBeGreaterThan(constraints);
  });

  it("runs the cards admin SQL right after the cards constraints, before the push, and stops the deploy if it fails", () => {
    const constraints = script.indexOf(
      "prisma/migrations/20261027120001_cards_foundations_constraints/migration.sql || exit 1"
    );
    const admin = script.indexOf(
      "bunx prisma db execute --schema prisma/schema --file prisma/migrations/20261028120000_cards_admin/migration.sql || exit 1"
    );
    const push = script.indexOf("bun run db:push:force");
    expect(constraints).toBeGreaterThan(0);
    expect(admin).toBeGreaterThan(constraints);
    expect(push).toBeGreaterThan(admin);
  });

  it("runs the cards face-hub SQL as the last SQL before the schema push, and stops the deploy if it fails", () => {
    const run =
      "bunx prisma db execute --schema prisma/schema --file prisma/migrations/20261031120000_cards_face_hub/migration.sql || exit 1";
    const push = script.indexOf("bun run db:push:force");
    const faceHub = script.indexOf(run);
    expect(faceHub).toBeGreaterThan(script.indexOf("bun run db:backup"));
    expect(faceHub).toBeGreaterThan(
      script.indexOf("20261028120000_cards_admin/migration.sql || exit 1")
    );
    expect(faceHub).toBe(script.lastIndexOf("bunx prisma db execute", push));
  });
});
