/** @jest-environment node */
// `jest` is deliberately NOT imported from "@jest/globals": the hoisted jest.mock() factories
// rely on the ambient global.
// Plan 406 follow-up, restored by plan 2026-10-24 Task 10: contributions keep an overwritten revision (stored with
// `parked`: a save a later one on the other wiki replaced) in the list, and say so.
jest.mock("~/server/db", () => ({
  __esModule: true,
  db: {},
  isDatabaseReadOnly: true,
}));
jest.mock("~/lib/wiki-os/adapters/mediawiki/bridge", () => ({
  __esModule: true,
  getUserContribs: jest.fn(),
  getUserInfo: jest.fn(),
  getBacklinks: jest.fn(),
}));

import { describe, it, expect, beforeEach } from "@jest/globals";
import { createCallerFactory } from "~/server/api/trpc";
import { wikiosUserTalkRouter } from "~/server/api/routers/wikios/user-talk";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { getUserContribs } from "~/lib/wiki-os/adapters/mediawiki/bridge";

const signedOut = (db: object) => createMockRouterContext({ auth: null, user: null, db }) as never;

beforeEach(() => {
  jest.clearAllMocks();
});

describe("wikios.getUserContribs", () => {
  it("passes the parked flag of a bridge contribution on", async () => {
    jest.mocked(getUserContribs).mockResolvedValue([
      {
        rev_id: 101,
        page_title: "Foo",
        page_namespace: 0,
        rev_timestamp: "2026-09-27T10:00:00Z",
        rev_len: 20,
        diff: 5,
        rev_comment: "conflicting edit",
        rev_minor_edit: 0,
        is_new: false,
        parked: true,
      },
      {
        rev_id: 99,
        page_title: "Bar",
        page_namespace: 0,
        rev_timestamp: "2026-09-26T10:00:00Z",
        rev_len: 10,
        diff: 1,
        rev_comment: "",
        rev_minor_edit: 0,
        is_new: false,
        parked: false,
      },
    ]);

    const result = await createCallerFactory(wikiosUserTalkRouter)(signedOut({})).getUserContribs({
      user: "carol",
    });

    expect(result.contribs.map((c) => [c.revid, c.parked])).toEqual([
      [101, true],
      [99, false],
    ]);
  });
});
