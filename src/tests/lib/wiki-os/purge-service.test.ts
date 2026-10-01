/** @jest-environment node */
/** Plan 410: action=purge marks the rendering stale, forgets the caches and queues a render. */
jest.mock("~/server/db", () => ({ __esModule: true, db: { wikiArticle: { update: jest.fn().mockResolvedValue({ id: "a1" }) } } }));
jest.mock("~/lib/wiki-os/services/render-service", () => ({ __esModule: true, enqueueRender: jest.fn() }));
jest.mock("~/lib/wiki-os/services/title-cache-eviction", () => ({ __esModule: true, evictWikiTitleCaches: jest.fn().mockResolvedValue(undefined) }));

import { db } from "~/server/db";
import { purgeArticle } from "~/lib/wiki-os/services/purge-service";
import { enqueueRender } from "~/lib/wiki-os/services/render-service";
import { evictWikiTitleCaches } from "~/lib/wiki-os/services/title-cache-eviction";

describe("purgeArticle", () => {
  it("marks the page's rendering stale, evicts its caches and queues a render, changing no text", async () => {
    await purgeArticle({ id: "a1", title: "Alpha" });
    expect(db.wikiArticle.update).toHaveBeenCalledWith({ where: { id: "a1" }, data: { htmlSyncedAt: null }, select: { id: true } });
    expect(evictWikiTitleCaches).toHaveBeenCalledWith("Alpha", "ixwiki", "a1");
    expect(enqueueRender).toHaveBeenCalledWith("a1");
  });
});
