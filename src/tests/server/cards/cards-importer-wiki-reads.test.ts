/** @jest-environment node */
// `jest` is deliberately NOT imported from "@jest/globals": the hoisted jest.mock() factories rely on the ambient global.
//
// The importer over the real generator (cards refresh §2.4; spike-sources.md "What the importer must do", rule 5): a
// page the wiki does not have is a skip, a failed read is a failure with its reason, and a wiki that refuses (HTTP
// 403) or answers with a web page instead of data (a Cloudflare challenge) stops the run for that wiki.
jest.mock("~/server/db", () => ({
  __esModule: true,
  db: { wikiArticle: { findMany: async () => [] } },
  isDatabaseReadOnly: true,
}));
jest.mock("~/server/modules/cards/cards.art-licence", () => ({
  captureArtLicence: jest.fn(),
  wikiQueryFor: jest.fn(),
}));

import { afterEach, describe, expect, it } from "@jest/globals";
import { DEFAULT_RARITY_THRESHOLDS } from "~/lib/cards/rarity-engine";
import { DiscoveryStopped } from "~/lib/realms/sources/wiki-discovery-client";
import { stageArticleCard, type ImportContext } from "~/server/modules/cards/cards.importer";
import { createMockPrisma } from "~/tests/helpers/mock-db";

const context: ImportContext = { query: jest.fn(), thresholds: DEFAULT_RARITY_THRESHOLDS.iiwiki };
const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

/** Every request answers with this status, content type and body. */
function wikiAnswers(status: number, body: string, type = "application/json") {
  globalThis.fetch = (async () =>
    ({
      ok: status >= 200 && status < 300,
      status,
      statusText: "",
      headers: new Headers({ "content-type": type }),
      text: async () => body,
      json: async () => JSON.parse(body),
    }) as Response) as typeof fetch;
}

function stage() {
  const db = createMockPrisma({ $queryRaw: jest.fn().mockResolvedValue([]) });
  return stageArticleCard(
    db as never,
    "iiwiki",
    { title: "Elm", requestedBy: null, jobId: null },
    context
  );
}

describe("reading the article", () => {
  it("skips a page the wiki does not have", async () => {
    wikiAnswers(200, JSON.stringify({ query: { pages: { "-1": { title: "Elm", missing: "" } } } }));
    await expect(stage()).resolves.toEqual({
      status: "SKIPPED",
      reason: '"Elm" was not found on iiwiki.',
    });
  });

  it("skips a title the wiki refuses as invalid", async () => {
    wikiAnswers(200, JSON.stringify({ query: { pages: { "-1": { title: "Elm", invalid: "" } } } }));
    await expect(stage()).resolves.toMatchObject({ status: "SKIPPED" });
  });

  it("fails a page the wiki could not serve, with the reason", async () => {
    wikiAnswers(503, "Service Unavailable", "text/plain");
    await expect(stage()).resolves.toEqual({
      status: "FAILED",
      reason: "iiwiki answered HTTP 503",
    });
  });

  it("fails on an API error, with its message", async () => {
    wikiAnswers(200, JSON.stringify({ error: { code: "ratelimited", info: "Slow down" } }));
    await expect(stage()).resolves.toEqual({ status: "FAILED", reason: "iiwiki: Slow down" });
  });

  it("fails when the wiki does not answer at all", async () => {
    globalThis.fetch = (async () => {
      throw new TypeError("fetch failed");
    }) as typeof fetch;
    await expect(stage()).resolves.toEqual({ status: "FAILED", reason: "fetch failed" });
  });

  it("stops the run when the wiki refuses the request", async () => {
    wikiAnswers(403, "<!DOCTYPE html><title>Just a moment...</title>", "text/html");
    const stopped = stage();
    await expect(stopped).rejects.toBeInstanceOf(DiscoveryStopped);
    await expect(stopped).rejects.toMatchObject({
      stop: { kind: "blocked", status: 403 },
      message: "iiwiki refused the request (HTTP 403)",
    });
  });

  it("stops the run when the wiki answers with a web page instead of data", async () => {
    wikiAnswers(200, "<!DOCTYPE html><title>Just a moment...</title>", "text/html");
    await expect(stage()).rejects.toMatchObject({
      name: "DiscoveryStopped",
      stop: { kind: "blocked", status: 200 },
      message:
        "iiwiki answered with a web page instead of data (a Cloudflare challenge, or the wiki is down)",
    });
  });
});
