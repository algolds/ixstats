/** @jest-environment node */
import { remapQuoteIds } from "~/server/modules/thinkpages-forum/import-quote-ids";
import { importStore } from "~/tests/helpers/forum-import-fake";

const quote = (id: string) => `<blockquote class="forum-quote" data-post="${id}">q</blockquote>`;
const bare = '<blockquote class="forum-quote">q</blockquote>';

function store() {
  return importStore({
    posts: [
      { id: "p-a", threadId: "t", xenforoPostId: 1, contentHtml: quote("2") + quote("404") },
      { id: "p-b", threadId: "t", xenforoPostId: 2, contentHtml: "<p>no quote</p>" },
      { id: "p-c", threadId: "t", xenforoPostId: null, contentHtml: quote("p-b") },
      { id: "p-d", threadId: "t", xenforoPostId: 4, contentHtml: quote("1") },
    ],
  });
}

const htmlOf = (tables: ReturnType<ReturnType<typeof store>["tables"]>, id: string) =>
  tables.posts.find((p) => p.id === id)!.contentHtml;

describe("remapQuoteIds", () => {
  it("points each quote at the native post of its XenForo id and drops the ids nothing maps", async () => {
    const { db, tables } = store();
    const result = await remapQuoteIds(db as never, { dropUnmapped: true });
    expect(result).toEqual({ remapped: 2, dropped: 1 });
    expect(htmlOf(tables(), "p-a")).toBe(quote("p-b") + bare);
    expect(htmlOf(tables(), "p-d")).toBe(quote("p-a"));
  });

  it("leaves native quotes and posts without quotes untouched", async () => {
    const { db, tables } = store();
    await remapQuoteIds(db as never, { dropUnmapped: true });
    expect(htmlOf(tables(), "p-c")).toBe(quote("p-b"));
    expect(htmlOf(tables(), "p-b")).toBe("<p>no quote</p>");
  });

  it("keeps unmapped ids while the run is incomplete, and maps them on the rerun", async () => {
    const { db, tables } = store();
    await remapQuoteIds(db as never, { dropUnmapped: false });
    expect(htmlOf(tables(), "p-a")).toBe(quote("p-b") + quote("404"));
    const rerun = await remapQuoteIds(db as never, { dropUnmapped: true });
    expect(rerun).toEqual({ remapped: 0, dropped: 1 });
    expect(htmlOf(tables(), "p-a")).toBe(quote("p-b") + bare);
  });

  it("is idempotent", async () => {
    const { db, tables } = store();
    await remapQuoteIds(db as never, { dropUnmapped: true });
    const before = JSON.stringify(tables().posts);
    expect(await remapQuoteIds(db as never, { dropUnmapped: true })).toEqual({
      remapped: 0,
      dropped: 0,
    });
    expect(JSON.stringify(tables().posts)).toBe(before);
  });
});
