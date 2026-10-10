/** @jest-environment node */
/**
 * Plan 415 (5b, found by plan 417): the standalone WikiOS process serves none of IxStates' routes, so a link
 * from a WikiOS page to one (`/blurbs`, `/mycountry`, `/dashboard`, `/countries`, `/achievements`,
 * `/messages`, `/maps`, ...) must be the absolute IxStates URL there. `ixstatesHref(path)` makes it so;
 * a literal `href="/blurbs"` or `withBasePath("/countries/...")` in a WikiOS component does not.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const WIKI_DIRS = ["src/components/wiki-os", "src/app/(wiki-os)", "src/components/halo/plugins/wiki"];

/** The first segments of IxStates routes the wiki links to (none is in WIKIOS_ALLOWED_PREFIXES). */
const IXSTATES_ROUTES =
  "blurbs|mycountry|myleague|myclub|dashboard|countries|achievements|settings|messages|maps|vault|thinkpages|hashtags|admin|terms|privacy|forum|builder|leaderboard|profile";

/** A path literal used as a link target: `href="/x"`, `href={\`/x`, `withBasePath("/x"`, `navigateWithBasePath("/x"`. */
const LITERAL_LINK = new RegExp(
  `(?:href=\\{?|href:\\s*|withBasePath\\(|navigateWithBasePath\\(|createUrl\\()\\s*["'\`]/(?:${IXSTATES_ROUTES})(?![\\w-])`,
  "g"
);

function sourceFiles(dir: string, found: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) sourceFiles(full, found);
    else if (/\.(?:ts|tsx)$/.test(entry.name)) found.push(full);
  }
  return found;
}

describe("links from WikiOS to IxStates routes", () => {
  it("go through ixstatesHref, never a path literal", () => {
    const offenders: string[] = [];
    let scanned = 0;
    for (const dir of WIKI_DIRS) {
      for (const file of sourceFiles(path.join(ROOT, dir))) {
        scanned++;
        const text = fs.readFileSync(file, "utf8");
        for (const match of text.matchAll(LITERAL_LINK)) {
          const line = text.slice(0, match.index).split("\n").length;
          offenders.push(`${path.relative(ROOT, file)}:${line}: ${match[0]}`);
        }
      }
    }

    expect(scanned).toBeGreaterThan(100);
    expect(offenders).toEqual([]);
  });

  it("uses the helper where the wiki links out (the guard is not vacuous)", () => {
    const users = WIKI_DIRS.flatMap((dir) => sourceFiles(path.join(ROOT, dir))).filter((file) =>
      /ixstates(?:Link)?Href\(/.test(fs.readFileSync(file, "utf8"))
    );

    expect(users.length).toBeGreaterThanOrEqual(10);
  });
});
