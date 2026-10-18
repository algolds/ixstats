/** @jest-environment node */
import {
  databaseLabel,
  localDatabaseRefusal,
  productionDatabaseRefusal,
} from "../../../scripts/lib/database-guard";

const url = (db: string) => `postgresql://u:p@localhost:5433/${db}?schema=public`;

describe("productionDatabaseRefusal", () => {
  it("reads a percent-encoded database name", () => {
    expect(productionDatabaseRefusal(url("ix%73tats"), false)).toMatch(/--production/);
  });

  it("refuses the production database written with a trailing slash", () => {
    expect(productionDatabaseRefusal(url("ixstats/"), false)).toMatch(/--production/);
  });

  it("allows a clone", () => {
    expect(productionDatabaseRefusal(url("ixstats_wv1"), false)).toBeNull();
  });

  it("refuses the production database without --production, and allows it with", () => {
    expect(productionDatabaseRefusal(url("ixstats"), false)).toMatch(/--production/);
    expect(productionDatabaseRefusal(url("ixstats"), true)).toBeNull();
  });

  it("refuses a missing or unusable DATABASE_URL", () => {
    expect(productionDatabaseRefusal(undefined, true)).toMatch(/DATABASE_URL/);
    expect(productionDatabaseRefusal("not a url", true)).toMatch(/DATABASE_URL/);
  });
});

describe("localDatabaseRefusal", () => {
  const at = (host: string) => `postgresql://u:p@${host}:5433/x?schema=public`;

  it.each(["localhost", "127.0.0.1", "[::1]"])("allows %s", (host) => {
    expect(localDatabaseRefusal(at(host))).toBeNull();
  });

  it.each(["db.example.com", "10.0.0.5", "localhost.evil.example"])("refuses %s", (host) => {
    expect(localDatabaseRefusal(at(host))).toMatch(/not local/);
  });

  it("refuses a host or hostaddr parameter, which overrides the URL's host", () => {
    expect(localDatabaseRefusal(`${at("localhost")}&host=db.example.com`)).toMatch(/hostaddr/);
    expect(localDatabaseRefusal(`${at("localhost")}&hostaddr=10.0.0.5`)).toMatch(/hostaddr/);
  });

  it("refuses a missing or unusable DATABASE_URL", () => {
    expect(localDatabaseRefusal(undefined)).toMatch(/DATABASE_URL/);
  });
});

describe("databaseLabel", () => {
  it("names host, port and database without the credentials", () => {
    expect(databaseLabel(url("ixstats_wv1"))).toBe("localhost:5433/ixstats_wv1");
  });

  it("defaults the port", () => {
    expect(databaseLabel("postgresql://u:p@db/ixstats")).toBe("db:5432/ixstats");
  });

  it("says when DATABASE_URL is unusable", () => {
    expect(databaseLabel(undefined)).toMatch(/not set or not a URL/);
  });
});
