/** @jest-environment node */
/**
 * B7: IxStates' robots rules cover only its own paths (under the base path), keep `?source=` reader
 * pages out, and advertise no takeover sitemap. Crawlers read only the host root's robots.txt, which
 * classic owns, so the runbook (step 6d) copies these rules there.
 */
import { robotsTxt } from "~/lib/wiki-os/sitemap-xml";
import { GET } from "~/app/robots.txt/route";

const BASE = "/projects/ixstates";

/** The path of every `Allow:`/`Disallow:` line. */
const rulePaths = (text: string) =>
  text
    .split("\n")
    .filter((line) => /^(Allow|Disallow):/.test(line))
    .map((line) => line.replace(/^(Allow|Disallow):\s*/, ""));

describe("robotsTxt (B7)", () => {
  it("robots names no Sitemap and scopes every rule under the base path", () => {
    const text = robotsTxt(BASE);
    const paths = rulePaths(text);

    expect(text).not.toMatch(/sitemap/i);
    expect(text.startsWith("User-agent: *\n")).toBe(true);
    expect(paths.length).toBeGreaterThan(10);
    for (const path of paths) expect(path.startsWith(`${BASE}/`)).toBe(true);
    expect(text).toContain(`Allow: ${BASE}/wiki/\n`);
    expect(text).toContain(`Disallow: ${BASE}/wiki/Special:\n`);
    expect(text).toContain(`Disallow: ${BASE}/*?*redirect=no\n`);
  });

  it("robots disallows ?source= pages", () => {
    const text = robotsTxt(BASE);
    expect(text).toContain(`Disallow: ${BASE}/*?source=\n`);
    expect(text).toContain(`Disallow: ${BASE}/*?*source=\n`);
  });

  it("with no base path the rules sit at the root", () => {
    const paths = rulePaths(robotsTxt(""));
    expect(paths).toContain("/wiki/");
    expect(paths).toContain("/util/");
    expect(paths).toContain("/*?source=");
    for (const path of paths) expect(path.startsWith("/")).toBe(true);
    expect(paths.some((path) => path.startsWith("//"))).toBe(false);
  });

  it("the route serves the rules under the app's base path", async () => {
    const saved = { base: process.env.BASE_PATH, publicBase: process.env.NEXT_PUBLIC_BASE_PATH };
    process.env.BASE_PATH = BASE;
    process.env.NEXT_PUBLIC_BASE_PATH = BASE;
    try {
      const response = GET();
      expect(response.headers.get("Content-Type")).toBe("text/plain; charset=utf-8");
      expect(await response.text()).toBe(robotsTxt(BASE));
    } finally {
      for (const [key, value] of [
        ["BASE_PATH", saved.base],
        ["NEXT_PUBLIC_BASE_PATH", saved.publicBase],
      ] as const) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    }
  });
});
