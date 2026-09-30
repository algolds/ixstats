/** @jest-environment node */
/**
 * ixwikiGetUserInfo must not invent wiki data: the user id, edit count and groups come from the live
 * MediaWiki API only. When the wiki is unreachable but IxStats has mirrored the name, the answer is
 * "exists, id 0, 0 edits, no groups" (unknown), not a made-up id 1 or a score-derived edit count.
 */
jest.mock("~/server/db", () => {
  const db = {
    wikiRevision: {
      count: jest.fn(),
      findFirst: jest.fn(),
    },
    lorewardUserStats: { findFirst: jest.fn() },
  };
  return { __esModule: true, db };
});

import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import { db } from "~/server/db";
import { ixwikiGetUserInfo } from "~/lib/wiki-os/adapters/mediawiki/bridge/pg-activity";

const mocked = db as unknown as {
  wikiRevision: { count: jest.Mock; findFirst: jest.Mock };
  lorewardUserStats: { findFirst: jest.Mock };
};

describe("ixwikiGetUserInfo", () => {
  let fetchSpy: jest.SpyInstance;
  beforeEach(() => {
    mocked.wikiRevision.count.mockReset().mockResolvedValue(3);
    mocked.wikiRevision.findFirst
      .mockReset()
      .mockResolvedValue({ author: "Kir", createdAt: new Date() });
    mocked.lorewardUserStats.findFirst
      .mockReset()
      .mockResolvedValue({ username: "Kir", totalScore: 100_000 });
    fetchSpy = jest.spyOn(globalThis, "fetch");
  });
  afterEach(() => fetchSpy.mockRestore());

  it("returns the live MediaWiki id, edit count and groups when the wiki answers", async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      json: async () => ({
        query: {
          users: [
            { userid: 42, name: "Kir", editcount: 987, groups: ["sysop"], registration: null },
          ],
        },
      }),
    } as Response);
    const info = await ixwikiGetUserInfo("Kir");
    expect(info).toMatchObject({ exists: true, userId: 42, editCount: 987, groups: ["sysop"] });
    expect(info?.registration).toBeNull();
  });

  it("does not fabricate an id, edit count or groups from the local mirror", async () => {
    fetchSpy.mockRejectedValue(new Error("offline"));
    const info = await ixwikiGetUserInfo("Kir");
    expect(info).toMatchObject({
      exists: true,
      username: "Kir",
      userId: 0,
      user_id: 0,
      editCount: 0,
      groups: [],
      registration: null,
    });
  });

  it("reports an unknown name as not existing", async () => {
    fetchSpy.mockRejectedValue(new Error("offline"));
    mocked.wikiRevision.count.mockResolvedValue(0);
    mocked.wikiRevision.findFirst.mockResolvedValue(null);
    mocked.lorewardUserStats.findFirst.mockResolvedValue(null);
    expect(await ixwikiGetUserInfo("Nobody")).toMatchObject({ exists: false, userId: 0 });
  });
});
