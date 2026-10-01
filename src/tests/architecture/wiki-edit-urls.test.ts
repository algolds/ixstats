/** @jest-environment node */
/**
 * Plan 412: a page's editor is `/wiki/<title>?action=edit` (MediaWiki's URL). The old
 * `/wiki/<title>/edit` path only redirects there; nothing may build it any more (it is a server hop
 * and, for a subpage, ambiguous). Builders go through `pageEditHref` / `articleHref`.
 */
import fs from "node:fs";
import path from "node:path";

const SRC = path.join(process.cwd(), "src");
const SKIP_DIRS = new Set(["tests", "node_modules", "generated"]);
/** `/wiki/${...}/edit`, `/wiki/<literal>/edit`, as a template, string or concatenation. */
const OLD_EDIT_PATH = /\/wiki\/(?:\$\{[^}]*\}|[^\s"'`/?]+)\/edit\b/;

function sources(dir: string, found: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) sources(full, found);
    } else if (/\.(?:tsx?|jsx?)$/.test(entry.name)) {
      found.push(full);
    }
  }
  return found;
}

describe("nothing builds /wiki/<title>/edit", () => {
  it("every edit link is ?action=edit", () => {
    const offenders: string[] = [];
    for (const file of sources(SRC)) {
      fs.readFileSync(file, "utf8")
        .split("\n")
        .forEach((line, index) => {
          if (/^\s*(?:\/\/|\*|\/\*)/.test(line)) return; // comments describe the old URL
          if (OLD_EDIT_PATH.test(line))
            offenders.push(`${path.relative(process.cwd(), file)}:${index + 1}`);
        });
    }
    expect(offenders).toEqual([]);
  });
});
