import { createWikiLinkService, WikiLinkError } from "~/server/modules/identity/identity.wiki-links";

const NOW = new Date("2026-09-27T12:00:00Z");

function setup(overrides: Partial<Record<string, any>> = {}) {
  const db: any = {
    $transaction: jest.fn((cb: any) => cb(db)),
    wikiAccountLink: {
      findUnique: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      upsert: jest.fn().mockImplementation(({ create }: any) => Promise.resolve({ id: "l1", ...create })),
      update: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    user: { update: jest.fn().mockResolvedValue({}), updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
    ...overrides,
  };
  const deps = {
    fetchWikiUser: jest.fn().mockResolvedValue({ username: "Kir", userId: 7 }),
    fetchUserPageLatest: jest.fn().mockResolvedValue({ content: "Hello ixstates-verify-abcdef1234", author: "Kir" }),
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

  it("refuses a username another user has verified, and never upserts", async () => {
    const { db, service } = setup();
    db.wikiAccountLink.findUnique.mockResolvedValue({ userId: "other", verifiedAt: NOW });
    await expect(service.start("u1", "iiwiki", "Kir")).rejects.toMatchObject({ code: "TAKEN" });
    expect(db.wikiAccountLink.upsert).not.toHaveBeenCalled();
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
    await expect(service.start("u1", "iiwiki", "ghost")).rejects.toMatchObject({ code: "WIKI_USER_NOT_FOUND" });
  });

  it("maps a wiki lookup failure to WIKI_UNREACHABLE", async () => {
    const { deps, service } = setup();
    deps.fetchWikiUser.mockRejectedValue(new Error("cloudflare"));
    await expect(service.start("u1", "iiwiki", "Kir")).rejects.toMatchObject({ code: "WIKI_UNREACHABLE" });
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
      data: { verifiedAt: NOW, token: null, tokenExpiresAt: null },
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
    db.wikiAccountLink.findUnique.mockResolvedValueOnce({ ...pending, tokenExpiresAt: new Date(NOW.getTime() - 1) });
    await expect(service.confirm("u1", "iiwiki")).rejects.toMatchObject({ code: "EXPIRED" });
    db.wikiAccountLink.findUnique.mockResolvedValueOnce({ ...pending, tokenExpiresAt: new Date(NOW.getTime() + 1000) });
    deps.fetchUserPageLatest.mockResolvedValueOnce({ content: "no token here", author: "Kir" });
    await expect(service.confirm("u1", "iiwiki")).rejects.toMatchObject({ code: "TOKEN_NOT_FOUND" });
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
    deps.fetchUserPageLatest.mockResolvedValue({
      content: "Hello ixstates-verify-abcdef1234",
      author: "SomeoneElse",
    });
    await expect(service.confirm("u1", "iiwiki")).rejects.toMatchObject({ code: "TOKEN_NOT_FOUND" });
    expect(db.wikiAccountLink.updateMany).not.toHaveBeenCalled();
  });

  it("does not verify when the row was re-owned or the token changed underneath it (race)", async () => {
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
    deps.fetchUserPageLatest.mockRejectedValue(new Error("cloudflare"));
    await expect(service.confirm("u1", "iiwiki")).rejects.toBeInstanceOf(WikiLinkError);
    await expect(service.confirm("u1", "iiwiki")).rejects.toMatchObject({ code: "WIKI_UNREACHABLE" });
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

describe("wiki link verification — adminVerify() (admin authority substitutes for the token)", () => {
  it("refuses when another user already holds a verified row for that username", async () => {
    const { db, service } = setup();
    db.wikiAccountLink.findUnique.mockResolvedValue({ userId: "other", verifiedAt: NOW });
    await expect(service.adminVerify("u1", "ixwiki", "Kir", 7)).rejects.toMatchObject({ code: "TAKEN" });
    expect(db.wikiAccountLink.upsert).not.toHaveBeenCalled();
  });

  it("writes a verified row and the ixwiki legacy columns without ever issuing a token", async () => {
    const { db, service } = setup();
    await expect(service.adminVerify("u1", "ixwiki", "kir", 7)).resolves.toEqual({ username: "Kir" });
    expect(db.wikiAccountLink.upsert).toHaveBeenCalledWith({
      where: { source_username: { source: "ixwiki", username: "Kir" } },
      update: { userId: "u1", wikiUserId: 7, verifiedAt: NOW, token: null, tokenExpiresAt: null },
      create: { userId: "u1", source: "ixwiki", username: "Kir", wikiUserId: 7, verifiedAt: NOW },
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

  it("accepts a null wikiUserId (PostgreSQL fast-path lookups hard-code id 1, which is not real)", async () => {
    const { db, service } = setup();
    await expect(service.adminVerify("u1", "ixwiki", "Kir", null)).resolves.toEqual({ username: "Kir" });
    expect(db.wikiAccountLink.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ create: expect.objectContaining({ wikiUserId: null }) })
    );
  });
});

describe("wiki link verification — unlink() and list()", () => {
  it("clears the ixwiki legacy columns on unlink", async () => {
    const { db, service } = setup();
    await service.unlink("u1", "ixwiki");
    expect(db.wikiAccountLink.deleteMany).toHaveBeenCalledWith({ where: { userId: "u1", source: "ixwiki" } });
    expect(db.user.update).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: { wikiUsername: null, wikiUserId: null, lastWikiSync: null },
    });
  });

  it("leaves the legacy columns untouched when unlinking a non-ixwiki source", async () => {
    const { db, service } = setup();
    await service.unlink("u1", "iiwiki");
    expect(db.wikiAccountLink.deleteMany).toHaveBeenCalledWith({ where: { userId: "u1", source: "iiwiki" } });
    expect(db.user.update).not.toHaveBeenCalled();
  });

  it("maps verified/pending flags for each linked source", async () => {
    const { db, service } = setup();
    db.wikiAccountLink.findMany.mockResolvedValue([
      { source: "ixwiki", username: "Kir", verifiedAt: NOW, token: null },
      { source: "iiwiki", username: "Kir", verifiedAt: null, token: "t" },
    ]);
    await expect(service.list("u1")).resolves.toEqual([
      { source: "ixwiki", username: "Kir", verified: true, pending: false },
      { source: "iiwiki", username: "Kir", verified: false, pending: true },
    ]);
  });
});
