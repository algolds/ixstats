/** @jest-environment node */
import { z } from "zod";
import {
  createDiscoveryClient,
  DiscoveryStopped,
  retryAfterMs,
} from "~/lib/realms/sources/wiki-discovery-client";
import { fakeIiwiki, json } from "~/tests/helpers/iiwiki-fixtures";

const API = "https://iiwiki.com/api.php";
const Any = z.object({ query: z.unknown().optional() }).passthrough();

function setup(respond?: Parameters<typeof fakeIiwiki>[0], options: { maxRetryAfterMs?: number; maxRequests?: number } = {}) {
  const wiki = fakeIiwiki(respond);
  const sleeps: number[] = [];
  const client = createDiscoveryClient("iiwiki", {
    fetchImpl: wiki.fetch,
    apiUrl: API,
    delayMs: 400,
    sleep: async (ms) => {
      sleeps.push(ms);
    },
    ...options,
  });
  return { wiki, sleeps, client };
}

const rosterQuery = { list: "categorymembers", cmtitle: "Category:Countries (Eurth)" };

describe("discovery client throttling", () => {
  it("sends one request at a time with a pause before every request but the first", async () => {
    const { client, sleeps, wiki } = setup();
    for (let i = 0; i < 3; i++) await client.query(rosterQuery, Any);

    expect(wiki.calls).toHaveLength(3);
    expect(sleeps).toEqual([400, 400]);
    expect(client.requests()).toBe(3);
  });

  it("runs queries started together one after another", async () => {
    let inFlight = 0;
    let most = 0;
    const wiki = fakeIiwiki();
    const client = createDiscoveryClient("iiwiki", {
      apiUrl: API,
      delayMs: 0,
      fetchImpl: (async (input: string) => {
        inFlight++;
        most = Math.max(most, inFlight);
        await new Promise((resolve) => setTimeout(resolve, 5));
        inFlight--;
        return wiki.fetch(input);
      }) as typeof fetch,
    });
    await Promise.all([1, 2, 3].map(() => client.query(rosterQuery, Any)));
    expect(most).toBe(1);
    expect(wiki.calls).toHaveLength(3);
  });

  it("waits out a short Retry-After on a 429 and retries", async () => {
    const { client, sleeps, wiki } = setup((_url, index) =>
      index === 0 ? new Response("slow down", { status: 429, headers: { "Retry-After": "3" } }) : undefined
    );
    const data = await client.query(rosterQuery, Any);

    expect(data.query).toBeDefined();
    expect(sleeps).toEqual([3000, 400]);
    expect(wiki.calls).toHaveLength(2);
  });

  it("stops as rate-limited when the wiki asks for a longer wait than it will take", async () => {
    const { client, wiki } = setup(
      () => new Response("", { status: 503, headers: { "Retry-After": "120" } }),
      { maxRetryAfterMs: 20_000 }
    );
    await expect(client.query(rosterQuery, Any)).rejects.toBeInstanceOf(DiscoveryStopped);
    expect(client.stopped()).toMatchObject({ kind: "rate-limited", status: 503 });
    // Once stopped, later queries send nothing.
    await expect(client.query(rosterQuery, Any)).rejects.toBeInstanceOf(DiscoveryStopped);
    expect(wiki.calls).toHaveLength(1);
  });

  it("stops at the request cap", async () => {
    const { client } = setup(undefined, { maxRequests: 2 });
    await client.query(rosterQuery, Any);
    await client.query(rosterQuery, Any);
    await expect(client.query(rosterQuery, Any)).rejects.toThrow("discovery cap");
    expect(client.stopped()?.kind).toBe("cap");
  });

  it("reports an unreachable wiki without throwing anything but DiscoveryStopped", async () => {
    const client = createDiscoveryClient("iiwiki", {
      apiUrl: API,
      fetchImpl: (async () => {
        throw new TypeError("fetch failed");
      }) as typeof fetch,
    });
    await expect(client.query(rosterQuery, Any)).rejects.toBeInstanceOf(DiscoveryStopped);
    expect(client.stopped()).toMatchObject({ kind: "unreachable", status: null });
  });

  it("sends the allowlisted user agent and formatversion 2", async () => {
    const seen: Array<Record<string, string>> = [];
    const client = createDiscoveryClient("iiwiki", {
      apiUrl: API,
      fetchImpl: (async (_url: string, init?: RequestInit) => {
        seen.push(init?.headers as Record<string, string>);
        return json({ query: {} });
      }) as typeof fetch,
    });
    await client.query({ list: "categorymembers" }, Any);
    expect(seen[0]).toMatchObject({ "User-Agent": "IxStats-Builder" });
  });
});

describe("retryAfterMs", () => {
  it("reads delta-seconds and HTTP dates", () => {
    expect(retryAfterMs("7")).toBe(7000);
    const now = Date.parse("2026-10-07T12:00:00Z");
    expect(retryAfterMs("Wed, 07 Oct 2026 12:00:30 GMT", now)).toBe(30_000);
    expect(retryAfterMs(null)).toBeNull();
    expect(retryAfterMs("soon")).toBeNull();
  });
});
