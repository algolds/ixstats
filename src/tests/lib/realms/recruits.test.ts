/** @jest-environment node */
/** Recruits count distinct players, not claims: re-claims and multi-realm claims by one player count once. */
interface ClaimRow {
  userId: string;
  invitedByUserId: string | null;
  status: string;
}

const mockRows: ClaimRow[] = [];

/** An in-memory realm_claims table answering findMany with its where and `distinct`. */
jest.mock("~/server/db", () => ({
  __esModule: true,
  db: {
    realmClaim: {
      findMany: jest.fn(
        ({ where, distinct }: { where: Partial<ClaimRow>; distinct?: (keyof ClaimRow)[] }) => {
          const hits = mockRows.filter((row) =>
            Object.entries(where).every(([key, value]) => row[key as keyof ClaimRow] === value)
          );
          const rows = distinct?.includes("userId")
            ? [...new Map(hits.map((row) => [row.userId, row])).values()]
            : hits;
          return Promise.resolve(rows.map((row) => ({ userId: row.userId })));
        }
      ),
    },
  },
}));

import { beforeEach, describe, expect, it } from "@jest/globals";
import { db } from "~/server/db";
import { countRecruits } from "~/lib/realms/recruits";

const claim = (
  userId: string,
  status = "approved",
  invitedByUserId: string | null = "inviter"
) => ({
  userId,
  invitedByUserId,
  status,
});

beforeEach(() => {
  mockRows.length = 0;
});

describe("countRecruits", () => {
  it("counts the same claimant twice as one recruit", async () => {
    mockRows.push(claim("p1"), claim("p1"));
    await expect(countRecruits(db, "inviter")).resolves.toBe(1);
  });

  it("counts two different claimants as two", async () => {
    mockRows.push(claim("p1"), claim("p2"), claim("p1"));
    await expect(countRecruits(db, "inviter")).resolves.toBe(2);
  });

  it("counts only approved claims naming this inviter", async () => {
    mockRows.push(
      claim("p1", "pending"),
      claim("p2", "rejected"),
      claim("p3", "approved", "other")
    );
    mockRows.push(claim("p4", "approved", null));
    await expect(countRecruits(db, "inviter")).resolves.toBe(0);
  });

  it("asks the database for distinct claimants", async () => {
    await countRecruits(db, "inviter");
    expect(jest.mocked(db.realmClaim.findMany)).toHaveBeenCalledWith({
      where: { invitedByUserId: "inviter", status: "approved" },
      distinct: ["userId"],
      select: { userId: true },
    });
  });
});
