/** @jest-environment node */
/**
 * The middleware (src/proxy.ts) and its CSP. The CSP keeps object-src and frame-ancestors shut and allows no plain
 * http: images or ws: sockets outside development. Code audit PL-2: the per-request nonce reaches the app (Next.js
 * reads it from the forwarded request's Content-Security-Policy, the root layout from x-csp-nonce), set by the proxy
 * and never taken from the client. Plan 412: /wiki/<title>?action=raw is answered by /api/wiki/raw with the path in a
 * header the client cannot forge. Plan 417: the standalone build still refuses a spoofed x-middleware-subrequest, and
 * fails closed (500, no redirect) when it has no IxStates URL.
 *
 * Folds csp, wiki-raw-rewrite-proxy, wikios-standalone-proxy and safe-equal's identifier-echo guard (now on the
 * response instead of the source).
 */
import { afterEach, beforeAll, describe, expect, it, jest } from "@jest/globals";
import { NextRequest, type NextFetchEvent } from "next/server";
import { buildCSPTemplate, renderCsp } from "~/lib/security/csp";

type Middleware = (req: NextRequest, event: NextFetchEvent) => Promise<Response>;
let middleware: Middleware;

const saved = {
  standalone: process.env.NEXT_PUBLIC_WIKIOS_STANDALONE,
  ixstates: process.env.NEXT_PUBLIC_IXSTATES_URL,
};

beforeAll(async () => {
  // No Clerk keys: exercises the simple middleware path, which shares the header logic.
  delete process.env.CLERK_SECRET_KEY;
  delete process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  delete process.env.NEXT_PUBLIC_WIKIOS_STANDALONE;
  middleware = (await import("~/proxy")).default as unknown as Middleware;
});

afterEach(() => {
  jest.restoreAllMocks();
  if (saved.standalone === undefined) delete process.env.NEXT_PUBLIC_WIKIOS_STANDALONE;
  else process.env.NEXT_PUBLIC_WIKIOS_STANDALONE = saved.standalone;
  if (saved.ixstates === undefined) delete process.env.NEXT_PUBLIC_IXSTATES_URL;
  else process.env.NEXT_PUBLIC_IXSTATES_URL = saved.ixstates;
});

const run = (path = "/countries", headers: Record<string, string> = {}) =>
  middleware(new NextRequest(`http://localhost${path}`, { headers }), {} as NextFetchEvent);
const rewriteOf = (res: Response) => res.headers.get("x-middleware-rewrite");
/** The request headers the proxy forwards: a header it overrides carries `x-middleware-request-<name>`. */
const forwarded = (res: Response, name: string) => res.headers.get(`x-middleware-request-${name}`);
const overrides = (res: Response) =>
  (res.headers.get("x-middleware-override-headers") ?? "").split(",").filter(Boolean);

describe("the CSP template", () => {
  it("renders the nonce into script-src and keeps object-src and frame-ancestors shut", () => {
    const csp = renderCsp(buildCSPTemplate(false), "abc");
    expect(csp).toContain("'nonce-abc'");
    expect(csp).not.toContain("__NONCE__");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
  });

  it("allows no plain http: images or ws: sockets outside development, and blob: fetches for MapLibre's worker", () => {
    const csp = buildCSPTemplate(false);
    expect(csp).toMatch(/img-src 'self' data: blob: https:;/);
    expect(csp).toMatch(/connect-src 'self' blob: https: wss:;/);
    // The development switch is NODE_ENV, not the argument
    const env = jest.replaceProperty(process.env, "NODE_ENV", "development");
    try {
      expect(buildCSPTemplate(false)).toMatch(/connect-src 'self' blob: https: wss: ws:;/);
    } finally {
      env.restore();
    }
  });
});

describe("the CSP nonce", () => {
  it("is forwarded on the request with the CSP, which matches the response CSP", async () => {
    const res = await run();
    const nonce = forwarded(res, "x-csp-nonce");
    expect(nonce).toMatch(/^[A-Za-z0-9+/=]{16,}$/);
    expect(forwarded(res, "content-security-policy")).toContain(`'nonce-${nonce}'`);
    expect(res.headers.get("content-security-policy")).toBe(
      forwarded(res, "content-security-policy")
    );
  });

  it("overwrites a nonce the client sends", async () => {
    const res = await run("/countries", { "x-csp-nonce": "attacker-chosen" });
    expect(forwarded(res, "x-csp-nonce")).not.toBe("attacker-chosen");
    expect(forwarded(res, "content-security-policy")).toContain(
      `'nonce-${forwarded(res, "x-csp-nonce")}'`
    );
  });

  // PL-20: nor is the rate-limit identifier (a user id or a client IP).
  it("never echoes the rate-limit identifier on a page or an API response", async () => {
    for (const path of ["/countries", "/api/trpc/countries.getAll"]) {
      const res = await run(path, { "cf-connecting-ip": "203.0.113.5" });
      expect([path, res.headers.get("x-ratelimit-identifier")]).toEqual([path, null]);
    }
  });

  it("is fresh per request and never echoed in a response header", async () => {
    const a = forwarded(await run(), "x-csp-nonce");
    const res = await run();
    expect(forwarded(res, "x-csp-nonce")).not.toBe(a);
    expect(res.headers.get("x-csp-nonce")).toBeNull();
  });
});

describe("/wiki/<title>?action=raw", () => {
  it("rewrites to the raw route, keeping the original query, and hands it the path in a header", async () => {
    const res = await run("/wiki/Foo_bar?action=raw&oldid=5");
    // Next 16 keeps the original query for a rewritten route handler: nothing is added to it.
    expect(rewriteOf(res)).toBe("http://localhost/api/wiki/raw?action=raw&oldid=5");
    expect(forwarded(res, "x-wikios-raw-path")).toBe("Foo_bar");
    expect(overrides(res)).toContain("x-wikios-raw-path");
  });

  it.each([
    ["/wiki/Template:Foo/doc?action=raw", "Template:Foo/doc"],
    ["/wiki/Template%3AFoo%2Fdoc?action=raw", "Template%3AFoo%2Fdoc"],
  ])("keeps the path of %s as it was sent", async (path, header) => {
    expect(forwarded(await run(path), "x-wikios-raw-path")).toBe(header);
  });

  it("sets the path from the URL over a client's x-wikios-raw-path or ?path=, forwarding its other headers", async () => {
    const res = await run("/wiki/Foo?action=raw&path=Secret", {
      "x-wikios-raw-path": "Secret",
      "user-agent": "Pywikibot",
    });
    expect(forwarded(res, "x-wikios-raw-path")).toBe("Foo");
    expect(forwarded(res, "user-agent")).toBe("Pywikibot");
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

  it.each(["/wiki/Foo", "/wiki/Foo?action=edit", "/wiki/Foo?oldid=5", "/util/search?action=raw"])(
    "leaves %s alone",
    async (path) => {
      const res = await run(path);
      expect(rewriteOf(res)).toBeNull();
      expect(forwarded(res, "x-wikios-raw-path")).toBeNull();
    }
  );

  it("is reached in the WikiOS standalone build too", async () => {
    process.env.NEXT_PUBLIC_WIKIOS_STANDALONE = "true";
    const res = await run("/wiki/Foo?action=raw");
    expect(res.status).toBe(200);
    expect(rewriteOf(res)).toBe("http://localhost/api/wiki/raw?action=raw");
    expect(forwarded(res, "x-wikios-raw-path")).toBe("Foo");
  });
});

describe("the WikiOS standalone build", () => {
  it("answers 500 and logs why when a redirect is needed but NEXT_PUBLIC_IXSTATES_URL is unset", async () => {
    process.env.NEXT_PUBLIC_WIKIOS_STANDALONE = "true";
    delete process.env.NEXT_PUBLIC_IXSTATES_URL;
    const error = jest.spyOn(console, "error").mockImplementation(() => undefined);
    const res = await run("/vault");
    expect(res.status).toBe(500);
    expect(res.headers.get("location")).toBeNull();
    expect(error).toHaveBeenCalledWith(
      expect.stringContaining("NEXT_PUBLIC_IXSTATES_URL is not set")
    );
  });

  it("still rejects a spoofed x-middleware-subrequest header first", async () => {
    process.env.NEXT_PUBLIC_WIKIOS_STANDALONE = "true";
    const res = await run("/", { "x-middleware-subrequest": "middleware" });
    expect(res.status).toBe(403);
  });
});

describe("framing (clickjacking)", () => {
  const frameAncestors = (res: Response) =>
    /frame-ancestors ([^;]+)/.exec(res.headers.get("content-security-policy") ?? "")?.[1];
  const MAPS_HOST = { host: "maps.ixwiki.com", "x-forwarded-host": "maps.ixwiki.com" };

  it.each([{}, MAPS_HOST])(
    "lets any site embed the chromeless map viewer (%o)",
    async (headers) => {
      const res = await run("/maps?embed=true&lat=1&lng=2&zoom=3", headers);
      expect(frameAncestors(res)).toBe("*");
      expect(res.headers.get("x-frame-options")).toBeNull();
    }
  );

  it.each(["/maps", "/maps?embed=false", "/wiki/Caphiria", "/countries/caphiria"])(
    "lets only the app's own origin frame %s",
    async (path) => {
      const res = await run(path);
      expect(frameAncestors(res)).toBe("'self'");
      expect(res.headers.get("x-frame-options")).toBe("SAMEORIGIN");
    }
  );

  it.each([
    "/admin",
    "/settings",
    "/mycountry",
    "/mycountry/map-editor",
    "/admin/maps/editor",
    "/dashboard",
  ])("refuses every frame on %s, on the maps host too", async (path) => {
    for (const headers of [{}, MAPS_HOST]) {
      const res = await run(path, headers);
      expect([path, frameAncestors(res)]).toEqual([path, "'none'"]);
      expect(res.headers.get("x-frame-options")).toBe("DENY");
    }
  });

  it.each(["/maps", "/maps?lat=1&lng=2", "/caphiria", "/wiki/Caphiria"])(
    "lets IxWiki, and no other site, frame %s on the maps host",
    async (path) => {
      const res = await run(path, MAPS_HOST);
      expect(frameAncestors(res)).toBe("'self' https://ixwiki.com https://*.ixwiki.com");
      expect(res.headers.get("x-frame-options")).toBeNull();
    }
  );

  it("does not take ?embed=true on another path as a reason to allow framing", async () => {
    const res = await run("/mycountry?embed=true", MAPS_HOST);
    expect(frameAncestors(res)).toBe("'none'");
  });
});
