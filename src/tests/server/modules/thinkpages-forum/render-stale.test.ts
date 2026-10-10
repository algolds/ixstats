/** @jest-environment node */
jest.mock("~/server/db", () => ({ db: {} }));
jest.mock("~/server/modules/thinkpages-forum/render", () => ({
  FORUM_RENDERER_VERSION: "forum-1:v",
  renderViaWiki: jest.fn(),
}));
import { renderViaWiki } from "~/server/modules/thinkpages-forum/render";
import { rerenderPosts, staleForumPostIds } from "~/server/modules/thinkpages-forum/render-stale";

const rerender = jest.mocked(renderViaWiki);

type Row = { id: string; threadId: string; contentWikitext: string };

/** `editedTo`: the wikitext an author saves between the cron's read and its write. */
function fakeDb(posts: Row[], editedTo?: string) {
  const updates: Array<{ id: string; renderedAt: Date | null; contentHtml: string }> = [];
  const templateWrites: string[][] = [];
  const db = {
    forumPost: {
      findMany: jest.fn(async () => posts),
      updateMany: jest.fn(
        async ({
          where,
          data,
        }: {
          where: { id: string; contentWikitext: string };
          data: { renderedAt: Date | null; contentHtml: string };
        }) => {
          const current = editedTo ?? posts.find((p) => p.id === where.id)?.contentWikitext;
          if (current !== where.contentWikitext) return { count: 0 };
          updates.push({
            id: where.id,
            renderedAt: data.renderedAt,
            contentHtml: data.contentHtml,
          });
          return { count: 1 };
        }
      ),
    },
    forumPostTemplate: {
      deleteMany: jest.fn(async () => ({ count: 0 })),
      createMany: jest.fn(async ({ data }: { data: Array<{ title: string }> }) => {
        templateWrites.push(data.map((d) => d.title));
        return { count: data.length };
      }),
    },
    $transaction: jest.fn(async (fn: (tx: typeof db) => Promise<boolean>) => fn(db)),
  };
  return { db, updates, templateWrites };
}

beforeEach(() => rerender.mockReset());

it("re-renders stale posts and replaces their templates", async () => {
  rerender.mockResolvedValue({
    contentHtml: "<p>new</p>",
    plainText: "new",
    rendererVersion: "forum-1:v",
    renderedAt: new Date(),
    templates: ["Template:Flag"],
  });
  const { db, updates, templateWrites } = fakeDb([
    { id: "p1", threadId: "t1", contentWikitext: "x" },
  ]);
  const result = await rerenderPosts(db as never, ["p1"]);
  expect(result).toEqual({ rendered: 1, failed: 0 });
  expect(updates[0]).toMatchObject({ id: "p1", contentHtml: "<p>new</p>" });
  expect(templateWrites).toEqual([["Template:Flag"]]);
});

it("leaves a post untouched when MediaWiki is still down", async () => {
  rerender.mockResolvedValue(null);
  const { db, updates } = fakeDb([{ id: "p1", threadId: "t1", contentWikitext: "x" }]);
  expect(await rerenderPosts(db as never, ["p1"])).toEqual({ rendered: 0, failed: 1 });
  expect(updates).toHaveLength(0);
});

it("skips the template insert when the render used no templates", async () => {
  rerender.mockResolvedValue({
    contentHtml: "<p>new</p>",
    plainText: "new",
    rendererVersion: "forum-1:v",
    renderedAt: new Date(),
    templates: [],
  });
  const { db, templateWrites } = fakeDb([{ id: "p1", threadId: "t1", contentWikitext: "x" }]);
  await rerenderPosts(db as never, ["p1"]);
  expect(db.forumPostTemplate.deleteMany).toHaveBeenCalledWith({ where: { postId: "p1" } });
  expect(templateWrites).toEqual([]);
});

it("writes only the text it rendered: an edit between the read and the write is left untouched", async () => {
  rerender.mockResolvedValue({
    contentHtml: "<p>stale</p>",
    plainText: "stale",
    rendererVersion: "forum-1:v",
    renderedAt: new Date(),
    templates: ["Template:Flag"],
  });
  const { db, updates, templateWrites } = fakeDb(
    [{ id: "p1", threadId: "t1", contentWikitext: "x" }],
    "edited"
  );
  expect(await rerenderPosts(db as never, ["p1"])).toEqual({ rendered: 0, failed: 0 });
  expect(db.forumPost.updateMany.mock.calls[0]![0].where).toEqual({
    id: "p1",
    contentWikitext: "x",
  });
  expect(updates).toHaveLength(0);
  expect(db.forumPostTemplate.deleteMany).not.toHaveBeenCalled();
  expect(templateWrites).toEqual([]);
});

it("selects stale post ids with the renderer version and limit bound", async () => {
  const queryRaw = jest.fn(
    async (strings: TemplateStringsArray, ...values: Array<string | number>) =>
      // A tagged template has one more string than values; anything else is not the query under test.
      strings.length === values.length + 1 ? [{ id: "a" }, { id: "b" }] : []
  );
  const ids = await staleForumPostIds({ $queryRaw: queryRaw } as never, 7);
  expect(ids).toEqual(["a", "b"]);
  const [strings, ...values] = queryRaw.mock.calls[0]!;
  expect(values).toEqual(["forum-1:v", 7]);
  expect(strings.join("?")).toContain('"contentWikitext" IS NOT NULL');
});
