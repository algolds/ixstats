/**
 * @jest-environment node
 *
 * The wiki harness the benches and parity scripts share: it never hits one wiki host faster than once a second (and
 * ixwiki.com at least a second apart, with the allowlisted IxStats-Builder agent), and reads only a local database.
 */
import { isLocalDatabaseUrl, throttledFetch } from "../../../scripts/lib/wikios-harness";
describe("throttledFetch", () => {
  let fetchSpy: jest.SpiedFunction<typeof fetch>;
  let starts: Array<{ url: string; at: number; init: RequestInit | undefined }>;

  beforeEach(() => {
    jest.useFakeTimers();
    starts = [];
    fetchSpy = jest.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      starts.push({ url: String(input), at: Date.now(), init });
      return new Response("ok", { status: 200 });
    });
  });

  afterEach(() => {
    fetchSpy.mockRestore();
    jest.useRealTimers();
  });

  it("spaces two calls to the same host by at least 1000 ms", async () => {
    const first = throttledFetch("https://spacing.example.test/a", {}, { minIntervalMs: 1000 });
    const second = throttledFetch("https://spacing.example.test/b", {}, { minIntervalMs: 1000 });
    await jest.advanceTimersByTimeAsync(5000);
    const [one, two] = await Promise.all([first, second]);
    expect(one.status).toBe(200);
    expect(two.body).toBe("ok");
    expect(starts).toHaveLength(2);
    expect(starts[1].at - starts[0].at).toBeGreaterThanOrEqual(1000);
  });

  it("does not hold back calls to different hosts", async () => {
    const first = throttledFetch("https://one.example.test/a");
    const second = throttledFetch("https://two.example.test/a");
    await jest.advanceTimersByTimeAsync(10);
    await Promise.all([first, second]);
    expect(starts[1].at - starts[0].at).toBeLessThan(1000);
  });

  it("never goes below one second for ixwiki.com hosts and sends the allowlisted User-Agent", async () => {
    const first = throttledFetch("https://ixwiki.com/api.php", {}, { minIntervalMs: 0 });
    const second = throttledFetch("https://ixwiki.com/wiki/Main_Page", {}, { minIntervalMs: 0 });
    await jest.advanceTimersByTimeAsync(5000);
    await Promise.all([first, second]);
    expect(starts[1].at - starts[0].at).toBeGreaterThanOrEqual(1000);
    expect(new Headers(starts[0].init?.headers).get("user-agent")).toBe("IxStats-Builder");
  });

  it("leaves other hosts' User-Agent alone and honours a shorter interval there", async () => {
    const first = throttledFetch("http://localhost:3000/a", {}, { minIntervalMs: 0 });
    const second = throttledFetch("http://localhost:3000/b", {}, { minIntervalMs: 0 });
    await jest.advanceTimersByTimeAsync(10);
    await Promise.all([first, second]);
    expect(new Headers(starts[0].init?.headers).get("user-agent")).toBeNull();
    expect(starts[1].at - starts[0].at).toBeLessThan(1000);
  });

  it("resolves with status 0 instead of throwing on an invalid or non-http URL", async () => {
    await expect(throttledFetch("not a url")).resolves.toMatchObject({
      status: 0,
      bytes: 0,
      error: "invalid URL: not a url",
    });
    await expect(throttledFetch("file:///etc/passwd")).resolves.toMatchObject({ status: 0 });
    await expect(throttledFetch("ftp://example.test/x")).resolves.toMatchObject({ status: 0 });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("reports the body size and times, and resolves with status 0 instead of throwing", async () => {
    const ok = await throttledFetch("https://sizes.example.test/ok", {}, { minIntervalMs: 0 });
    expect(ok.bytes).toBe(2);
    expect(ok.totalMs).toBeGreaterThanOrEqual(ok.ttfbMs);
    fetchSpy.mockRejectedValueOnce(new Error("connection refused"));
    const failed = await throttledFetch(
      "https://sizes.example.test/fail",
      {},
      { minIntervalMs: 0 }
    );
    expect(failed).toMatchObject({ status: 0, bytes: 0, error: "connection refused" });
  });
});

describe("page lists and URLs", () => {
  it("only treats a localhost DATABASE_URL as readable", () => {
    expect(isLocalDatabaseUrl("postgresql://u:p@localhost:5433/ixstats")).toBe(true);
    expect(isLocalDatabaseUrl("postgresql://u:p@127.0.0.1:5433/ixstats")).toBe(true);
    expect(isLocalDatabaseUrl("postgresql://u:p@db.example.com:5432/ixstats")).toBe(false);
    expect(isLocalDatabaseUrl("")).toBe(false);
  });
});
