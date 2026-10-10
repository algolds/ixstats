/** @jest-environment node */
/**
 * `ixstatesHref(path)`, `withBasePath(path)`, `createUrl(path)`, `createAbsoluteUrl(path)` and `titleToWikiOSPath(title)` return a path with the
 * deployment's base path in front (`/projects/ixstates/blurbs`), which is right for a plain `<a href>`, a redirect or
 * `window.location`. Next's `<Link>` adds the base path itself, with no check for a prefix, so handing it one of them
 * renders `/projects/ixstates/projects/ixstates/blurbs` in production. A `<Link>` takes the plain path, or
 * `ixstatesLinkHref(...)` where the IxStates host logic matters. This reads every TSX file's AST: for a `<Link>`
 * imported from `next/link`, its `href` must not hold a call to one of those helpers, directly or through a same-file
 * variable or function that calls it.
 */
import fs from "node:fs";
import path from "node:path";
import { ts } from "ts-morph";

const ROOT = process.cwd();
const SRC = path.join(ROOT, "src");
const BASE_PREFIXED_HELPERS: readonly string[] = [
  "ixstatesHref",
  "withBasePath",
  "createUrl",
  "createAbsoluteUrl",
  // wiki title to its WikiOS path with the base path (titleToWikiOSRoute is the <Link> one)
  "titleToWikiOSPath",
];

function tsxFiles(dir: string, found: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) tsxFiles(full, found);
    else if (entry.name.endsWith(".tsx")) found.push(full);
  }
  return found;
}

function descendants(node: ts.Node, visit: (child: ts.Node) => void): void {
  visit(node);
  node.forEachChild((child) => descendants(child, visit));
}

/** The local names `next/link` is imported under. */
function nextLinkNames(file: ts.SourceFile): Set<string> {
  const names = new Set<string>();
  for (const statement of file.statements) {
    if (!ts.isImportDeclaration(statement)) continue;
    if (
      !ts.isStringLiteral(statement.moduleSpecifier) ||
      statement.moduleSpecifier.text !== "next/link"
    )
      continue;
    const clause = statement.importClause;
    if (clause?.name) names.add(clause.name.text);
  }
  return names;
}

/**
 * Visits the node and what it holds, except the arguments of a call to a function that is not one of `names`: a
 * helper's result handed to `encodeURIComponent(createUrl("/realms"))` is a value inside a query string (a
 * `redirect_url`), not the path the `<Link>` navigates to.
 */
function walkPathParts(
  node: ts.Node,
  names: ReadonlySet<string>,
  visit: (child: ts.Node) => void
): void {
  visit(node);
  if (
    ts.isCallExpression(node) &&
    !(ts.isIdentifier(node.expression) && names.has(node.expression.text))
  ) {
    walkPathParts(node.expression, names, visit);
    return;
  }
  node.forEachChild((child) => walkPathParts(child, names, visit));
}

function callsAny(node: ts.Node, callees: ReadonlySet<string>): boolean {
  let found = false;
  walkPathParts(node, callees, (child) => {
    if (
      ts.isCallExpression(child) &&
      ts.isIdentifier(child.expression) &&
      callees.has(child.expression.text)
    ) {
      found = true;
    }
  });
  return found;
}

/**
 * The file's names that hold a base-prefixed path: `const x = withBasePath(..)`, a function that calls it, and
 * (repeated until nothing new turns up) anything built from those.
 */
function basePrefixedNames(file: ts.SourceFile): Set<string> {
  const names = new Set<string>(BASE_PREFIXED_HELPERS);
  const declarations: Array<{ name: string; node: ts.Node }> = [];
  descendants(file, (node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
      declarations.push({ name: node.name.text, node: node.initializer });
    } else if (ts.isFunctionDeclaration(node) && node.name && node.body) {
      declarations.push({ name: node.name.text, node: node.body });
    }
  });
  for (let grew = true; grew;) {
    grew = false;
    for (const { name, node } of declarations) {
      if (!names.has(name) && callsAny(node, names)) {
        names.add(name);
        grew = true;
      }
    }
  }
  return names;
}

/** "line: <Link ...>" for every `<Link>` in the source whose `href` holds a base-prefixed path. */
export function linkHrefOffenders(source: string, fileName = "fixture.tsx"): string[] {
  const file = ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  );
  const linkNames = nextLinkNames(file);
  if (linkNames.size === 0) return [];
  const tainted = basePrefixedNames(file);
  const offenders: string[] = [];
  descendants(file, (node) => {
    if (!ts.isJsxOpeningElement(node) && !ts.isJsxSelfClosingElement(node)) return;
    if (!ts.isIdentifier(node.tagName) || !linkNames.has(node.tagName.text)) return;
    for (const attribute of node.attributes.properties) {
      if (!ts.isJsxAttribute(attribute) || attribute.name.getText(file) !== "href") continue;
      const value = attribute.initializer;
      if (!value || !ts.isJsxExpression(value) || !value.expression) continue;
      const names = new Set<string>();
      walkPathParts(value.expression, tainted, (child) => {
        if (ts.isIdentifier(child) && tainted.has(child.text)) names.add(child.text);
      });
      if (names.size > 0) {
        const line = file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1;
        offenders.push(`${line}: ${node.getText(file).split("\n")[0]}`);
      }
    }
  });
  return offenders;
}

describe("linkHrefOffenders (the guard itself)", () => {
  const link = 'import Link from "next/link";\n';

  it("flags ixstatesHref handed to a Next Link, directly, in a template, or through a same-file helper", () => {
    expect(
      linkHrefOffenders(`${link}const a = <Link href={ixstatesHref("/blurbs")}>x</Link>;`)
    ).toHaveLength(1);
    expect(
      linkHrefOffenders(`${link}const a = <Link\n  href={ixstatesHref(\`/c/\${id}\`)}\n/>;`)
    ).toHaveLength(1);
    expect(
      linkHrefOffenders(`${link}const a = <Link href={cond ? ixstatesHref("/a") : "/b"} />;`)
    ).toHaveLength(1);
    expect(
      linkHrefOffenders(`${link}const url = ixstatesHref("/x");\nconst a = <Link href={url} />;`)
    ).toHaveLength(1);
    expect(
      linkHrefOffenders(
        `${link}const forumLink = (p: string) => (flag ? ixstatesHref(p) : p);\nconst a = () => { const u = forumLink("/y"); return <Link href={u} />; };`
      )
    ).toHaveLength(1);
  });

  it.each([
    ["withBasePath", 'withBasePath("/blurbs")'],
    ["createUrl", 'createUrl("/realms")'],
    ["createAbsoluteUrl", 'createAbsoluteUrl("/realms")'],
    ["titleToWikiOSPath", "titleToWikiOSPath(title)"],
  ])("flags %s handed to a Next Link, directly or through a same-file helper", (_name, call) => {
    expect(linkHrefOffenders(`${link}const a = <Link href={${call}}>x</Link>;`)).toHaveLength(1);
    expect(
      linkHrefOffenders(
        `${link}const pageHref = (t: string) => ${call};\nconst a = <Link href={pageHref(t)} />;`
      )
    ).toHaveLength(1);
  });

  it("flags a base-prefixed path wrapped around a redirect_url, and leaves the redirect_url value alone", () => {
    expect(
      linkHrefOffenders(
        `${link}const a = <Link href={withBasePath(\`/sign-in?redirect_url=\${encodeURIComponent(withBasePath("/x"))}\`)} />;`
      )
    ).toHaveLength(1);
    expect(
      linkHrefOffenders(
        `${link}const a = <Link href={\`/sign-in?redirect_url=\${encodeURIComponent(createUrl("/realms"))}\`} />;`
      )
    ).toEqual([]);
    expect(
      linkHrefOffenders(
        `${link}const signIn = \`/sign-in?redirect_url=\${encodeURIComponent(withBasePath("/x"))}\`;\nconst a = <Link href={signIn} />;`
      )
    ).toEqual([]);
  });

  it("follows the local name next/link is imported under", () => {
    const aliased =
      'import NextLink from "next/link";\nconst a = <NextLink href={ixstatesHref("/x")} />;';
    expect(linkHrefOffenders(aliased)).toHaveLength(1);
  });

  it("leaves a plain <a>, ixstatesLinkHref, and a Link that is not Next's alone", () => {
    expect(linkHrefOffenders(`${link}const a = <a href={withBasePath("/blurbs")}>x</a>;`)).toEqual(
      []
    );
    expect(
      linkHrefOffenders(`${link}const a = <Link href={ixstatesLinkHref("/blurbs")}>x</Link>;`)
    ).toEqual([]);
    expect(
      linkHrefOffenders(
        'import { Link } from "./Link";\nconst a = <Link href={ixstatesHref("/x")} />;'
      )
    ).toEqual([]);
    expect(
      linkHrefOffenders(
        `${link}const a = <Link href="/x">y</Link>;\nconst b = <a href={ixstatesHref("/x")} />;`
      )
    ).toEqual([]);
  });
});

describe("Next <Link> hrefs", () => {
  it("never hold ixstatesHref(...): a <Link> takes ixstatesLinkHref(...)", () => {
    const offenders: string[] = [];
    const files = tsxFiles(SRC).filter((file) => !file.includes(`${path.sep}tests${path.sep}`));
    for (const file of files) {
      for (const offender of linkHrefOffenders(fs.readFileSync(file, "utf8"), file)) {
        offenders.push(`${path.relative(ROOT, file)}:${offender}`);
      }
    }

    expect(files.length).toBeGreaterThan(500);
    expect(offenders).toEqual([]);
  });
});
