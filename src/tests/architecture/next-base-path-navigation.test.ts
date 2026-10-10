/** @jest-environment node */
/**
 * `ixstatesHref(path)`, `withBasePath(path)`, `createUrl(path)`, `createAbsoluteUrl(path)` and `titleToWikiOSPath(title)`
 * return a path with the deployment's base path in front (`/projects/ixstates/blurbs`), which is right for a plain
 * `<a href>`, a redirect or `window.location`. Next's `<Link>` and its router (`router.push/replace/prefetch`) add the
 * base path themselves, with no check for a prefix, so handing either one of them renders
 * `/projects/ixstates/projects/ixstates/blurbs` in production. They take the plain path, `titleToWikiOSRoute(...)` or
 * `ixstatesLinkHref(...)`. This reads every TS/TSX file's AST: the `href` of a `<Link>` imported from `next/link`,
 * and the first argument of `push`/`replace`/`prefetch` on a Next router (`useRouter()` from `next/navigation` or
 * `next/router`), must not hold a call to one of those helpers, directly or through a same-file variable or function
 * that calls it.
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

function sourceFiles(dir: string, found: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) sourceFiles(full, found);
    else if (/\.tsx?$/.test(entry.name) && !entry.name.endsWith(".d.ts")) found.push(full);
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

const ROUTER_METHODS: ReadonlySet<string> = new Set(["push", "replace", "prefetch"]);
const ROUTER_TYPE = /AppRouterInstance|NextRouter|typeof useRouter/;

/** The local names of `useRouter` imported from `next/navigation` or `next/router`. */
function useRouterNames(file: ts.SourceFile): Set<string> {
  const names = new Set<string>();
  for (const statement of file.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier))
      continue;
    if (!["next/navigation", "next/router"].includes(statement.moduleSpecifier.text)) continue;
    const bindings = statement.importClause?.namedBindings;
    if (!bindings || !ts.isNamedImports(bindings)) continue;
    for (const element of bindings.elements) {
      if ((element.propertyName ?? element.name).text === "useRouter") names.add(element.name.text);
    }
  }
  return names;
}

/** Names that hold a Next router: `const router = useRouter()`, or a parameter typed as one. */
function nextRouterNames(file: ts.SourceFile): Set<string> {
  const hooks = useRouterNames(file);
  const routers = new Set<string>();
  if (hooks.size === 0) return routers;
  descendants(file, (node) => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer &&
      ts.isCallExpression(node.initializer) &&
      ts.isIdentifier(node.initializer.expression) &&
      hooks.has(node.initializer.expression.text)
    ) {
      routers.add(node.name.text);
    } else if (
      ts.isParameter(node) &&
      ts.isIdentifier(node.name) &&
      node.type &&
      ROUTER_TYPE.test(node.type.getText(file))
    ) {
      routers.add(node.name.text);
    }
  });
  return routers;
}

function holdsBasePrefixedPath(expression: ts.Node, tainted: ReadonlySet<string>): boolean {
  let found = false;
  walkPathParts(expression, tainted, (child) => {
    if (ts.isIdentifier(child) && tainted.has(child.text)) found = true;
  });
  return found;
}

/**
 * "line: <code>" for every `<Link>` whose `href`, and every Next `router.push/replace/prefetch(...)` whose path,
 * holds a base-prefixed path.
 */
export function navigationOffenders(source: string, fileName = "fixture.tsx"): string[] {
  const file = ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.Latest,
    true,
    fileName.endsWith(".ts") ? ts.ScriptKind.TS : ts.ScriptKind.TSX
  );
  const linkNames = nextLinkNames(file);
  const routers = nextRouterNames(file);
  if (linkNames.size === 0 && routers.size === 0) return [];
  const tainted = basePrefixedNames(file);
  const offenders: string[] = [];
  const report = (node: ts.Node) => {
    const line = file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1;
    offenders.push(`${line}: ${node.getText(file).split("\n")[0]}`);
  };
  descendants(file, (node) => {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      if (!ts.isIdentifier(node.tagName) || !linkNames.has(node.tagName.text)) return;
      for (const attribute of node.attributes.properties) {
        if (!ts.isJsxAttribute(attribute) || attribute.name.getText(file) !== "href") continue;
        const value = attribute.initializer;
        if (!value || !ts.isJsxExpression(value) || !value.expression) continue;
        if (holdsBasePrefixedPath(value.expression, tainted)) report(node);
      }
    } else if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      ts.isIdentifier(node.expression.expression) &&
      routers.has(node.expression.expression.text) &&
      ROUTER_METHODS.has(node.expression.name.text)
    ) {
      const path = node.arguments[0];
      if (path && holdsBasePrefixedPath(path, tainted)) report(node);
    }
  });
  return offenders;
}

describe("navigationOffenders (the guard itself)", () => {
  const link = 'import Link from "next/link";\n';

  it("flags ixstatesHref handed to a Next Link, directly, in a template, or through a same-file helper", () => {
    expect(
      navigationOffenders(`${link}const a = <Link href={ixstatesHref("/blurbs")}>x</Link>;`)
    ).toHaveLength(1);
    expect(
      navigationOffenders(`${link}const a = <Link\n  href={ixstatesHref(\`/c/\${id}\`)}\n/>;`)
    ).toHaveLength(1);
    expect(
      navigationOffenders(`${link}const a = <Link href={cond ? ixstatesHref("/a") : "/b"} />;`)
    ).toHaveLength(1);
    expect(
      navigationOffenders(`${link}const url = ixstatesHref("/x");\nconst a = <Link href={url} />;`)
    ).toHaveLength(1);
    expect(
      navigationOffenders(
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
    expect(navigationOffenders(`${link}const a = <Link href={${call}}>x</Link>;`)).toHaveLength(1);
    expect(
      navigationOffenders(
        `${link}const pageHref = (t: string) => ${call};\nconst a = <Link href={pageHref(t)} />;`
      )
    ).toHaveLength(1);
  });

  it("flags a base-prefixed path wrapped around a redirect_url, and leaves the redirect_url value alone", () => {
    expect(
      navigationOffenders(
        `${link}const a = <Link href={withBasePath(\`/sign-in?redirect_url=\${encodeURIComponent(withBasePath("/x"))}\`)} />;`
      )
    ).toHaveLength(1);
    expect(
      navigationOffenders(
        `${link}const a = <Link href={\`/sign-in?redirect_url=\${encodeURIComponent(createUrl("/realms"))}\`} />;`
      )
    ).toEqual([]);
    expect(
      navigationOffenders(
        `${link}const signIn = \`/sign-in?redirect_url=\${encodeURIComponent(withBasePath("/x"))}\`;\nconst a = <Link href={signIn} />;`
      )
    ).toEqual([]);
  });

  describe("Next router calls", () => {
    const nav = 'import { useRouter } from "next/navigation";\n';

    it.each(["push", "replace", "prefetch"])(
      "flags router.%s with a base-prefixed path",
      (method) => {
        expect(
          navigationOffenders(
            `${nav}function C() { const router = useRouter(); router.${method}(withBasePath("/x")); }`
          )
        ).toHaveLength(1);
      }
    );

    it("flags every helper, a same-file helper, an aliased hook and the pages-router hook", () => {
      const calls = [
        'createUrl("/x")',
        'createAbsoluteUrl("/x")',
        "titleToWikiOSPath(title)",
        'ixstatesHref("/x")',
        "pageHref(t)",
        "`${withBasePath(a)}?q=1`",
      ];
      for (const call of calls) {
        expect(
          navigationOffenders(
            `${nav}const pageHref = (t: string) => withBasePath(t);\nfunction C() { const router = useRouter(); router.push(${call}); }`
          )
        ).toHaveLength(1);
      }
      expect(
        navigationOffenders(
          'import { useRouter as useNextRouter } from "next/router";\nfunction C() { const r = useNextRouter(); r.push(withBasePath("/x")); }'
        )
      ).toHaveLength(1);
    });

    it("flags a router handed in as a typed parameter", () => {
      expect(
        navigationOffenders(
          `${nav}import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";\nfunction go(router: AppRouterInstance) { router.push(withBasePath("/x")); }`
        )
      ).toHaveLength(1);
    });

    it("leaves plain paths, titleToWikiOSRoute, ixstatesLinkHref and routers that are not Next's", () => {
      expect(
        navigationOffenders(
          `${nav}function C() { const router = useRouter(); router.push("/x"); router.replace(titleToWikiOSRoute(t)); router.push(ixstatesLinkHref("/y")); }`
        )
      ).toEqual([]);
      expect(
        navigationOffenders(
          'import { useRouter } from "./own-router";\nfunction C() { const router = useRouter(); router.push(withBasePath("/x")); }'
        )
      ).toEqual([]);
      expect(
        navigationOffenders(
          `${nav}function C() { const router = useRouter(); window.history.pushState(null, "", withBasePath("/x")); }`
        )
      ).toEqual([]);
      expect(
        navigationOffenders(
          `${nav}function C() { const router = useRouter(); other.push(withBasePath("/x")); }`
        )
      ).toEqual([]);
    });
  });

  it("follows the local name next/link is imported under", () => {
    const aliased =
      'import NextLink from "next/link";\nconst a = <NextLink href={ixstatesHref("/x")} />;';
    expect(navigationOffenders(aliased)).toHaveLength(1);
  });

  it("leaves a plain <a>, ixstatesLinkHref, and a Link that is not Next's alone", () => {
    expect(
      navigationOffenders(`${link}const a = <a href={withBasePath("/blurbs")}>x</a>;`)
    ).toEqual([]);
    expect(
      navigationOffenders(`${link}const a = <Link href={ixstatesLinkHref("/blurbs")}>x</Link>;`)
    ).toEqual([]);
    expect(
      navigationOffenders(
        'import { Link } from "./Link";\nconst a = <Link href={ixstatesHref("/x")} />;'
      )
    ).toEqual([]);
    expect(
      navigationOffenders(
        `${link}const a = <Link href="/x">y</Link>;\nconst b = <a href={ixstatesHref("/x")} />;`
      )
    ).toEqual([]);
  });
});

describe("Next <Link> hrefs and router paths", () => {
  it("never hold a base-prefixed path: they take the plain path, titleToWikiOSRoute or ixstatesLinkHref", () => {
    const offenders: string[] = [];
    const files = sourceFiles(SRC).filter((file) => !file.includes(`${path.sep}tests${path.sep}`));
    for (const file of files) {
      for (const offender of navigationOffenders(fs.readFileSync(file, "utf8"), file)) {
        offenders.push(`${path.relative(ROOT, file)}:${offender}`);
      }
    }

    expect(files.length).toBeGreaterThan(500);
    expect(offenders).toEqual([]);
  });
});
