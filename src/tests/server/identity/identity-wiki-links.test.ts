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
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    user: { update: jest.fn().mockResolvedValue({}), updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
    ...overrides,
  };
  const deps = {
    fetchWikiUser: jest.fn().mockResolvedValue({ username: "Kir", userId: 7 }),
    fetchUserPageWikitext: jest.fn().mockResolvedValue("Hello ixstates-verify-abcdef1234"),
    now: () => NOW,
    newToken: () => "ixstates-verify-abcdef1234",
  };
  return { db, deps, service: createWikiLinkService(db, deps) };
}

describe("wiki link verification", () => {
  it("issues a 24h token for an existing wiki user", async () => {
    const { db, service } = setup();
    const res = await service.start("u1", "iiwiki", "kir");
    expect(res.token).toBe("ixstates-verify-abcdef1234");
    expect(res.username).toBe("Kir");
    expect(res.expiresAt.getTime() - NOW.getTime()).toBe(24 * 3600 * 1000);
    expect(db.wikiAccountLink.upsert).toHaveBeenCalled();
  });

  it("refuses a username another user has verified", async () => {
    const { db, service } = setup();
    db.wikiAccountLink.findUnique.mockResolvedValue({ userId: "other", verifiedAt: NOW });
    await expect(service.start("u1", "iiwiki", "Kir")).rejects.toMatchObject({ code: "TAKEN" });
  });

  it("rejects a wiki user that does not exist", async () => {
    const { deps, service } = setup();
    deps.fetchWikiUser.mockResolvedValue(null);
    await expect(service.start("u1", "iiwiki", "ghost")).rejects.toMatchObject({ code: "WIKI_USER_NOT_FOUND" });
  });

  it("verifies when the token is on the user page and writes the ixwiki legacy columns", async () => {
    const { db, service } = setup();
    db.wikiAccountLink.findUnique.mockResolvedValue({
      id: "l1", userId: "u1", source: "ixwiki", username: "Kir", wikiUserId: 7,
      token: "ixstates-verify-abcdef1234", tokenExpiresAt: new Date(NOW.getTime() + 1000), verifiedAt: null,
    });
    await expect(service.confirm("u1", "ixwiki")).resolves.toEqual({ username: "Kir" });
    expect(db.user.updateMany).toHaveBeenCalledWith({
      where: { wikiUsername: "Kir", id: { not: "u1" } },
      data: { wikiUsername: null, wikiUserId: null },
    });
    expect(db.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "u1" }, data: expect.objectContaining({ wikiUsername: "Kir", wikiUserId: 7 }) })
    );
  });

  it("fails with TOKEN_NOT_FOUND / EXPIRED / NO_PENDING", async () => {
    const { db, deps, service } = setup();
    const pending = { id: "l1", userId: "u1", source: "iiwiki", username: "Kir", token: "ixstates-verify-abcdef1234", verifiedAt: null };
    db.wikiAccountLink.findUnique.mockResolvedValueOnce(null);
    await expect(service.confirm("u1", "iiwiki")).rejects.toMatchObject({ code: "NO_PENDING" });
    db.wikiAccountLink.findUnique.mockResolvedValueOnce({ ...pending, tokenExpiresAt: new Date(NOW.getTime() - 1) });
    await expect(service.confirm("u1", "iiwiki")).rejects.toMatchObject({ code: "EXPIRED" });
    db.wikiAccountLink.findUnique.mockResolvedValueOnce({ ...pending, tokenExpiresAt: new Date(NOW.getTime() + 1000) });
    deps.fetchUserPageWikitext.mockResolvedValueOnce("no token here");
    await expect(service.confirm("u1", "iiwiki")).rejects.toMatchObject({ code: "TOKEN_NOT_FOUND" });
  });

  it("maps wiki outages to WIKI_UNREACHABLE", async () => {
    const { db, deps, service } = setup();
    db.wikiAccountLink.findUnique.mockResolvedValue({
      id: "l1", userId: "u1", source: "iiwiki", username: "Kir", token: "t", tokenExpiresAt: new Date(NOW.getTime() + 1000), verifiedAt: null,
    });
    deps.fetchUserPageWikitext.mockRejectedValue(new Error("cloudflare"));
    await expect(service.confirm("u1", "iiwiki")).rejects.toBeInstanceOf(WikiLinkError);
    await expect(service.confirm("u1", "iiwiki")).rejects.toMatchObject({ code: "WIKI_UNREACHABLE" });
  });
});
