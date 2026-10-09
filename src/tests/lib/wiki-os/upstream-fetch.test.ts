/** @jest-environment node */
import { describe, it, expect, afterEach } from "@jest/globals";
import { TRPCError } from "@trpc/server";
import { fetchMediaWikiJson } from "~/lib/wiki-os/upstream-fetch";

const realFetch = globalThis.fetch;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function rejection(promise: Promise<unknown>): Promise<TRPCError> {
  try {
    await promise;
  } catch (error) {
    return error as TRPCError;
  }
  throw new Error("expected the call to reject");
}

describe("fetchMediaWikiJson", () => {
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it("returns parsed JSON and sends the allow-listed user agent and a timeout signal", async () => {
    const fetchMock = jest.fn(async () => jsonResponse({ query: { ok: true } }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const data = await fetchMediaWikiJson<{ query: { ok: boolean } }>("https://wiki.test/api.php?a=1");

    expect(data).toEqual({ query: { ok: true } });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://wiki.test/api.php?a=1");
    expect(init.headers).toEqual({
      "User-Agent": "IxStats-Builder",
      "Api-User-Agent": "IxStats-Builder",
    });
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("maps HTTP 429 to TOO_MANY_REQUESTS", async () => {
    globalThis.fetch = jest.fn(async () => jsonResponse({}, 429)) as unknown as typeof fetch;
    const error = await rejection(fetchMediaWikiJson("https://wiki.test/api.php?429"));
    expect(error).toBeInstanceOf(TRPCError);
    expect(error.code).toBe("TOO_MANY_REQUESTS");
  });

  it("maps HTTP 500 to BAD_GATEWAY", async () => {
    globalThis.fetch = jest.fn(async () => jsonResponse({}, 500)) as unknown as typeof fetch;
    const error = await rejection(fetchMediaWikiJson("https://wiki.test/api.php?500"));
    expect(error.code).toBe("BAD_GATEWAY");
  });

  it("maps an HTML body (a Cloudflare challenge page) to BAD_GATEWAY", async () => {
    globalThis.fetch = jest.fn(
      async () => new Response("<html>Just a moment...</html>", { status: 200 })
    ) as unknown as typeof fetch;
    const error = await rejection(fetchMediaWikiJson("https://wiki.test/api.php?html"));
    expect(error.code).toBe("BAD_GATEWAY");
  });

  it("turns an API error with HTTP 200 into BAD_GATEWAY carrying the code", async () => {
    globalThis.fetch = jest.fn(async () =>
      jsonResponse({ error: { code: "badvalue", info: "bad" } })
    ) as unknown as typeof fetch;
    const error = await rejection(fetchMediaWikiJson("https://wiki.test/api.php?badvalue"));
    expect(error.code).toBe("BAD_GATEWAY");
    expect(error.message).toContain("badvalue");
  });

  it("maps the ratelimited API error to TOO_MANY_REQUESTS", async () => {
    globalThis.fetch = jest.fn(async () =>
      jsonResponse({ error: { code: "ratelimited" } })
    ) as unknown as typeof fetch;
    const error = await rejection(fetchMediaWikiJson("https://wiki.test/api.php?ratelimited"));
    expect(error.code).toBe("TOO_MANY_REQUESTS");
  });

  it("maps a timeout to TIMEOUT", async () => {
    globalThis.fetch = jest.fn(async () => {
      throw new DOMException("The operation timed out", "TimeoutError");
    }) as unknown as typeof fetch;
    const error = await rejection(fetchMediaWikiJson("https://wiki.test/api.php?timeout"));
    expect(error.code).toBe("TIMEOUT");
    expect(error.message).toBe("Upstream wiki timed out");
  });

  it("caches successful responses by URL only when cacheTtlMs is passed", async () => {
    const fetchMock = jest.fn(async () => jsonResponse({ n: 1 }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await fetchMediaWikiJson("https://wiki.test/api.php?cached", { cacheTtlMs: 60_000 });
    await fetchMediaWikiJson("https://wiki.test/api.php?cached", { cacheTtlMs: 60_000 });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await fetchMediaWikiJson("https://wiki.test/api.php?uncached");
    await fetchMediaWikiJson("https://wiki.test/api.php?uncached");
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("does not cache a failure", async () => {
    const fetchMock = jest
      .fn()
      .mockImplementationOnce(async () => jsonResponse({}, 500))
      .mockImplementationOnce(async () => jsonResponse({ ok: true }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await rejection(fetchMediaWikiJson("https://wiki.test/api.php?flaky", { cacheTtlMs: 60_000 }));
    const data = await fetchMediaWikiJson("https://wiki.test/api.php?flaky", { cacheTtlMs: 60_000 });
    expect(data).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
