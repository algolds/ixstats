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

const run = (path: string) =>
  middleware(new NextRequest(`http://localhost${path}`), {} as NextFetchEvent);
const rewriteOf = (res: Response) => res.headers.get("x-middleware-rewrite");

describe("proxy: /wiki/<title>?action=raw", () => {
  it("rewrites to the raw route with the path after /wiki/ and every other parameter untouched", async () => {
    const res = await run("/wiki/Foo_bar?action=raw&oldid=5");
    expect(rewriteOf(res)).toBe("http://localhost/api/wiki/raw?action=raw&oldid=5&path=Foo_bar");
  });

  it("keeps the path as it was sent: subpages, and escapes the route decodes once", async () => {
    expect(rewriteOf(await run("/wiki/Template:Foo/doc?action=raw"))).toBe(
      "http://localhost/api/wiki/raw?action=raw&path=Template%3AFoo%2Fdoc"
    );
    expect(rewriteOf(await run("/wiki/100%25_Pure?action=raw"))).toBe(
      "http://localhost/api/wiki/raw?action=raw&path=100%2525_Pure"
    );
  });

  it("a path= of the caller's own never reaches the route", async () => {
    const res = await run("/wiki/Foo?action=raw&path=Secret");
    expect(rewriteOf(res)).toBe("http://localhost/api/wiki/raw?action=raw&path=Foo");
  });

  it("leaves every other wiki URL alone", async () => {
    for (const path of [
      "/wiki/Foo",
      "/wiki/Foo?action=edit",
      "/wiki/Foo?action=history",
      "/wiki/Foo?oldid=5",
      "/wiki/Main_Page",
      "/wiki",
      "/api/wiki/raw?action=raw&path=Foo",
      "/util/search?action=raw",
    ]) {
      expect(rewriteOf(await run(path))).toBeNull();
    }
  });

  it("is reached in the WikiOS standalone build too", async () => {
    process.env.NEXT_PUBLIC_WIKIOS_STANDALONE = "true";
    try {
      const res = await run("/wiki/Foo?action=raw");
      expect(res.status).toBe(200);
      expect(rewriteOf(res)).toBe("http://localhost/api/wiki/raw?action=raw&path=Foo");
    } finally {
      delete process.env.NEXT_PUBLIC_WIKIOS_STANDALONE;
    }
  });
});
