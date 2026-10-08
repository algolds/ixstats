/** @jest-environment node */
/**
 * Realm invites on the identity side: a `via` handle resolves to a user the way a passport URL does (stored
 * handle, then legacy names); the realm's Join panel names the inviter only when they hold a nation in that
 * realm; and the passport counts the holder's approved invited claims.
 */
jest.mock("~/server/db", () => {
  const db = {
    user: { findUnique: jest.fn(), findFirst: jest.fn() },
    country: { findFirst: jest.fn() },
    thinkpagesAccount: { findFirst: jest.fn() },
    realmClaim: { findMany: jest.fn() },
  };
  return { __esModule: true, db, isDatabaseReadOnly: false };
});

jest.mock("~/lib/wiki-os/adapters/ixstates/user-sync", () => ({
  lookupWikiUser: jest.fn().mockResolvedValue(null),
}));

import { beforeEach, describe, expect, it } from "@jest/globals";
import { db } from "~/server/db";
import {
  loadRecruitedCount,
  resolveInviterUserId,
  resolveRealmInviter,
} from "~/server/modules/identity/identity.invites";

const mocked = db as unknown as {
  user: { findUnique: jest.Mock; findFirst: jest.Mock };
  country: { findFirst: jest.Mock };
  thinkpagesAccount: { findFirst: jest.Mock };
  realmClaim: { findMany: jest.Mock };
};

const kir = {
  id: "db_kir",
  clerkUserId: "clerk_kir",
  handle: "kir" as string | null,
  forumUsername: "Kir Forum",
};

/** Realm slug → status, for the open-realm filter. */
const REALMS: Record<string, string> = { eurth: "active", unlisted: "active", drafty: "draft" };

interface MemberWhere {
  ownerUserId: string;
  realmId?: string;
  realm?: { slug: string; status: string };
}

/** Kir holds a nation in every realm; the filter decides which realms count. */
function kirHoldsEverywhere() {
  mocked.country.findFirst.mockImplementation(({ where }: { where: MemberWhere }) => {
    if (where.ownerUserId !== "db_kir") return Promise.resolve(null);
    const open = where.realm ? REALMS[where.realm.slug] === where.realm.status : true;
    return Promise.resolve(open ? { id: "c1" } : null);
  });
}

beforeEach(() => {
  mocked.user.findUnique.mockReset().mockResolvedValue(null);
  mocked.user.findFirst.mockReset().mockResolvedValue(null);
  mocked.country.findFirst.mockReset().mockResolvedValue(null);
  mocked.thinkpagesAccount.findFirst.mockReset().mockResolvedValue(null);
  mocked.realmClaim.findMany.mockReset();
});

describe("resolveInviterUserId", () => {
  it("resolves a stored handle, normalised, without the legacy lookup", async () => {
    mocked.user.findUnique.mockResolvedValue(kir);
    await expect(resolveInviterUserId("@Kir")).resolves.toBe("db_kir");
    expect(mocked.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { handle: "kir" } })
    );
    expect(mocked.user.findFirst).not.toHaveBeenCalled();
  });

  it("falls back to a forum name", async () => {
    mocked.user.findFirst.mockResolvedValue(kir);
    await expect(resolveInviterUserId("Kir Forum")).resolves.toBe("db_kir");
  });

  it("is null for an unknown name, me, or a blank via", async () => {
    await expect(resolveInviterUserId("nobody")).resolves.toBeNull();
    await expect(resolveInviterUserId("me")).resolves.toBeNull();
    await expect(resolveInviterUserId("  ")).resolves.toBeNull();
  });
});

describe("resolveRealmInviter", () => {
  it("names a member of the realm by handle and persona name, nothing else", async () => {
    mocked.user.findUnique.mockResolvedValue(kir);
    kirHoldsEverywhere();
    mocked.thinkpagesAccount.findFirst.mockResolvedValue({ displayName: "Kir of Caphiria" });
    await expect(resolveRealmInviter("eurth", "kir")).resolves.toEqual({
      handle: "kir",
      displayName: "Kir of Caphiria",
    });
    expect(mocked.country.findFirst).toHaveBeenCalledWith({
      where: { ownerUserId: "db_kir", realm: { slug: "eurth", status: "active" } },
      select: { id: true },
    });
  });

  it("names nobody in a realm that takes no claims (draft, generating), though they hold a nation", async () => {
    mocked.user.findUnique.mockResolvedValue(kir);
    kirHoldsEverywhere();
    await expect(resolveRealmInviter("drafty", "kir")).resolves.toBeNull();
    // An unlisted realm is reachable by link and open for claims.
    await expect(resolveRealmInviter("unlisted", "kir")).resolves.not.toBeNull();
  });

  it("reads IxWorld membership by its realm id", async () => {
    mocked.user.findUnique.mockResolvedValue(kir);
    mocked.country.findFirst.mockResolvedValue({ id: "c1" });
    await expect(resolveRealmInviter("ixworld", "kir")).resolves.toEqual({
      handle: "kir",
      displayName: "Kir Forum",
    });
    expect(mocked.country.findFirst).toHaveBeenCalledWith({
      where: { ownerUserId: "db_kir", realmId: "default" },
      select: { id: true },
    });
  });

  it("is null when the inviter holds no nation in the realm, or is unknown", async () => {
    mocked.user.findUnique.mockResolvedValue(kir);
    await expect(resolveRealmInviter("eurth", "kir")).resolves.toBeNull();
    mocked.user.findUnique.mockResolvedValue(null);
    await expect(resolveRealmInviter("eurth", "nobody")).resolves.toBeNull();
  });

  it("falls back to the normalised via when the user has no stored handle", async () => {
    mocked.user.findFirst.mockResolvedValue({ ...kir, handle: null, forumUsername: null });
    mocked.country.findFirst.mockResolvedValue({ id: "c1" });
    await expect(resolveRealmInviter("eurth", "@Kir_Forum")).resolves.toEqual({
      handle: "kir_forum",
      displayName: "kir_forum",
    });
  });
});

describe("loadRecruitedCount", () => {
  it("counts the holder's distinct recruits (approved invited claimants)", async () => {
    mocked.realmClaim.findMany.mockResolvedValue([{ userId: "p1" }, { userId: "p2" }]);
    await expect(loadRecruitedCount("db_kir")).resolves.toBe(2);
    expect(mocked.realmClaim.findMany).toHaveBeenCalledWith({
      where: { invitedByUserId: "db_kir", status: "approved" },
      distinct: ["userId"],
      select: { userId: true },
    });
  });

  it("is zero without a user or when the count fails", async () => {
    await expect(loadRecruitedCount(undefined)).resolves.toBe(0);
    mocked.realmClaim.findMany.mockRejectedValue(new Error("db down"));
    await expect(loadRecruitedCount("db_kir")).resolves.toBe(0);
  });
});
