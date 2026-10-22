/**
 * Wiki link verification (`createWikiLinkService`): a player proves an account by saving a one-time code on their
 * User: page, and only a first appearance by the account itself counts (a planted, laundered or unattributable token
 * never does); a username another player verified is refused inside the transaction. Admins link by authority
 * (ruling F-2) through the same service: never their own account, never a name holding imported groups (unless a
 * system owner), never over another player's verified link, and the confirming admin is recorded.
 *
 * Folds admin-wiki-links (the admin router over the service).
 */
jest.mock("~/lib/auth", () => ({ isSystemOwner: jest.fn(() => false) }));
jest.mock("~/lib/cache", () => ({
  ...jest.requireActual("~/lib/cache"), // the tRPC context needs the real Cache class
  globalCache: {
    delete: jest.fn().mockResolvedValue(undefined),
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
  },
  invalidateCache: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("~/lib/wiki-os/adapters/mediawiki/bridge", () => ({
  getUserInfo: jest.fn().mockResolvedValue({ exists: true, userId: 7, username: "Kir" }),
}));
jest.mock("~/server/db", () => ({
  db: {
    user: {
      findFirst: jest.fn().mockResolvedValue(null),
      findUnique: jest.fn(),
      update: jest.fn().mockResolvedValue({}),
    },
  },
  isDatabaseReadOnly: true,
}));

import { adminUsersRouter } from "~/server/api/routers/admin/users";
import { isSystemOwner } from "~/lib/auth";
import { db as serverDb } from "~/server/db";
import { createIdorContext } from "~/tests/helpers/country-idor-context";
import {
  createWikiLinkService,
  WikiLinkError,
} from "~/server/modules/identity/identity.wiki-links";

function adminCaller(holder: object | null = null) {
  const ctx = createIdorContext(
    {
      user: {
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      wikiAccountLink: {
        findUnique: jest.fn().mockResolvedValue(holder),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
        upsert: jest.fn().mockResolvedValue({}),
      },
      wikiUserGroup: { count: jest.fn().mockResolvedValue(0) },
    },
    "admin"
  );
  const d = ctx.db as any;
  d.$transaction = jest.fn((cb: any) => cb(d));
  return { caller: adminUsersRouter.createCaller(ctx as any), d };
}

const legacyWrite = jest.mocked(serverDb.user.update);

beforeEach(() => {
  legacyWrite.mockClear();
  jest.mocked(isSystemOwner).mockReturnValue(false);
});

const NOW = new Date("2026-09-27T12:00:00Z");
/** An ordinary admin (not a system owner) confirming links by authority, and a system owner doing so. */
const ADMIN = { adminUserId: "dbadmin", isSystemOwner: false };
const OWNER = { adminUserId: "dbowner", isSystemOwner: true };
const TOKEN = "ixstates-verify-abcdef1234";
type Rev = { content: string | null; author: string | null };
const rev = (content: string | null, author: string | null): Rev => ({ content, author });
/** The User: page revisions saved since the code was issued, oldest first; `complete` = the window is not truncated. */
const history = (revisions: Rev[], complete = true) => ({ revisions, complete });

function setup(overrides: Partial<Record<string, any>> = {}) {
  const db: any = {
    $transaction: jest.fn((cb: any) => cb(db)),
    wikiAccountLink: {
      findUnique: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      upsert: jest
        .fn()
        .mockImplementation(({ create }: any) => Promise.resolve({ id: "l1", ...create })),
      update: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    user: {
      update: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    wikiUserGroup: { count: jest.fn().mockResolvedValue(0) },
    ...overrides,
  };
  const deps = {
    fetchWikiUser: jest.fn().mockResolvedValue({
      username: "Kir",
      userId: 7,
      registration: new Date("2026-01-01T00:00:00Z"),
      editCount: 42,
    }),
    fetchUserPageHistory: jest.fn().mockResolvedValue(history([rev(`Hello ${TOKEN}`, "Kir")])),
    now: () => NOW,
    newToken: () => "ixstates-verify-abcdef1234",
  };
  return { db, deps, service: createWikiLinkService(db, deps) };
}

describe("wiki link verification — start()", () => {
  it("issues a 24h token for an existing wiki user, scoping deleteMany/upsert correctly", async () => {
    const { db, service } = setup();
    const res = await service.start("u1", "iiwiki", "kir");
    expect(res.token).toBe("ixstates-verify-abcdef1234");
    expect(res.username).toBe("Kir");
    expect(res.expiresAt.getTime() - NOW.getTime()).toBe(24 * 3600 * 1000);
    expect(db.wikiAccountLink.deleteMany).toHaveBeenCalledWith({
      where: { userId: "u1", source: "iiwiki", NOT: { username: "Kir" } },
    });
    expect(db.wikiAccountLink.upsert).toHaveBeenCalledWith({
      where: { source_username: { source: "iiwiki", username: "Kir" } },
      update: {
        userId: "u1",
        wikiUserId: 7,
        token: "ixstates-verify-abcdef1234",
        tokenExpiresAt: res.expiresAt,
        verifiedAt: null,
      },
      create: {
        userId: "u1",
        source: "iiwiki",
        username: "Kir",
        wikiUserId: 7,
        token: "ixstates-verify-abcdef1234",
        tokenExpiresAt: res.expiresAt,
      },
    });
  });

  it("refuses a username another user has verified — checked inside the transaction, not before it", async () => {
    const { db, service } = setup();
    // Outer (pre-tx) client sees no holder; only the tx-scoped client sees the verified one, so this
    // only passes if the TAKEN check runs via `tx`, not via `db` before $transaction is entered.
    db.wikiAccountLink.findUnique.mockResolvedValue(null);
    const tx = {
      wikiAccountLink: {
        findUnique: jest.fn().mockResolvedValue({ userId: "other", verifiedAt: NOW }),
        deleteMany: jest.fn(),
        upsert: jest.fn(),
      },
    };
    db.$transaction.mockImplementation((cb: any) => cb(tx));
    await expect(service.start("u1", "iiwiki", "Kir")).rejects.toMatchObject({ code: "TAKEN" });
    expect(tx.wikiAccountLink.upsert).not.toHaveBeenCalled();
  });

  it("does not block start when the existing holder is unverified — takes it over with a fresh token", async () => {
    const { db, service } = setup();
    db.wikiAccountLink.findUnique.mockResolvedValue({ userId: "other", verifiedAt: null });
    const res = await service.start("u1", "iiwiki", "Kir");
    expect(res.token).toBe("ixstates-verify-abcdef1234");
    expect(db.wikiAccountLink.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ userId: "u1", token: "ixstates-verify-abcdef1234" }),
      })
    );
  });

  it("rejects a wiki user that does not exist", async () => {
    const { deps, service } = setup();
    deps.fetchWikiUser.mockResolvedValue(null);
    await expect(service.start("u1", "iiwiki", "ghost")).rejects.toMatchObject({
      code: "WIKI_USER_NOT_FOUND",
    });
  });

  it("names the wiki in plain words when the user is missing, never as the raw source id", async () => {
    const { deps, service } = setup();
    deps.fetchWikiUser.mockResolvedValue(null);
    await expect(service.start("u1", "ixwiki", "ghost")).rejects.toMatchObject({
      message: 'No wiki user named "ghost"',
    });
    await expect(service.start("u1", "iiwiki", "ghost")).rejects.toMatchObject({
      message: 'No IIWiki user named "ghost"',
    });
    await expect(service.start("u1", "althistory", "ghost")).rejects.toMatchObject({
      message: 'No AltHistory user named "ghost"',
    });
  });

  it("maps a wiki lookup failure to WIKI_UNREACHABLE", async () => {
    const { deps, service } = setup();
    deps.fetchWikiUser.mockRejectedValue(new Error("cloudflare"));
    await expect(service.start("u1", "iiwiki", "Kir")).rejects.toMatchObject({
      code: "WIKI_UNREACHABLE",
    });
  });

  it("never reads or writes the legacy User columns — a legacy squatter cannot block it", async () => {
    const { db, service } = setup();
    // A different user holds the legacy `User.wikiUsername` squat; start() must never consult it.
    await service.start("u1", "ixwiki", "Kir");
    expect(db.user.update).not.toHaveBeenCalled();
    expect(db.user.updateMany).not.toHaveBeenCalled();
  });
});

describe("wiki link verification — confirm()", () => {
  it("verifies when the token is on the user page saved by its own author, and writes the ixwiki legacy columns", async () => {
    const { db, service } = setup();
    db.wikiAccountLink.findUnique.mockResolvedValue({
      id: "l1",
      userId: "u1",
      source: "ixwiki",
      username: "Kir",
      wikiUserId: 7,
      token: "ixstates-verify-abcdef1234",
      tokenExpiresAt: new Date(NOW.getTime() + 1000),
      verifiedAt: null,
    });
    await expect(service.confirm("u1", "ixwiki")).resolves.toEqual({ username: "Kir" });
    expect(db.wikiAccountLink.updateMany).toHaveBeenCalledWith({
      where: { id: "l1", userId: "u1", token: "ixstates-verify-abcdef1234", verifiedAt: null },
      data: {
        verifiedAt: NOW,
        token: null,
        tokenExpiresAt: null,
        // self-service proof: nobody confirmed it by authority, and the account's age and edits are recorded
        verifiedById: null,
        mwRegisteredAt: new Date("2026-01-01T00:00:00Z"),
        mwEditCount: 42,
      },
    });
    expect(db.user.updateMany).toHaveBeenCalledWith({
      where: { wikiUsername: "Kir", id: { not: "u1" } },
      data: { wikiUsername: null, wikiUserId: null },
    });
    expect(db.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "u1" },
        data: expect.objectContaining({ wikiUsername: "Kir", wikiUserId: 7 }),
      })
    );
  });

  it("fails with TOKEN_NOT_FOUND / EXPIRED / NO_PENDING", async () => {
    const { db, deps, service } = setup();
    const pending = {
      id: "l1",
      userId: "u1",
      source: "iiwiki",
      username: "Kir",
      token: "ixstates-verify-abcdef1234",
      verifiedAt: null,
    };
    db.wikiAccountLink.findUnique.mockResolvedValueOnce(null);
    await expect(service.confirm("u1", "iiwiki")).rejects.toMatchObject({ code: "NO_PENDING" });
    db.wikiAccountLink.findUnique.mockResolvedValueOnce({
      ...pending,
      tokenExpiresAt: new Date(NOW.getTime() - 1),
    });
    await expect(service.confirm("u1", "iiwiki")).rejects.toMatchObject({ code: "EXPIRED" });
    db.wikiAccountLink.findUnique.mockResolvedValueOnce({
      ...pending,
      tokenExpiresAt: new Date(NOW.getTime() + 1000),
    });
    deps.fetchUserPageHistory.mockResolvedValueOnce(history([rev("no token here", "Kir")]));
    await expect(service.confirm("u1", "iiwiki")).rejects.toMatchObject({
      code: "TOKEN_NOT_FOUND",
    });
  });

  it("rejects with TOKEN_NOT_FOUND when the token is present but was saved by someone else", async () => {
    const { db, deps, service } = setup();
    db.wikiAccountLink.findUnique.mockResolvedValue({
      id: "l1",
      userId: "u1",
      source: "iiwiki",
      username: "Kir",
      token: "ixstates-verify-abcdef1234",
      tokenExpiresAt: new Date(NOW.getTime() + 1000),
      verifiedAt: null,
    });
    // Anyone can edit a stock MediaWiki user page — the token alone doesn't prove control.
    deps.fetchUserPageHistory.mockResolvedValue(history([rev(`Hello ${TOKEN}`, "SomeoneElse")]));
    await expect(service.confirm("u1", "iiwiki")).rejects.toMatchObject({
      code: "TOKEN_NOT_FOUND",
    });
    expect(db.wikiAccountLink.updateMany).not.toHaveBeenCalled();
  });

  it("does not verify when the row was re-owned or the token changed underneath it (race)", async () => {
    const { db, service } = setup();
    db.wikiAccountLink.findUnique.mockResolvedValue({
      id: "l1",
      userId: "u1",
      source: "iiwiki",
      username: "Kir",
      token: "ixstates-verify-abcdef1234",
      tokenExpiresAt: new Date(NOW.getTime() + 1000),
      verifiedAt: null,
    });
    // The token check outside the tx passed, but by the time the tx runs, another start() re-owned
    // the row (or it already got verified) — updateMany finds no matching row.
    db.wikiAccountLink.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(service.confirm("u1", "iiwiki")).rejects.toMatchObject({ code: "NO_PENDING" });
    expect(db.user.update).not.toHaveBeenCalled();
    expect(db.user.updateMany).not.toHaveBeenCalled();
  });

  it("maps wiki outages to WIKI_UNREACHABLE", async () => {
    const { db, deps, service } = setup();
    db.wikiAccountLink.findUnique.mockResolvedValue({
      id: "l1",
      userId: "u1",
      source: "iiwiki",
      username: "Kir",
      token: "t",
      tokenExpiresAt: new Date(NOW.getTime() + 1000),
      verifiedAt: null,
    });
    deps.fetchUserPageHistory.mockRejectedValue(new Error("cloudflare"));
    await expect(service.confirm("u1", "iiwiki")).rejects.toBeInstanceOf(WikiLinkError);
    await expect(service.confirm("u1", "iiwiki")).rejects.toMatchObject({
      code: "WIKI_UNREACHABLE",
    });
  });

  it("verifies nothing when the wiki cannot be asked for the account's age and edits", async () => {
    const { db, deps, service } = setup();
    db.wikiAccountLink.findUnique.mockResolvedValue({
      id: "l1",
      userId: "u1",
      source: "ixwiki",
      username: "Kir",
      token: "ixstates-verify-abcdef1234",
      tokenExpiresAt: new Date(NOW.getTime() + 1000),
      verifiedAt: null,
    });
    deps.fetchWikiUser.mockRejectedValue(new Error("cloudflare"));
    await expect(service.confirm("u1", "ixwiki")).rejects.toMatchObject({
      code: "WIKI_UNREACHABLE",
    });
    expect(db.wikiAccountLink.updateMany).not.toHaveBeenCalled();
  });

  it("records no age or edit count for an account the wiki does not say them for", async () => {
    const { db, deps, service } = setup();
    db.wikiAccountLink.findUnique.mockResolvedValue({
      id: "l1",
      userId: "u1",
      source: "ixwiki",
      username: "Kir",
      token: "ixstates-verify-abcdef1234",
      tokenExpiresAt: new Date(NOW.getTime() + 1000),
      verifiedAt: null,
    });
    deps.fetchWikiUser.mockResolvedValue({
      username: "Kir",
      userId: 7,
      registration: null,
      editCount: null,
    });
    await service.confirm("u1", "ixwiki");
    expect(db.wikiAccountLink.updateMany.mock.calls[0]?.[0].data).toMatchObject({
      verifiedById: null,
      mwRegisteredAt: null,
      mwEditCount: null,
    });
  });

  it("leaves user.* untouched for a non-ixwiki confirm", async () => {
    const { db, service } = setup();
    db.wikiAccountLink.findUnique.mockResolvedValue({
      id: "l1",
      userId: "u1",
      source: "althistory",
      username: "Kir",
      token: "ixstates-verify-abcdef1234",
      tokenExpiresAt: new Date(NOW.getTime() + 1000),
      verifiedAt: null,
    });
    await expect(service.confirm("u1", "althistory")).resolves.toEqual({ username: "Kir" });
    expect(db.user.update).not.toHaveBeenCalled();
    expect(db.user.updateMany).not.toHaveBeenCalled();
  });
});

describe("wiki link verification — confirm(): the token's first appearance since issue must be the account's (F-3, F-6)", () => {
  const EXPIRES = new Date(NOW.getTime() + 1000);
  const ISSUED = new Date(EXPIRES.getTime() - 24 * 3600 * 1000);
  const SAVE_IT_YOURSELF = "Save the code on your user page yourself, then press Verify";

  function pendingSetup() {
    const ctx = setup();
    ctx.db.wikiAccountLink.findUnique.mockResolvedValue({
      id: "l1",
      userId: "u1",
      source: "iiwiki",
      username: "Kir",
      token: TOKEN,
      tokenExpiresAt: EXPIRES,
      verifiedAt: null,
    });
    return ctx;
  }

  it("reads the revisions saved since the code was issued (tokenExpiresAt − 24h), less a 5-minute clock-skew margin", async () => {
    const { deps, service } = pendingSetup();
    await expect(service.confirm("u1", "iiwiki")).resolves.toEqual({ username: "Kir" });
    expect(deps.fetchUserPageHistory).toHaveBeenCalledWith(
      "iiwiki",
      "Kir",
      new Date(ISSUED.getTime() - 5 * 60_000)
    );
  });

  it("a wiki clock running behind ours: the account's save stamped 2 minutes before issue is still found and accepted", async () => {
    const { deps, service } = pendingSetup();
    const minutes = (m: number) => new Date(ISSUED.getTime() + m * 60_000);
    const page = [
      { at: minutes(-60), ...rev("My page", "Kir") },
      { at: minutes(-2), ...rev(`My page ${TOKEN}`, "Kir") }, // saved after issue, stamped by a slow wiki clock
      { at: minutes(30), ...rev(`Tidied ${TOKEN}`, "TidyBot") },
    ];
    // The wiki answers rvdir=newer&rvstart=<since>: every revision stamped at or after `since`, oldest first.
    deps.fetchUserPageHistory.mockImplementation((_source: string, _user: string, since: Date) =>
      Promise.resolve(
        history(
          page.filter((r) => r.at >= since).map(({ content, author }) => rev(content, author))
        )
      )
    );
    await expect(service.confirm("u1", "iiwiki")).resolves.toEqual({ username: "Kir" });
  });

  it("refuses a token planted by someone else, even after the account itself edited the page", async () => {
    const { db, deps, service } = pendingSetup();
    deps.fetchUserPageHistory.mockResolvedValue(
      history([rev(`My page ${TOKEN}`, "Mallory"), rev(`My page, tidied. ${TOKEN}`, "Kir")])
    );
    await expect(service.confirm("u1", "iiwiki")).rejects.toMatchObject({
      code: "TOKEN_NOT_FOUND",
      message: "The code must be saved on User:Kir by Kir themself",
    });
    expect(db.wikiAccountLink.updateMany).not.toHaveBeenCalled();
  });

  it("refuses a laundered token: planted, vandalised away, then restored by the account's revert", async () => {
    const { db, deps, service } = pendingSetup();
    deps.fetchUserPageHistory.mockResolvedValue(
      history([
        rev(`My page <!-- ${TOKEN} -->`, "Mallory"),
        rev("vandalised", "Vandal"),
        rev(`My page <!-- ${TOKEN} -->`, "Kir"), // Kir's revert restores the planted token
      ])
    );
    await expect(service.confirm("u1", "iiwiki")).rejects.toMatchObject({
      code: "TOKEN_NOT_FOUND",
    });
    expect(db.wikiAccountLink.updateMany).not.toHaveBeenCalled();
  });

  it("accepts a token the account saved itself, even if someone edited the page after", async () => {
    const { db, deps, service } = pendingSetup();
    deps.fetchUserPageHistory.mockResolvedValue(
      history([
        rev("My page", "Mallory"),
        rev(`My page ${TOKEN}`, "Kir"),
        rev(`Tidied ${TOKEN}`, "TidyBot"),
      ])
    );
    await expect(service.confirm("u1", "iiwiki")).resolves.toEqual({ username: "Kir" });
    expect(db.wikiAccountLink.updateMany).toHaveBeenCalledTimes(1);
  });

  it("accepts a user page the account created with the token", async () => {
    const { deps, service } = pendingSetup();
    deps.fetchUserPageHistory.mockResolvedValue(
      history([rev(TOKEN, "Kir"), rev(`Hi ${TOKEN}`, "Kir")])
    );
    await expect(service.confirm("u1", "iiwiki")).resolves.toEqual({ username: "Kir" });
  });

  it("refuses when the window is truncated (the first appearance cannot be established)", async () => {
    const { db, deps, service } = pendingSetup();
    const twenty = Array.from({ length: 20 }, (_, i) => rev(`edit ${i} ${TOKEN}`, "Kir"));
    deps.fetchUserPageHistory.mockResolvedValue(history(twenty, false));
    await expect(service.confirm("u1", "iiwiki")).rejects.toMatchObject({
      code: "TOKEN_NOT_FOUND",
      message: SAVE_IT_YOURSELF,
    });
    expect(db.wikiAccountLink.updateMany).not.toHaveBeenCalled();
  });

  it("refuses when any revision in the window has hidden content or a hidden author (unattributable)", async () => {
    for (const hidden of [rev(null, "Mallory"), rev(`x ${TOKEN}`, null)]) {
      const { db, deps, service } = pendingSetup();
      deps.fetchUserPageHistory.mockResolvedValue(history([hidden, rev(`Mine ${TOKEN}`, "Kir")]));
      await expect(service.confirm("u1", "iiwiki")).rejects.toMatchObject({
        code: "TOKEN_NOT_FOUND",
        message: SAVE_IT_YOURSELF,
      });
      expect(db.wikiAccountLink.updateMany).not.toHaveBeenCalled();
    }
  });

  it("still requires the LATEST revision to contain the token", async () => {
    const { deps, service } = pendingSetup();
    deps.fetchUserPageHistory.mockResolvedValue(
      history([rev(TOKEN, "Kir"), rev("removed", "Mallory")])
    );
    await expect(service.confirm("u1", "iiwiki")).rejects.toMatchObject({
      code: "TOKEN_NOT_FOUND",
    });
    const empty = pendingSetup();
    empty.deps.fetchUserPageHistory.mockResolvedValue(history([]));
    await expect(empty.service.confirm("u1", "iiwiki")).rejects.toMatchObject({
      code: "TOKEN_NOT_FOUND",
    });
  });
});

describe("wiki link verification — adminVerify() (admin authority substitutes for the token)", () => {
  it("refuses when another user already holds a verified row — checked inside the transaction, not before it", async () => {
    const { db, service } = setup();
    // Same trap as start()'s equivalent test: only the tx-scoped client sees the verified holder.
    db.wikiAccountLink.findUnique.mockResolvedValue(null);
    const tx = {
      wikiAccountLink: {
        findUnique: jest.fn().mockResolvedValue({ userId: "other", verifiedAt: NOW }),
        deleteMany: jest.fn(),
        upsert: jest.fn(),
      },
      user: { updateMany: jest.fn(), update: jest.fn() },
    };
    db.$transaction.mockImplementation((cb: any) => cb(tx));
    await expect(service.adminVerify("u1", "ixwiki", "Kir", 7, ADMIN)).rejects.toMatchObject({
      code: "TAKEN",
    });
    expect(tx.wikiAccountLink.upsert).not.toHaveBeenCalled();
  });

  it("writes a verified row and the ixwiki legacy columns without ever issuing a token", async () => {
    const { db, service } = setup();
    await expect(service.adminVerify("u1", "ixwiki", "kir", 7, ADMIN)).resolves.toEqual({
      username: "Kir",
    });
    expect(db.wikiAccountLink.upsert).toHaveBeenCalledWith({
      where: { source_username: { source: "ixwiki", username: "Kir" } },
      update: {
        userId: "u1",
        wikiUserId: 7,
        verifiedAt: NOW,
        token: null,
        tokenExpiresAt: null,
        verifiedById: "dbadmin",
        mwRegisteredAt: null,
        mwEditCount: null,
      },
      create: {
        userId: "u1",
        source: "ixwiki",
        username: "Kir",
        wikiUserId: 7,
        verifiedAt: NOW,
        verifiedById: "dbadmin",
      },
    });
    expect(db.user.updateMany).toHaveBeenCalledWith({
      where: { wikiUsername: "Kir", id: { not: "u1" } },
      data: { wikiUsername: null, wikiUserId: null },
    });
    expect(db.user.update).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: { wikiUsername: "Kir", wikiUserId: 7, lastWikiSync: NOW },
    });
  });

  it("records who confirmed the link, so the rights engine can tell it from a self-proven one", async () => {
    const { db, service } = setup();
    await service.adminVerify("u1", "ixwiki", "Kir", 7, OWNER);
    expect(db.wikiAccountLink.upsert.mock.calls[0]?.[0].create).toMatchObject({
      verifiedById: "dbowner",
    });
  });

  it("refuses an admin linking their own account, and lets a system owner", async () => {
    const { db, service } = setup();
    await expect(
      service.adminVerify("dbadmin", "ixwiki", "Mwbureaucrat", 7, ADMIN)
    ).rejects.toMatchObject({
      code: "NOT_ALLOWED",
    });
    expect(db.wikiAccountLink.upsert).not.toHaveBeenCalled();
    expect(db.user.update).not.toHaveBeenCalled();

    await expect(service.adminVerify("dbowner", "ixwiki", "Kir", 7, OWNER)).resolves.toEqual({
      username: "Kir",
    });
  });

  it("refuses a wiki name that already holds pending groups unless the admin is a system owner", async () => {
    const { db, service } = setup();
    db.wikiUserGroup.count.mockResolvedValue(1);

    await expect(
      service.adminVerify("u1", "ixwiki", "Mwbureaucrat", 7, ADMIN)
    ).rejects.toMatchObject({
      code: "NOT_ALLOWED",
      message: expect.stringContaining("only a system owner"),
    });
    expect(db.wikiUserGroup.count).toHaveBeenCalledWith({
      where: { wikiUsername: "Mwbureaucrat" },
    });
    expect(db.wikiAccountLink.upsert).not.toHaveBeenCalled();
    expect(db.user.update).not.toHaveBeenCalled();

    await expect(service.adminVerify("u1", "ixwiki", "Mwbureaucrat", 7, OWNER)).resolves.toEqual({
      username: "Mwbureaucrat",
    });
  });

  it("does not look at pending groups for another wiki's links", async () => {
    const { db, service } = setup();
    db.wikiUserGroup.count.mockResolvedValue(1);
    await expect(service.adminVerify("u1", "iiwiki", "Kir", 7, ADMIN)).resolves.toEqual({
      username: "Kir",
    });
    expect(db.wikiUserGroup.count).not.toHaveBeenCalled();
  });

  it("accepts a null wikiUserId (PostgreSQL fast-path lookups hard-code id 1, which is not real)", async () => {
    const { db, service } = setup();
    await expect(service.adminVerify("u1", "ixwiki", "Kir", null, ADMIN)).resolves.toEqual({
      username: "Kir",
    });
    expect(db.wikiAccountLink.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ create: expect.objectContaining({ wikiUserId: null }) })
    );
  });
});

describe("wiki link verification — unlink() and list()", () => {
  it("clears the ixwiki legacy columns on unlink", async () => {
    const { db, service } = setup();
    await service.unlink("u1", "ixwiki");
    expect(db.wikiAccountLink.deleteMany).toHaveBeenCalledWith({
      where: { userId: "u1", source: "ixwiki" },
    });
    expect(db.user.update).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: { wikiUsername: null, wikiUserId: null, lastWikiSync: null },
    });
  });

  it("leaves the legacy columns untouched when unlinking a non-ixwiki source", async () => {
    const { db, service } = setup();
    await service.unlink("u1", "iiwiki");
    expect(db.wikiAccountLink.deleteMany).toHaveBeenCalledWith({
      where: { userId: "u1", source: "iiwiki" },
    });
    expect(db.user.update).not.toHaveBeenCalled();
  });

  it("maps verified/pending flags for each linked source", async () => {
    const { db, service } = setup();
    db.wikiAccountLink.findMany.mockResolvedValue([
      { source: "ixwiki", username: "Kir", verifiedAt: NOW, token: null, tokenExpiresAt: null },
      {
        source: "iiwiki",
        username: "Kir",
        verifiedAt: null,
        token: "t",
        tokenExpiresAt: new Date(NOW.getTime() + 1000),
      },
    ]);
    await expect(service.list("u1")).resolves.toEqual([
      { source: "ixwiki", username: "Kir", verified: true, pending: false },
      { source: "iiwiki", username: "Kir", verified: false, pending: true },
    ]);
  });

  it("an expired code is not pending (ruling F-4) — the row offers a fresh start instead of a dead Verify", async () => {
    const { db, service } = setup();
    db.wikiAccountLink.findMany.mockResolvedValue([
      {
        source: "iiwiki",
        username: "Kir",
        verifiedAt: null,
        token: "t",
        tokenExpiresAt: new Date(NOW.getTime() - 1),
      },
      { source: "althistory", username: "Kir", verifiedAt: null, token: "t", tokenExpiresAt: null },
    ]);
    await expect(service.list("u1")).resolves.toEqual([
      { source: "iiwiki", username: "Kir", verified: false, pending: false },
      { source: "althistory", username: "Kir", verified: false, pending: false },
    ]);
  });
});

describe("admin.unlinkUserWiki", () => {
  it("revokes the verified ixwiki link and clears the legacy columns (ixwiki is the default source)", async () => {
    const { caller, d } = adminCaller();
    await expect(caller.unlinkUserWiki({ userId: "u1" })).resolves.toEqual({ success: true });
    expect(d.wikiAccountLink.deleteMany).toHaveBeenCalledWith({
      where: { userId: "u1", source: "ixwiki" },
    });
    expect(d.user.update).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: { wikiUsername: null, wikiUserId: null, lastWikiSync: null },
    });
  });

  it("revokes an iiwiki or althistory link without touching the ixwiki legacy columns", async () => {
    for (const source of ["iiwiki", "althistory"] as const) {
      const { caller, d } = adminCaller();
      await caller.unlinkUserWiki({ userId: "u1", source });
      expect(d.wikiAccountLink.deleteMany).toHaveBeenCalledWith({
        where: { userId: "u1", source },
      });
      expect(d.user.update).not.toHaveBeenCalled();
    }
  });
});

describe("admin.linkUserWiki", () => {
  it("a TAKEN refusal (another player verified the account) is CONFLICT and writes nothing", async () => {
    const { caller, d } = adminCaller({ userId: "someone-else", verifiedAt: new Date() });
    await expect(caller.linkUserWiki({ userId: "u1", wikiUsername: "Kir" })).rejects.toMatchObject({
      code: "CONFLICT",
    });
    expect(legacyWrite).not.toHaveBeenCalled();
    expect(d.user.update).not.toHaveBeenCalled();
    expect(d.user.updateMany).not.toHaveBeenCalled();
    expect(d.wikiAccountLink.deleteMany).not.toHaveBeenCalled();
    expect(d.wikiAccountLink.upsert).not.toHaveBeenCalled();
  });

  it("records the verified link and the legacy columns in the service's one transaction", async () => {
    const { caller, d } = adminCaller();
    await expect(caller.linkUserWiki({ userId: "u1", wikiUsername: "kir" })).resolves.toMatchObject(
      {
        success: true,
        wikiUsername: "Kir",
      }
    );
    expect(d.wikiAccountLink.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ userId: "u1", username: "Kir", wikiUserId: 7 }),
      })
    );
    expect(d.user.update).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: expect.objectContaining({ wikiUsername: "Kir", wikiUserId: 7 }),
    });
    expect(legacyWrite).not.toHaveBeenCalled();
  });

  it("records the confirming admin on the link", async () => {
    const { caller, d } = adminCaller();
    await caller.linkUserWiki({ userId: "u1", wikiUsername: "kir" });
    expect(d.wikiAccountLink.upsert.mock.calls[0]?.[0].create).toMatchObject({
      verifiedById: "db_user_caller",
    });
  });

  // The security review's exploit: a staff member links themselves to an unclaimed MediaWiki
  // bureaucrat's name, expecting to inherit the groups imported for that name.
  it("refuses staff linking their own account, FORBIDDEN, writing nothing", async () => {
    const { caller, d } = adminCaller();
    await expect(
      caller.linkUserWiki({ userId: "db_user_caller", wikiUsername: "Mwbureaucrat" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(d.wikiAccountLink.upsert).not.toHaveBeenCalled();
    expect(d.user.update).not.toHaveBeenCalled();
  });

  it("refuses staff linking anyone to a name that holds imported groups, FORBIDDEN, writing nothing", async () => {
    const { caller, d } = adminCaller();
    d.wikiUserGroup.count.mockResolvedValue(1);
    await expect(
      caller.linkUserWiki({ userId: "u1", wikiUsername: "Mwbureaucrat" })
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: expect.stringContaining("system owner"),
    });
    expect(d.wikiAccountLink.upsert).not.toHaveBeenCalled();
    expect(d.user.update).not.toHaveBeenCalled();
  });

  it("lets a system owner do both", async () => {
    jest.mocked(isSystemOwner).mockReturnValue(true);
    const { caller, d } = adminCaller();
    d.wikiUserGroup.count.mockResolvedValue(1);
    await expect(
      caller.linkUserWiki({ userId: "db_user_caller", wikiUsername: "Mwbureaucrat" })
    ).resolves.toMatchObject({ success: true });
    expect(d.wikiAccountLink.upsert.mock.calls[0]?.[0].create).toMatchObject({
      verifiedById: "db_user_caller",
    });
  });

  it("an unknown wiki user is BAD_REQUEST and writes nothing", async () => {
    const { getUserInfo } = jest.requireMock("~/lib/wiki-os/adapters/mediawiki/bridge");
    getUserInfo.mockResolvedValueOnce({ exists: false });
    const { caller, d } = adminCaller();
    await expect(
      caller.linkUserWiki({ userId: "u1", wikiUsername: "Nobody" })
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    expect(d.wikiAccountLink.upsert).not.toHaveBeenCalled();
    expect(legacyWrite).not.toHaveBeenCalled();
  });
});
