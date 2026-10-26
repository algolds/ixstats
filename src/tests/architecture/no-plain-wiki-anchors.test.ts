/** @jest-environment node */
/**
 * A plain `<a href="/wiki/…">` skips the base path: under production's `/projects/ixstates` it lands on classic's
 * `/wiki/…` instead of the app's reader. App links to the wiki go through `<Link>` (Next adds the base path) or a
 * plain `<a>` whose `href` is built by `createUrl(…)`. This walks every `.tsx` under `src` and fails on a JSX `<a>`
 * whose `href` is a `"/wiki/…"` string or a template starting `/wiki/`.
 *
 * It reads JSX only, through the TypeScript parser, so an HTML string fixture holding `<a href="/wiki/…">` is not JSX
 * and does not count.
 */
import fs from "node:fs";
import path from "node:path";
import { ts } from "ts-morph";

const SRC = path.join(process.cwd(), "src");
const WIKI_PREFIX = "/wiki/";

function walk(dir: string, visit: (file: string) => void): void {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, visit);
    else if (entry.name.endsWith(".tsx")) visit(full);
  }
}

/** Whether a JSX attribute's value is a literal `/wiki/…` path: a string, or a template whose head starts with it. */
function isWikiLiteral(value: ts.JsxAttributeValue | undefined): boolean {
  if (!value) return false;
  if (ts.isStringLiteral(value)) return value.text.startsWith(WIKI_PREFIX);
  if (!ts.isJsxExpression(value) || !value.expression) return false;
  const expr = value.expression;
  if (ts.isStringLiteral(expr) || ts.isNoSubstitutionTemplateLiteral(expr)) return expr.text.startsWith(WIKI_PREFIX);
  if (ts.isTemplateExpression(expr)) return expr.head.text.startsWith(WIKI_PREFIX);
  return false;
}

/** The plain `<a>` tags in `source` whose `href` is a literal `/wiki/…` path, as `file:line`. */
function plainWikiAnchors(file: string, source: string): string[] {
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const found: string[] = [];
  const visit = (node: ts.Node): void => {
    if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && node.tagName.getText(sf) === "a") {
      for (const attr of node.attributes.properties) {
        if (ts.isJsxAttribute(attr) && attr.name.getText(sf) === "href" && isWikiLiteral(attr.initializer)) {
          const { line } = sf.getLineAndCharacterOfPosition(attr.getStart(sf));
          found.push(`${path.relative(process.cwd(), file)}:${line + 1}`);
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return found;
}

describe("the detector", () => {
  const scan = (jsx: string) => plainWikiAnchors("fixture.tsx", `export const X = () => (${jsx});`);

  it.each([
    ['<a href="/wiki/Foo">x</a>'],
    ["<a href={`/wiki/${slug}`}>x</a>"],
    ['<a href={"/wiki/Foo"}>x</a>'],
    ["<a href={`/wiki/Foo`}>x</a>"],
    ['<a className="c" href="/wiki/Foo" />'],
  ])("flags %s", (jsx) => {
    expect(scan(jsx)).toEqual(["fixture.tsx:1"]);
  });

  it.each([
    ["<a href={createUrl(`/wiki/${slug}`)}>x</a>"],
    ['<Link href="/wiki/Foo">x</Link>'],
    ["<Link href={`/wiki/${slug}`}>x</Link>"],
    ['<a href="https://ixwiki.com/wiki/Foo">x</a>'],
    ['<a href="/dashboard">x</a>'],
    ["<p>{'<a href=\"/wiki/Foo\">'}</p>"],
  ])("allows %s", (jsx) => {
    expect(scan(jsx)).toEqual([]);
  });
});

describe("no plain <a> links to /wiki/ in src", () => {
  it("every .tsx under src uses <Link> or createUrl for a /wiki/ href", () => {
    const files: string[] = [];
    walk(SRC, (file) => files.push(file));
    expect(files.length).toBeGreaterThan(1000); // the walk found the app
    expect(files.flatMap((file) => plainWikiAnchors(file, fs.readFileSync(file, "utf8")))).toEqual([]);
  });
});
