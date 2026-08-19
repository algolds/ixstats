// src/lib/wiki-os/__tests__/storage-driver.test.ts
// Unit tests for WikiOS pluggable storage driver interface & MemoryStorageDriver.

import { describe, it, expect, beforeEach } from "@jest/globals";
import { MemoryStorageDriver } from "../drivers/memory-driver";
import { setStorageDriver, getStorageDriver } from "../storage-driver";

describe("WikiStorageDriver & MemoryStorageDriver", () => {
  let driver: MemoryStorageDriver;

  beforeEach(() => {
    driver = new MemoryStorageDriver();
    setStorageDriver(driver);
  });

  it("registers and retrieves the active storage driver", () => {
    expect(getStorageDriver()).toBe(driver);
    expect(driver.name).toBe("memory");
  });

  it("stores and retrieves articles by source and title", async () => {
    await driver.putArticle({
      source: "ixwiki",
      title: "Burgundie",
      wikitext: "== Overview ==\nBurgundie is a nation.",
      revisionId: 1042,
      revTimestamp: "2026-08-18T12:00:00Z",
      syncedAt: new Date(),
    });

    const retrieved = await driver.getArticle("ixwiki", "Burgundie");
    expect(retrieved).not.toBeNull();
    expect(retrieved?.title).toBe("Burgundie");
    expect(retrieved?.revisionId).toBe(1042);
    expect(retrieved?.wikitext).toContain("Burgundie is a nation.");
  });

  it("normalizes spaces to underscores in titles", async () => {
    await driver.putArticle({
      source: "ixwiki",
      title: "New Harren",
      wikitext: "Content with space",
      syncedAt: new Date(),
    });

    const retrieved = await driver.getArticle("ixwiki", "New_Harren");
    expect(retrieved).not.toBeNull();
    expect(retrieved?.wikitext).toBe("Content with space");
  });

  it("records and lists revisions in reverse chronological order", async () => {
    await driver.recordRevision({
      articleId: "ixwiki:Burgundie",
      source: "ixwiki",
      mwRevId: 101,
      wikitext: "Revision 1",
      author: "EditorA",
      summary: "First edit",
      minor: false,
    });

    await driver.recordRevision({
      articleId: "ixwiki:Burgundie",
      source: "ixwiki",
      mwRevId: 102,
      wikitext: "Revision 2",
      author: "EditorB",
      summary: "Second edit",
      minor: true,
    });

    const history = await driver.listRevisions("ixwiki", "Burgundie", 10);
    expect(history.revisions.length).toBe(2);
    expect(history.revisions[0]?.mwRevId).toBe(102);
    expect(history.revisions[1]?.mwRevId).toBe(101);
  });

  it("deletes articles upon invalidation", async () => {
    await driver.putArticle({
      source: "ixwiki",
      title: "Temp_Page",
      wikitext: "Temporary",
      syncedAt: new Date(),
    });

    await driver.deleteArticle("ixwiki", "Temp_Page");
    const retrieved = await driver.getArticle("ixwiki", "Temp_Page");
    expect(retrieved).toBeNull();
  });
});
