/** @jest-environment node */
/**
 * Plan 418 (A9): `wikios.getPageImages` looks a title up on the wiki it is given and defaults to IxWiki.
 * It used to try IxWiki and then iiwiki for any title, so a caller that does not say which wiki its page is
 * on silently loses a sister wiki's images. Every client call names its wiki.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
// `getPageImages.useQuery(` / `.fetch(` / `.prefetch(`, or the router's direct form `t.wikios.getPageImages(`
// inside `api.useQueries`. The server-side bridge function of the same name is not a client call.
const CALL = /(?:getPageImages\.(?:useQuery|fetch|prefetch)|wikios\.getPageImages)\(/g;

function sourceFiles(dir: string, found: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== "tests" && entry.name !== "node_modules") sourceFiles(full, found);
    } else if (/\.(?:ts|tsx)$/.test(entry.name)) found.push(full);
  }
  return found;
}

describe("wikios.getPageImages callers", () => {
  it("every call names its wiki", () => {
    const calls: string[] = [];
    const unnamed: string[] = [];
    for (const file of sourceFiles(path.join(ROOT, "src"))) {
      const text = fs.readFileSync(file, "utf8");
      for (const match of text.matchAll(CALL)) {
        const where = `${path.relative(ROOT, file)}:${text.slice(0, match.index).split("\n").length}`;
        calls.push(where);
        // The argument object is the next few lines: `{ title, wiki }` or `{ title: ..., wiki: ... }`.
        const argument = text.slice(match.index, match.index + 240).split("}")[0]!;
        if (!/\bwiki\b/.test(argument)) unnamed.push(where);
      }
    }

    // the feed cards share one call in useWikiLeadImage
    expect(calls.length).toBeGreaterThanOrEqual(3);
    expect(unnamed).toEqual([]);
  });
});
