import { describe, it, expect } from "@jest/globals";
import { readFileSync } from "node:fs";

const SQL = "prisma/migrations/20261023120000_atlas_studio/migration.sql";
const RUN = `bunx prisma db execute --schema prisma/schema --file ${SQL}`;

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

  it("does not go on to the push if the SQL fails", () => {
    const line = script.split("\n").find((l) => l.includes(RUN)) ?? "";
    // Either the script stops on any failure, or the push is chained behind the SQL
    expect(/^set -e/m.test(script) || line.includes(`${SQL} && bun run db:push:force`)).toBe(true);
  });
});
