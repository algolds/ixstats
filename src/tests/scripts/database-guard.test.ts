/** @jest-environment node */
/**
 * The scripts that write a database refuse the wrong one: scripts/lib/database-guard needs --production for the
 * production database (however its name is written) and names the target without credentials, and db:bootstrap
 * refuses production, a remote host unless explicitly allowed, and a missing DATABASE_URL.
 *
 * Folds bootstrap-dev-db.
 */
import { databaseLabel, productionDatabaseRefusal } from "../../../scripts/lib/database-guard";
import { bootstrapRefusal } from "../../../scripts/setup/bootstrap-dev-db";

const url = (db: string) => `postgresql://u:p@localhost:5433/${db}?schema=public`;

describe("productionDatabaseRefusal", () => {
  it.each([
    ["plainly", "ixstats"],
    ["percent-encoded", "ix%73tats"],
    ["with a trailing slash", "ixstats/"],
  ])("refuses the production database written %s without --production", (_how, name) => {
    expect(productionDatabaseRefusal(url(name), false)).toMatch(/--production/);
  });

  it("allows the production database with --production, and a clone without", () => {
    expect(productionDatabaseRefusal(url("ixstats"), true)).toBeNull();
    expect(productionDatabaseRefusal(url("ixstats_wv1"), false)).toBeNull();
  });

  it("refuses a missing or unusable DATABASE_URL", () => {
    expect(productionDatabaseRefusal(undefined, true)).toMatch(/DATABASE_URL/);
    expect(productionDatabaseRefusal("not a url", true)).toMatch(/DATABASE_URL/);
  });

  it("names host, port and database without the credentials", () => {
    expect(databaseLabel(url("ixstats_wv1"))).toBe("localhost:5433/ixstats_wv1");
    expect(databaseLabel("postgresql://u:p@db/ixstats")).toBe("db:5432/ixstats");
    expect(databaseLabel(undefined)).toMatch(/not set or not a URL/);
  });
});

describe("db:bootstrap", () => {
  const local = "postgresql://postgres:postgres@localhost:5433/ixstats";
  const remote = "postgresql://u:p@db.example.com:5432/ixstats";

  it("allows a local development database", () => {
    expect(
      bootstrapRefusal({ nodeEnv: "development", databaseUrl: local, allowRemote: false })
    ).toBeNull();
  });

  it("refuses production even when remote hosts are allowed", () => {
    expect(
      bootstrapRefusal({ nodeEnv: "production", databaseUrl: local, allowRemote: true })
    ).toMatch(/production/);
  });

  it("refuses a remote host unless explicitly allowed", () => {
    expect(
      bootstrapRefusal({ nodeEnv: "development", databaseUrl: remote, allowRemote: false })
    ).toMatch(/not a local database/);
    expect(
      bootstrapRefusal({ nodeEnv: "development", databaseUrl: remote, allowRemote: true })
    ).toBeNull();
  });

  it("refuses when DATABASE_URL is missing", () => {
    expect(
      bootstrapRefusal({ nodeEnv: "development", databaseUrl: undefined, allowRemote: false })
    ).toMatch(/DATABASE_URL/);
  });
});
