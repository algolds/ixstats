/** @jest-environment node */
import { remapStashedThreads } from "~/server/modules/thinkpages-forum/import-stash-threads";
import { importStore } from "~/tests/helpers/forum-import-fake";

/** Threads 100 (public), 101 (hidden) and 103 (staff archive) imported; 999 never was. */
function stashStore(stashItems: object[]) {
  return importStore({
    categories: [
      { id: "c-xf12", key: "xf-12", visibility: "public" },
      { id: "c-xf13", key: "xf-13", visibility: "staff" },
    ],
    threads: [
      { id: "t-open", categoryId: "c-xf12", xenforoThreadId: 100 },
      { id: "t-hidden", categoryId: "c-xf12", xenforoThreadId: 101, hidden: true },
      { id: "t-staff", categoryId: "c-xf13", xenforoThreadId: 103 },
    ],
    stashItems: stashItems as never,
  });
}

/** A bridge-era stash item: title `forum:thread:<xf>`, its old path, and the XenForo id in `contentId`. */
const legacy = (id: string, stashId: string, xf: number | string, extra: object = {}) => ({
  id,
  stashId,
  pageTitle: `forum:thread:${xf}`,
  pageSlug: `/forum/thread/${xf}`,
  contentType: "forum_thread",
  contentId: typeof xf === "number" ? xf : null,
  note: `Old ${xf}`,
  ...extra,
});

const native = (id: string, stashId: string, threadId: string) => ({
  id,
  stashId,
  pageTitle: `thinkpages:thread:${threadId}`,
  pageSlug: `/thinkpages/t/${threadId}`,
  contentType: "forum_thread",
  contentId: null,
  note: `Now ${threadId}`,
});

const itemsOf = (store: ReturnType<typeof stashStore>) =>
  store
    .tables()
    .stashItems.map((i) => ({
      id: i.id,
      stashId: i.stashId,
      pageTitle: i.pageTitle,
      pageSlug: i.pageSlug,
      contentType: i.contentType,
      contentId: i.contentId,
      note: i.note,
    }))
    .sort((a, b) => String(a.id).localeCompare(String(b.id)));

describe("remapStashedThreads", () => {
  it("moves a bridge-era item to its native thread, found by contentId or else by its title", async () => {
    const store = stashStore([
      legacy("i-1", "s-1", 100),
      { ...legacy("i-2", "s-1", 101), contentId: null },
      // Written before stash items had a content type: the native item is always a forum_thread.
      { ...legacy("i-3", "s-2", 100), contentType: "wiki" },
      // contentId wins over the title.
      { ...legacy("i-4", "s-3", 7), contentId: 100 },
    ]);

    const totals = await remapStashedThreads(store.db as never, { dropUnresolved: true });

    expect(totals).toEqual({ moved: 4, twins: 0, deleted: 0 });
    expect(itemsOf(store)).toEqual([
      { ...native("i-1", "s-1", "t-open"), note: "Old 100" },
      { ...native("i-2", "s-1", "t-hidden"), note: "Old 101" },
      { ...native("i-3", "s-2", "t-open"), note: "Old 100" },
      { ...native("i-4", "s-3", "t-open"), note: "Old 7" },
    ]);
  });

  it("maps a hidden or staff-only thread too: the stash listing decides what its owner may read", async () => {
    const store = stashStore([legacy("i-hidden", "s-1", 101), legacy("i-staff", "s-1", 103)]);

    await remapStashedThreads(store.db as never, { dropUnresolved: true });

    expect(itemsOf(store).map((i) => i.pageTitle)).toEqual([
      "thinkpages:thread:t-hidden",
      "thinkpages:thread:t-staff",
    ]);
  });

  it("deletes the bridge-era item when that stash already holds the native thread", async () => {
    const store = stashStore([
      native("i-native", "s-1", "t-open"),
      legacy("i-old", "s-1", 100),
      // Two bridge-era items for one thread in one stash: the first moves, the second is its twin.
      legacy("i-a", "s-2", 100),
      { ...legacy("i-b", "s-2", 100), contentType: "wiki" },
      // Another stash's native item is no twin.
      legacy("i-other", "s-3", 100),
    ]);

    const totals = await remapStashedThreads(store.db as never, { dropUnresolved: true });

    expect(totals).toEqual({ moved: 2, twins: 2, deleted: 0 });
    expect(itemsOf(store)).toEqual([
      { ...native("i-a", "s-2", "t-open"), note: "Old 100" },
      native("i-native", "s-1", "t-open"),
      { ...native("i-other", "s-3", "t-open"), note: "Old 100" },
    ]);
  });

  it("keeps an item whose thread was never imported while threads failed, and deletes it on a clean run", async () => {
    const store = stashStore([
      legacy("i-never", "s-1", 999),
      legacy("i-no-id", "s-1", "abc"),
      legacy("i-too-big", "s-1", "2147483648"),
    ]);
    const before = itemsOf(store);

    const kept = await remapStashedThreads(store.db as never, { dropUnresolved: false });

    expect(kept).toEqual({ moved: 0, twins: 0, deleted: 0 });
    expect(itemsOf(store)).toEqual(before);

    const clean = await remapStashedThreads(store.db as never, { dropUnresolved: true });

    expect(clean).toEqual({ moved: 0, twins: 0, deleted: 3 });
    expect(itemsOf(store)).toEqual([]);
  });

  it("maps on the rerun a thread that was written after a run that kept its item", async () => {
    const store = stashStore([legacy("i-late", "s-1", 102)]);
    await remapStashedThreads(store.db as never, { dropUnresolved: false });
    store.tables().threads.push({
      id: "t-late",
      categoryId: "c-xf12",
      xenforoThreadId: 102,
      hidden: false,
      createdAt: new Date(0),
    });

    expect(await remapStashedThreads(store.db as never, { dropUnresolved: true })).toEqual({
      moved: 1,
      twins: 0,
      deleted: 0,
    });
    expect(itemsOf(store)[0]?.pageTitle).toBe("thinkpages:thread:t-late");
  });

  it("leaves every other item alone", async () => {
    const others = [
      native("i-native", "s-1", "t-open"),
      {
        id: "i-wiki",
        stashId: "s-1",
        pageTitle: "Rome",
        pageSlug: "Rome",
        contentType: "wiki",
        contentId: null,
        note: null,
      },
      {
        id: "i-image",
        stashId: "s-1",
        pageTitle: "commons:Flag.png",
        pageSlug: "commons%3AFlag.png",
        contentType: "image",
        contentId: null,
        note: null,
      },
      {
        id: "i-name",
        stashId: "s-1",
        pageTitle: "Forum:thread:100",
        pageSlug: "Forum%3Athread%3A100",
        contentType: "wiki",
        contentId: 100,
        note: null,
      },
    ];
    const store = stashStore(others);
    const before = itemsOf(store);

    expect(await remapStashedThreads(store.db as never, { dropUnresolved: true })).toEqual({
      moved: 0,
      twins: 0,
      deleted: 0,
    });
    expect(itemsOf(store)).toEqual(before);
    expect(store.db.stashItem.updateMany).not.toHaveBeenCalled();
    expect(store.db.stashItem.deleteMany).not.toHaveBeenCalled();
  });

  it("leaves an item removed or changed between its read and the write alone", async () => {
    const store = stashStore([legacy("i-gone", "s-1", 100), legacy("i-moved", "s-2", 100)]);
    const read = store.db.stashItem.findMany.getMockImplementation()!;
    store.db.stashItem.findMany.mockImplementationOnce(async (args) => {
      const rows = await read(args);
      const tables = store.tables();
      tables.stashItems = tables.stashItems.filter((i) => i.id !== "i-gone");
      tables.stashItems.find((i) => i.id === "i-moved")!.pageTitle = "Main_Page";
      return rows;
    });

    expect(await remapStashedThreads(store.db as never, { dropUnresolved: true })).toEqual({
      moved: 0,
      twins: 0,
      deleted: 0,
    });
    expect(itemsOf(store)).toEqual([{ ...legacy("i-moved", "s-2", 100), pageTitle: "Main_Page" }]);
  });

  it("is idempotent, and pages through every bridge-era item with one thread query per page", async () => {
    const items = Array.from({ length: 501 }, (_, i) =>
      legacy(`i-${String(i).padStart(3, "0")}`, `s-${i}`, 100)
    );
    const store = stashStore(items);

    expect(await remapStashedThreads(store.db as never, { dropUnresolved: true })).toEqual({
      moved: 501,
      twins: 0,
      deleted: 0,
    });
    expect(store.db.forumThread.findMany).toHaveBeenCalledTimes(2);
    const after = JSON.stringify(store.tables().stashItems);
    store.db.stashItem.updateMany.mockClear();

    expect(await remapStashedThreads(store.db as never, { dropUnresolved: true })).toEqual({
      moved: 0,
      twins: 0,
      deleted: 0,
    });
    expect(store.db.stashItem.updateMany).not.toHaveBeenCalled();
    expect(JSON.stringify(store.tables().stashItems)).toBe(after);
  });
});
