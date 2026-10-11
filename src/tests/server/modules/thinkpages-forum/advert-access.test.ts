/** @jest-environment node */
import {
  advertClosed,
  advertGate,
  advertHiddenFrom,
  advertRealmHiddenFrom,
  advertRowOf,
  canEditAdvertPost,
  canManageAdvert,
} from "~/server/modules/thinkpages-forum/advert-access";

const admin = {
  id: "u_a",
  clerkUserId: "admin",
  countryId: null,
  role: { name: "admin", level: 10 },
};
const founder = {
  id: "u_f",
  clerkUserId: "founder",
  countryId: "c1",
  role: { name: "user", level: 100 },
};
const officer = {
  id: "u_o",
  clerkUserId: "officer",
  countryId: "c2",
  role: { name: "user", level: 100 },
};
const boardOnly = {
  id: "u_b",
  clerkUserId: "boarder",
  countryId: "c3",
  role: { name: "user", level: 100 },
};
const member = {
  id: "u_m",
  clerkUserId: "member",
  countryId: "c4",
  role: { name: "user", level: 100 },
};

const realm = { id: "r_eurth", slug: "eurth", name: "Eurth", status: "active", ownerId: "founder" };
const draft = { ...realm, status: "draft" };
const generating = { ...realm, status: "generating" };
const archived = { ...realm, status: "archived" };

const GRANTS = [
  { userId: "officer", powers: ["appearance", "board"] },
  { userId: "boarder", powers: ["board"] },
];
function officerDb() {
  return {
    realmOfficer: {
      findMany: jest.fn(async ({ where }: { where: { realmId: string; userId: string } }) =>
        GRANTS.filter((g) => g.userId === where.userId)
      ),
    },
    forumPost: {
      findFirst: jest.fn(async (_args?: object) => ({ id: "p_first" })),
    },
  };
}

describe("advertGate", () => {
  it("is empty for site admins, who see every advert", () => {
    expect(advertGate(admin)).toEqual({});
  });

  it("lets anonymous readers see adverts of published realms, ordinary threads and IxWorld only", () => {
    expect(advertGate(null)).toEqual({
      AND: [
        {
          OR: [
            { advertRealmId: null },
            { advertRealmId: "default" },
            { advertRealm: { status: { notIn: ["draft", "generating"] } } },
          ],
        },
      ],
    });
  });

  it("adds the realms a signed-in viewer owns, so a founder sees their own draft", () => {
    expect(advertGate(founder)).toEqual({
      AND: [
        {
          OR: [
            { advertRealmId: null },
            { advertRealmId: "default" },
            { advertRealm: { status: { notIn: ["draft", "generating"] } } },
            { advertRealm: { ownerId: "founder" } },
          ],
        },
      ],
    });
  });
});

describe("advertRealmHiddenFrom", () => {
  it("hides a draft or generating realm's advert from members and anonymous readers", () => {
    for (const hidden of [draft, generating]) {
      expect(advertRealmHiddenFrom(member, hidden)).toBe(true);
      expect(advertRealmHiddenFrom(null, hidden)).toBe(true);
      expect(advertRealmHiddenFrom(officer, hidden)).toBe(true);
    }
  });

  it("shows it to the founder and site admins", () => {
    expect(advertRealmHiddenFrom(founder, draft)).toBe(false);
    expect(advertRealmHiddenFrom(admin, generating)).toBe(false);
  });

  it("shows published and archived realms' adverts, and ordinary threads (no realm) to everyone", () => {
    expect(advertRealmHiddenFrom(null, realm)).toBe(false);
    expect(advertRealmHiddenFrom(member, archived)).toBe(false);
    expect(advertRealmHiddenFrom(member, null)).toBe(false);
    expect(advertRealmHiddenFrom(member, undefined)).toBe(false);
  });
});

describe("advertHiddenFrom", () => {
  const realmDb = (row: object | null) => ({
    realm: { findUnique: jest.fn(async (_args?: object) => row) },
  });

  it("is false for a thread that is no advert, without reading a realm", async () => {
    const db = realmDb(draft);
    await expect(advertHiddenFrom(db as never, member, { advertRealmId: null })).resolves.toBe(
      false
    );
    await expect(advertHiddenFrom(db as never, member, {})).resolves.toBe(false);
    expect(db.realm.findUnique).not.toHaveBeenCalled();
  });

  it("hides a draft realm's advert from members and anonymous readers, and shows it to its founder and admins", async () => {
    const db = realmDb(draft);
    const thread = { advertRealmId: "r_eurth" };
    await expect(advertHiddenFrom(db as never, member, thread)).resolves.toBe(true);
    await expect(advertHiddenFrom(db as never, null, thread)).resolves.toBe(true);
    await expect(advertHiddenFrom(db as never, founder, thread)).resolves.toBe(false);
    await expect(advertHiddenFrom(db as never, admin, thread)).resolves.toBe(false);
  });

  it("shows a published realm's advert to everyone", async () => {
    await expect(
      advertHiddenFrom(realmDb(realm) as never, null, { advertRealmId: "r_eurth" })
    ).resolves.toBe(false);
  });

  it("reads the realm by the thread's advertRealmId", async () => {
    const db = realmDb(realm);
    await advertHiddenFrom(db as never, member, { advertRealmId: "r_eurth" });
    expect(db.realm.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "r_eurth" } })
    );
  });
});

describe("IxWorld", () => {
  const ixworld = { ...realm, id: "default", slug: "ixworld", name: "IxWorld", status: "draft" };

  it("is never hidden, whatever its row says", async () => {
    expect(advertRealmHiddenFrom(member, ixworld)).toBe(false);
    const db = { realm: { findUnique: jest.fn(async (_args?: object) => ixworld) } };
    await expect(advertHiddenFrom(db as never, null, { advertRealmId: "default" })).resolves.toBe(
      false
    );
  });

  it("is never hidden by the list gate", () => {
    expect(JSON.stringify(advertGate(member))).toContain('{"advertRealmId":"default"}');
  });
});

describe("advertClosed", () => {
  it("closes only an archived realm's advert", () => {
    expect(advertClosed(archived)).toBe(true);
    expect(advertClosed(realm)).toBe(false);
    expect(advertClosed(draft)).toBe(false);
    expect(advertClosed(null)).toBe(false);
    expect(advertClosed(undefined)).toBe(false);
  });

  it("never closes IxWorld", () => {
    expect(advertClosed({ ...archived, id: "default" })).toBe(false);
  });
});

describe("canManageAdvert", () => {
  it("holds for site admins and the founder without reading the officer table", async () => {
    const db = officerDb();
    await expect(canManageAdvert(db as never, admin, realm)).resolves.toBe(true);
    await expect(canManageAdvert(db as never, founder, realm)).resolves.toBe(true);
    expect(db.realmOfficer.findMany).not.toHaveBeenCalled();
  });

  it("holds for an officer with the appearance power", async () => {
    await expect(canManageAdvert(officerDb() as never, officer, realm)).resolves.toBe(true);
  });

  it("does not hold for an officer without it, a plain member or an anonymous reader", async () => {
    const db = officerDb();
    await expect(canManageAdvert(db as never, boardOnly, realm)).resolves.toBe(false);
    await expect(canManageAdvert(db as never, member, realm)).resolves.toBe(false);
    await expect(canManageAdvert(db as never, null, realm)).resolves.toBe(false);
  });

  it("asks for this realm's grants for this user only", async () => {
    const db = officerDb();
    await canManageAdvert(db as never, officer, realm);
    expect(db.realmOfficer.findMany).toHaveBeenCalledWith({
      where: { realmId: "r_eurth", userId: "officer" },
      select: { userId: true, powers: true },
    });
  });
});

describe("canEditAdvertPost", () => {
  const first = { id: "p_first", threadId: "t_ad" };
  const second = { id: "p_second", threadId: "t_ad" };

  it("lets a manager edit the first post and no other", async () => {
    const db = officerDb();
    await expect(canEditAdvertPost(db as never, officer, first, realm)).resolves.toBe(true);
    await expect(canEditAdvertPost(db as never, officer, second, realm)).resolves.toBe(false);
    expect(db.forumPost.findFirst).toHaveBeenCalledWith({
      where: { threadId: "t_ad" },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: { id: true },
    });
  });

  it("is false for someone who does not manage the advert, and for a thread that is no advert", async () => {
    const db = officerDb();
    await expect(canEditAdvertPost(db as never, boardOnly, first, realm)).resolves.toBe(false);
    await expect(canEditAdvertPost(db as never, officer, first, null)).resolves.toBe(false);
    await expect(canEditAdvertPost(db as never, officer, first, undefined)).resolves.toBe(false);
  });
});

describe("advertRowOf", () => {
  const withLooks = { ...realm, thumbnail: "/t.png", emblemUrl: "/e.png" };

  it("is null for an ordinary thread", () => {
    expect(advertRowOf(null)).toBeNull();
    expect(advertRowOf(undefined)).toBeNull();
  });

  it("carries the mark and whether the realm takes new nations", () => {
    expect(advertRowOf(withLooks)).toEqual({
      realmSlug: "eurth",
      realmName: "Eurth",
      emblemUrl: "/e.png",
      thumbnail: "/t.png",
      claimsOpen: true,
    });
    expect(advertRowOf({ ...withLooks, status: "archived" })?.claimsOpen).toBe(false);
    expect(advertRowOf({ ...withLooks, status: "draft" })?.claimsOpen).toBe(false);
  });
});
