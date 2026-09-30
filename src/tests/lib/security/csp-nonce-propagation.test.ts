/** @jest-environment node */
/**
 * Code audit PL-2: the per-request CSP nonce reaches the app. Next.js reads it from the forwarded
 * request's Content-Security-Policy (to nonce its own inline scripts) and the root layout reads
 * x-csp-nonce (for Clerk); both must be set by the proxy, never taken from the client.
 */
import { describe, expect, it, beforeAll } from "@jest/globals";
import { NextRequest, type NextFetchEvent } from "next/server";

type Middleware = (req: NextRequest, event: NextFetchEvent) => Promise<Response>;
let middleware: Middleware;

beforeAll(async () => {
  // No Clerk keys: exercises the simple middleware path, which shares the header logic.
  delete process.env.CLERK_SECRET_KEY;
  delete process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  middleware = (await import("~/proxy")).default as unknown as Middleware;
});

/** Request headers the app will see, as Next.js reconstructs them from the middleware response. */
function forwardedRequestHeaders(res: Response): Record<string, string> {
  const names = (res.headers.get("x-middleware-override-headers") ?? "").split(",");
  return Object.fromEntries(
    names
      .filter(Boolean)
      .map((name) => [name, res.headers.get(`x-middleware-request-${name}`) ?? ""])
  );
}

async function run(headers: Record<string, string> = {}) {
  const req = new NextRequest("http://localhost/countries", { headers });
  return middleware(req, {} as NextFetchEvent);
}

describe("CSP nonce propagation", () => {
  it("forwards the nonce and the CSP on the request, matching the response CSP", async () => {
    const res = await run();
    const forwarded = forwardedRequestHeaders(res);
    const nonce = forwarded["x-csp-nonce"];

    expect(nonce).toMatch(/^[A-Za-z0-9+/=]{16,}$/);
    expect(forwarded["content-security-policy"]).toContain(`'nonce-${nonce}'`);
    expect(res.headers.get("content-security-policy")).toBe(forwarded["content-security-policy"]);
  });

  it("overwrites a nonce the client sends", async () => {
    const res = await run({ "x-csp-nonce": "attacker-chosen" });
    const forwarded = forwardedRequestHeaders(res);

    expect(forwarded["x-csp-nonce"]).not.toBe("attacker-chosen");
    expect(forwarded["content-security-policy"]).toContain(`'nonce-${forwarded["x-csp-nonce"]}'`);
  });

  it("uses a fresh nonce per request and doesn't echo it in a response header", async () => {
    const a = forwardedRequestHeaders(await run())["x-csp-nonce"];
    const res = await run();
    const b = forwardedRequestHeaders(res)["x-csp-nonce"];

    expect(a).not.toBe(b);
    expect(res.headers.get("x-csp-nonce")).toBeNull();
  });
});
