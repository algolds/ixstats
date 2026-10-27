/** @jest-environment node */
/**
 * The wiki-save rate limit (plan 2026-10-24 Task 14, A7): a new account gets 8 saves a minute, an autoconfirmed or
 * confirmed one 30, a holder of `noratelimit` (sysop, bot) any number. The limit sits in `commitWikitextSave`, the one
 * write path of the editor, api.php, revert, rollback and "Restore my text"; a system save (`authorLabel`: the
 * story-chain sync) is never limited. api.php answers the refusal as `ratelimited`.
 */
// describeEachWikiosMode answers the switch and marker rows through this mock
jest.mock("~/server/db", () => ({
  __esModule: true,
  db: { systemConfig: { findUnique: jest.fn() } },
}));
jest.mock("~/lib/cache/rate-limiter", () => {
  // a fixed window per key, as the in-memory fallback counts
  const counts = new Map<string, number>();
  return {
    __esModule: true,
    counts,
    rateLimiter: {
      isEnabled: jest.fn(() => true),
      check: jest.fn(
        async (identifier: string, namespace: string, limits: { maxRequests: number }) => {
          const key = `${namespace}:${identifier}`;
          const used = (counts.get(key) ?? 0) + 1;
          counts.set(key, used);
          return { success: used <= limits.maxRequests, remaining: 0, resetAt: new Date() };
        }
      ),
    },
  };
});
jest.mock("~/lib/wiki-os/rights", () => ({
  __esModule: true,
  getWikiPermissions: jest.fn(),
}));
jest.mock("~/lib/wiki-os/core", () => ({
  __esModule: true,
  ArticleRepository: { saveArticle: jest.fn() },
}));
jest.mock("~/lib/wiki-os/guardian/cloudflare-guardian", () => ({
  CloudflareGuardian: { purgeArticleEdgeCache: jest.fn() },
}));

import { TRPCError } from "@trpc/server";
import { rateLimiter } from "~/lib/cache/rate-limiter";
import { getWikiPermissions } from "~/lib/wiki-os/rights";
import { ArticleRepository } from "~/lib/wiki-os/core";
import { CloudflareGuardian } from "~/lib/wiki-os/guardian/cloudflare-guardian";
import { toApiError } from "~/lib/wiki-os/api-compat/error-map";
import {
  assertWikiSaveRate,
  WIKI_SAVE_LIMITS,
  WIKI_SAVE_REFUSAL,
} from "~/lib/wiki-os/services/save-rate-limit";
import { commitWikitextSave } from "~/lib/wiki-os/services/edit-service";
import { describeEachWikiosMode } from "~/tests/helpers/wikios-modes";

const { counts } = jest.requireMock("~/lib/cache/rate-limiter") as { counts: Map<string, number> };

/** A signed-in member with a handle, in `groups` and holding `rights`. */
function member(id: string, groups: string[], rights: string[] = ["edit"]) {
  jest.mocked(getWikiPermissions).mockResolvedValue({
    groups,
    rights: new Set(rights),
    block: null,
    ownUserNames: [],
  } as never);
  return { auth: { userId: `clerk-${id}` }, user: { id, handle: id } };
}

/** How many of `tries` saves in a row the limit lets through before the first refusal. */
async function allowedOf(ctx: ReturnType<typeof member>, tries: number): Promise<number> {
  for (let n = 0; n < tries; n++) {
    const refused = await assertWikiSaveRate(ctx).then(
      () => null,
      (error: TRPCError) => error
    );
    if (refused) {
      expect(refused).toBeInstanceOf(TRPCError);
      expect(refused.code).toBe("TOO_MANY_REQUESTS");
      expect(refused.message).toBe("You are saving too fast. Wait a minute and try again.");
      return n;
    }
  }
  return tries;
}

const save = { title: "Foo", wikitext: "text", summary: "", minor: false };

beforeEach(() => {
  counts.clear();
  jest.clearAllMocks();
  jest.mocked(ArticleRepository.saveArticle).mockResolvedValue({
    article: { id: "a1" },
    revisionId: "r1",
    nullEdit: false,
  } as never);
});

describeEachWikiosMode("the wiki-save rate limit", () => {
  it("has the limits of the plan: 8 a minute for a new account, 30 for an autoconfirmed one", () => {
    expect(WIKI_SAVE_LIMITS).toEqual({
      newbie: { max: 8, windowMs: 60_000 },
      autoconfirmed: { max: 30, windowMs: 60_000 },
    });
    expect(WIKI_SAVE_REFUSAL).toBe("You are saving too fast. Wait a minute and try again.");
  });

  it("a new account gets 8 saves a minute and the ninth is refused", async () => {
    const ctx = member("newbie-1", ["*", "user"]);

    await expect(allowedOf(ctx, 12)).resolves.toBe(8);
    expect(rateLimiter.check).toHaveBeenCalledWith("wiki-save:newbie-1", "wiki_save:newbie", {
      maxRequests: 8,
      windowMs: 60_000,
    });
  });

  it.each(["autoconfirmed", "confirmed"])("%s gets 30", async (group) => {
    const ctx = member(`${group}-1`, ["*", "user", group]);

    await expect(allowedOf(ctx, 35)).resolves.toBe(30);
    expect(rateLimiter.check).toHaveBeenCalledWith(
      `wiki-save:${group}-1`,
      "wiki_save:autoconfirmed",
      { maxRequests: 30, windowMs: 60_000 }
    );
  });

  it("counts each account on its own", async () => {
    await expect(allowedOf(member("first", ["user"]), 9)).resolves.toBe(8);
    await expect(allowedOf(member("second", ["user"]), 1)).resolves.toBe(1);
  });

  it("asks neither the rights nor the limiter when the limiter is off (RATE_LIMIT_ENABLED unset)", async () => {
    jest.mocked(rateLimiter.isEnabled).mockReturnValueOnce(false);
    const ctx = member("newbie-off", ["user"]);

    await expect(assertWikiSaveRate(ctx)).resolves.toBeUndefined();
    expect(getWikiPermissions).not.toHaveBeenCalled();
    expect(rateLimiter.check).not.toHaveBeenCalled();
  });

  it("an upload's File: page is not counted: uploads have their own limit", async () => {
    const ctx = member("uploader", ["user"]);

    for (let n = 0; n < 12; n++) {
      await commitWikitextSave(ctx, { ...save, title: `File:F${n}.png`, uploadPage: true });
    }

    expect(ArticleRepository.saveArticle).toHaveBeenCalledTimes(12);
    expect(rateLimiter.check).not.toHaveBeenCalled();
  });

  it("noratelimit holders are never limited", async () => {
    const ctx = member("sysop-1", ["user", "autoconfirmed", "sysop"], ["edit", "noratelimit"]);

    await expect(allowedOf(ctx, 50)).resolves.toBe(50);
    expect(rateLimiter.check).not.toHaveBeenCalled();
  });

  it("a person's save through commitWikitextSave is limited, before anything is written", async () => {
    const ctx = member("newbie-2", ["user"]);
    for (let n = 0; n < 8; n++) await commitWikitextSave(ctx, save);

    const refused = await commitWikitextSave(ctx, save).catch((error: TRPCError) => error);

    expect(refused).toBeInstanceOf(TRPCError);
    expect((refused as TRPCError).code).toBe("TOO_MANY_REQUESTS");
    expect(ArticleRepository.saveArticle).toHaveBeenCalledTimes(8);
  });

  it("a system save is never limited", async () => {
    member("unused", ["user"]);

    for (let n = 0; n < 20; n++) {
      await commitWikitextSave({}, { ...save, authorLabel: "Caphiria" });
    }

    expect(ArticleRepository.saveArticle).toHaveBeenCalledTimes(20);
    expect(rateLimiter.check).not.toHaveBeenCalled();
    expect(getWikiPermissions).not.toHaveBeenCalled();
  });

  it("asks nothing of the limit for a player with no handle: that save is refused first", async () => {
    const refused = await commitWikitextSave({ user: { id: "nohandle" } }, save).catch(
      (error: TRPCError) => error
    );

    expect((refused as TRPCError).code).toBe("PRECONDITION_FAILED");
    expect(rateLimiter.check).not.toHaveBeenCalled();
  });

  it("api.php answers the refusal as ratelimited", () => {
    const answer = toApiError(
      new TRPCError({ code: "TOO_MANY_REQUESTS", message: WIKI_SAVE_REFUSAL })
    );

    expect(answer).toMatchObject({ code: "ratelimited", info: WIKI_SAVE_REFUSAL });
  });

  it("purges the edge cache after a save that changed the page, never after a null edit", async () => {
    const ctx = member("sysop-2", ["sysop"], ["noratelimit"]);
    await commitWikitextSave(ctx, save);
    expect(CloudflareGuardian.purgeArticleEdgeCache).toHaveBeenCalledWith("Foo");

    jest.mocked(CloudflareGuardian.purgeArticleEdgeCache).mockClear();
    jest.mocked(ArticleRepository.saveArticle).mockResolvedValue({
      article: { id: "a1" },
      revisionId: "r0",
      nullEdit: true,
    } as never);
    await expect(commitWikitextSave(ctx, save)).resolves.toMatchObject({ nullEdit: true });
    expect(CloudflareGuardian.purgeArticleEdgeCache).not.toHaveBeenCalled();
  });
});
