/** @jest-environment node */
// `jest` is deliberately NOT imported from "@jest/globals": the hoisted jest.mock() factories rely on the ambient global.
//
// The importer over the real generator (cards refresh §2.4; spike-sources.md "What the importer must do", rule 5): a
// page the wiki does not have is a skip, a failed read is a failure with its reason, and a wiki that refuses (HTTP
// 403 or 429, `readapidenied`) or answers with a web page instead of data (a Cloudflare challenge) stops the run for
// that wiki. That holds for every read a card is made from (the page, its image's address, its backlinks), so a
// refused read never stages a card without its art that would then hold the article's natural key.
jest.mock("~/server/db", () => ({
  __esModule: true,
  db: { wikiArticle: { findMany: async () => [], findFirst: jest.fn() } },
  isDatabaseReadOnly: true,
}));
jest.mock("~/server/modules/cards/cards.art-licence", () => ({
  captureArtLicence: jest.fn(),
  wikiQueryFor: jest.fn(),
}));

import { afterEach, beforeEach, describe, expect, it } from "@jest/globals";
import { DEFAULT_RARITY_THRESHOLDS } from "~/lib/cards/rarity-engine";
import { stageArticleCard, type ImportContext } from "~/server/modules/cards/cards.importer";
import { createMockPrisma } from "~/tests/helpers/mock-db";

const context: ImportContext = { query: jest.fn(), thresholds: DEFAULT_RARITY_THRESHOLDS.iiwiki };
const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

interface Answer {
  status: number;
  body: string;
  type?: string;
}
const json = (value: object): Answer => ({ status: 200, body: JSON.stringify(value) });
const CHALLENGE: Answer = {
  status: 200,
  body: "<!DOCTYPE html><title>Just a moment...</title>",
  type: "text/html",
};

/** The response bodies the wiki was asked to cancel. */
let cancelled: number[] = [];

function answer({ status, body, type = "application/json" }: Answer): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: "",
    headers: new Headers({ "content-type": type }),
    body: {
      cancel: async () => {
        cancelled.push(status);
      },
    },
    text: async () => body,
    json: async () => JSON.parse(body),
  } as never;
}

/** Elm's page: long enough to become a card, its art named by its first article image (so its address is read). */
const PAGE = json({
  query: {
    pages: {
      1: {
        title: "Elm",
        images: [{ title: "File:Elm coast.jpg" }],
        revisions: [{ "*": "'''Elm''' is a nation. ".repeat(40), user: "Kir", timestamp: "2020" }],
      },
    },
  },
});
const IMAGE = json({
  query: {
    pages: {
      2: {
        title: "File:Elm coast.jpg",
        imageinfo: [{ url: "https://iiwiki.com/images/a/ab/Elm_coast.jpg" }],
      },
    },
  },
});
const BACKLINKS = json({ query: { backlinks: [{ title: "A" }] } });
const EDITORS = json({
  query: { pages: { 1: { title: "Elm", revisions: [{ user: "Kir", timestamp: "2020" }] } } },
});

/** The wiki answering each read of the article; a read left out answers as Elm's wiki does. */
function wiki(reads: Partial<Record<"page" | "image" | "backlinks", Answer | Error>> = {}) {
  globalThis.fetch = (async (input: string) => {
    const params = new URL(input).searchParams;
    const read =
      params.get("list") === "backlinks"
        ? (reads.backlinks ?? BACKLINKS)
        : params.get("prop") === "imageinfo"
          ? (reads.image ?? IMAGE)
          : params.get("rvdir") === "newer"
            ? EDITORS
            : (reads.page ?? PAGE);
    // A DOMException (the timeout) is not an `Error` instance in this realm: tell the two apart by shape.
    if (!("body" in read)) throw read;
    return answer(read);
  }) as typeof fetch;
}

const makeDb = () => {
  const stageDb = createMockPrisma({ $queryRaw: jest.fn().mockResolvedValue([]) });
  stageDb.card.create.mockResolvedValue({ id: "card_elm", rarity: "COMMON" });
  return stageDb;
};
let stageDb = makeDb();
const stage = (source: "iiwiki" | "ixwiki" = "iiwiki") =>
  stageArticleCard(
    stageDb as never,
    source,
    { title: "Elm", requestedBy: null, jobId: null },
    context
  );

beforeEach(() => {
  cancelled = [];
  stageDb = makeDb();
});

describe("reading the page", () => {
  it("stops the run when the wiki limits the requests", async () => {
    wiki({ page: { status: 429, body: "", type: "text/plain" } });
    await expect(stage()).rejects.toMatchObject({
      name: "DiscoveryStopped",
      stop: { kind: "rate-limited", status: 429 },
      message: "IIWiki stopped answering (HTTP 429).",
    });
    expect(cancelled).toEqual([429]);
  });
  it("stops the run when the wiki answers with a web page instead of data", async () => {
    wiki({ page: CHALLENGE });
    await expect(stage()).rejects.toMatchObject({
      name: "DiscoveryStopped",
      stop: { kind: "blocked", status: 200 },
      message: "IIWiki answered with a web page instead of data.",
    });
  });
});
