/** @jest-environment node */
/**
 * /api/sse/map-updates is public: open streams are capped per process (503) and per client IP (429), and a closed
 * stream gives its slot back.
 */
import { createStreamLimiter } from "~/app/api/sse/map-updates/connection-limit";

const unsubscribe = jest.fn();
jest.mock("~/lib/maps/map-update-bus", () => ({
  mapUpdateBus: { subscribe: jest.fn(() => unsubscribe) },
}));
jest.mock("~/server/modules/maps/map-event-realm", () => ({ resolveEventRealm: jest.fn() }));
jest.mock("~/server/db", () => ({ db: {} }));

const headers = (ip?: string) => new Headers(ip ? { "cf-connecting-ip": ip } : {});

describe("createStreamLimiter", () => {
  it("caps the streams of one client IP with 429, and gives a slot back on release", () => {
    const limiter = createStreamLimiter(10, 2);
    const a = limiter.acquire(headers("1.1.1.1"));
    const b = limiter.acquire(headers("1.1.1.1"));
    expect(a.ok && b.ok).toBe(true);
    expect(limiter.acquire(headers("1.1.1.1"))).toMatchObject({ ok: false, status: 429 });
    expect(limiter.acquire(headers("2.2.2.2")).ok).toBe(true);
    if (a.ok) {
      a.release();
      a.release(); // a second release changes nothing
    }
    expect(limiter.open).toBe(2);
    expect(limiter.acquire(headers("1.1.1.1")).ok).toBe(true);
  });

  it("caps all streams of the process with 503, clients without an IP included", () => {
    const limiter = createStreamLimiter(3, 2);
    for (let i = 0; i < 3; i++) expect(limiter.acquire(headers()).ok).toBe(true);
    expect(limiter.acquire(headers())).toMatchObject({ ok: false, status: 503 });
    expect(limiter.acquire(headers("3.3.3.3"))).toMatchObject({ ok: false, status: 503 });
  });
});

describe("GET /api/sse/map-updates", () => {
  it("streams until the client goes, then frees its slot; past the per-client cap it answers 429", async () => {
    const { GET } = await import("~/app/api/sse/map-updates/route");
    const { mapUpdateStreams, MAX_STREAMS_PER_CLIENT } = await import(
      "~/app/api/sse/map-updates/connection-limit"
    );
    const open = (controller: AbortController) =>
      GET(
        new Request("http://localhost/api/sse/map-updates", {
          headers: { "cf-connecting-ip": "9.9.9.9" },
          signal: controller.signal,
        })
      );

    const controllers = Array.from({ length: MAX_STREAMS_PER_CLIENT }, () => new AbortController());
    for (const controller of controllers) {
      const response = await open(controller);
      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toBe("text/event-stream");
    }
    expect(mapUpdateStreams.open).toBe(MAX_STREAMS_PER_CLIENT);

    const refused = await open(new AbortController());
    expect(refused.status).toBe(429);
    expect(refused.headers.get("Retry-After")).toBe("30");

    controllers[0]!.abort();
    expect(mapUpdateStreams.open).toBe(MAX_STREAMS_PER_CLIENT - 1);
    expect(unsubscribe).toHaveBeenCalledTimes(1);
    const again = new AbortController();
    expect((await open(again)).status).toBe(200);

    for (const controller of [...controllers.slice(1), again]) controller.abort();
    expect(mapUpdateStreams.open).toBe(0);
  });
});
