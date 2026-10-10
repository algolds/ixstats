/** @jest-environment node */
jest.mock("~/server/db", () => ({ db: {} }));
jest.mock("~/server/modules/thinkpages-forum/render", () => ({
  FORUM_RENDERER_VERSION: "forum-1:v",
  renderViaWiki: jest.fn(),
}));
import { renderViaWiki } from "~/server/modules/thinkpages-forum/render";
import { rerenderPosts, staleForumPostIds } from "~/server/modules/thinkpages-forum/render-stale";

const rerender = jest.mocked(renderViaWiki);

function fakeDb(posts: Array<{ id: string; threadId: string; contentWikitext: string }>) {
  const updates: Array<{ id: string; renderedAt: Date | null; contentHtml: string }> = [];
  const templateWrites: string[][] = [];
  const db = {
    forumPost: {
      findMany: jest.fn(async () => posts),
      update: jest.fn(
        async ({
          where,
          data,
        }: {
          where: { id: string };
          data: { renderedAt: Date | null; contentHtml: string };
        }) => {
          updates.push({
            id: where.id,
            renderedAt: data.renderedAt,
            contentHtml: data.contentHtml,
          });
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
    $transaction: jest.fn(async (fn: (tx: typeof db) => Promise<void>) => fn(db)),
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

it("selects stale post ids with the renderer version and limit bound", async () => {
  const queryRaw = jest.fn(async () => [{ id: "a" }, { id: "b" }]);
  const ids = await staleForumPostIds({ $queryRaw: queryRaw } as never, 7);
  expect(ids).toEqual(["a", "b"]);
  const call = queryRaw.mock.calls[0] as unknown as [
    TemplateStringsArray,
    ...Array<string | number>,
  ];
  expect(call.slice(1)).toEqual(["forum-1:v", 7]);
  expect(call[0].join("?")).toContain('"contentWikitext" IS NOT NULL');
});
