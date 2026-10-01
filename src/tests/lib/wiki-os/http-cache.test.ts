/** @jest-environment node */
/**
 * Plan 413 (item 7): an anonymous read of the article or the Main Page may be kept by a shared cache
 * for a moment; nothing else, and nothing signed in.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  PUBLIC_READ_CACHE_CONTROL,
  parseCookieHeader,
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
  it("lets a shared cache keep an anonymous article read 30 s, stale 5 minutes", () => {
    expect(PUBLIC_READ_CACHE_CONTROL).toBe(
      "public, max-age=0, s-maxage=30, stale-while-revalidate=300"
    );
    expect(read()).toEqual({
      "Cache-Control": PUBLIC_READ_CACHE_CONTROL,
      Vary: "Cookie, Authorization",
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

describe("the tRPC route", () => {
  it("answers through responseMeta with these headers", () => {
    const route = readFileSync(join(process.cwd(), "src/app/api/trpc/[trpc]/route.ts"), "utf8");
    expect(route).toContain("responseMeta");
    expect(route).toContain("sharedReadCacheHeaders");
    expect(route).toMatch(/failed: errors\.length > 0/);
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
