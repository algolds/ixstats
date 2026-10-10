/** @jest-environment node */
/**
 * `/thinkpages/r/mine`, the sidebar's "Your realm": a server resolver that sends a member to the Hub of the realm of
 * their primary nation (307, the answer depends on who asks), and everyone else to the forum home. It resolves as the
 * session's viewer, and has no loading.tsx (a redirect page needs the real redirect).
 */
import fs from "node:fs";
import path from "node:path";

jest.mock("next/navigation", () => ({
  redirect: jest.fn((url: string) => {
    throw new Error(`redirect:${url}`);
  }),
  unstable_rethrow: jest.fn(),
}));
jest.mock("@clerk/nextjs/server", () => ({ auth: jest.fn() }));
jest.mock("~/server/db", () => ({
  db: {
    user: { findUnique: jest.fn() },
    country: { findMany: jest.fn() },
    realm: { findMany: jest.fn(), findUnique: jest.fn() },
    realmOfficer: { findMany: jest.fn() },
    forumCategoryModerator: { findMany: jest.fn() },
  },
}));

import { beforeEach, describe, expect, it } from "@jest/globals";
import { auth } from "@clerk/nextjs/server";
import { db } from "~/server/db";
import MyRealmPage from "~/app/thinkpages/r/mine/page";

const mockAuth = jest.mocked(auth);
const signedIn = (userId: string | null) =>
  mockAuth.mockResolvedValue({ userId } as Awaited<ReturnType<typeof auth>>);

const fakeDb = db as unknown as {
  user: { findUnique: jest.Mock };
  country: { findMany: jest.Mock };
  realm: { findMany: jest.Mock; findUnique: jest.Mock };
  realmOfficer: { findMany: jest.Mock };
  forumCategoryModerator: { findMany: jest.Mock };
};

const member = {
  id: "u1",
  clerkUserId: "member",
  countryId: "c1",
  role: { name: "user", level: 100 },
};
const EURTH = { id: "r_eurth", slug: "eurth", name: "Eurth", status: "active", ownerId: "founder" };
const DRAFT = { ...EURTH, id: "r_draft", slug: "draft", status: "draft" };

function realmRows(rows: Array<typeof EURTH>) {
  fakeDb.realm.findUnique.mockImplementation(
    async ({ where }: { where: { id?: string; slug?: string } }) =>
      rows.find((r) => r.id === where.id || r.slug === where.slug) ?? null
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  signedIn(null);
  fakeDb.user.findUnique.mockResolvedValue(member);
  fakeDb.country.findMany.mockResolvedValue([]);
  fakeDb.realm.findMany.mockResolvedValue([]);
  fakeDb.realmOfficer.findMany.mockResolvedValue([]);
  fakeDb.forumCategoryModerator.findMany.mockResolvedValue([]);
  realmRows([EURTH, DRAFT]);
});

describe("/thinkpages/r/mine", () => {
  it("sends a member of a realm to its Hub board", async () => {
    signedIn("member");
    fakeDb.country.findMany.mockResolvedValue([
      { id: "c1", realmId: "r_eurth", currentTotalGdp: 5 },
    ]);
    await expect(MyRealmPage()).rejects.toThrow("redirect:/thinkpages/r/eurth/hub");
    expect(fakeDb.country.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { ownerUserId: "u1" } })
    );
  });

  it("sends a member holding no nation to the forum home", async () => {
    signedIn("member");
    await expect(MyRealmPage()).rejects.toThrow("redirect:/thinkpages");
  });

  it("sends a signed-out visitor to the forum home without a lookup", async () => {
    await expect(MyRealmPage()).rejects.toThrow("redirect:/thinkpages");
    expect(fakeDb.user.findUnique).not.toHaveBeenCalled();
    expect(fakeDb.country.findMany).not.toHaveBeenCalled();
  });

  it("sends a signed-in user without a user row to the forum home", async () => {
    signedIn("stranger");
    fakeDb.user.findUnique.mockResolvedValue(null);
    await expect(MyRealmPage()).rejects.toThrow("redirect:/thinkpages");
  });

  it("sends a member whose realm is hidden from them to the forum home", async () => {
    signedIn("member");
    fakeDb.country.findMany.mockResolvedValue([
      { id: "c1", realmId: "r_draft", currentTotalGdp: 5 },
    ]);
    await expect(MyRealmPage()).rejects.toThrow("redirect:/thinkpages");
  });

  it("encodes the realm slug in the Hub path", async () => {
    signedIn("member");
    realmRows([{ ...EURTH, slug: "a b/c" }]);
    fakeDb.country.findMany.mockResolvedValue([
      { id: "c1", realmId: "r_eurth", currentTotalGdp: 5 },
    ]);
    await expect(MyRealmPage()).rejects.toThrow("redirect:/thinkpages/r/a%20b%2Fc/hub");
  });

  it("is a redirect page with no loading.tsx beside it", () => {
    const dir = path.join(process.cwd(), "src/app/thinkpages/r/mine");
    expect(fs.readdirSync(dir)).toEqual(["page.tsx"]);
  });
});
