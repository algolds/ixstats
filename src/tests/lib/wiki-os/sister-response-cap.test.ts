/** @jest-environment node */
/**
 * What a sister wiki may make this server hold. An answer is read up to `MAX_SISTER_RESPONSE_BYTES` and no further
 * (by its Content-Length, else as it streams in): past it the read stops, the body is cancelled and the call fails as
 * the wiki giving no usable answer (SisterResponseTooLargeError, a WikiUnavailableError); a render that big is a
 * page its wiki cannot render for us (SisterRenderError). The render cache counts what it holds in bytes.
 */

import { afterEach, beforeEach, describe, expect, it } from "@jest/globals";
import {
  MAX_SISTER_RESPONSE_BYTES,
  readSisterWikitext,
  SisterResponseTooLargeError,
} from "~/lib/wiki-os/adapters/mediawiki/bridge/http-reader";
import { ByteBoundedCache } from "~/lib/cache/byte-bounded-cache";
import {
  renderSisterArticle,
  SisterRenderError,
} from "~/lib/wiki-os/services/sister-render-service";
import { WikiUnavailableError } from "~/lib/wiki-os/upstream-guard";

const CHUNK = 1024 * 1024;
let pulled = 0;
let cancelled = false;
let fetchSpy: jest.SpiedFunction<typeof fetch>;
let now = 1_000_000;
let dateSpy: jest.SpyInstance<number, []>;

/** A JSON answer whose body never ends: 1 MB chunks for as long as anyone reads. */
const endless = (headers: Record<string, string> = {}) =>
  new Response(
    new ReadableStream<Uint8Array>({
      pull(controller) {
        pulled++;
        controller.enqueue(new Uint8Array(CHUNK).fill(0x20));
      },
      cancel() {
        cancelled = true;
      },
    }),
    { headers: { "content-type": "application/json", ...headers } }
  );

beforeEach(() => {
  pulled = 0;
  cancelled = false;
  // an hour on per test: past any cooldown a test before left on the shared host
  now += 3_600_000;
  dateSpy = jest.spyOn(Date, "now").mockImplementation(() => now);
});

afterEach(() => {
  fetchSpy.mockRestore();
  dateSpy.mockRestore();
});

describe("a sister wiki's answer", () => {
  it("is read no further than the cap, and fails as too large (unavailable)", async () => {
    fetchSpy = jest.spyOn(global, "fetch").mockImplementation(async () => endless());

    const error = await readSisterWikitext("iiwiki", "Endless").catch((e: Error) => e);

    expect(error).toBeInstanceOf(SisterResponseTooLargeError);
    expect(error).toBeInstanceOf(WikiUnavailableError);
    expect(cancelled).toBe(true);
    expect(pulled).toBeLessThanOrEqual(MAX_SISTER_RESPONSE_BYTES / CHUNK + 3);
  });

  it("is refused unread when its Content-Length is over the cap", async () => {
    fetchSpy = jest
      .spyOn(global, "fetch")
      .mockImplementation(async () =>
        endless({ "content-length": String(MAX_SISTER_RESPONSE_BYTES + 1) })
      );

    await expect(readSisterWikitext("althistory", "Declared")).rejects.toBeInstanceOf(
      SisterResponseTooLargeError
    );
    expect(pulled).toBeLessThanOrEqual(1);
  });

  it("under the cap is parsed as before", async () => {
    fetchSpy = jest.spyOn(global, "fetch").mockImplementation(async () =>
      Response.json({
        query: { pages: { "7": { pageid: 7, title: "Small", revisions: [{ revid: 3 }] } } },
      })
    );

    expect(await readSisterWikitext("iiwiki", "Small")).toMatchObject({
      title: "Small",
      pageId: 7,
      revId: 3,
    });
  });
});

describe("renderSisterArticle", () => {
  it("calls a render over the cap one its wiki cannot render", async () => {
    fetchSpy = jest.spyOn(global, "fetch").mockImplementation(async () => endless());
    const article = { title: "Huge", pageId: 1, wikitext: "x", length: 1, revId: 99 };

    await expect(renderSisterArticle("iiwiki", article)).rejects.toBeInstanceOf(SisterRenderError);
  });

  it("caches a render counted in bytes, at two bytes a character of what it holds", async () => {
    const html = `<div class="mw-parser-output"><p>${"a".repeat(50_000)}</p></div>`;
    fetchSpy = jest
      .spyOn(global, "fetch")
      .mockImplementation(async () => Response.json({ parse: { title: "Sized", text: html } }));
    const set = jest.spyOn(ByteBoundedCache.prototype, "set");
    try {
      const render = await renderSisterArticle("althistory", {
        title: "Sized",
        pageId: 2,
        wikitext: "x",
        length: 1,
        revId: 100,
      });

      expect(set).toHaveBeenCalledTimes(1);
      const bytes = set.mock.calls[0]![2];
      expect(bytes).toBeGreaterThanOrEqual(render.contentHtml.length * 2);
      expect(bytes).toBeLessThan(render.contentHtml.length * 2 + 2_000);
    } finally {
      set.mockRestore();
    }
  });
});
