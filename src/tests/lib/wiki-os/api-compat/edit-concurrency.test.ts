/** @jest-environment node */
// `jest` is deliberately NOT imported from "@jest/globals": the hoisted jest.mock() factories rely on the ambient global.
/**
 * M1: api.php edits built from the stored page (`appendtext`, `prependtext`, `section`) lose no update when two of them
 * are made at the same moment, even though the request names no base: the head the text was read at is the implicit
 * base. The real `action=edit` module and the real `commitWikitextSave`/`saveArticle` over a model of PostgreSQL's
 * transactions and locks (helpers/locking-wiki-db.ts); only the bot's reads (page row, text, revision refs) are the
 * harness's fake store.
 */
import { createLockingWikiDb } from "~/tests/helpers/locking-wiki-db";
import { commitWikitextSave } from "~/lib/wiki-os/services/edit-service";
import { loggedIn, makeWikiDeps, type FakeWikiData } from "./harness";

let model = createLockingWikiDb();
const mockTransaction = (...args: Parameters<typeof model.db.$transaction>) =>
  model.db.$transaction(...args);

jest.mock("~/server/db", () => ({
  __esModule: true,
  db: { $transaction: (...args: unknown[]) => (mockTransaction as (...a: unknown[]) => unknown)(...args) },
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
jest.mock("~/lib/wiki-os/services/watchlist-notify", () => ({
  notifyWatchers: jest.fn().mockResolvedValue(0),
}));
jest.mock("~/lib/wiki-os/guardian/cloudflare-guardian", () => ({
  CloudflareGuardian: { purgeArticleEdgeCache: jest.fn() },
}));

type Body = Record<string, any>;

const data = (): FakeWikiData => ({
  pages: [{ pageId: 1, title: "Alpha" }],
  revisions: [
    { revId: 101, page: "Alpha", timestamp: "2026-01-01T10:00:00Z", user: "Heku", content: "good text" },
  ],
});

/** The page as WikiOS holds it: one revision, stamped with MediaWiki's id 101 (its api.php `revid`, and its reference). */
function seedAlpha() {
  model.committed.articles.push({
    id: "art-alpha",
    source: "ixwiki",
    title: "Alpha",
    wikitext: "good text",
    status: "PUBLISHED",
    protectionLevel: "ALL",
    protectionExpiry: null,
  });
  model.committed.revisions.push({
    id: "rev-alpha-1",
    articleId: "art-alpha",
    mwRevId: 101,
    parked: false,
    createdAt: new Date("2026-01-01T10:00:00Z"),
    wikitext: "good text",
    byteSize: 9,
  });
}

async function setup() {
  const wiki = await makeWikiDeps(data(), {
    // the real save; the harness answers the module's own reads
    services: {
      saveWikitext: async (ctx, save) => ({ revisionRowId: (await commitWikitextSave(ctx, save)).revisionId }),
    },
  });
  const token = await loggedIn(wiki.bot);
  const edit = (params: Record<string, string>) =>
    wiki.bot.post({ action: "edit", token, formatversion: "2", ...params }) as Promise<Body>;
  return { edit };
}

beforeEach(() => {
  jest.clearAllMocks();
  model = createLockingWikiDb();
  seedAlpha();
});

const articleText = () => model.committed.articles[0]!.wikitext;
const revisions = () => model.committed.revisions;

describe("two appendtext edits at the same moment, neither naming a base", () => {
  it("lands exactly one; the other gets editconflict and changes nothing", async () => {
    const { edit } = await setup();

    const [first, second] = await Promise.all([
      edit({ title: "Alpha", appendtext: "\nfirst" }),
      edit({ title: "Alpha", appendtext: "\nsecond" }),
    ]);

    const results = [first, second];
    const landed = results.filter((body) => body.edit?.result === "Success");
    const refused = results.filter((body) => body.error);
    expect(landed).toHaveLength(1);
    expect(refused).toHaveLength(1);
    expect(refused[0]!.error.code).toBe("editconflict");
    // no update was lost: the text is the base plus exactly the winner's append, and there is one new revision
    expect(["good text\nfirst", "good text\nsecond"]).toContain(articleText());
    expect(revisions()).toHaveLength(2);
    expect(model.committed.jobs).toHaveLength(1);
  });
});

describe("a whole new text without a base", () => {
  it("is the last write wins, as in MediaWiki: both land", async () => {
    const { edit } = await setup();

    const bodies = await Promise.all([
      edit({ title: "Alpha", text: "whole one" }),
      edit({ title: "Alpha", text: "whole two" }),
    ]);

    expect(bodies.every((body) => body.edit?.result === "Success")).toBe(true);
    expect(revisions()).toHaveLength(3);
  });
});

describe("two createonly edits of a page that does not exist, at the same moment", () => {
  it("lands one; the other gets articleexists", async () => {
    const { edit } = await setup();

    const bodies = await Promise.all([
      edit({ title: "Beta", text: "mine", createonly: "" }),
      edit({ title: "Beta", text: "yours", createonly: "" }),
    ]);

    expect(bodies.filter((body) => body.edit?.result === "Success")).toHaveLength(1);
    const refused = bodies.filter((body) => body.error);
    expect(refused).toHaveLength(1);
    expect(refused[0]!.error.code).toBe("articleexists");
    expect(model.committed.articles.filter((row) => row.title === "Beta")).toHaveLength(1);
  });
});
