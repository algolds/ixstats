/** @jest-environment node */
jest.mock("~/server/db", () => ({ db: {} }));
jest.mock("~/server/modules/thinkpages-forum/render", () => ({
  FORUM_RENDERER_VERSION: "forum-1:v",
  renderViaWiki: jest.fn(),
}));
import { renderViaWiki } from "~/server/modules/thinkpages-forum/render";
import {
  nextStaleBatch,
  rerenderPosts,
  resetRenderFailuresForTests
} from "~/server/modules/thinkpages-forum/render-stale";

const rerender = jest.mocked(renderViaWiki);

type Row = { id: string; threadId: string; contentWikitext: string };

/** `editedTo`: the wikitext an author saves between the cron's read and its write. */
function fakeDb(posts: Row[], editedTo?: string) {
  const updates: Array<{ id: string; renderedAt: Date | null; contentHtml: string }> = [];
  const templateWrites: string[][] = [];
  const parts = {
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
  };
  const db = {
    ...parts,
    $transaction: jest.fn(async (fn: (tx: typeof parts) => Promise<boolean>) => fn(parts)),
  };
  return { db, updates, templateWrites };
}

beforeEach(() => {
  rerender.mockReset();
  resetRenderFailuresForTests();
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
const RENDERED = {
  plainText: "Hi @kir",
  rendererVersion: "forum-1:v",
  renderedAt: new Date(),
  templates: [],
};

function withNames(db: ReturnType<typeof fakeDb>["db"]) {
  return {
    ...db,
    user: { findMany: jest.fn(async (_args: object) => [{ id: "u_kir", handle: "kir" }]) },
    thinkpagesAccount: { findMany: jest.fn(async (_args: object) => []) },
  };
}

it("does not keep a mention link the render carried: only the ones it makes itself", async () => {
  rerender.mockResolvedValue({
    ...RENDERED,
    contentHtml: '<p><a class="forum-mention" href="/id/victim">@victim</a> @kir</p>',
  });
  const { db, updates } = fakeDb([{ id: "p1", threadId: "t1", contentWikitext: "x" }]);
  await rerenderPosts(withNames(db) as never, ["p1"]);
  expect(updates[0]?.contentHtml).toBe(
    '<p>@victim <a class="forum-mention" href="/id/kir">@kir</a></p>'
  );
});

describe("a post whose render keeps failing", () => {
  const BROKEN = Array.from({ length: 12 }, (_, i) => `broken${i}`);
  const posts: Row[] = [...BROKEN, "fine"].map((id) => ({
    id,
    threadId: "t1",
    contentWikitext: id,
  }));
  /** The stale query's order: posts that never rendered come first, and LIMIT cuts the list there. */
  const queue = (rows: Row[]) => ({
    $queryRaw: jest.fn(async (_s: TemplateStringsArray, ...values: Array<string | number>) =>
      rows.slice(0, Number(values[values.length - 1])).map(({ id }) => ({ id }))
    ),
  });
  const run = async (rows: Row[]) => {
    const { db, updates } = fakeDb(rows);
    const ids = await nextStaleBatch(queue(rows) as never);
    db.forumPost.findMany.mockImplementation(async () => rows.filter((p) => ids.includes(p.id)));
    const result = await rerenderPosts(db as never, ids);
    return { ids, result, updates };
  };
  const mediaWiki = (broken: boolean) =>
    rerender.mockImplementation(async (source: string) =>
      broken && source.startsWith("broken")
        ? null
        : {
            contentHtml: "<p>ok</p>",
            plainText: "ok",
            rendererVersion: "forum-1:v",
            renderedAt: new Date(),
            templates: [],
          }
    );

  it("goes to the back of the queue, so a renderable post behind it is reached on the next run", async () => {
    mediaWiki(true);
    const first = await run(posts);
    expect(first.ids).toEqual(BROKEN.slice(0, 10));
    expect(first.result).toEqual({ rendered: 0, failed: 10 });
    const second = await run(posts);
    expect(second.ids).toEqual([...BROKEN.slice(10), "fine"]);
    expect(second.updates.map((u) => u.id)).toEqual(["fine"]);
    expect(second.result).toEqual({ rendered: 1, failed: 2 });
  });
});
