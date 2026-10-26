/** @jest-environment node */
// `jest` is deliberately NOT imported from "@jest/globals" (see cards-archetypes-admin-auth.test.ts):
// the hoisted jest.mock() factories rely on the ambient global.
/**
 * The WikiOS routers' gates, one mock set for all of them. Plan 401 (S4 to S8): authorization reads the approved
 * name claims (IxnayID), never a typed name; a stash write goes only into the caller's own stashes; there is no
 * wikios author profile (IxnayID); template previews are signed-in, bounded, sanitised and SHA-256 keyed, and
 * template wikitext cannot be broken out of; write procedures carry limits and every title and query input is capped.
 * The editing router saves and previews only sanitised HTML, keeps to the namespace allowlist and canonical titles,
 * and needs the right the page's protection asks for (plan 409). Identity is the internal User id, so blurbs and
 * stashes find the caller's own rows.
 *
 * Folds wikios-save-sanitize and wikios-user-identity, each in its own block.
 */
jest.mock("~/server/db", () => ({
  __esModule: true,
  db: {
    systemConfig: { findUnique: jest.fn() },
    user: { findUnique: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
    wikiAccountLink: { findFirst: jest.fn() },
    wikiNameClaim: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue(null),
    },
    wikiUserGroup: { findMany: jest.fn().mockResolvedValue([]) },
    wikiBlock: { findMany: jest.fn().mockResolvedValue([]) },
    wikiRestriction: { findMany: jest.fn().mockResolvedValue([]) },
    wikiArticle: {
      upsert: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
      // the locked row's status, read by the save (a live page)
      findUnique: jest.fn().mockResolvedValue(null),
    },
    wikiRevision: {
      findFirst: jest.fn(),
      create: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
    },
    wikiMirrorJob: { create: jest.fn() },
    stash: { findMany: jest.fn(), findFirst: jest.fn(), findUnique: jest.fn(), create: jest.fn() },
    stashItem: { upsert: jest.fn(), deleteMany: jest.fn(), findMany: jest.fn() },
    blurbPrompt: { findUnique: jest.fn() },
    blurbResponse: { findUnique: jest.fn(), create: jest.fn() },
    thinkpagesAccount: { findFirst: jest.fn() },
    thinkpagesPost: { create: jest.fn() },
    auditLog: { create: jest.fn() },
    $transaction: jest.fn(),
  },
  isDatabaseReadOnly: true,
}));
jest.mock("~/lib/auth", () => ({
  __esModule: true,
  isSystemOwner: (id: string) => id === "system_owner_id",
  UserManagementService: jest.fn(),
}));
jest.mock("~/lib/auth/system-owner-constants", () => ({
  __esModule: true,
  isSystemOwner: (id: string) => id === "system_owner_id",
}));
jest.mock("~/lib/wiki-os/core", () => ({
  __esModule: true,
  ArticleRepository: { findBySlug: jest.fn(), saveArticle: jest.fn() },
}));
jest.mock("~/lib/wiki-os/services/mirror-outbox", () => ({
  __esModule: true,
  ...jest.requireActual("~/lib/wiki-os/services/mirror-outbox"),
  scheduleMirrorKick: jest.fn(),
}));
jest.mock("~/lib/wiki-os/services/render-service", () => ({
  enqueueRender: jest.fn(),
  invalidateDependents: jest.fn(),
}));
jest.mock("~/lib/wiki-os/core/link-graph-service", () => ({
  __esModule: true,
  LinkGraphService: { syncArticleLinks: jest.fn().mockResolvedValue(0) },
}));
jest.mock("~/lib/wiki-os/core/media-asset-service", () => ({
  __esModule: true,
  MediaAssetService: { processContentImages: jest.fn().mockResolvedValue(undefined) },
}));
jest.mock("~/lib/wiki-os/adapters/mediawiki/parsoid", () => ({
  __esModule: true,
  // The engine call stays real: the template preview sends its wikitext through it (the S7 tests below).
  ...jest.requireActual("~/lib/wiki-os/adapters/mediawiki/parsoid"),
  wikitextToHtml: jest.fn(),
}));
jest.mock("~/lib/wiki-os/guardian/cloudflare-guardian", () => ({
  __esModule: true,
  CloudflareGuardian: { purgeArticleEdgeCache: jest.fn() },
}));
jest.mock("~/lib/wiki-os/adapters/mediawiki/article-store", () => ({
  __esModule: true,
  getRevisionWikitextShadow: jest.fn(),
  getArticleHistoryShadow: jest.fn(),
}));
// Edit conflicts have their own suite (wikios-edit-conflict.test.ts); here no save ever conflicts.
jest.mock("~/lib/wiki-os/core/edit-conflict", () => ({
  __esModule: true,
  detectEditConflict: jest.fn().mockResolvedValue(null),
}));
jest.mock("~/lib/wiki-os/adapters/mediawiki/bridge", () => ({
  __esModule: true,
  getUserContribs: jest.fn(),
  getUserInfo: jest.fn().mockResolvedValue(null),
  getBacklinks: jest.fn(),
}));
jest.mock("~/lib/wiki-os/templates/preview-service.server", () => ({
  ...jest.requireActual("~/lib/wiki-os/templates/preview-service.server"),
  renderTemplateWithRedisCache: jest.fn(),
}));
jest.mock("~/lib/wiki-os/core/page-management-service", () => ({
  __esModule: true,
  PageOperationError: jest.requireActual("~/lib/wiki-os/core/page-management-service")
    .PageOperationError,
  PageManagementService: { restoreArticle: jest.fn() },
}));

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import { createCallerFactory } from "~/server/api/trpc";
import { blurbsRespondRouter } from "~/server/api/routers/blurbs/respond";
import { wikiosEditingRouter } from "~/server/api/routers/wikios/editing";
import { wikiosStashRouter } from "~/server/api/routers/wikios/stash";
import { wikiosDiscussionsRouter } from "~/server/api/routers/wikios/discussions";
import { wikiosUserTalkRouter } from "~/server/api/routers/wikios/user-talk";
import { wikiosTemplatesRouter } from "~/server/api/routers/wikios/templates";
import { wikiosWatchlistAnnotationsRouter } from "~/server/api/routers/wikios/watchlist-annotations";
import { wikiosPageContentRouter } from "~/server/api/routers/wikios/page-content";
import { wikiosSearchRouter } from "~/server/api/routers/wikios/search";
import { getTemplatePreview } from "~/lib/wiki-os/templates/template-engine.server";
import {
  canonicalPreviewInput,
  previewCacheKey,
  renderTemplateWithRedisCache,
} from "~/lib/wiki-os/templates/preview-service.server";
import {
  getRevisionWikitextShadow,
  getArticleHistoryShadow,
} from "~/lib/wiki-os/adapters/mediawiki/article-store";
import { wikitextToHtml } from "~/lib/wiki-os/adapters/mediawiki/parsoid";
import { PageManagementService } from "~/lib/wiki-os/core/page-management-service";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { ArticleRepository } from "~/lib/wiki-os/core";
import { MEDIAWIKI_NAMESPACE_REASON } from "~/lib/wiki-os/namespace-policy";
import { db } from "~/server/db";
import { applyWikiosMode } from "~/tests/helpers/wikios-modes";

const mockDb = db as unknown as {
  user: { findFirst: jest.Mock; update: jest.Mock };
  wikiAccountLink: { findFirst: jest.Mock };
  wikiNameClaim: { findMany: jest.Mock };
  wikiArticle: { upsert: jest.Mock; count: jest.Mock; findUnique: jest.Mock };
  wikiRestriction: { findMany: jest.Mock };
  wikiRevision: { findFirst: jest.Mock; create: jest.Mock };
  wikiMirrorJob: { create: jest.Mock };
  stash: { findFirst: jest.Mock; create: jest.Mock };
  stashItem: { upsert: jest.Mock; deleteMany: jest.Mock };
  $transaction: jest.Mock;
};

const asCtx = (ctx: unknown) => ctx as never;

/** The approved IxWiki name claim of the signed-in user `db1` (null = none). */
const mockClaim = (name: string | null, rightsPass = false) =>
  mockDb.wikiNameClaim.findMany.mockResolvedValue(
    name
      ? [
          {
            id: "claim-1",
            userId: "db1",
            name,
            visible: true,
            rightsPass,
            decidedAt: new Date("2026-01-01"),
            mwUserId: null,
          },
        ]
      : []
  );

const userCtx = () =>
  createMockRouterContext({
    auth: { userId: "user_1" },
    user: {
      id: "db1",
      clerkUserId: "user_1",
      handle: "alpha",
      role: { name: "user", level: 100 },
    },
  });

// v1 with the protections marker the rights import writes (without it WikiOS takes no write)
let restoreMode: () => void = () => undefined;
beforeEach(() => {
  restoreMode = applyWikiosMode("v1", {
    findUnique: jest.mocked(db.systemConfig.findUnique) as jest.Mock,
  });
});
afterEach(() => restoreMode());

describe("S4: wiki identity for authorization is the approved name claim", () => {
  const editCaller = () => createCallerFactory(wikiosEditingRouter)(asCtx(userCtx()));

  beforeEach(() => {
    jest.clearAllMocks();
    mockDb.wikiRestriction.findMany.mockResolvedValue([]);
    jest.mocked(ArticleRepository.findBySlug).mockResolvedValue(null);
    jest.mocked(ArticleRepository.saveArticle).mockResolvedValue({
      article: {} as never,
      revisionId: "rev-1" as never,
      nullEdit: false,
    });
  });

  it("forbids User:<name> when no approved claim exists", async () => {
    mockClaim(null);

    await expect(
      editCaller().saveWikitext({ title: "User:Legacy/Notes", wikitext: "x" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(ArticleRepository.saveArticle).not.toHaveBeenCalled();
  });

  it("allows the user's own User: page through an approved claim, looked up by internal id", async () => {
    mockClaim("Verified");

    await editCaller().saveWikitext({ title: "User:Verified/Notes", wikitext: "x" });

    expect(ArticleRepository.saveArticle).toHaveBeenCalledTimes(1);
    expect(mockDb.wikiNameClaim.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { source: "ixwiki", userId: { in: ["db1"] }, status: "APPROVED" },
      })
    );
    expect(mockDb.wikiAccountLink.findFirst).not.toHaveBeenCalled();
  });

  it("does not let a claimed name alone satisfy an AUTOCONFIRMED protection", async () => {
    jest.mocked(ArticleRepository.findBySlug).mockResolvedValue({ status: "PUBLISHED" } as never);
    mockDb.wikiRestriction.findMany.mockResolvedValue([
      { action: "edit", level: "autoconfirmed", expiresAt: null },
    ]);
    const revisions = (db as unknown as { wikiRevision: { count: jest.Mock } }).wikiRevision;

    mockClaim(null);
    await expect(
      editCaller().saveWikitext({ title: "Guarded", wikitext: "x" })
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
    });

    // even a system owner's claim: the old MediaWiki account's age and edits are not read
    mockClaim("Verified", true);
    await expect(
      editCaller().saveWikitext({ title: "Guarded", wikitext: "x" })
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
    });

    // WikiOS's own rule, counting the revisions the claim tagged with the account's id
    revisions.count.mockResolvedValue(10);
    const aged = createMockRouterContext({
      auth: { userId: "user_1" },
      user: {
        id: "db1",
        clerkUserId: "user_1",
        handle: "alpha",
        createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        role: { name: "user", level: 100 },
      },
    });
    try {
      await createCallerFactory(wikiosEditingRouter)(asCtx(aged)).saveWikitext({
        title: "Guarded",
        wikitext: "x",
      });
    } finally {
      revisions.count.mockResolvedValue(0);
    }
    expect(ArticleRepository.saveArticle).toHaveBeenCalledTimes(1);
    expect(revisions.count).toHaveBeenCalledWith({ where: { authorId: "db1" } });
  });

  it("saveArticle never updates the author's user row", async () => {
    const { ArticleRepository: RealArticleRepository } = jest.requireActual<
      typeof import("~/lib/wiki-os/core/article-repository")
    >("~/lib/wiki-os/core/article-repository");
    // the save locks the page's row first (SELECT ... FOR NO KEY UPDATE: the row exists)
    const tx = {
      ...mockDb,
      $queryRaw: jest.fn().mockResolvedValue([{ id: "a1" }]),
      $executeRaw: jest.fn(),
    };
    mockDb.$transaction.mockImplementation(async (fn: (client: typeof tx) => unknown) => fn(tx));
    mockDb.user.findFirst.mockResolvedValue({ id: "db1" });
    mockDb.wikiArticle.upsert.mockResolvedValue({
      id: "a1",
      title: "Caphiria",
      slug: "Caphiria",
      source: "ixwiki",
      wikitext: "x",
      namespace: 0,
      namespacePrefix: null,
      protectionLevel: "ALL",
      protectionExpiry: null,
      syncedAt: new Date(),
      updatedAt: new Date(),
    });
    mockDb.wikiRevision.findFirst.mockResolvedValue(null);
    mockDb.wikiRevision.create.mockResolvedValue({
      id: "r1",
      articleId: "a1",
      summary: null,
      minor: false,
      author: "Some_Country",
      createdAt: new Date(),
    });

    await RealArticleRepository.saveArticle(
      { slug: "Caphiria", title: "Caphiria", wikitext: "x" },
      "user_1",
      "Some_Country"
    );

    expect(mockDb.user.findFirst).toHaveBeenCalled();
    expect(mockDb.user.update).not.toHaveBeenCalled();
    expect(mockDb.wikiRevision.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ authorId: "db1" }) })
    );
    expect(mockDb.wikiMirrorJob.create).toHaveBeenCalledTimes(1);
  });
});

describe("S5: stashPage only writes into the caller's own stashes", () => {
  const stashCaller = () => createCallerFactory(wikiosStashRouter)(asCtx(userCtx()));

  beforeEach(() => {
    jest.clearAllMocks();
    mockDb.stashItem.upsert.mockResolvedValue({});
  });

  it("answers NOT_FOUND for another user's stashId and never upserts", async () => {
    mockDb.stash.findFirst.mockResolvedValue(null);

    await expect(
      stashCaller().stashPage({ pageTitle: "Caphiria", stashId: "someone_elses_stash" })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    expect(mockDb.stash.findFirst).toHaveBeenCalledWith({
      where: { id: "someone_elses_stash", userId: { in: ["db1", "user_1"] } },
      select: { id: true },
    });
    expect(mockDb.stashItem.upsert).not.toHaveBeenCalled();
  });

  it("upserts into an owned stashId", async () => {
    mockDb.stash.findFirst.mockResolvedValue({ id: "mine" });

    const result = await stashCaller().stashPage({ pageTitle: "Caphiria", stashId: "mine" });

    expect(result).toEqual({ success: true, stashId: "mine" });
    expect(mockDb.stashItem.upsert).toHaveBeenCalledTimes(1);
  });
});

describe("S6: there is no author profile endpoint", () => {
  it("tells who a wiki name is only through users.resolveWikiAuthor, never a wikios profile", () => {
    expect(Object.keys(wikiosUserTalkRouter._def.procedures)).not.toContain("getAuthorProfile");
  });
});

describe("S7: template preview is signed-in, bounded, sanitised and SHA-256 keyed", () => {
  const validInput = { template: "Quote box", params: { text: "hi" } };
  const previewCaller = (ctx: unknown) =>
    createCallerFactory(wikiosTemplatesRouter)(asCtx(ctx)).getTemplatePreview;

  beforeEach(() => {
    jest.clearAllMocks();
    jest
      .mocked(renderTemplateWithRedisCache)
      .mockResolvedValue({ html: "<p>ok</p>", source: "network", cached: false });
  });

  it("is no longer a public procedure", async () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    const anonymous = createMockRouterContext({ auth: null, user: null });

    await expect(previewCaller(anonymous)(validInput)).rejects.toThrow(/Authentication required/);
    expect(renderTemplateWithRedisCache).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it.each([
    ["an over-long template name", { template: "T".repeat(256), params: {} }],
    ["template-breaking characters", { template: "Foo}}{{Bar", params: {} }],
    ["a pipe in the template name", { template: "Foo|bar", params: {} }],
    ["an over-long parameter name", { template: "T", params: { ["k".repeat(65)]: "v" } }],
    ["an over-long parameter value", { template: "T", params: { k: "v".repeat(20_001) } }],
    [
      "more than 200 parameters",
      {
        template: "T",
        params: Object.fromEntries(Array.from({ length: 201 }, (_, i) => [`p${i}`, "v"])),
      },
    ],
  ])("rejects %s", async (_label, input) => {
    await expect(previewCaller(userCtx())(input)).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(renderTemplateWithRedisCache).not.toHaveBeenCalled();
  });

  it("accepts 200 parameters and values up to 20,000 characters", async () => {
    const params = Object.fromEntries(
      Array.from({ length: 200 }, (_, i) => [`p${i}`, "v".repeat(100)])
    );
    params.p0 = "v".repeat(20_000);

    await expect(previewCaller(userCtx())({ template: "T", params })).resolves.toBe("<p>ok</p>");
  });

  it("sanitises the rendered HTML before returning it", async () => {
    jest.mocked(renderTemplateWithRedisCache).mockResolvedValue({
      html: '<p onclick="alert(1)">ok</p><script>alert(1)</script><img src=x onerror=alert(1)>',
      source: "network",
      cached: false,
    });

    const html = await previewCaller(userCtx())(validInput);

    expect(html).toContain("ok");
    expect(html).not.toMatch(/<script|onerror|onclick/i);
  });

  it("previewCacheKey is a SHA-256 key that separates inputs the old 32-bit hash merged", () => {
    // "Aa" and "BB" collide under the old `h * 31 + c` rolling hash, so these two shared a key.
    const legacyHash = (text: string) => {
      let h = 0;
      for (let i = 0; i < text.length; i++) h = ((h << 5) - h + text.charCodeAt(i)) | 0;
      return h >>> 0;
    };
    expect(legacyHash(canonicalPreviewInput("T", { a: "Aa" }))).toBe(
      legacyHash(canonicalPreviewInput("T", { a: "BB" }))
    );

    const first = previewCacheKey("T", { a: "Aa" });
    const second = previewCacheKey("T", { a: "BB" });

    expect(first).toMatch(/^tplprev:v2:[0-9a-f]{64}$/);
    expect(second).toMatch(/^tplprev:v2:[0-9a-f]{64}$/);
    expect(first).not.toBe(second);
    expect(previewCacheKey("T", { a: "1", b: "2" })).toBe(previewCacheKey("T", { b: "2", a: "1" }));
  });
});

describe("S7: template wikitext cannot be broken out of", () => {
  let fetchMock: jest.SpiedFunction<typeof fetch>;

  const sentWikitext = () =>
    new URLSearchParams(String(fetchMock.mock.calls[0]![1]!.body)).get("text");

  beforeEach(() => {
    fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValue(Response.json({ parse: { text: "<p>rendered</p>" } }));
  });

  afterEach(() => {
    fetchMock.mockRestore();
  });

  it("previews a parameter whose value is a nested template: |flag={{flag|X}}", async () => {
    await expect(getTemplatePreview("Infobox country", { flag: "{{flag|X}}" })).resolves.toContain(
      "rendered"
    );

    expect(sentWikitext()).toBe("{{Infobox country|flag={{flag|X}}}}");
  });

  it("escapes a literal pipe at depth 0 of a value as {{!}}: |x=a|b", async () => {
    await getTemplatePreview("Quote box", { x: "a|b", author: "Me" });

    expect(sentWikitext()).toBe("{{Quote box|x=a{{!}}b|author=Me}}");
  });

  it("escapes only depth-0 pipes and keeps the ones inside nested calls and links", async () => {
    await getTemplatePreview("T", {
      x: "a|[[File:F.png|thumb|caption]]|{{flag|X|size=2}} b|{{c|{{d|e}}}}",
    });

    expect(sentWikitext()).toBe(
      "{{T|x=a{{!}}[[File:F.png|thumb|caption]]{{!}}{{flag|X|size=2}} b{{!}}{{c|{{d|e}}}}}}"
    );
  });

  it("keeps triple-brace parameters balanced", async () => {
    await getTemplatePreview("T", { x: "{{{1|default}}}" });

    expect(sentWikitext()).toBe("{{T|x={{{1|default}}}}}");
  });

  it.each([
    ["a stray closing pair: |x=a}}b", "a}}b"],
    ["closing then opening: |x=x}}{{evil|k=v", "x}}{{evil|k=v"],
    ["an unclosed template", "{{evil"],
    ["an unclosed link", "[[Foo"],
    ["a stray link closer", "a]]b"],
    ["mismatched pairs", "{{x]]"],
    ["an over-closed call", "{{a}}}}"],
  ])("refuses %s without calling MediaWiki", async (_label, value) => {
    await expect(getTemplatePreview("Quote box", { x: value })).resolves.toBe("Invalid parameter");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([["a|b"], ["a=b"], ["a}}b"], ["a\nb"]])(
    "refuses the parameter name %j without calling MediaWiki",
    async (key) => {
      await expect(getTemplatePreview("Quote box", { [key]: "v" })).resolves.toBe(
        "Invalid parameter"
      );
      expect(fetchMock).not.toHaveBeenCalled();
    }
  );
});

describe("S7: WikiOS write procedures carry limits", () => {
  const editCaller = () => createCallerFactory(wikiosEditingRouter)(asCtx(userCtx()));

  it("rejects wikitext over MediaWiki's 2 MB page limit", async () => {
    await expect(
      editCaller().saveWikitext({ title: "Big", wikitext: "x".repeat(2_000_001) })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("uses the rate-limited procedure builders for every editing mutation", () => {
    const source = readFileSync(
      join(process.cwd(), "src/server/api/routers/wikios/editing.ts"),
      "utf8"
    );
    for (const name of ["saveWikitext", "revertToRevision", "rollback", "restoreArticle"]) {
      expect(source).toMatch(new RegExp(`${name}: lightMutationProcedure`));
    }
    expect(source).toMatch(/previewWikitext: readOnlyProcedure/);
    expect(source).not.toMatch(/: protectedProcedure/);
  });
});

describe("S7: unbounded title and query inputs are capped", () => {
  const ctx = () => asCtx(userCtx());

  it("caps watchlist page titles at 512 characters", async () => {
    await expect(
      createCallerFactory(wikiosWatchlistAnnotationsRouter)(ctx()).watchPage({
        pageTitle: "t".repeat(513),
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("caps page-content titles at 512 characters", async () => {
    const caller = createCallerFactory(wikiosPageContentRouter)(ctx());
    await expect(caller.getPageImages({ title: "t".repeat(513) })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });

  it("no longer serves getSectionContent (a public per-line heading regex was a ReDoS)", () => {
    expect(
      (wikiosPageContentRouter._def.procedures as Record<string, unknown>).getSectionContent
    ).toBeUndefined();
  });

  it("caps search queries at 256 characters and fileTypes at 20 entries", async () => {
    const caller = createCallerFactory(wikiosSearchRouter)(ctx());
    await expect(caller.advancedSearch({ query: "q".repeat(257) })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    await expect(
      caller.searchFiles({ fileTypes: Array.from({ length: 21 }, () => "png") })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(caller.searchBusinesses({ query: "q".repeat(257) })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });
});

// S5 (forum stash ownership) moved with the XenForo bridge's deletion (phase 4b): the native forum stash refuses
// another user's stash in src/tests/server/modules/thinkpages-forum/stash.test.ts.

describe("S8: bounded inputs on stash, placeholder and discussion endpoints", () => {
  const ctx = () => asCtx(userCtx());

  it("caps wikios stash ids (64), contentType (32) and titles (512)", async () => {
    const caller = createCallerFactory(wikiosStashRouter)(ctx());
    const bad = { code: "BAD_REQUEST" };
    await expect(
      caller.stashPage({ pageTitle: "P", stashId: "s".repeat(65) })
    ).rejects.toMatchObject(bad);
    await expect(
      caller.stashPage({ pageTitle: "P", contentType: "c".repeat(33) })
    ).rejects.toMatchObject(bad);
    await expect(caller.stashPage({ pageTitle: "p".repeat(513) })).rejects.toMatchObject(bad);
    await expect(caller.deleteStash({ id: "s".repeat(65) })).rejects.toMatchObject(bad);
    await expect(
      caller.unstashPage({ pageTitle: "P", stashId: "s".repeat(65) })
    ).rejects.toMatchObject(bad);
    await expect(caller.getStashItems({ stashId: "s".repeat(65) })).rejects.toMatchObject(bad);
  });

  it("caps resolveWikiPlaceholders at 200 placeholders of 512 characters and 200k of text", async () => {
    const caller = createCallerFactory(wikiosPageContentRouter)(ctx());
    const bad = { code: "BAD_REQUEST" };
    await expect(
      caller.resolveWikiPlaceholders({ placeholders: Array.from({ length: 201 }, () => "x") })
    ).rejects.toMatchObject(bad);
    await expect(
      caller.resolveWikiPlaceholders({ placeholders: ["x".repeat(513)] })
    ).rejects.toMatchObject(bad);
    await expect(
      caller.resolveWikiPlaceholders({ text: "t".repeat(200_001) })
    ).rejects.toMatchObject(bad);
  });

  it("puts the discussion mutations on the rate-limited procedure builder", () => {
    const source = readFileSync(
      join(process.cwd(), "src/server/api/routers/wikios/discussions.ts"),
      "utf8"
    );
    for (const name of [
      "createThread",
      "postComment",
      "resolveThread",
      "deleteThread",
      "deleteComment",
    ]) {
      expect(source).toMatch(new RegExp(`${name}: lightMutationProcedure`));
    }
    expect(source).not.toMatch(/: protectedProcedure/);
  });

  it("caps discussion thread ids at 64 characters", async () => {
    const caller = createCallerFactory(wikiosDiscussionsRouter)(ctx());
    const bad = { code: "BAD_REQUEST" };
    await expect(caller.deleteThread({ threadId: "t".repeat(65) })).rejects.toMatchObject(bad);
    await expect(
      caller.resolveThread({ threadId: "t".repeat(65), resolved: true })
    ).rejects.toMatchObject(bad);
    await expect(
      caller.postComment({ threadId: "t".repeat(65), content: "hi" })
    ).rejects.toMatchObject(bad);
  });
});

describe("the editing router (save, preview, page management, rights)", () => {
  const createCaller = createCallerFactory(wikiosEditingRouter);

  const userCtx = () =>
    createMockRouterContext({
      auth: { userId: "user_1" },
      user: {
        id: "db1",
        clerkUserId: "user_1",
        handle: "alpha",
        role: { name: "user", level: 100 },
      },
    });

  const existingArticle = () => ({ status: "PUBLISHED" }) as never;

  /** The page's title-keyed protection rows (plan 409: the restriction table is the source of truth). */
  const mockRestrictions = (...rows: Array<{ action: string; level: string }>) =>
    (
      db as unknown as { wikiRestriction: { findMany: jest.Mock } }
    ).wikiRestriction.findMany.mockResolvedValue(rows.map((row) => ({ ...row, expiresAt: null })));

  beforeEach(() => {
    mockRestrictions();
  });

  describe("wikiosEditingRouter.saveWikitext", () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it("forbids saveWikitext on a SYSOP-protected page for a non-admin", async () => {
      jest.mocked(ArticleRepository.findBySlug).mockResolvedValue(existingArticle());
      mockRestrictions({ action: "edit", level: "sysop" });
      const caller = createCaller(userCtx() as never);

      await expect(caller.saveWikitext({ title: "Locked", wikitext: "x" })).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
      expect(ArticleRepository.saveArticle).not.toHaveBeenCalled();
    });
  });

  describe("wikiosEditingRouter page management", () => {
    beforeEach(() => {
      jest.clearAllMocks();
      jest.mocked(ArticleRepository.findBySlug).mockResolvedValue(existingArticle());
    });

    it("forbids restoreArticle for a non-admin", async () => {
      const caller = createCaller(userCtx() as never);
      await expect(caller.restoreArticle({ title: "Page" })).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
      expect(PageManagementService.restoreArticle).not.toHaveBeenCalled();
    });
  });

  const adminCtx = () =>
    createMockRouterContext({
      auth: { userId: "system_owner_id" },
      user: {
        id: "dbadmin",
        clerkUserId: "system_owner_id",
        handle: "admin",
        role: { name: "admin", level: 0 },
      },
    });

  describe("wikiosEditingRouter namespace allowlist (NEW-1)", () => {
    beforeEach(() => {
      jest.clearAllMocks();
      mockClaim("Linked");
      jest.mocked(ArticleRepository.findBySlug).mockResolvedValue(null);
      jest.mocked(ArticleRepository.saveArticle).mockResolvedValue({
        article: {} as never,
        revisionId: "rev-1" as never,
        nullEdit: false,
      });
      jest.mocked(getRevisionWikitextShadow).mockResolvedValue({
        wikitext: "old",
        title: "X",
        source: "ixwiki",
        timestamp: "",
        fromShadow: true,
        parked: false,
      });
      jest.mocked(getArticleHistoryShadow).mockResolvedValue({
        revisions: [
          {
            revid: "r2",
            user: "bob",
            timestamp: "",
            comment: "",
            size: 1,
            byteDelta: 0,
            minor: false,
            sha1: null,
            parked: false,
            textDeleted: false,
            commentDeleted: false,
            userDeleted: false,
          },
          {
            revid: "r1",
            user: "amy",
            timestamp: "",
            comment: "",
            size: 1,
            byteDelta: 0,
            minor: false,
            sha1: null,
            parked: false,
            textDeleted: false,
            commentDeleted: false,
            userDeleted: false,
          },
        ],
        hasMore: false,
        fromShadow: true,
      });
    });

    const forbidden = [
      "Template:Infobox",
      "Module:Foo",
      "MediaWiki:Common.js",
      "User:Someone/common.js",
    ];

    it.each(forbidden)("saveWikitext refuses %s for a non-admin", async (title) => {
      const caller = createCaller(userCtx() as never);
      await expect(caller.saveWikitext({ title, wikitext: "x" })).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
      expect(ArticleRepository.saveArticle).not.toHaveBeenCalled();
    });

    it.each(forbidden)("revertToRevision refuses %s for a non-admin", async (title) => {
      const caller = createCaller(userCtx() as never);
      await expect(caller.revertToRevision({ title, revid: "r1" })).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
      expect(ArticleRepository.saveArticle).not.toHaveBeenCalled();
    });

    it.each(forbidden)("rollback refuses %s for a non-admin", async (title) => {
      const caller = createCaller(userCtx() as never);
      await expect(caller.rollback({ title })).rejects.toMatchObject({ code: "FORBIDDEN" });
      expect(ArticleRepository.saveArticle).not.toHaveBeenCalled();
    });

    it("allows an article, the user's own page, and passes the revision id to the export", async () => {
      const caller = createCaller(userCtx() as never);
      await caller.saveWikitext({ title: "Caphiria", wikitext: "x" });
      await caller.saveWikitext({ title: "User:Linked/Notes", wikitext: "x" });
      expect(ArticleRepository.saveArticle).toHaveBeenCalledTimes(2);
    });

    it("refuses another user's page and a user page whose name the caller does not hold", async () => {
      await expect(
        createCaller(userCtx() as never).saveWikitext({
          title: "User:Other",
          wikitext: "x",
        })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      mockClaim(null);
      await expect(
        createCaller(userCtx() as never).saveWikitext({ title: "User:Linked", wikitext: "x" })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });

    it("lets a wiki admin edit interface namespaces, but not a MediaWiki: page: classic is its authority (A8)", async () => {
      const caller = createCaller(adminCtx() as never);
      await caller.saveWikitext({ title: "Template:Infobox", wikitext: "x" });
      jest.mocked(getRevisionWikitextShadow).mockResolvedValue({
        wikitext: "old",
        title: "MediaWiki:Sidebar",
        source: "ixwiki",
        timestamp: "",
        fromShadow: true,
        parked: false,
      });
      const classic = {
        code: "FORBIDDEN",
        message: `namespaceprotected: ${MEDIAWIKI_NAMESPACE_REASON}`,
      };
      await expect(
        caller.revertToRevision({ title: "MediaWiki:Sidebar", revid: "r1" })
      ).rejects.toMatchObject(classic);
      await expect(
        caller.saveWikitext({ title: "MediaWiki:Sidebar", wikitext: "x" })
      ).rejects.toMatchObject(classic);
      await expect(caller.rollback({ title: "MediaWiki:Sidebar" })).rejects.toMatchObject(classic);
      expect(ArticleRepository.saveArticle).toHaveBeenCalledTimes(1);
    });
  });

  describe("wikiosEditingRouter.previewWikitext (NEW-13)", () => {
    beforeEach(() => {
      jest.clearAllMocks();
      jest.mocked(wikitextToHtml).mockResolvedValue("<p>hi</p>");
    });

    it("rejects an anonymous caller", async () => {
      const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
      const caller = createCaller(createMockRouterContext({ auth: null, user: null }) as never);
      await expect(caller.previewWikitext({ wikitext: "hi", title: "T" })).rejects.toThrow(
        /Authentication required/
      );
      expect(wikitextToHtml).not.toHaveBeenCalled();
      warn.mockRestore();
    });

    it("renders for a signed-in user", async () => {
      const caller = createCaller(userCtx() as never);
      await expect(caller.previewWikitext({ wikitext: "hi", title: "T" })).resolves.toHaveProperty(
        "html"
      );
    });

    it("sanitizes the HTML it hands back: script, event handlers and javascript: links are gone (plan 404 review)", async () => {
      jest
        .mocked(wikitextToHtml)
        .mockResolvedValue(
          '<p onclick="steal()">Hi <a href="javascript:alert(1)">link</a></p><script>alert(2)</script>' +
            '<table class="infobox"><tr><td>Capital<img src=x onerror="alert(3)"></td></tr></table>' +
            '<div class="hatnote">Notice <script>alert(4)</script></div>'
        );
      const caller = createCaller(userCtx() as never);

      const { html } = await caller.previewWikitext({ wikitext: "hi", title: "T" });

      expect(html).toContain("Hi");
      expect(html).toContain("Capital");
      expect(html).toContain("Notice");
      expect(html).not.toMatch(/<script|onclick|onerror|javascript:/i);
      // The wrapper the editor styles keeps its class.
      expect(html).toContain("wikios-infobox-container");
    });
  });

  describe("wikiosEditingRouter canonical titles (plan 403)", () => {
    beforeEach(() => {
      jest.clearAllMocks();
      jest.mocked(ArticleRepository.findBySlug).mockResolvedValue(null);
      jest.mocked(ArticleRepository.saveArticle).mockResolvedValue({
        article: {} as never,
        revisionId: "rev-1" as never,
        nullEdit: false,
      });
    });

    it("saves, exports and reports the canonical title whatever spelling was sent", async () => {
      const caller = createCaller(userCtx() as never);

      const result = await caller.saveWikitext({ title: "foo_bar", wikitext: "x" });

      expect(result).toMatchObject({ success: true, title: "Foo bar" });
      expect(ArticleRepository.saveArticle).toHaveBeenCalledWith(
        expect.objectContaining({ slug: "Foo bar", title: "Foo bar" }),
        expect.anything(),
        expect.anything()
      );
    });

    it("refuses a title MediaWiki would refuse before saving anything", async () => {
      const caller = createCaller(userCtx() as never);

      await expect(caller.saveWikitext({ title: "a[b", wikitext: "x" })).rejects.toMatchObject({
        code: "BAD_REQUEST",
      });
      expect(ArticleRepository.saveArticle).not.toHaveBeenCalled();
    });
  });

  describe("wikiosEditingRouter preview and restore canonical titles (plan 403)", () => {
    beforeEach(() => {
      jest.clearAllMocks();
      jest.mocked(wikitextToHtml).mockResolvedValue("<p>hi</p>");
      jest
        .mocked(PageManagementService.restoreArticle)
        .mockResolvedValue({ success: true, articleId: "a1" });
    });

    it("previews against the canonical title", async () => {
      const caller = createCaller(userCtx() as never);

      await caller.previewWikitext({ wikitext: "hi", title: "user_talk:jane" });

      expect(wikitextToHtml).toHaveBeenCalledWith("hi", "User talk:Jane");
    });

    it("refuses to preview a title MediaWiki would refuse", async () => {
      const caller = createCaller(userCtx() as never);

      await expect(caller.previewWikitext({ wikitext: "hi", title: "a[b" })).rejects.toMatchObject({
        code: "BAD_REQUEST",
      });
      expect(wikitextToHtml).not.toHaveBeenCalled();
    });

    it("restores by the canonical title", async () => {
      const caller = createCaller(adminCtx() as never);

      await caller.restoreArticle({ title: "foo_bar" });

      expect(PageManagementService.restoreArticle).toHaveBeenCalledWith(
        "Foo bar",
        { userId: "dbadmin", name: "admin" },
        "ixwiki"
      );
    });

    it("checks the admin right before the title, and refuses an invalid title", async () => {
      await expect(
        createCaller(userCtx() as never).restoreArticle({ title: "a[b" })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(
        createCaller(adminCtx() as never).restoreArticle({ title: "a[b" })
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
      expect(PageManagementService.restoreArticle).not.toHaveBeenCalled();
    });
  });

  describe("wikiosEditingRouter rights (plan 409)", () => {
    const mockGroups = (...groups: string[]) =>
      (
        db as unknown as { wikiUserGroup: { findMany: jest.Mock } }
      ).wikiUserGroup.findMany.mockResolvedValue(
        groups.map((group) => ({ group, expiresAt: null }))
      );
    const mockBlocks = (...rows: Array<{ reason: string | null; allowUserTalk: boolean }>) =>
      (
        db as unknown as { wikiBlock: { findMany: jest.Mock } }
      ).wikiBlock.findMany.mockResolvedValue(rows.map((row) => ({ ...row, expiresAt: null })));

    beforeEach(() => {
      jest.clearAllMocks();
      mockClaim(null);
      mockGroups();
      mockBlocks();
      jest.mocked(ArticleRepository.findBySlug).mockResolvedValue(existingArticle());
      jest.mocked(ArticleRepository.saveArticle).mockResolvedValue({
        article: {} as never,
        revisionId: "rev-1" as never,
        nullEdit: false,
      });
      jest.mocked(getRevisionWikitextShadow).mockResolvedValue({
        wikitext: "old",
        title: "Caphiria",
        source: "ixwiki",
        timestamp: "",
        fromShadow: true,
        parked: false,
      });
      jest.mocked(getArticleHistoryShadow).mockResolvedValue({
        revisions: [
          {
            revid: "r2",
            user: "bob",
            timestamp: "",
            comment: "",
            size: 1,
            byteDelta: 0,
            minor: false,
            sha1: null,
            parked: false,
            textDeleted: false,
            commentDeleted: false,
            userDeleted: false,
          },
          {
            revid: "r1",
            user: "amy",
            timestamp: "",
            comment: "",
            size: 1,
            byteDelta: 0,
            minor: false,
            sha1: null,
            parked: false,
            textDeleted: false,
            commentDeleted: false,
            userDeleted: false,
          },
        ],
        hasMore: false,
        fromShadow: true,
      });
    });

    it("refuses every write to a blocked user, with the block reason", async () => {
      mockBlocks({ reason: "vandalism", allowUserTalk: true });
      const caller = createCaller(userCtx() as never);

      await expect(caller.saveWikitext({ title: "Caphiria", wikitext: "x" })).rejects.toMatchObject(
        {
          code: "FORBIDDEN",
          message: expect.stringMatching(/^blocked: .*vandalism/),
        }
      );
      await expect(
        caller.revertToRevision({ title: "Caphiria", revid: "r1" })
      ).rejects.toMatchObject({
        message: expect.stringMatching(/^blocked: /),
      });
      expect(ArticleRepository.saveArticle).not.toHaveBeenCalled();
    });

    it("holds create-protection against a new page, and an archived page counts as new", async () => {
      mockRestrictions({ action: "create", level: "sysop" });
      const caller = createCaller(userCtx() as never);

      jest.mocked(ArticleRepository.findBySlug).mockResolvedValue(null);
      await expect(caller.saveWikitext({ title: "Salted", wikitext: "x" })).rejects.toMatchObject({
        message: expect.stringMatching(/^titleprotected: /),
      });

      jest.mocked(ArticleRepository.findBySlug).mockResolvedValue({ status: "ARCHIVED" } as never);
      await expect(caller.saveWikitext({ title: "Salted", wikitext: "x" })).rejects.toMatchObject({
        message: expect.stringMatching(/^titleprotected: /),
      });

      // An existing page is not held by create-protection.
      jest.mocked(ArticleRepository.findBySlug).mockResolvedValue(existingArticle());
      await caller.saveWikitext({ title: "Salted", wikitext: "x" });
      expect(ArticleRepository.saveArticle).toHaveBeenCalledTimes(1);
    });

    it("rolls back only for the rollback right", async () => {
      const caller = createCaller(userCtx() as never);
      await expect(caller.rollback({ title: "Caphiria" })).rejects.toMatchObject({
        message: expect.stringMatching(/^permissiondenied: /),
      });
      expect(ArticleRepository.saveArticle).not.toHaveBeenCalled();

      mockGroups("rollbacker");
      await caller.rollback({ title: "Caphiria" });
      expect(ArticleRepository.saveArticle).toHaveBeenCalledTimes(1);
    });

    it("holds a rollback to the page's edit protection", async () => {
      mockGroups("rollbacker");
      mockRestrictions({ action: "edit", level: "sysop" });
      await expect(
        createCaller(userCtx() as never).rollback({ title: "Caphiria" })
      ).rejects.toMatchObject({ message: expect.stringMatching(/^protectedpage: /) });
    });

    it("restoreArticle checks and acts in the realm it was asked for, and maps service refusals", async () => {
      const caller = createCaller(adminCtx() as never);
      jest
        .mocked(PageManagementService.restoreArticle)
        .mockResolvedValue({ success: true, articleId: "a1" });

      await caller.restoreArticle({ title: "foo_bar", realm: "iiwiki" });
      expect(PageManagementService.restoreArticle).toHaveBeenCalledWith(
        "Foo bar",
        { userId: "dbadmin", name: "admin" },
        "iiwiki"
      );

      const { PageOperationError } = jest.requireActual<
        typeof import("~/lib/wiki-os/core/page-management-service")
      >("~/lib/wiki-os/core/page-management-service");
      for (const code of ["NOT_FOUND", "CONFLICT", "BAD_REQUEST"] as const) {
        jest
          .mocked(PageManagementService.restoreArticle)
          .mockRejectedValueOnce(new PageOperationError(code, `refused ${code}`));
        await expect(caller.restoreArticle({ title: "Foo" })).rejects.toMatchObject({
          code,
          message: `refused ${code}`,
        });
      }
    });

    it("will not save over a deleted page: an administrator restores it first", async () => {
      jest.mocked(ArticleRepository.findBySlug).mockResolvedValue({ status: "ARCHIVED" } as never);
      mockGroups("rollbacker");
      const caller = createCaller(userCtx() as never);
      const refused = {
        code: "PRECONDITION_FAILED",
        message: "This page was deleted; ask an administrator to restore it",
      };

      await expect(caller.saveWikitext({ title: "Gone", wikitext: "x" })).rejects.toMatchObject(
        refused
      );
      await expect(caller.revertToRevision({ title: "Gone", revid: "r1" })).rejects.toMatchObject(
        refused
      );
      await expect(caller.rollback({ title: "Gone" })).rejects.toMatchObject(refused);
      expect(ArticleRepository.saveArticle).not.toHaveBeenCalled();
    });

    it("checks the caller's rights on a deleted title before telling them it was deleted", async () => {
      jest.mocked(ArticleRepository.findBySlug).mockResolvedValue({ status: "ARCHIVED" } as never);
      const caller = createCaller(userCtx() as never);

      await expect(
        caller.saveWikitext({ title: "Template:Gone", wikitext: "x" })
      ).rejects.toMatchObject({
        message: expect.stringMatching(/^namespaceprotected: /),
      });
      mockBlocks({ reason: "spam", allowUserTalk: true });
      await expect(caller.saveWikitext({ title: "Gone", wikitext: "x" })).rejects.toMatchObject({
        message: expect.stringMatching(/^blocked: /),
      });
    });

    it("lets the IxStates admin role act as a sysop: edit Template:, roll back, but not edit site JS", async () => {
      const adminRoleCtx = createMockRouterContext({
        auth: { userId: "user_2" },
        user: {
          id: "db2",
          clerkUserId: "user_2",
          handle: "mod",
          role: { name: "admin", level: 10 },
        },
      });
      const caller = createCaller(adminRoleCtx as never);

      await caller.saveWikitext({ title: "Template:Infobox", wikitext: "x" });
      await caller.rollback({ title: "Caphiria" });
      await expect(
        caller.saveWikitext({ title: "MediaWiki:Common.js", wikitext: "x" })
      ).rejects.toMatchObject({ message: expect.stringMatching(/^namespaceprotected: /) });
    });
  });
});

describe("identity is the internal User id (blurbs, stashes)", () => {
  const mockDb = db as unknown as {
    user: { findFirst: jest.Mock };
    blurbPrompt: { findUnique: jest.Mock };
    blurbResponse: { findUnique: jest.Mock; create: jest.Mock };
    thinkpagesAccount: { findFirst: jest.Mock };
    thinkpagesPost: { create: jest.Mock };
    stash: { findMany: jest.Mock; findFirst: jest.Mock; findUnique: jest.Mock; create: jest.Mock };
    stashItem: { upsert: jest.Mock };
  };

  const ctx = () =>
    createMockRouterContext({
      auth: { userId: "user_clerk_1" },
      user: {
        id: "db_user_1",
        clerkUserId: "user_clerk_1",
        countryId: "country_1",
        role: { name: "user", level: 100 },
      },
    }) as never;

  describe("blurbs.submitResponse identity", () => {
    beforeEach(() => {
      jest.clearAllMocks();
      // Only the Clerk id finds the user, as in production (findWikiUserByAuthId matches clerkUserId).
      mockDb.user.findFirst.mockImplementation(async (args: { where: { clerkUserId?: string } }) =>
        args.where.clerkUserId === "user_clerk_1"
          ? { id: "db_user_1", countryId: "country_1" }
          : null
      );
      mockDb.blurbPrompt.findUnique.mockResolvedValue({
        id: "prompt_1",
        status: "ACTIVE",
        slug: "p",
        title: "Prompt",
      });
      mockDb.blurbResponse.findUnique.mockResolvedValue(null);
      mockDb.thinkpagesAccount.findFirst.mockResolvedValue({ id: "acct_1" });
      mockDb.thinkpagesPost.create.mockResolvedValue({ id: "post_1" });
      mockDb.blurbResponse.create.mockImplementation(async (args: { data: unknown }) => args.data);
    });

    it("finds the signed-in user by Clerk id and saves the dispatch under the internal id", async () => {
      const caller = createCallerFactory(blurbsRespondRouter)(ctx());
      const result = await caller.submitResponse({ promptId: "prompt_1", content: "Hello" });

      expect(mockDb.user.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { clerkUserId: "user_clerk_1" } })
      );
      expect(result).toMatchObject({ userId: "db_user_1", countryId: "country_1" });
      // The ThinkPages cross-post looks the account up by Clerk id, too.
      expect(mockDb.thinkpagesAccount.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { clerkUserId: "user_clerk_1", countryId: "country_1" } })
      );
      expect(result).toMatchObject({ thinkpagesPostId: "post_1" });
    });
  });

  describe("wikios stash identity", () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it("lists stashes keyed by the internal id and by the legacy Clerk id", async () => {
      mockDb.stash.findMany.mockResolvedValue([
        {
          id: "legacy",
          name: "My Stash",
          color: "#000",
          icon: null,
          isDefault: true,
          order: 0,
          _count: { items: 3 },
        },
      ]);
      const caller = createCallerFactory(wikiosStashRouter)(ctx());
      const stashes = await caller.getStashes();

      expect(mockDb.stash.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: { in: ["db_user_1", "user_clerk_1"] } } })
      );
      expect(stashes).toEqual([expect.objectContaining({ id: "legacy", itemCount: 3 })]);
    });

    it("stashes into the legacy default stash instead of creating a second one", async () => {
      mockDb.stash.findFirst.mockResolvedValue({ id: "legacy", userId: "user_clerk_1" });
      mockDb.stashItem.upsert.mockResolvedValue({});
      const caller = createCallerFactory(wikiosStashRouter)(ctx());
      const result = await caller.stashPage({ pageTitle: "Caphiria" });

      expect(result).toEqual({ success: true, stashId: "legacy" });
      expect(mockDb.stash.create).not.toHaveBeenCalled();
    });

    it("does not stash into a named stash that belongs to someone else", async () => {
      mockDb.stash.findFirst.mockResolvedValue(null);
      mockDb.stashItem.upsert.mockClear();
      const caller = createCallerFactory(wikiosStashRouter)(ctx());

      await expect(caller.stashPage({ pageTitle: "Caphiria", stashId: "other" })).rejects.toThrow(
        "Stash not found"
      );
      expect(mockDb.stash.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "other", userId: { in: ["db_user_1", "user_clerk_1"] } },
        })
      );
      expect(mockDb.stashItem.upsert).not.toHaveBeenCalled();
    });

    it("does not delete a stash that belongs to someone else", async () => {
      mockDb.stash.findUnique.mockResolvedValue({
        id: "other",
        userId: "user_clerk_2",
        isDefault: false,
      });
      const caller = createCallerFactory(wikiosStashRouter)(ctx());
      await expect(caller.deleteStash({ id: "other" })).rejects.toThrow("Stash not found");
    });
  });
});
