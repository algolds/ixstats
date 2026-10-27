/** @jest-environment node */
/**
 * The stylesheets' fonts load under the base path: Next.js leaves a root-relative `url("/fonts/…")` as written, so the
 * PostCSS pass (scripts/setup/postcss-base-path-urls.cjs) puts the base path in front, with the same rule as
 * next.config.js's `basePath` (scripts/setup/base-path.cjs). The reader's font preloads ask for the same URLs, or the
 * browser would fetch each font twice.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import postcss from "postcss";
import basePathUrls from "../../../scripts/setup/postcss-base-path-urls.cjs";
import { resolveBasePath } from "../../../scripts/setup/base-path.cjs";
import { schibstedFontHref } from "~/components/wiki-os/shared/FontPreloads";

const TYPOGRAPHY = readFileSync(resolve(__dirname, "../../styles/typography.css"), "utf8");
const BASE = "/projects/ixstates";

const run = (css: string, basePath: string) =>
  postcss([basePathUrls({ basePath })]).process(css, { from: undefined }).css;

/** The `src` URLs of a sheet's @font-face rules, as written. */
const fontUrls = (css: string) => [...css.matchAll(/url\("([^"]+)"\)/g)].map((match) => match[1]);

describe("the base-path pass over the stylesheets", () => {
  it("puts the base path in front of every font URL of typography.css, the tabular punctuation's included", () => {
    const before = fontUrls(TYPOGRAPHY);
    expect(before.length).toBeGreaterThan(30);
    expect(before.every((url) => url?.startsWith("/fonts/"))).toBe(true);
    expect(before).toContain("/fonts/schibsted-punct-500.woff2");

    const after = fontUrls(run(TYPOGRAPHY, BASE));
    expect(after).toEqual(before.map((url) => `${BASE}${url}`));
  });

  it("leaves the sheet as it is without a base path, and other URLs always", () => {
    expect(run(TYPOGRAPHY, "")).toBe(TYPOGRAPHY);
    const other =
      'a{background:url("/images/x.png")}b{background:url(data:image/png;base64,AA)}c{background:url(https://x.test/fonts/a.ttf)}';
    expect(run(other, BASE)).toBe(other);
    expect(run("a{src:url(/fonts/a.ttf),url('/fonts/b.woff2')}", BASE)).toBe(
      `a{src:url(${BASE}/fonts/a.ttf),url('${BASE}/fonts/b.woff2')}`
    );
  });

  it("uses next.config.js's rule: standalone none, BASE_PATH when set, else /projects/ixstates in production only", () => {
    expect(resolveBasePath({ NODE_ENV: "production" })).toBe(BASE);
    expect(resolveBasePath({ NODE_ENV: "development" })).toBe("");
    expect(resolveBasePath({ NODE_ENV: "production", BASE_PATH: "" })).toBe("");
    expect(resolveBasePath({ NODE_ENV: "production", BASE_PATH: "projects/ixstates/" })).toBe(BASE);
    expect(
      resolveBasePath({
        NODE_ENV: "production",
        NEXT_PUBLIC_IXWORLD_STANDALONE: "true",
        BASE_PATH: BASE,
      })
    ).toBe("");
  });

  it("reads BASE_PATH even when it is unset, so Turbopack keys its cached CSS on it", () => {
    const read = new Set<string | symbol>();
    const env = new Proxy<Record<string, string | undefined>>(
      { NODE_ENV: "development" },
      { get: (target, prop) => (read.add(prop), Reflect.get(target, prop)) }
    );
    expect(resolveBasePath(env)).toBe("");
    expect(read).toContain("BASE_PATH");
  });
});

describe("the reader's font preloads", () => {
  const previous = process.env.NEXT_PUBLIC_BASE_PATH;
  afterEach(() => {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_BASE_PATH;
    else process.env.NEXT_PUBLIC_BASE_PATH = previous;
  });

  /** FontPreloads' href builder under `basePath` (`getBasePath` reads the env on each call). */
  const hrefUnder = (basePath: string, weight: number): string => {
    process.env.NEXT_PUBLIC_BASE_PATH = basePath;
    return schibstedFontHref(weight);
  };

  it("ask for the URLs the processed stylesheet loads, under the base path and without one", () => {
    for (const basePath of [BASE, ""]) {
      const href = hrefUnder(basePath, 500);
      expect(href).toBe(`${basePath}/fonts/Schibsted%20Grotesk-500.ttf`);
      expect(fontUrls(run(TYPOGRAPHY, basePath)).map((url) => encodeURI(url ?? ""))).toContain(
        href
      );
    }
  });
});
