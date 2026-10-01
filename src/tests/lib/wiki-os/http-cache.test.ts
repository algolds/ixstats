/** @jest-environment node */
/**
 * Plan 413 (item 7): an anonymous read of the article or the Main Page may be kept by a shared cache
 * for a moment; nothing else, and nothing signed in.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { initTRPC } from "@trpc/server";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import {
  PUBLIC_READ_CACHE_CONTROL,
  parseCookieHeader,
  readCacheResponseMeta,
  sharedReadCacheHeaders,
} from "~/lib/wiki-os/http-cache";

const read = (
  overrides: Partial<Parameters<typeof sharedReadCacheHeaders>[0]> = {},
  headers: Record<string, string> = {}
) =>
  sharedReadCacheHeaders({
    type: "query",
    paths: ["wikios.getArticleHtml"],
    failed: false,
    headers: new Headers(headers),
    ...overrides,
  });

describe("sharedReadCacheHeaders", () => {
  it("lets a shared cache keep an anonymous article read 30 s, stale 30 s", () => {
    expect(PUBLIC_READ_CACHE_CONTROL).toBe(
      "public, max-age=0, s-maxage=30, stale-while-revalidate=30"
    );
    expect(read()).toEqual({
      "Cache-Control": PUBLIC_READ_CACHE_CONTROL,
      Vary: "Cookie, Authorization, Accept, trpc-accept",
    });
    expect(read({ paths: ["wikios.getMainPage"] })).not.toBeNull();
    expect(read({}, { cookie: "theme=dark; wikios_sidebar_collapsed=1" })).not.toBeNull();
  });

  it("is for a batch only when every call in it is one of the two", () => {
    expect(read({ paths: ["wikios.getArticleHtml", "wikios.getMainPage"] })).not.toBeNull();
    expect(read({ paths: ["wikios.getArticleHtml", "users.getProfile"] })).toBeNull();
    expect(read({ paths: ["wikios.getHistory"] })).toBeNull();
    expect(read({ paths: [] })).toBeNull();
    expect(read({ paths: undefined })).toBeNull();
  });

  it("is never for a mutation or a failed read", () => {
    expect(read({ type: "mutation" })).toBeNull();
    expect(read({ failed: true })).toBeNull();
  });

  it("is never for a streamed (jsonl) request: its headers go out before the call can fail", () => {
    expect(read({}, { "trpc-accept": "application/jsonl" })).toBeNull();
  });

  it("is never for a reader with credentials: a bearer token, a Clerk session, an impersonation header", () => {
    expect(read({}, { authorization: "Bearer abc" })).toBeNull();
    expect(read({}, { cookie: "__session=jwt" })).toBeNull();
    expect(read({}, { cookie: "a=b; __client_uat=1759000000" })).toBeNull();
    expect(read({}, { "x-play-as-user": "someone" })).toBeNull();
    // a signed-out Clerk cookie ("0") is anonymous
    expect(read({}, { cookie: "__client_uat=0" })).not.toBeNull();
  });
});

describe("parseCookieHeader", () => {
  it("splits name and value at the first =, and ignores empty parts", () => {
    expect(parseCookieHeader("a=1; b=x=y;; c")).toEqual([
      { name: "a", value: "1" },
      { name: "b", value: "x=y" },
      { name: "c", value: "" },
    ]);
    expect(parseCookieHeader(null)).toEqual([]);
  });
});

describe("the tRPC route, through fetchRequestHandler", () => {
  const t = initTRPC.create();
  const router = t.router({
    wikios: t.router({
      getArticleHtml: t.procedure.query(() => "html"),
      getFailing: t.procedure.query(() => {
        throw new Error("boom");
      }),
    }),
  });
  const call = (path: string, headers: Record<string, string> = {}) => {
    const req = new Request(
      `http://localhost/api/trpc/${path}?batch=1&input=${encodeURIComponent('{"0":{"json":null}}')}`,
      {
        headers,
      }
    );
    return fetchRequestHandler({
      endpoint: "/api/trpc",
      req,
      router,
      createContext: () => ({}),
      responseMeta: readCacheResponseMeta(req),
    });
  };

  it("sends the shared-cache headers on a plain anonymous read", async () => {
    const res = await call("wikios.getArticleHtml");
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe(PUBLIC_READ_CACHE_CONTROL);
    expect(res.headers.get("vary")).toContain("trpc-accept");
  });

  it("sends no Cache-Control: public on a streamed (trpc-accept: jsonl) read", async () => {
    const res = await call("wikios.getArticleHtml", { "trpc-accept": "application/jsonl" });
    expect(res.status).toBe(200);
    expect(res.headers.get("transfer-encoding")).toBe("chunked");
    expect(res.headers.get("cache-control") ?? "").not.toContain("public");
    await res.text();
  });

  it("sends none on a read that fails, nor on a procedure outside the two", async () => {
    const failed = await call("wikios.getFailing");
    expect(failed.headers.get("cache-control") ?? "").not.toContain("public");
    const streamedFailure = await call("wikios.getFailing", { "trpc-accept": "application/jsonl" });
    expect(streamedFailure.headers.get("cache-control") ?? "").not.toContain("public");
    await streamedFailure.text();
  });

  it("the route file hands its responseMeta to this helper", () => {
    const route = readFileSync(join(process.cwd(), "src/app/api/trpc/[trpc]/route.ts"), "utf8");
    expect(route).toContain("responseMeta: readCacheResponseMeta(req)");
  });

  it("the article page itself is not made shared-cacheable, and says why", () => {
    const page = readFileSync(
      join(process.cwd(), "src/app/(wiki-os)/wiki/[...slug]/page.tsx"),
      "utf8"
    );
    expect(page).toContain("ponytail:");
    expect(page).toContain("nonce");
    // no Cache-Control is ever set from this page: the comment is the only mention of s-maxage
    expect(page).not.toMatch(/headers\(\)\.set|Cache-Control:|cacheControl|revalidate\s*=/i);
  });
});
