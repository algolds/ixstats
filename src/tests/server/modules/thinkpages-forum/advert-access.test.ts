/** @jest-environment node */
import {
  advertClosed,
  advertGate,
  advertHiddenFrom,
  advertRealmHiddenFrom,
  assertAdvertsOnly,
  canEditPost,
  canManageAdvert,
} from "~/server/modules/thinkpages-forum/advert-access";
import { canSeeRealm } from "~/server/modules/thinkpages-forum/realm-access";

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

  it("lets anonymous readers see adverts of published realms, ordinary threads and Ixnay only", () => {
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

/** Evaluates the one `advertGate` shape over a thread row, so the list gate can be held against the row check. */
interface GateRow {
  advertRealmId: string | null;
  advertRealm: { status: string; ownerId: string } | null;
}
interface GateClause {
  advertRealmId?: string | null;
  advertRealm?: { status?: { notIn: string[] }; ownerId?: string };
}
function passesGate(gate: ReturnType<typeof advertGate>, row: GateRow): boolean {
  const parts = (gate.AND ?? []) as never as Array<{ OR: GateClause[] }>;
  return parts.every(({ OR }) =>
    OR.some((clause) => {
      if (clause.advertRealmId !== undefined) return row.advertRealmId === clause.advertRealmId;
      const cond = clause.advertRealm!;
      if (!row.advertRealm) return false;
      if (cond.status) return !cond.status.notIn.includes(row.advertRealm.status);
      return row.advertRealm.ownerId === cond.ownerId;
    })
  );
}

describe("advertGate agrees with canSeeRealm", () => {
  const viewers = { anonymous: null, member, officer, founder, admin };
  const statuses = ["draft", "generating", "active", "archived"];

  for (const status of statuses) {
    for (const [name, viewer] of Object.entries(viewers)) {
      it(`for a ${status} realm and ${name}`, () => {
        const realmRow = { ...realm, status };
        const row = {
          advertRealmId: realm.id,
          advertRealm: { status, ownerId: realm.ownerId },
        };
        const visible = canSeeRealm(viewer, realmRow);
        expect(passesGate(advertGate(viewer), row)).toBe(visible);
        expect(advertRealmHiddenFrom(viewer, realmRow)).toBe(!visible);
      });
    }
  }

  it("lets every viewer see an ordinary thread", () => {
    for (const viewer of Object.values(viewers)) {
      expect(passesGate(advertGate(viewer), { advertRealmId: null, advertRealm: null })).toBe(true);
    }
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
});

describe("advertHiddenFrom", () => {
  const realmDb = (row: object | null) => ({
    realm: { findUnique: jest.fn(async (_args?: object) => row) },
  });
  it("hides a draft realm's advert from members and anonymous readers, and shows it to its founder and admins", async () => {
    const db = realmDb(draft);
    const thread = { advertRealmId: "r_eurth" };
    await expect(advertHiddenFrom(db as never, member, thread)).resolves.toBe(true);
    await expect(advertHiddenFrom(db as never, null, thread)).resolves.toBe(true);
    await expect(advertHiddenFrom(db as never, founder, thread)).resolves.toBe(false);
    await expect(advertHiddenFrom(db as never, admin, thread)).resolves.toBe(false);
  });
});

describe("Ixnay", () => {
  const ixnay = { ...realm, id: "default", slug: "ixnay", name: "Ixnay", status: "draft" };

  it("is never hidden, whatever its row says", async () => {
    expect(advertRealmHiddenFrom(member, ixnay)).toBe(false);
    const db = { realm: { findUnique: jest.fn(async (_args?: object) => ixnay) } };
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

  it("never closes Ixnay", () => {
    expect(advertClosed({ ...archived, id: "default" })).toBe(false);
  });
});

describe("canManageAdvert", () => {
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

describe("canEditPost", () => {
  const post = (id: string, authorUserId: string | null) => ({
    id,
    threadId: "t_ad",
    authorUserId,
  });
  const first = (authorUserId: string | null) => post("p_first", authorUserId);
  const second = (authorUserId: string | null) => post("p_second", authorUserId);
  const officerActor = officer;

  it("lets a manager edit the first post, whoever wrote it, and no reply but their own", async () => {
    const db = officerDb();
    await expect(canEditPost(db as never, officerActor, first("u_other"), realm)).resolves.toBe(
      true
    );
    await expect(canEditPost(db as never, officerActor, second("u_other"), realm)).resolves.toBe(
      false
    );
    await expect(canEditPost(db as never, officerActor, second("u_o"), realm)).resolves.toBe(true);
    expect(db.forumPost.findFirst).toHaveBeenCalledWith({
      where: { threadId: "t_ad" },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: { id: true },
    });
  });

  it("does not let authorship alone edit the first post once the author lost the power", async () => {
    const db = officerDb();
    const exOfficer = { ...boardOnly, id: "u_board" };
    await expect(canEditPost(db as never, exOfficer, first("u_board"), realm)).resolves.toBe(false);
    await expect(canEditPost(db as never, exOfficer, second("u_board"), realm)).resolves.toBe(true);
  });

  it("is the author's alone in a thread that is no advert, with no first-post read", async () => {
    const db = officerDb();
    await expect(canEditPost(db as never, officerActor, first("u_o"), null)).resolves.toBe(true);
    await expect(canEditPost(db as never, officerActor, first("u_x"), undefined)).resolves.toBe(
      false
    );
    expect(db.forumPost.findFirst).not.toHaveBeenCalled();
  });
});

describe("assertAdvertsOnly", () => {
  const find = { key: "find-a-realm", scope: "site" };

  it("refuses a thread in Find a Realm that names no realm, and nothing else", () => {
    expect(() => assertAdvertsOnly(find, undefined)).toThrow(/adverts only/i);
    expect(() => assertAdvertsOnly(find, "r_eurth")).not.toThrow();
    expect(() => assertAdvertsOnly({ key: "general", scope: "site" }, undefined)).not.toThrow();
    expect(() =>
      assertAdvertsOnly({ key: "find-a-realm", scope: "realm" }, undefined)
    ).not.toThrow();
  });
});
