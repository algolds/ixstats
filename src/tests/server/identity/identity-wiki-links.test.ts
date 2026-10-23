/**
 * Sister wiki link verification (`createWikiLinkService`): a player proves an IIWiki or AltHistory account by saving
 * a one-time code on their User: page, and only a first appearance by the account itself counts (a planted, laundered
 * or unattributable token never does); a username another player verified is refused inside the transaction. IxWiki
 * is not a source here: an old IxWiki name joins an account through a name claim, so the service never reads or
 * writes the user row.
 */
import {
  createWikiLinkService,
  WikiLinkError,
} from "~/server/modules/identity/identity.wiki-links";

const NOW = new Date("2026-09-27T12:00:00Z");
const TOKEN = "ixstates-verify-abcdef1234";
type Rev = { content: string | null; author: string | null };
const rev = (content: string | null, author: string | null): Rev => ({ content, author });
/** The User: page revisions saved since the code was issued, oldest first; `complete` = the window is not truncated. */
const history = (revisions: Rev[], complete = true) => ({ revisions, complete });

/** What a transaction callback is handed: link rows only. */
type LinkTx = { wikiAccountLink: Record<string, jest.Mock> };
type TxCallback = (tx: LinkTx) => Promise<void>;

/** The db holds link rows only: a user-row write would throw, so every test also proves the service never makes one. */
function setup() {
  const db = {
    $transaction: jest.fn(),
    wikiAccountLink: {
      findUnique: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      upsert: jest
        .fn()
        .mockImplementation(({ create }: { create: object }) =>
          Promise.resolve({ id: "l1", ...create })
        ),
      update: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  };
  db.$transaction.mockImplementation((cb: TxCallback) => cb(db));
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
  return { db, deps, service: createWikiLinkService(db as never, deps) };
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
    db.$transaction.mockImplementation((cb: TxCallback) => cb(tx));
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

  it("names the sister wiki in an error, never the raw source id", async () => {
    const { deps, service } = setup();
    deps.fetchWikiUser.mockResolvedValue(null);
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
});

describe("wiki link verification — confirm()", () => {
  it("verifies when the token is on the user page saved by its own author", async () => {
    const { db, service } = setup();
    db.wikiAccountLink.findUnique.mockResolvedValue({
      id: "l1",
      userId: "u1",
      source: "althistory",
      username: "Kir",
      wikiUserId: 7,
      token: "ixstates-verify-abcdef1234",
      tokenExpiresAt: new Date(NOW.getTime() + 1000),
      verifiedAt: null,
    });
    await expect(service.confirm("u1", "althistory")).resolves.toEqual({ username: "Kir" });
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
    // The token check passed, but by the time the compare-and-swap runs another start() re-owned
    // the row (or it already got verified) — updateMany finds no matching row.
    db.wikiAccountLink.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(service.confirm("u1", "iiwiki")).rejects.toMatchObject({ code: "NO_PENDING" });
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
      source: "iiwiki",
      username: "Kir",
      token: "ixstates-verify-abcdef1234",
      tokenExpiresAt: new Date(NOW.getTime() + 1000),
      verifiedAt: null,
    });
    deps.fetchWikiUser.mockRejectedValue(new Error("cloudflare"));
    await expect(service.confirm("u1", "iiwiki")).rejects.toMatchObject({
      code: "WIKI_UNREACHABLE",
    });
    expect(db.wikiAccountLink.updateMany).not.toHaveBeenCalled();
  });

  it("records no age or edit count for an account the wiki does not say them for", async () => {
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
    deps.fetchWikiUser.mockResolvedValue({
      username: "Kir",
      userId: 7,
      registration: null,
      editCount: null,
    });
    await service.confirm("u1", "iiwiki");
    expect(db.wikiAccountLink.updateMany.mock.calls[0]?.[0].data).toMatchObject({
      verifiedById: null,
      mwRegisteredAt: null,
      mwEditCount: null,
    });
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

describe("wiki link verification — unlink() and list()", () => {
  it("unlink deletes the account's link on that sister wiki and nothing else", async () => {
    const { db, service } = setup();
    await service.unlink("u1", "iiwiki");
    expect(db.wikiAccountLink.deleteMany).toHaveBeenCalledWith({
      where: { userId: "u1", source: "iiwiki" },
    });
  });

  it("lists the sister wiki links only: a leftover IxWiki row is not a link any more", async () => {
    const { db, service } = setup();
    await service.list("u1");
    expect(db.wikiAccountLink.findMany).toHaveBeenCalledWith({
      where: { userId: "u1", source: { in: ["iiwiki", "althistory"] } },
      orderBy: { source: "asc" },
    });
  });

  it("maps verified/pending flags for each linked source", async () => {
    const { db, service } = setup();
    db.wikiAccountLink.findMany.mockResolvedValue([
      { source: "althistory", username: "Kir", verifiedAt: NOW, token: null, tokenExpiresAt: null },
      {
        source: "iiwiki",
        username: "Kir",
        verifiedAt: null,
        token: "t",
        tokenExpiresAt: new Date(NOW.getTime() + 1000),
      },
    ]);
    await expect(service.list("u1")).resolves.toEqual([
      { source: "althistory", username: "Kir", verified: true, pending: false },
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
