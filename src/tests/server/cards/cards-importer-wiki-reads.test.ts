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
import { db } from "~/server/db";
import { DEFAULT_RARITY_THRESHOLDS } from "~/lib/cards/rarity-engine";
import { DiscoveryStopped } from "~/lib/realms/sources/wiki-discovery-client";
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
  it("stages the card when every read answers", async () => {
    wiki();
    await expect(stage()).resolves.toMatchObject({ status: "STAGED" });
    expect(stageDb.card.create.mock.calls[0]![0].data.artwork).toBe(
      "https://iiwiki.com/images/a/ab/Elm_coast.jpg"
    );
  });

  it("skips a page the wiki does not have", async () => {
    wiki({ page: json({ query: { pages: { "-1": { title: "Elm", missing: "" } } } }) });
    await expect(stage()).resolves.toEqual({
      status: "SKIPPED",
      reason: '"Elm" was not found on IIWiki.',
    });
  });

  it("skips a title the wiki refuses as invalid", async () => {
    wiki({ page: json({ query: { pages: { "-1": { title: "Elm", invalid: "" } } } }) });
    await expect(stage()).resolves.toMatchObject({ status: "SKIPPED" });
  });

  it("fails a page the wiki could not serve, with the reason, and lets go of the answer", async () => {
    wiki({ page: { status: 503, body: "Service Unavailable", type: "text/plain" } });
    await expect(stage()).resolves.toEqual({
      status: "FAILED",
      reason: "IIWiki answered HTTP 503.",
    });
    expect(cancelled).toEqual([503]);
  });

  it("fails on an API error other than a refusal, with its message", async () => {
    wiki({
      page: json({
        error: {
          code: "internal_api_error_DBQueryError",
          info: "A database query error has occurred.",
        },
      }),
    });
    await expect(stage()).resolves.toEqual({
      status: "FAILED",
      reason: "IIWiki answered with an error: A database query error has occurred.",
    });
  });

  it("fails when the wiki does not answer at all", async () => {
    wiki({ page: new TypeError("fetch failed") });
    await expect(stage()).resolves.toEqual({ status: "FAILED", reason: "fetch failed" });
  });

  it("fails an IxWiki page Postgres could not read", async () => {
    jest.mocked(db.wikiArticle.findFirst).mockRejectedValue(new Error("connection reset"));
    await expect(stage("ixwiki")).resolves.toEqual({
      status: "FAILED",
      reason: "connection reset",
    });
    expect(stageDb.card.create).not.toHaveBeenCalled();
  });

  it("stops the run when the wiki refuses the request, letting go of the answer", async () => {
    wiki({ page: { ...CHALLENGE, status: 403 } });
    const stopped = stage();
    await expect(stopped).rejects.toBeInstanceOf(DiscoveryStopped);
    await expect(stopped).rejects.toMatchObject({
      stop: { kind: "blocked", status: 403 },
      message: "IIWiki stopped answering (HTTP 403).",
    });
    expect(cancelled).toEqual([403]);
  });

  it("stops the run when the wiki limits the requests", async () => {
    wiki({ page: { status: 429, body: "", type: "text/plain" } });
    await expect(stage()).rejects.toMatchObject({
      name: "DiscoveryStopped",
      stop: { kind: "rate-limited", status: 429 },
      message: "IIWiki stopped answering (HTTP 429).",
    });
    expect(cancelled).toEqual([429]);
  });

  it("stops the run when the wiki will not let its pages be read", async () => {
    wiki({
      page: json({
        error: { code: "readapidenied", info: "You need read permission to use this module." },
      }),
    });
    await expect(stage()).rejects.toMatchObject({
      name: "DiscoveryStopped",
      stop: { kind: "blocked", status: null },
      message: "IIWiki does not allow reading its pages.",
    });
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

describe("reading the page's image and backlinks", () => {
  it.each([
    ["image", { ...CHALLENGE, status: 403 }],
    ["image", CHALLENGE],
    ["backlinks", { ...CHALLENGE, status: 403 }],
    ["backlinks", CHALLENGE],
  ] as const)(
    "stops the run when the %s read is refused, staging nothing",
    async (read, refusal) => {
      wiki({ [read]: refusal });
      await expect(stage()).rejects.toBeInstanceOf(DiscoveryStopped);
      expect(stageDb.card.create).not.toHaveBeenCalled();
    }
  );

  it.each([
    ["image", { status: 503, body: "", type: "text/plain" }, "IIWiki answered HTTP 503."],
    [
      "image",
      new DOMException("The operation was aborted due to timeout", "TimeoutError"),
      "The operation was aborted due to timeout",
    ],
    ["backlinks", { status: 502, body: "", type: "text/plain" }, "IIWiki answered HTTP 502."],
    [
      "backlinks",
      new DOMException("The operation was aborted due to timeout", "TimeoutError"),
      "The operation was aborted due to timeout",
    ],
  ] as const)(
    "fails the article when the %s read fails, staging nothing",
    async (read, failure, reason) => {
      wiki({ [read]: failure });
      // The timeout's text, whatever realm its DOMException comes from (Jest's is not an `Error` here).
      await expect(stage()).resolves.toEqual({
        status: "FAILED",
        reason: expect.stringContaining(reason),
      });
      expect(stageDb.card.create).not.toHaveBeenCalled();
    }
  );
});
