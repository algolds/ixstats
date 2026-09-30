/** @jest-environment node */
/**
 * Roadmap M0 item 18 (PL-20): secrets are compared in constant time, and the proxy no longer
 * echoes the rate-limit identifier (user ID or client IP) back in API responses.
 */
import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "@jest/globals";
import { bearerMatches, safeEqual } from "~/lib/security/safe-equal";

describe("safeEqual", () => {
  it("matches only identical strings, whatever their lengths", () => {
    expect(safeEqual("s3cret", "s3cret")).toBe(true);
    expect(safeEqual("s3cret", "s3creT")).toBe(false);
    expect(safeEqual("s3cret", "s3cret-longer")).toBe(false);
    expect(safeEqual("", "s3cret")).toBe(false);
  });
});

describe("bearerMatches", () => {
  it("accepts exactly `Bearer <secret>`", () => {
    expect(bearerMatches("Bearer s3cret", "s3cret")).toBe(true);
    expect(bearerMatches("Bearer wrong", "s3cret")).toBe(false);
    expect(bearerMatches("s3cret", "s3cret")).toBe(false);
    expect(bearerMatches(null, "s3cret")).toBe(false);
    expect(bearerMatches(undefined, "s3cret")).toBe(false);
  });
});

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

describe("source guards", () => {
  const root = join(__dirname, "../../../..");

  it("API routes don't compare bearer tokens or API keys with === / !==", () => {
    const offenders = sourceFiles(join(root, "src/app/api")).filter((file) => {
      const src = readFileSync(file, "utf8");
      return (
        /[!=]==\s*`Bearer \$\{/.test(src) ||
        /[!=]==\s*(CRON_SECRET|expectedApiKey|botSecret|cronSecret)\b/.test(src) ||
        /\b(token|apiKey|apiKeyHeader(\.trim\(\))?)\s*[!=]==\s*(CRON_SECRET|expectedApiKey)\b/.test(
          src
        )
      );
    });
    expect(offenders).toEqual([]);
  });

  it("the proxy doesn't echo X-RateLimit-Identifier", () => {
    const proxy = readFileSync(join(root, "src/proxy.ts"), "utf8");
    expect(proxy).not.toMatch(/X-RateLimit-Identifier/i);
  });
});
