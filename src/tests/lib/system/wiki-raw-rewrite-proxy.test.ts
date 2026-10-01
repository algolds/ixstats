/** @jest-environment node */
/** The raw-wikitext rewrite in src/proxy.ts (plan 412): /wiki/<title>?action=raw is answered by /api/wiki/raw. */
import { beforeAll, describe, expect, it } from "@jest/globals";
import { NextRequest, type NextFetchEvent } from "next/server";

type Middleware = (req: NextRequest, event: NextFetchEvent) => Promise<Response>;
let middleware: Middleware;

beforeAll(async () => {
  // No Clerk keys: the simple middleware path, which is enough to reach the rewrite.
  delete process.env.CLERK_SECRET_KEY;
  delete process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  delete process.env.NEXT_PUBLIC_WIKIOS_STANDALONE;
  middleware = (await import("~/proxy")).default as unknown as Middleware;
});

const run = (path: string, headers: Record<string, string> = {}) =>
  middleware(new NextRequest(`http://localhost${path}`, { headers }), {} as NextFetchEvent);
const rewriteOf = (res: Response) => res.headers.get("x-middleware-rewrite");
/** The request headers the proxy forwards: a header it overrides carries `x-middleware-request-<name>`. */
const forwarded = (res: Response, name: string) => res.headers.get(`x-middleware-request-${name}`);
const overrides = (res: Response) =>
  (res.headers.get("x-middleware-override-headers") ?? "").split(",").filter(Boolean);

describe("proxy: /wiki/<title>?action=raw", () => {
  it("rewrites to the raw route, keeping the original query, and hands it the path in a header", async () => {
    const res = await run("/wiki/Foo_bar?action=raw&oldid=5");
    // Next 16 keeps the original query for a rewritten route handler: nothing is added to it.
    expect(rewriteOf(res)).toBe("http://localhost/api/wiki/raw?action=raw&oldid=5");
    expect(forwarded(res, "x-wikios-raw-path")).toBe("Foo_bar");
    expect(overrides(res)).toContain("x-wikios-raw-path");
  });

  it("keeps the path as it was sent: subpages, and escapes the route decodes once", async () => {
    expect(forwarded(await run("/wiki/Template:Foo/doc?action=raw"), "x-wikios-raw-path")).toBe(
      "Template:Foo/doc"
    );
    expect(forwarded(await run("/wiki/Template%3AFoo%2Fdoc?action=raw"), "x-wikios-raw-path")).toBe(
      "Template%3AFoo%2Fdoc"
    );
    expect(forwarded(await run("/wiki/100%25_Pure?action=raw"), "x-wikios-raw-path")).toBe(
      "100%25_Pure"
    );
  });

  it("forwards the client's other headers, and never trusts its own x-wikios-raw-path or ?path=", async () => {
    const res = await run("/wiki/Foo?action=raw&path=Secret", {
      "x-wikios-raw-path": "Secret",
      "user-agent": "Pywikibot",
    });

    expect(forwarded(res, "x-wikios-raw-path")).toBe("Foo"); // set from the URL, overwriting the client's
    expect(forwarded(res, "user-agent")).toBe("Pywikibot");
    expect(rewriteOf(res)).toBe("http://localhost/api/wiki/raw?action=raw&path=Secret");
    // ...and the route reads the header first (see the route's own tests), so ?path= is not the page.
  });

  it("strips a client's x-wikios-raw-path from a direct request to the raw route", async () => {
    const res = await run("/api/wiki/raw?action=raw&path=Foo", {
      "x-wikios-raw-path": "Secret",
      "user-agent": "curl",
    });

    expect(rewriteOf(res)).toBeNull(); // not a rewrite: the request goes on as it is...
    expect(res.headers.get("x-middleware-next")).toBe("1");
    expect(overrides(res)).not.toContain("x-wikios-raw-path"); // ...without the forged header
    expect(overrides(res)).toContain("user-agent");
  });

  it("leaves a direct request without the header, and every other wiki URL, alone", async () => {
    for (const path of [
      "/api/wiki/raw?action=raw&path=Foo",
      "/wiki/Foo",
      "/wiki/Foo?action=edit",
      "/wiki/Foo?action=history",
      "/wiki/Foo?oldid=5",
      "/wiki/Main_Page",
      "/wiki",
      "/util/search?action=raw",
    ]) {
      const res = await run(path);
      expect(rewriteOf(res)).toBeNull();
      expect(forwarded(res, "x-wikios-raw-path")).toBeNull();
    }
  });

  it("the header is not honoured on other routes either: only the raw route's own path is cleaned", async () => {
    // A forged header elsewhere is harmless (only /api/wiki/raw reads it), and is not stripped there.
    const res = await run("/wiki/Foo", { "x-wikios-raw-path": "Secret" });
    expect(rewriteOf(res)).toBeNull();
  });

  it("is reached in the WikiOS standalone build too", async () => {
    process.env.NEXT_PUBLIC_WIKIOS_STANDALONE = "true";
    try {
      const res = await run("/wiki/Foo?action=raw");
      expect(res.status).toBe(200);
      expect(rewriteOf(res)).toBe("http://localhost/api/wiki/raw?action=raw");
      expect(forwarded(res, "x-wikios-raw-path")).toBe("Foo");
    } finally {
      delete process.env.NEXT_PUBLIC_WIKIOS_STANDALONE;
    }
  });
});
