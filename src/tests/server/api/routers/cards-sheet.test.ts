/** @jest-environment node */
/**
 * cards.getSheet: parses `from`, ignores a malformed one, checks showcases against the passport switch, and finds a
 * holder by the passport handle they show (`holderOf`, the real handle chain over a mocked database).
 */
jest.mock("~/server/db", () => ({
  db: { user: { findUnique: jest.fn(), findFirst: jest.fn() } },
}));
jest.mock("~/lib/cards/hub/sheet", () => ({ loadCardSheet: jest.fn(async () => null) }));
jest.mock("~/server/modules/identity/identity.privacy", () => ({
  loadPassportSettings: jest.fn(async () => ({ visibility: { vaultCards: false } })),
}));
jest.mock("~/lib/wiki-os/adapters/mediawiki/bridge", () => ({
  getArticleWikitext: jest.fn(async () => null),
  getArticleIntro: jest.fn(async () => ({ text: "An intro." })),
}));

import { createCallerFactory } from "~/server/api/trpc";
import { cardsSheetRouter } from "~/server/api/routers/cards/sheet";
import { holderOf, vaultVisible } from "~/server/api/routers/cards/_passport";
import { db as serverDb } from "~/server/db";
import { loadCardSheet } from "~/lib/cards/hub/sheet";
import { loadPassportSettings } from "~/server/modules/identity/identity.privacy";
import { getArticleIntro, getArticleWikitext } from "~/lib/wiki-os/adapters/mediawiki/bridge";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { createMockPrisma } from "~/tests/helpers/mock-db";

const createCaller = createCallerFactory(cardsSheetRouter);
const signedOut = () => createCaller(createMockRouterContext({ auth: null, user: null }) as never);

beforeEach(() => jest.clearAllMocks());

describe("cards.getSheet", () => {
  it("passes the viewer, the card and where the sheet was opened from", async () => {
    const db = createMockPrisma();
    const caller = createCaller(
      createMockRouterContext({
        db,
        auth: { userId: "clerk_me" },
        user: { id: "db_me", clerkUserId: "clerk_me" },
      }) as never
    );
    await expect(caller.getSheet({ cardId: "c1", from: "showcase.s1" })).resolves.toBeNull();
    const [passedDb, viewer, card, options] = jest.mocked(loadCardSheet).mock.calls[0]!;
    expect(passedDb).toBe(db);
    expect([viewer, card, options.from]).toEqual(["db_me", "c1", { kind: "showcase", id: "s1" }]);
    expect(options.rules.vaultVisible).toBe(vaultVisible);
    expect(options.rules.holderOf).toBe(holderOf);
    await expect(options.rules.vaultVisible("owner")).resolves.toBe(false);
    expect(loadPassportSettings).toHaveBeenCalledWith("owner");
  });

  it("takes any passport handle as the holder, up to MediaWiki's 255 characters", async () => {
    const caller = createCaller(createMockRouterContext({ db: createMockPrisma() }) as never);
    await caller.getSheet({ cardId: "c1", from: "holder.Takatta Loa" });
    await caller.getSheet({ cardId: "c1", from: `holder.${"x".repeat(255)}` });
    expect(jest.mocked(loadCardSheet).mock.calls.map((call) => call[3].from)).toEqual([
      { kind: "holder", handle: "Takatta Loa" },
      { kind: "holder", handle: "x".repeat(255) },
    ]);
  });

  it("drops a malformed or missing from", async () => {
    const caller = createCaller(createMockRouterContext({ db: createMockPrisma() }) as never);
    await caller.getSheet({ cardId: "c1", from: "offer.<script>" });
    await caller.getSheet({ cardId: "c1" });
    expect(jest.mocked(loadCardSheet).mock.calls.map((call) => call[3].from)).toEqual([null, null]);
  });

  it("refuses a signed-out caller and an oversized input", async () => {
    await expect(signedOut().getSheet({ cardId: "c1" })).rejects.toMatchObject({
      cause: { code: "UNAUTHORIZED" },
    });
    const caller = createCaller(createMockRouterContext({ db: createMockPrisma() }) as never);
    await expect(caller.getSheet({ cardId: "x".repeat(65) })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    await expect(caller.getSheet({ cardId: "" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(caller.getSheet({ cardId: "c1", from: "x".repeat(263) })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    expect(loadCardSheet).not.toHaveBeenCalled();
  });
});

describe("vaultVisible", () => {
  it("is the passport's Vault cards switch", async () => {
    jest.mocked(loadPassportSettings).mockResolvedValueOnce({
      visibility: { vaultCards: true },
    } as never);
    await expect(vaultVisible("u1")).resolves.toBe(true);
    expect(loadPassportSettings).toHaveBeenCalledWith("u1");
  });
});

describe("holderOf", () => {
  const users = jest.mocked(serverDb.user);

  it("finds a holder with no stored handle by their forum name or their Clerk id", async () => {
    users.findUnique.mockResolvedValue(null);
    users.findFirst.mockResolvedValueOnce({ id: "u_forum" } as never);
    await expect(holderOf("Helvianir")).resolves.toBe("u_forum");
    expect(users.findFirst.mock.calls[0]![0]!.where!.OR).toEqual(
      expect.arrayContaining([{ forumUsername: { equals: "Helvianir", mode: "insensitive" } }])
    );
    users.findFirst.mockResolvedValueOnce({ id: "u_clerk" } as never);
    await expect(holderOf("user_2abcDEF345ghiJKL678mnoPQR90s")).resolves.toBe("u_clerk");
    expect(users.findFirst.mock.calls[1]![0]!.where!.OR).toEqual(
      expect.arrayContaining([{ clerkUserId: "user_2abcDEF345ghiJKL678mnoPQR90s" }])
    );
  });

  it("finds a holder by their stored handle first", async () => {
    users.findUnique.mockResolvedValueOnce({ id: "u_stored" } as never);
    await expect(holderOf("ann")).resolves.toBe("u_stored");
    expect(users.findUnique.mock.calls[0]![0].where).toEqual({ handle: "ann" });
    expect(users.findFirst).not.toHaveBeenCalled();
  });

  it("names nobody for a handle no player has, or when the lookup fails", async () => {
    users.findUnique.mockResolvedValue(null);
    users.findFirst.mockResolvedValueOnce(null);
    await expect(holderOf("Takatta Loa")).resolves.toBeNull();
    users.findFirst.mockRejectedValueOnce(new Error("database down"));
    await expect(holderOf("Takatta Loa")).resolves.toBeNull();
  });
});

describe("cards.getWikiArticleExcerpt", () => {
  it("serves a signed-out caller from any article wiki, falling back to the intro", async () => {
    await expect(
      signedOut().getWikiArticleExcerpt({ articleTitle: "Caphiria", wikiSource: "althistory" })
    ).resolves.toEqual({ extract: "An intro.", wikitext: "An intro." });
    expect(getArticleWikitext).toHaveBeenCalledWith("Caphiria", "althistory");
    expect(getArticleIntro).toHaveBeenCalledWith("Caphiria", "althistory");
  });

  it("returns the article's wikitext when it has some, and nothing when neither read finds it", async () => {
    jest.mocked(getArticleWikitext).mockResolvedValueOnce({ wikitext: "'''Caphiria'''" } as never);
    await expect(
      signedOut().getWikiArticleExcerpt({ articleTitle: "Caphiria", wikiSource: "ixwiki" })
    ).resolves.toEqual({ extract: "'''Caphiria'''", wikitext: "'''Caphiria'''" });
    expect(getArticleIntro).not.toHaveBeenCalled();
    jest.mocked(getArticleIntro).mockResolvedValueOnce(null as never);
    await expect(
      signedOut().getWikiArticleExcerpt({ articleTitle: "Nowhere", wikiSource: "iiwiki" })
    ).resolves.toEqual({ extract: null, wikitext: null });
  });

  it("refuses Commons, which has no articles", async () => {
    await expect(
      signedOut().getWikiArticleExcerpt({
        articleTitle: "File:Map.png",
        wikiSource: "commons" as never,
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
