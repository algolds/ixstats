/** @jest-environment node */
/**
 * Plan 418: `docs/systems/wikios/mediawiki-dependencies.md` is the owner-facing list of what still talks to
 * MediaWiki and why. It is only worth reading if it is complete: every source file that names a MediaWiki
 * endpoint (an `api.php`, `index.php` or `rest.php` URL, an `ixwiki.com` address, the API-URL helper, the config helpers that build
 * an IxWiki URL, the MediaWiki environment variables) or calls the render engine must be mentioned in it. A new call site means a new row.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const DOC = fs.readFileSync(
  path.join(ROOT, "docs/systems/wikios/mediawiki-dependencies.md"),
  "utf8"
);

/** What marks a file as naming a MediaWiki endpoint. */
const ENDPOINT =
  /getMediaWikiApiUrl|mediaWikiApiUrl|mediaWikiOrigin|mediaWikiImageUrl|mediaWikiHostPattern|isMediaWikiUrl|publicArticleUrl|wikiTitleFromArticleUrl|wikiosConfig\.(?:publicBaseUrl|publicHost|mediawiki)|\bapi\.php\b|\bindex\.php\b|\brest\.php\b|ixwiki\.com|NEXT_PUBLIC_MEDIAWIKI_URL|WIKIOS_MEDIAWIKI|renderArticleViaMediaWiki|wikitextToHtml/;
const SOURCE_FILE = /\.(?:ts|tsx)$/;

function sourceFiles(dir: string, found: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== "tests" && entry.name !== "__tests__" && entry.name !== "node_modules") {
        sourceFiles(full, found);
      }
    } else if (SOURCE_FILE.test(entry.name)) {
      found.push(path.relative(ROOT, full));
    }
  }
  return found;
}

describe("mediawiki-dependencies.md", () => {
  const files = sourceFiles(path.join(ROOT, "src"));

  it("mentions every source file that names a MediaWiki endpoint", () => {
    const named = files.filter((file) => ENDPOINT.test(fs.readFileSync(path.join(ROOT, file), "utf8")));
    const missing = named.filter((file) => !DOC.includes(file));

    expect(named.length).toBeGreaterThan(20);
    expect(missing).toEqual([]);
  });

  it("names no source file that does not exist (a renamed file must be renamed here)", () => {
    const mentioned = [...DOC.matchAll(/`(src\/[^`\s*]+?\.(?:ts|tsx))`/g)].map((match) => match[1]!);
    const gone = mentioned.filter((file) => !fs.existsSync(path.join(ROOT, file)));

    expect(mentioned.length).toBeGreaterThan(20);
    expect(gone).toEqual([]);
  });
});
