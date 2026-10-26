/** @jest-environment node */
/**
 * Uploaded flags and images are stored without the base path (`/images/uploads/…`, `/flags/…`, see
 * `src/server/shared/uploaded-assets.ts`). Under production's `/projects/ixstates` a root-relative `src` loads from
 * classic MediaWiki's root and 404s, so every flag, avatar, profile picture, banner, logo, cover, thumbnail or photo
 * `src` goes through `assetUrl()` (or `withBasePath()`), which leaves absolute, data: and blob: URLs alone and never
 * doubles the base path.
 *
 * This walks every `.tsx` under `src` and fails on a JSX `src={…}` that names one of those (or holds an
 * `/images/uploads` literal) without one of the `RESOLVERS`. A value resolved earlier in the file
 * (`const flagUrl = assetUrl(raw)`) counts as resolved. Components that resolve their own `src` are listed in
 * `RESOLVING_TAGS`.
 *
 * OG images (`src/lib/og`) are exempt: `next/og` needs absolute URLs, which their loaders build.
 */
import fs from "node:fs";
import path from "node:path";
import { ts } from "ts-morph";

const SRC = path.join(process.cwd(), "src");
/** `assetUrl`, `withBasePath`, and helpers that return an absolute URL or one already carrying the base path. */
const RESOLVERS = new Set([
  "assetUrl",
  "withBasePath",
  "resolveSrc",
  "proxyDiscordUrl",
  "proxyCardArtwork",
  "proxyNSImage",
  "getPlayerPhotoUrl",
  "mediaWikiImageUrl",
  "getImageUrl",
]);
/** Components that pass their `src` through `assetUrl`/`withBasePath` themselves. */
const RESOLVING_TAGS = new Set([
  "FlagTile",
  "FlagBanner",
  "FlagWatermark",
  "FlagDot",
  "AvatarImage",
  "TeamCrest",
  "PillImage",
]);
const EXEMPT_DIRS = [path.join("src", "lib", "og"), path.join("src", "tests")];
const FLAGGISH = /flag/i;
const PICTURISH =
  /flag|avatar|profileImage|imageUrl|banner|logo|cover|thumbnail|photo|heroImage|selectedImage|mediaUrl|media\.url/i;
/**
 * WikiOS surfaces are held to the flag rule, and their picture srcs to a count that only falls (mostly wiki
 * thumbnails and Clerk avatars, which are absolute, but a stored relative one would 404).
 */
const WIKIOS_DIRS = [
  path.join("src", "components", "wiki-os"),
  path.join("src", "app", "(wiki-os)"),
];
const WIKIOS_UNRESOLVED_PICTURES_ALLOWED = 10;
const UPLOAD_LITERAL = /["'`]\/images\/uploads\//;

function walk(dir: string, visit: (file: string) => void): void {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, visit);
    else if (entry.name.endsWith(".tsx")) visit(full);
  }
}

function callsResolver(node: ts.Node): boolean {
  if (
    ts.isCallExpression(node) &&
    ts.isIdentifier(node.expression) &&
    RESOLVERS.has(node.expression.text)
  ) {
    return true;
  }
  return ts.forEachChild(node, callsResolver) ?? false;
}

/** Names of variables in `sf` whose initializer calls a resolver. */
function resolvedNames(sf: ts.SourceFile): Set<string> {
  const names = new Set<string>();
  const visit = (node: ts.Node): void => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer &&
      callsResolver(node.initializer)
    ) {
      names.add(node.name.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return names;
}

function isUnresolved(
  expr: ts.Expression,
  sf: ts.SourceFile,
  resolved: Set<string>,
  names: RegExp
): boolean {
  if (callsResolver(expr)) return false;
  if (ts.isIdentifier(expr) && resolved.has(expr.text)) return false;
  const text = expr.getText(sf);
  return names.test(text) || UPLOAD_LITERAL.test(text);
}

/** The `src={…}` attributes in `source` that match `names` (or hold an upload) without resolving it, as `file:line`. */
function unresolvedAssetSrcs(file: string, source: string, names: RegExp = PICTURISH): string[] {
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const resolved = resolvedNames(sf);
  const found: string[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      if (!RESOLVING_TAGS.has(node.tagName.getText(sf))) {
        for (const attr of node.attributes.properties) {
          if (!ts.isJsxAttribute(attr) || attr.name.getText(sf) !== "src") continue;
          const init = attr.initializer;
          const expr = init && ts.isJsxExpression(init) ? init.expression : undefined;
          const literal = init && ts.isStringLiteral(init) && UPLOAD_LITERAL.test(init.getText(sf));
          if (literal || (expr && isUnresolved(expr, sf, resolved, names))) {
            const { line } = sf.getLineAndCharacterOfPosition(attr.getStart(sf));
            found.push(`${path.relative(process.cwd(), file)}:${line + 1}`);
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return found;
}

describe("the detector", () => {
  const scan = (body: string) => unresolvedAssetSrcs("fixture.tsx", body);
  const jsx = (el: string) => `export const X = ({ c, flagUrl }) => (${el});`;

  it.each([
    ["<img src={c.flagUrl} />"],
    ["<img src={c.country?.flag ?? undefined} />"],
    ["<img src={user.flag} />"],
    ["<img src={account.profileImageUrl} />"],
    ["<img src={group.settings.bannerUrl} />"],
    ["<img src={team.logo} />"],
    ["<img src={post.mediaUrls[0]} />"],
    ["<motion.img src={lightboxMedia.url} />"],
    ['<img src="/images/uploads/x.png" />'],
    ["<img src={`/images/uploads/${name}`} />"],
    ["<img src={normalizeFlagUrl(c.flag) ?? undefined} />"],
  ])("flags %s", (el) => {
    expect(scan(jsx(el))).toEqual(["fixture.tsx:1"]);
  });

  it.each([
    ["<img src={assetUrl(c.flagUrl) ?? undefined} />"],
    ["<img src={withBasePath(c.flag)} />"],
    ["<FlagWatermark src={flagUrl} />"],
    ["<img src={assetUrl(c.avatarUrl) ?? undefined} />"],
    ["<AvatarImage src={account.profileImageUrl} />"],
    ["<img src={proxyDiscordUrl(account.profileImageUrl)} />"],
    ["<img src={gif.images.fixed_height.url} />"],
    ['<img src="/logo.svg" />'],
  ])("allows %s", (el) => {
    expect(scan(jsx(el))).toEqual([]);
  });

  it("allows a name resolved earlier in the file", () => {
    expect(
      scan("const flagSrc = assetUrl(raw);\nexport const X = () => <img src={flagSrc} />;")
    ).toEqual([]);
  });
});

describe("flag and upload srcs carry the base path", () => {
  const inside = (file: string, dirs: string[]) =>
    dirs.some((dir) => path.relative(process.cwd(), file).startsWith(dir));
  const files: string[] = [];
  walk(SRC, (file) => {
    if (!inside(file, EXEMPT_DIRS)) files.push(file);
  });
  const app = files.filter((file) => !inside(file, WIKIOS_DIRS));
  const wikiOs = files.filter((file) => inside(file, WIKIOS_DIRS));
  const scanAll = (list: string[], names: RegExp) =>
    list.flatMap((file) => unresolvedAssetSrcs(file, fs.readFileSync(file, "utf8"), names));

  it("every .tsx under src outside WikiOS resolves a flag, picture or upload src", () => {
    expect(app.length).toBeGreaterThan(1000); // the walk found the app
    expect(scanAll(app, PICTURISH)).toEqual([]);
  });

  it("every WikiOS .tsx resolves a flag or upload src, and its unresolved picture srcs only fall", () => {
    expect(wikiOs.length).toBeGreaterThan(50);
    expect(scanAll(wikiOs, FLAGGISH)).toEqual([]);
    expect(scanAll(wikiOs, PICTURISH).length).toBeLessThanOrEqual(
      WIKIOS_UNRESOLVED_PICTURES_ALLOWED
    );
  });
});
