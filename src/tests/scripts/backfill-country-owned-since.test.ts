/** @jest-environment node */
import {
  backfillOwnedSince,
  resolveOwnedSince,
} from "../../../scripts/backfill-country-owned-since";
import { createMockPrisma } from "~/tests/helpers/mock-db";

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

describe("resolveOwnedSince", () => {
  const country = { id: "c1", ownerUserId: "u1" };

  it("prefers the owner's latest approved claim over the first change log row", () => {
    const claims = [
      { countryId: "c1", userId: "u1", reviewedAt: d("2025-03-01") },
      { countryId: "c1", userId: "u1", reviewedAt: d("2025-09-01") },
    ];
    expect(resolveOwnedSince(country, claims, d("2025-01-01"))).toEqual({
      date: d("2025-09-01"),
      source: "claim",
    });
  });

  it("ignores claims by someone else (an earlier owner)", () => {
    const claims = [{ countryId: "c1", userId: "u9", reviewedAt: d("2025-03-01") }];
    expect(resolveOwnedSince(country, claims, d("2025-06-01"))).toEqual({
      date: d("2025-06-01"),
      source: "changelog",
    });
  });

  it("is unresolved with neither a claim nor a change log row", () => {
    expect(resolveOwnedSince(country, [], null)).toEqual({ date: null, source: "none" });
  });
});

describe("backfillOwnedSince", () => {
  function setup() {
    const db = createMockPrisma();
    db.country.findMany.mockResolvedValue([
      { id: "c1", ownerUserId: "u1" },
      { id: "c2", ownerUserId: "u2" },
      { id: "c3", ownerUserId: "u3" },
    ]);
    db.realmClaim.findMany.mockResolvedValue([
      { countryId: "c1", userId: "u1", reviewedAt: d("2025-03-01") },
    ]);
    db.countryChangeLog.groupBy.mockResolvedValue([
      { countryId: "c2", _min: { createdAt: d("2025-05-05") } },
    ]);
    db.country.updateMany.mockResolvedValue({ count: 1 });
    return db;
  }

  it("selects only owned nations without a date, and approved claims with a review date", async () => {
    const db = setup();
    await backfillOwnedSince(db as never, false);
    expect(db.country.findMany).toHaveBeenCalledWith({
      where: { ownerUserId: { not: null }, ownedSince: null },
      select: { id: true, ownerUserId: true },
    });
    expect(db.realmClaim.findMany).toHaveBeenCalledWith({
      where: {
        countryId: { in: ["c1", "c2", "c3"] },
        status: "approved",
        reviewedAt: { not: null },
      },
      select: { countryId: true, userId: true, reviewedAt: true },
    });
  });

  it("dry-run reports what it would write and writes nothing", async () => {
    const db = setup();
    const report = await backfillOwnedSince(db as never, false);
    expect(report).toEqual({ fromClaim: 1, fromChangelog: 1, unresolved: ["c3"], written: 0 });
    expect(db.country.update).not.toHaveBeenCalled();
    expect(db.country.updateMany).not.toHaveBeenCalled();
  });

  it("apply writes each resolved date once, only where ownedSince is still null", async () => {
    const db = setup();
    const report = await backfillOwnedSince(db as never, true);
    expect(report.written).toBe(2);
    expect(db.country.updateMany).toHaveBeenCalledTimes(2);
    expect(db.country.updateMany).toHaveBeenCalledWith({
      where: { id: "c1", ownedSince: null },
      data: { ownedSince: d("2025-03-01") },
    });
    expect(db.country.updateMany).toHaveBeenCalledWith({
      where: { id: "c2", ownedSince: null },
      data: { ownedSince: d("2025-05-05") },
    });
  });
});
