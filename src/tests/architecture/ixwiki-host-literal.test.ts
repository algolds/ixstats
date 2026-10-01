/** @jest-environment node */
/**
 * Plan 415 (v1 decision D14): no hard-coded `ixwiki.com`. The wiki's host is spelled once, in
 * `src/lib/wiki-os/config.ts`; every other file asks the config (`mediaWikiOrigin`, `publicArticleUrl`,
 * `mediaWikiApiUrl`, ...). Left alone, and not counted: comments, `User-Agent` contact strings, and the hosts
 * under ixwiki.com that are not MediaWiki (forum, maps, accounts, clerk, archives).
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const OTHER_HOSTS = /(?:forum|maps|accounts|clerk|archives)\\?\.ixwiki\\?\.com/g;
const HOST = /ixwiki\\?\.com/;
const ALLOWED = new Set(["src/lib/wiki-os/config.ts"]);

function sourceFiles(dir: string, found: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== "tests" && entry.name !== "__tests__") sourceFiles(full, found);
    } else if (/\.(?:ts|tsx)$/.test(entry.name)) found.push(full);
  }
  return found;
}

describe("the wiki's host", () => {
  it("is spelled in config.ts alone", () => {
    const offenders: string[] = [];
    for (const file of sourceFiles(path.join(ROOT, "src"))) {
      const relative = path.relative(ROOT, file);
      if (ALLOWED.has(relative)) continue;
      fs.readFileSync(file, "utf8")
        .split("\n")
        .forEach((line, index) => {
          const code = line.replace(OTHER_HOSTS, "");
          const isComment = /^\s*(?:\/\/|\*|\/\*)/.test(line);
          const isContact = /IxStats\/[\d.]+ \(|contact/i.test(line);
          if (HOST.test(code) && !isComment && !isContact) offenders.push(`${relative}:${index + 1}: ${line.trim()}`);
        });
    }

    expect(offenders).toEqual([]);
  });

  it("is spelled there once, as the default of NEXT_PUBLIC_MEDIAWIKI_URL", () => {
    const config = fs.readFileSync(path.join(ROOT, "src/lib/wiki-os/config.ts"), "utf8");
    const spelled = config.split("\n").filter((line) => /"https:\/\/ixwiki\.com"/.test(line));

    expect(spelled).toHaveLength(1);
    expect(spelled[0]).toContain("FALLBACK_PUBLIC_BASE_URL");
  });
});
