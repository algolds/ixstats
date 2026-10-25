/** @jest-environment node */
/**
 * The per-host guard in front of outbound wiki API calls (upstream-guard.ts): a breaker that opens after five
 * failures in a row (a Cloudflare challenge counts), probes once after its cooldown and doubles the cooldown up to
 * five minutes, a limiter of 8 in flight and 240 a minute per host, and the typed error the tRPC formatter turns
 * into SERVICE_UNAVAILABLE or TOO_MANY_REQUESTS.
 */
import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import {
  HOST_GUARD_OVERRIDES,
  HostGuard,
  type HostGuardOptions,
  SISTER_GUARD_OPTIONS,
  WikiUnavailableError,
  unlessUnavailable,
  upstreamGuard,
  wikiNameForUrl,
} from "~/lib/wiki-os/upstream-guard";

const IIWIKI = "https://iiwiki.com/api.php?action=query&format=json";
const ALTHISTORY = "https://althistory.fandom.com/api.php?action=query&format=json";

let fetchSpy: jest.SpiedFunction<typeof fetch>;
let warnSpy: jest.SpiedFunction<typeof console.warn>;
let clock = 1_000_000;

const json = () => Response.json({ query: {} });
const html = (status = 200) =>
  new Response("<html><title>Just a moment...</title></html>", {
    status,
    headers: { "content-type": "text/html; charset=UTF-8" },
  });
const status = (code: number) =>
  new Response("{}", { status: code, headers: { "content-type": "application/json" } });

function guard(overrides: Partial<HostGuardOptions> = {}): HostGuard {
  return new HostGuard({ ...SISTER_GUARD_OPTIONS, now: () => clock, ...overrides });
}

/** Resolves when the guarded call settles: the error it threw, or null when it answered. */
async function failureOf(call: Promise<Response>): Promise<WikiUnavailableError | null> {
  try {
    await call;
    return null;
  } catch (error) {
    if (error instanceof WikiUnavailableError) return error;
    throw error;
  }
}

/** A fetch answer the test settles by hand. */
function deferred(): { promise: Promise<Response>; resolve: (response: Response) => void } {
  let resolve: (response: Response) => void = () => undefined;
  const promise = new Promise<Response>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

/** Five failures in a row on `url`: the circuit is open afterwards. */
async function openCircuit(g: HostGuard, url = IIWIKI): Promise<void> {
  fetchSpy.mockImplementation(async () => status(503));
  for (let i = 0; i < 5; i++) await failureOf(g.fetch(url, { timeoutMs: 1000 }));
}

beforeEach(() => {
  clock = 1_000_000;
  fetchSpy = jest.spyOn(global, "fetch").mockImplementation(async (input) => {
    throw new Error(`unexpected fetch ${String(input)}`);
  });
  warnSpy = jest.spyOn(console, "warn").mockImplementation(() => undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("the request", () => {
  it("sends the builder user agent twice, asks for JSON and carries a timeout signal", async () => {
    fetchSpy.mockImplementation(async () => json());
    const response = await guard().fetch(IIWIKI, { timeoutMs: 1000 });
    expect(response.status).toBe(200);
    const init = fetchSpy.mock.calls[0]![1]!;
    const headers = new Headers(init.headers);
    expect(headers.get("User-Agent")).toBe("IxStats-Builder");
    expect(headers.get("Api-User-Agent")).toBe("IxStats-Builder");
    expect(headers.get("Accept")).toBe("application/json");
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(fetchSpy.mock.calls[0]![0]).toBe(IIWIKI);
  });

  it("sends the caller's own user agent when it names one", async () => {
    fetchSpy.mockImplementation(async () => json());
    await guard().fetch(IIWIKI, { timeoutMs: 1000, userAgent: "Contact/1.0" });
    const headers = new Headers(fetchSpy.mock.calls[0]![1]!.headers);
    expect(headers.get("User-Agent")).toBe("Contact/1.0");
    expect(headers.get("Api-User-Agent")).toBe("Contact/1.0");
  });

  it.each([
    ["Infinity", Number.POSITIVE_INFINITY, 12_000],
    ["NaN", Number.NaN, 12_000],
    ["a negative value", -5, 12_000],
    ["zero", 0, 12_000],
    ["ten minutes", 600_000, 30_000],
    ["thirty seconds", 30_000, 30_000],
  ])(
    "a timeout of %s becomes %i ms and is not a failure of the wiki",
    async (_label, timeoutMs, used) => {
      const timeoutSpy = jest.spyOn(AbortSignal, "timeout");
      const g = guard({ failureThreshold: 1 });
      fetchSpy.mockImplementation(async () => json());
      expect((await g.fetch(IIWIKI, { timeoutMs })).status).toBe(200);
      expect(timeoutSpy).toHaveBeenCalledWith(used);
      expect((await g.fetch(IIWIKI, { timeoutMs: 1000 })).status).toBe(200);
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    }
  );

  it('an unlisted host never reaches the client: the error says "The wiki", the log names the host', async () => {
    const g = guard({ failureThreshold: 1 });
    fetchSpy.mockImplementation(async () => status(503));
    const error = await failureOf(g.fetch("http://127.0.0.1:8080/w/api.php", { timeoutMs: 1000 }));
    expect(error?.message).toBe("The wiki could not be reached just now.");
    expect(error?.context).toEqual({ wiki: "The wiki", reason: "unreachable" });
    expect(`${error?.message} ${JSON.stringify(error?.context)}`).not.toMatch(/127\.0\.0\.1|8080/);
    expect(String(warnSpy.mock.calls[0]![0])).toContain("127.0.0.1:8080");
  });

  it("the timeout signal aborts after timeoutMs", async () => {
    fetchSpy.mockImplementation(async () => json());
    await guard().fetch(IIWIKI, { timeoutMs: 20 });
    const signal = fetchSpy.mock.calls[0]![1]!.signal!;
    expect(signal.aborted).toBe(false);
    await new Promise((r) => setTimeout(r, 60));
    expect(signal.aborted).toBe(true);
  });

  it("returns a 4xx answer other than 403 and 429 as the wiki's own answer, and it counts as a success", async () => {
    const g = guard({ failureThreshold: 2 });
    fetchSpy.mockImplementation(async () => status(503));
    await failureOf(g.fetch(IIWIKI, { timeoutMs: 1000 }));
    fetchSpy.mockImplementation(async () => status(404));
    expect((await g.fetch(IIWIKI, { timeoutMs: 1000 })).status).toBe(404);
    fetchSpy.mockImplementation(async () => status(400));
    expect((await g.fetch(IIWIKI, { timeoutMs: 1000 })).status).toBe(400);
    fetchSpy.mockImplementation(async () => status(503));
    await failureOf(g.fetch(IIWIKI, { timeoutMs: 1000 }));
    // One failure after the 4xx: the count restarted, so the circuit is still closed.
    fetchSpy.mockImplementation(async () => json());
    expect((await g.fetch(IIWIKI, { timeoutMs: 1000 })).status).toBe(200);
  });

  it("a failed answer's body is released", async () => {
    const challenge = html();
    fetchSpy.mockImplementation(async () => challenge);
    await failureOf(guard().fetch(IIWIKI, { timeoutMs: 1000 }));
    expect(challenge.bodyUsed).toBe(true);
  });
});

describe("the breaker", () => {
  it("four failures in a row still ask; the fifth opens the circuit and the sixth call sends no request", async () => {
    const g = guard();
    fetchSpy.mockImplementation(async () => status(502));
    for (let i = 0; i < 4; i++) {
      expect((await failureOf(g.fetch(IIWIKI, { timeoutMs: 1000 })))?.reason).toBe("unreachable");
    }
    expect(warnSpy).not.toHaveBeenCalled();
    expect((await failureOf(g.fetch(IIWIKI, { timeoutMs: 1000 })))?.reason).toBe("unreachable");
    expect(fetchSpy).toHaveBeenCalledTimes(5);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(String(warnSpy.mock.calls[0]![0])).toMatch(/IIWiki \(iiwiki\.com\).*5 failures.*30 s/);
    const sixth = await failureOf(g.fetch(IIWIKI, { timeoutMs: 1000 }));
    expect(sixth?.reason).toBe("circuit-open");
    expect(sixth?.wiki).toBe("IIWiki");
    expect(fetchSpy).toHaveBeenCalledTimes(5);
  });

  it.each([
    ["a 403", () => status(403)],
    ["a 403 challenge page", () => html(403)],
    ["a 200 with text/html", () => html(200)],
    [
      "a 200 with no content type",
      () => new Response("{}", { status: 200, headers: { "content-type": "" } }),
    ],
    ["a 500", () => status(500)],
    ["a 301 that was not followed", () => new Response(null, { status: 301 })],
  ])(
    "a Cloudflare challenge page (403, or 200 with text/html) counts as a failure: %s",
    async (_label, answer) => {
      const g = guard({ failureThreshold: 1 });
      fetchSpy.mockImplementation(async () => answer());
      expect((await failureOf(g.fetch(IIWIKI, { timeoutMs: 1000 })))?.reason).toBe("unreachable");
      expect((await failureOf(g.fetch(IIWIKI, { timeoutMs: 1000 })))?.reason).toBe("circuit-open");
    }
  );

  it("a thrown fetch or a timeout counts as a failure", async () => {
    const g = guard({ failureThreshold: 2 });
    fetchSpy.mockImplementationOnce(async () => {
      throw new TypeError("fetch failed");
    });
    fetchSpy.mockImplementationOnce(async () => {
      throw new DOMException("The operation was aborted due to timeout", "TimeoutError");
    });
    expect((await failureOf(g.fetch(IIWIKI, { timeoutMs: 1000 })))?.reason).toBe("unreachable");
    expect((await failureOf(g.fetch(IIWIKI, { timeoutMs: 1000 })))?.reason).toBe("unreachable");
    expect((await failureOf(g.fetch(IIWIKI, { timeoutMs: 1000 })))?.reason).toBe("circuit-open");
  });

  it("after 30 seconds one probe goes out while other calls fail fast; its success closes the circuit", async () => {
    const g = guard();
    await openCircuit(g);
    fetchSpy.mockClear();
    warnSpy.mockClear();

    clock += 29_999;
    expect((await failureOf(g.fetch(IIWIKI, { timeoutMs: 1000 })))?.reason).toBe("circuit-open");
    expect(fetchSpy).not.toHaveBeenCalled();

    clock += 1;
    const probeAnswer = deferred();
    fetchSpy.mockImplementationOnce(() => probeAnswer.promise);
    const probe = g.fetch(IIWIKI, { timeoutMs: 1000 });
    expect((await failureOf(g.fetch(IIWIKI, { timeoutMs: 1000 })))?.reason).toBe("circuit-open");
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    probeAnswer.resolve(json());
    expect((await probe).status).toBe(200);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(String(warnSpy.mock.calls[0]![0])).toMatch(/IIWiki \(iiwiki\.com\).*closed/);

    fetchSpy.mockImplementation(async () => json());
    expect((await g.fetch(IIWIKI, { timeoutMs: 1000 })).status).toBe(200);
    expect((await g.fetch(IIWIKI, { timeoutMs: 1000 })).status).toBe(200);
    expect(fetchSpy).toHaveBeenCalledTimes(3);
  });

  it("a closed circuit takes five fresh failures to open again, for 30 seconds", async () => {
    const g = guard();
    await openCircuit(g);
    clock += 30_000;
    await failureOf(g.fetch(IIWIKI, { timeoutMs: 1000 })); // a failed probe: 60 s
    clock += 60_000;
    fetchSpy.mockImplementation(async () => json());
    await g.fetch(IIWIKI, { timeoutMs: 1000 });
    fetchSpy.mockImplementation(async () => status(503));
    for (let i = 0; i < 4; i++) await failureOf(g.fetch(IIWIKI, { timeoutMs: 1000 }));
    expect((await failureOf(g.fetch(IIWIKI, { timeoutMs: 1000 })))?.reason).toBe("unreachable");
    expect((await failureOf(g.fetch(IIWIKI, { timeoutMs: 1000 })))?.reason).toBe("circuit-open");
    // And it opens for 30 seconds again, not for a doubled cooldown.
    clock += 30_000;
    fetchSpy.mockImplementation(async () => json());
    expect((await g.fetch(IIWIKI, { timeoutMs: 1000 })).status).toBe(200);
  });

  it("a failed probe reopens for 60 seconds, then 120, never more than 5 minutes", async () => {
    const g = guard();
    await openCircuit(g);
    clock += 30_000;

    let failures = 5;
    for (const cooldown of [60_000, 120_000, 240_000, 300_000, 300_000]) {
      fetchSpy.mockImplementation(async () => status(503));
      warnSpy.mockClear();
      expect((await failureOf(g.fetch(IIWIKI, { timeoutMs: 1000 })))?.reason).toBe("unreachable");
      failures += 1;
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(String(warnSpy.mock.calls[0]![0])).toContain(`${failures} failures`);
      expect(String(warnSpy.mock.calls[0]![0])).toContain(`${cooldown / 1000} s`);
      fetchSpy.mockClear();
      clock += cooldown - 1;
      expect((await failureOf(g.fetch(IIWIKI, { timeoutMs: 1000 })))?.reason).toBe("circuit-open");
      expect(fetchSpy).not.toHaveBeenCalled();
      clock += 1;
    }
    fetchSpy.mockImplementation(async () => json());
    expect((await g.fetch(IIWIKI, { timeoutMs: 1000 })).status).toBe(200);
  });

  it("a success resets the count", async () => {
    const g = guard();
    for (let round = 0; round < 3; round++) {
      fetchSpy.mockImplementation(async () => status(503));
      for (let i = 0; i < 4; i++) await failureOf(g.fetch(IIWIKI, { timeoutMs: 1000 }));
      fetchSpy.mockImplementation(async () => json());
      await g.fetch(IIWIKI, { timeoutMs: 1000 });
    }
    expect(fetchSpy).toHaveBeenCalledTimes(15);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("calls already in flight when the circuit opens neither extend it nor close it", async () => {
    const g = guard({ failureThreshold: 1 });
    const late = deferred();
    const lateSuccess = deferred();
    fetchSpy.mockImplementationOnce(() => late.promise);
    fetchSpy.mockImplementationOnce(() => lateSuccess.promise);
    const slowFailure = g.fetch(IIWIKI, { timeoutMs: 1000 });
    const slowSuccess = g.fetch(IIWIKI, { timeoutMs: 1000 });
    fetchSpy.mockImplementationOnce(async () => status(503));
    await failureOf(g.fetch(IIWIKI, { timeoutMs: 1000 }));
    expect(warnSpy).toHaveBeenCalledTimes(1);

    late.resolve(status(503));
    lateSuccess.resolve(json());
    await failureOf(slowFailure);
    await slowSuccess;
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect((await failureOf(g.fetch(IIWIKI, { timeoutMs: 1000 })))?.reason).toBe("circuit-open");

    clock += 30_000;
    fetchSpy.mockImplementation(async () => json());
    expect((await g.fetch(IIWIKI, { timeoutMs: 1000 })).status).toBe(200);
  });

  it("a late success while the circuit is open leaves the reopen log counting every failure", async () => {
    const g = guard({ failureThreshold: 1 });
    const lateSuccess = deferred();
    fetchSpy.mockImplementationOnce(() => lateSuccess.promise);
    const slow = g.fetch(IIWIKI, { timeoutMs: 1000 });
    fetchSpy.mockImplementationOnce(async () => status(503));
    await failureOf(g.fetch(IIWIKI, { timeoutMs: 1000 }));
    lateSuccess.resolve(json());
    await slow;
    clock += 30_000;
    fetchSpy.mockImplementation(async () => status(503));
    warnSpy.mockClear();
    await failureOf(g.fetch(IIWIKI, { timeoutMs: 1000 }));
    expect(String(warnSpy.mock.calls[0]![0])).toContain("after 2 failures in a row");
  });

  it("hosts are independent", async () => {
    const g = guard();
    await openCircuit(g, IIWIKI);
    fetchSpy.mockImplementation(async () => json());
    expect((await failureOf(g.fetch(IIWIKI, { timeoutMs: 1000 })))?.reason).toBe("circuit-open");
    expect((await g.fetch(ALTHISTORY, { timeoutMs: 1000 })).status).toBe(200);
  });
});

describe("the limiter", () => {
  it("past 8 in flight or 240 a minute the call is refused as busy without a request", async () => {
    const g = guard();
    const answers = Array.from({ length: 8 }, () => deferred());
    let next = 0;
    fetchSpy.mockImplementation(() => answers[next++]!.promise);
    const inFlight = answers.map(() => g.fetch(IIWIKI, { timeoutMs: 1000 }));
    const ninth = await failureOf(g.fetch(IIWIKI, { timeoutMs: 1000 }));
    expect(ninth?.reason).toBe("busy");
    expect(fetchSpy).toHaveBeenCalledTimes(8);
    // Another host has its own slots.
    fetchSpy.mockImplementationOnce(async () => json());
    expect((await g.fetch(ALTHISTORY, { timeoutMs: 1000 })).status).toBe(200);
    for (const answer of answers) answer.resolve(json());
    await Promise.all(inFlight);

    const minute = guard();
    fetchSpy.mockReset();
    fetchSpy.mockImplementation(async () => json());
    for (let i = 0; i < 240; i++) await minute.fetch(IIWIKI, { timeoutMs: 1000 });
    expect((await failureOf(minute.fetch(IIWIKI, { timeoutMs: 1000 })))?.reason).toBe("busy");
    expect(fetchSpy).toHaveBeenCalledTimes(240);
    clock += 250; // one token back (240 a minute is one per 250 ms)
    expect((await minute.fetch(IIWIKI, { timeoutMs: 1000 })).status).toBe(200);
  });

  it("our own refusals do not count as failures", async () => {
    const g = guard({ maxConcurrent: 1, failureThreshold: 1 });
    const answer = deferred();
    fetchSpy.mockImplementationOnce(() => answer.promise);
    const first = g.fetch(IIWIKI, { timeoutMs: 1000 });
    expect((await failureOf(g.fetch(IIWIKI, { timeoutMs: 1000 })))?.reason).toBe("busy");
    answer.resolve(json());
    await first;
    fetchSpy.mockImplementation(async () => json());
    expect((await g.fetch(IIWIKI, { timeoutMs: 1000 })).status).toBe(200);
  });

  it("a probe the limiter refuses frees the probe slot", async () => {
    const g = guard({ failureThreshold: 1, openMs: 1000, perMinute: 1 });
    fetchSpy.mockImplementation(async () => status(503));
    await failureOf(g.fetch(IIWIKI, { timeoutMs: 1000 }));
    clock += 1000;
    expect((await failureOf(g.fetch(IIWIKI, { timeoutMs: 1000 })))?.reason).toBe("busy");
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    clock += 60_000;
    fetchSpy.mockImplementation(async () => json());
    expect((await g.fetch(IIWIKI, { timeoutMs: 1000 })).status).toBe(200);
  });
});

describe("per-host limits", () => {
  const COMMONS = "https://commons.wikimedia.org/w/api.php?action=query&format=json";
  const withOverrides = () =>
    new HostGuard({ ...SISTER_GUARD_OPTIONS, now: () => clock }, HOST_GUARD_OVERRIDES);

  /** How many calls at once `url` lets through before refusing the next as busy. */
  async function inFlightLimit(g: HostGuard, url: string): Promise<number> {
    const answers: Array<ReturnType<typeof deferred>> = [];
    fetchSpy.mockImplementation(() => {
      const answer = deferred();
      answers.push(answer);
      return answer.promise;
    });
    const calls: Array<Promise<Response>> = [];
    let refusal: WikiUnavailableError | null = null;
    while (refusal === null && calls.length < 100) {
      const call = g.fetch(url, { timeoutMs: 1000 });
      const settled = await Promise.race([
        failureOf(call),
        new Promise<"pending">((resolve) => setImmediate(() => resolve("pending"))),
      ]);
      if (settled === "pending") calls.push(call);
      else refusal = settled;
    }
    for (const answer of answers) answer.resolve(json());
    await Promise.all(calls);
    expect(refusal?.reason).toBe("busy");
    return calls.length;
  }

  /** How many calls in a row `url` answers before its minute runs out. */
  async function perMinuteLimit(g: HostGuard, url: string): Promise<number> {
    fetchSpy.mockImplementation(async () => json());
    let answered = 0;
    while ((await failureOf(g.fetch(url, { timeoutMs: 1000 }))) === null && answered < 1000) {
      answered += 1;
    }
    return answered;
  }

  it("Commons has 16 in flight and 600 a minute; a sister wiki keeps 8 and 240", async () => {
    expect(HOST_GUARD_OVERRIDES).toEqual({
      "commons.wikimedia.org": { maxConcurrent: 16, perMinute: 600 },
    });
    expect(await inFlightLimit(withOverrides(), COMMONS)).toBe(16);
    expect(await inFlightLimit(withOverrides(), IIWIKI)).toBe(8);
    expect(await perMinuteLimit(withOverrides(), COMMONS)).toBe(600);
    expect(await perMinuteLimit(withOverrides(), IIWIKI)).toBe(240);
  });

  it("Commons keeps the sister breaker: the fifth failure opens it", async () => {
    const g = withOverrides();
    await openCircuit(g, COMMONS);
    fetchSpy.mockImplementation(async () => json());

    expect((await failureOf(g.fetch(COMMONS, { timeoutMs: 1000 })))?.reason).toBe("circuit-open");
    expect(fetchSpy).toHaveBeenCalledTimes(5);
  });

  it("the process guard gives Commons its limits", async () => {
    expect(await inFlightLimit(upstreamGuard, COMMONS)).toBe(16);
  });
});

describe("a 429", () => {
  it("a 429 is busy and counts as a failure", async () => {
    const g = guard({ failureThreshold: 2 });
    fetchSpy.mockImplementation(async () => status(429));
    expect((await failureOf(g.fetch(IIWIKI, { timeoutMs: 1000 })))?.reason).toBe("busy");
    expect((await failureOf(g.fetch(IIWIKI, { timeoutMs: 1000 })))?.reason).toBe("busy");
    expect((await failureOf(g.fetch(IIWIKI, { timeoutMs: 1000 })))?.reason).toBe("circuit-open");
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });
});

describe("WikiUnavailableError", () => {
  it("the error carries SERVICE_UNAVAILABLE, or TOO_MANY_REQUESTS when busy", () => {
    const unreachable = new WikiUnavailableError("IIWiki", "unreachable");
    expect(unreachable.code).toBe("UNAVAILABLE");
    expect(unreachable.trpcCode).toBe("SERVICE_UNAVAILABLE");
    expect(unreachable.statusCode).toBe(503);
    expect(unreachable.message).toBe("IIWiki could not be reached just now.");
    expect(unreachable.context).toEqual({ wiki: "IIWiki", reason: "unreachable" });

    const open = new WikiUnavailableError("IIWiki", "circuit-open");
    expect(open.trpcCode).toBe("SERVICE_UNAVAILABLE");
    expect(open.message).toBe("IIWiki could not be reached just now.");

    const busy = new WikiUnavailableError("AltHistory Wiki", "busy");
    expect(busy.code).toBe("RATE_LIMITED");
    expect(busy.trpcCode).toBe("TOO_MANY_REQUESTS");
    expect(busy.statusCode).toBe(429);
    expect(busy.message).toBe("AltHistory Wiki is busy; try again shortly.");
    expect(busy.context).toEqual({ wiki: "AltHistory Wiki", reason: "busy" });
    expect(busy.wiki).toBe("AltHistory Wiki");
    expect(busy.reason).toBe("busy");
  });
});

describe("unlessUnavailable", () => {
  it("unlessUnavailable turns only the typed error into null", async () => {
    await expect(unlessUnavailable(Promise.resolve("page"))).resolves.toBe("page");
    await expect(
      unlessUnavailable(Promise.reject(new WikiUnavailableError("IIWiki", "busy")))
    ).resolves.toBeNull();
    const other = new Error("parse failed");
    await expect(unlessUnavailable(Promise.reject(other))).rejects.toBe(other);
  });
});

describe("wikiNameForUrl", () => {
  it("wikiNameForUrl names IIWiki for its origin, its www alias and the development relay path", () => {
    expect(wikiNameForUrl("https://iiwiki.com/api.php?action=parse")).toBe("IIWiki");
    expect(wikiNameForUrl("https://www.iiwiki.com/api.php")).toBe("IIWiki");
    expect(
      wikiNameForUrl("https://maps.ixwiki.com/api/mediawiki/iiwiki/api.php?action=query")
    ).toBe("IIWiki");
  });

  it("names Wikimedia Commons for its api.php and its relay path, so its outage reads by name", async () => {
    expect(wikiNameForUrl("https://commons.wikimedia.org/w/api.php?action=query")).toBe(
      "Wikimedia Commons"
    );
    expect(wikiNameForUrl("https://maps.ixwiki.com/api/mediawiki/commons/api.php")).toBe(
      "Wikimedia Commons"
    );
    fetchSpy.mockImplementation(async () => status(503));
    const error = await failureOf(
      guard().fetch("https://commons.wikimedia.org/w/api.php?x", { timeoutMs: 1000 })
    );
    expect(error?.message).toBe("Wikimedia Commons could not be reached just now.");
  });

  it('names a wiki by its upload host, and calls any other host "The wiki"', () => {
    expect(wikiNameForUrl("https://althistory.fandom.com/api.php")).toBe("AltHistory Wiki");
    expect(wikiNameForUrl("https://static.wikia.nocookie.net/althistory/images/a.png")).toBe(
      "AltHistory Wiki"
    );
    expect(wikiNameForUrl("https://upload.wikimedia.org/x.png")).toBe("Wikimedia Commons");
    expect(wikiNameForUrl("https://example.org:8443/api.php")).toBe("The wiki");
    expect(wikiNameForUrl("https://maps.ixwiki.com/api/mediawiki/nowhere/api.php")).toBe(
      "The wiki"
    );
    expect(wikiNameForUrl("https://notiiwiki.com/api.php")).toBe("The wiki");
  });
});

describe("the process guard", () => {
  it("is one HostGuard with the sister numbers", () => {
    expect(upstreamGuard).toBeInstanceOf(HostGuard);
    expect(SISTER_GUARD_OPTIONS).toEqual({
      failureThreshold: 5,
      openMs: 30_000,
      maxOpenMs: 300_000,
      maxConcurrent: 8,
      perMinute: 240,
    });
  });
});
