/** @jest-environment node */
/**
 * Plan 407: one time limit for all the MediaWiki calls of a mirror attempt, so the worker's lock can outlast it.
 */
// The mirror's api.php and bot login come from `wikiosConfig`; this test sets their variables as it runs.
jest.mock("~/lib/wiki-os/config", () =>
  jest
    .requireActual("~/tests/helpers/live-wikios-config")
    .withLiveEnvironment(jest.requireActual("~/lib/wiki-os/config"))
);

import { requestSignal, withinAttempt } from "~/lib/wiki-os/adapters/mediawiki/attempt-scope";
import {
  getBotSessionAndToken,
  invalidateCsrfToken,
} from "~/lib/wiki-os/adapters/mediawiki/csrf-cache";
import { getMediaWikiAction } from "~/lib/wiki-os/adapters/mediawiki/write-service";
import { z } from "zod";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const realFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = realFetch;
  invalidateCsrfToken();
});

describe("withinAttempt / requestSignal", () => {
  it("gives a request only its own time outside an attempt", async () => {
    const signal = requestSignal(20);

    expect(signal.aborted).toBe(false);
    await sleep(50);
    expect(signal.aborted).toBe(true);
    expect(requestSignal(10_000).aborted).toBe(false);
  });

  it("stops every request of an attempt when the attempt's time is up, whatever their own time", async () => {
    await withinAttempt(40, async () => {
      const early = requestSignal(10_000);
      expect(early.aborted).toBe(false);

      await sleep(80);

      expect(early.aborted).toBe(true); // a request in flight is aborted
      expect(requestSignal(10_000).aborted).toBe(true); // one made after is already aborted
    });
  });

  it("is the request's own timeout that ends it when that is shorter than the attempt's", async () => {
    await withinAttempt(10_000, async () => {
      const signal = requestSignal(20);

      await sleep(50);

      expect(signal.aborted).toBe(true);
    });
  });

  it("keeps attempts apart: a request outside is not bound by an attempt that has ended", async () => {
    await withinAttempt(20, async () => sleep(50));

    expect(requestSignal(10_000).aborted).toBe(false);
  });
});

describe("the calls of an attempt", () => {
  const stuckWiki = () => {
    const signals: AbortSignal[] = [];
    globalThis.fetch = jest.fn(
      (_input: string | URL | Request, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          const signal = init?.signal as AbortSignal;
          signals.push(signal);
          signal.addEventListener("abort", () => reject(signal.reason));
        })
    ) as unknown as typeof fetch;
    return signals;
  };

  beforeEach(() => {
    process.env.WIKIOS_MEDIAWIKI_API = "http://mediawiki.test/api.php";
    process.env.WIKIOS_MEDIAWIKI_BOT_USER = "WikiOSMirror@wikios";
    process.env.WIKIOS_MEDIAWIKI_BOT_TOKEN = "bot-password";
  });

  it("aborts the login that is in flight when the attempt's time is up", async () => {
    const signals = stuckWiki();

    const started = Date.now();
    await expect(withinAttempt(40, () => getBotSessionAndToken())).rejects.toMatchObject({
      name: "TimeoutError",
    });

    expect(Date.now() - started).toBeLessThan(2_000);
    expect(signals[0]?.aborted).toBe(true);
  });

  it("aborts an api call of the attempt too, not only the login", async () => {
    const signals = stuckWiki();

    await expect(
      withinAttempt(40, () => getMediaWikiAction({ action: "query" }, z.object({})))
    ).rejects.toMatchObject({ name: "TimeoutError" });

    expect(signals.every((signal) => signal.aborted)).toBe(true);
  });
});
