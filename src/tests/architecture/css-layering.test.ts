/**
 * Facet 3 §1 — the cascade guard.
 *
 * Every first-party stylesheet in src/styles must be layered (so a Tailwind
 * utility on an element always beats a Facet/theme class), must not use
 * `!important`, and material/surface classes must not set layout-affecting
 * properties. A small brace-depth scanner is enough: we only need top-level
 * structure and each rule's selector + declarations.
 */
import fs from "fs";
import path from "path";

const STYLES_DIR = path.resolve(__dirname, "../../styles");

/** Files the guard does not apply to at all. */
const EXEMPT_FILES = new Set([
  // Third-party overrides (Clerk / MapLibre / Sonner) — unlayered + !important by design.
  "integrations.css",
  "clerk.css",
  // Owned by the tokens work: Tailwind entry point, theme variables, @theme tokens.
  "globals.css",
  "themes.css",
  "facet/tokens.css",
]);

/** Files that must be layered but may use `!important`, each for a documented reason. */
const IMPORTANT_ALLOWED = new Set([
  // User-preference kill switches (reduce motion, low fidelity, print) must beat
  // utilities *and* inline styles written by Framer Motion.
  "facet/overrides.css",
  // Overrides for MediaWiki/Parsoid HTML with inline styles and CodeMirror's injected theme.
  "wiki-os/mediawiki.css",
]);

/** Top-level at-rules that are fine outside a layer. */
const ALLOWED_TOP_LEVEL_BLOCKS =
  /^@(layer|utility|theme|keyframes|-webkit-keyframes|font-face|property|custom-variant)\b/;
const ALLOWED_TOP_LEVEL_STATEMENTS =
  /^@(import|layer|custom-variant|charset|source|reference|plugin)\b/;
/** Conditional group rules may appear at top level only if they contain nothing but allowed blocks. */
const CONDITIONAL_GROUP = /^@(media|supports|container)\b/;

/**
 * Material/surface classes that must never set layout-affecting properties — including the Facet
 * 3.1 identity paints (glow, refraction, acrylic glow, flag watermark, aurora/radiance/foil, ghost
 * heraldry, jewel), which the primitives place with utilities.
 */
const MATERIAL_CLASS =
  /\.facet-(depth-\d|hierarchy-[a-z]+|material(?:-[a-z]+)?|surface|floating|overlay|modal|tint-glow|refraction-line|acrylic-glow|flag-watermark|aurora|radiance|foil|ghost-heraldry|jewel)(?![\w-])/;

/** `@utility` materials and Facet 3.1 identity utilities: paint only, like the classes above. */
const MATERIAL_UTILITY = /^@utility (material-[\w-]+|facet-[\w-]+)$/;
const LAYOUT_PROPERTIES = ["position", "z-index", "border-radius", "margin", "letter-spacing"];

type Node =
  | { kind: "statement"; text: string }
  | { kind: "block"; prelude: string; body: string; children: Node[] | null };

function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

/** Parse one level of CSS into statements and blocks (children parsed for nesting at-rules/rules). */
function parse(css: string): Node[] {
  const nodes: Node[] = [];
  let i = 0;
  let start = 0;
  const n = css.length;
  const skipString = (j: number) => {
    const quote = css[j];
    j++;
    while (j < n && css[j] !== quote) j += css[j] === "\\" ? 2 : 1;
    return j + 1;
  };
  while (i < n) {
    const c = css[i];
    if (c === "\\") {
      i += 2;
      continue;
    }
    if (c === '"' || c === "'") {
      i = skipString(i);
      continue;
    }
    if (c === ";") {
      const text = css.slice(start, i).trim();
      if (text) nodes.push({ kind: "statement", text });
      start = ++i;
      continue;
    }
    if (c === "{") {
      const prelude = css.slice(start, i).trim().replace(/\s+/g, " ");
      let depth = 1;
      let j = i + 1;
      while (j < n && depth > 0) {
        const d = css[j];
        if (d === "\\") {
          j += 2;
          continue;
        }
        if (d === '"' || d === "'") {
          j = skipString(j);
          continue;
        }
        if (d === "{") depth++;
        else if (d === "}") depth--;
        j++;
      }
      const body = css.slice(i + 1, j - 1);
      const nested = body.includes("{");
      nodes.push({ kind: "block", prelude, body, children: nested ? parse(body) : null });
      i = j;
      start = i;
      continue;
    }
    i++;
  }
  return nodes;
}

function listCssFiles(dir: string, base = dir): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return listCssFiles(full, base);
    return entry.name.endsWith(".css") ? [path.relative(base, full).split(path.sep).join("/")] : [];
  });
}

function onlyAllowedBlocks(nodes: Node[]): boolean {
  return nodes.every((node) =>
    node.kind === "statement"
      ? ALLOWED_TOP_LEVEL_STATEMENTS.test(node.text)
      : ALLOWED_TOP_LEVEL_BLOCKS.test(node.prelude) ||
        (CONDITIONAL_GROUP.test(node.prelude) &&
          node.children !== null &&
          onlyAllowedBlocks(node.children))
  );
}

function splitSelectors(prelude: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (const ch of prelude) {
    if (ch === "(" || ch === "[") depth++;
    if (ch === ")" || ch === "]") depth--;
    if (ch === "," && depth === 0) {
      parts.push(current.trim());
      current = "";
    } else current += ch;
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

/** The compound selector the rule actually styles (after the last combinator, outside parentheses). */
function subjectCompound(selector: string): string {
  let depth = 0;
  let cut = 0;
  for (let i = 0; i < selector.length; i++) {
    const ch = selector[i]!;
    if (ch === "(" || ch === "[") depth++;
    else if (ch === ")" || ch === "]") depth--;
    else if (depth === 0 && (ch === " " || ch === ">" || ch === "+" || ch === "~")) cut = i + 1;
  }
  return selector.slice(cut).trim();
}

/** All style rules (selector + declarations), descending into at-rules and nested rules. */
function collectRules(nodes: Node[], out: { selector: string; body: string }[] = []) {
  for (const node of nodes) {
    if (node.kind !== "block") continue;
    if (node.prelude.startsWith("@")) {
      if (
        node.children &&
        !/^@(keyframes|-webkit-keyframes|font-face|property)\b/.test(node.prelude)
      ) {
        collectRules(node.children, out);
      }
      continue;
    }
    out.push({ selector: node.prelude, body: node.children ? "" : node.body });
    if (node.children) collectRules(node.children, out);
  }
  return out;
}

const files = listCssFiles(STYLES_DIR)
  .filter((file) => !EXEMPT_FILES.has(file))
  .sort();

describe("Facet 3 cascade guard (src/styles)", () => {
  it("finds the stylesheets it guards", () => {
    expect(files).toEqual(
      expect.arrayContaining([
        "facet/core.css",
        "facet/physics.css",
        "facet/identity.css",
        "wiki-os/components.css",
      ])
    );
  });

  describe.each(files)("%s", (file) => {
    const css = stripComments(fs.readFileSync(path.join(STYLES_DIR, file), "utf8"));
    const tree = parse(css);

    it("has no top-level style rules outside @layer / @utility / @theme / @keyframes / @font-face", () => {
      const offenders = tree
        .filter((node) => !onlyAllowedBlocks([node]))
        .map((node) => (node.kind === "block" ? node.prelude : node.text).slice(0, 120));
      expect(offenders).toEqual([]);
    });

    if (!IMPORTANT_ALLOWED.has(file)) {
      it("does not use !important", () => {
        const lines = css
          .split("\n")
          .map((line, index) => ({ line: line.trim(), index: index + 1 }))
          .filter(({ line }) => /!\s*important/i.test(line));
        expect(lines).toEqual([]);
      });
    }

    it("material and identity utilities set no position, z-index, radius, margin or letter-spacing", () => {
      const offenders: string[] = [];
      const visit = (nodes: Node[]) => {
        for (const node of nodes) {
          if (node.kind !== "block") continue;
          const match = MATERIAL_UTILITY.exec(node.prelude);
          if (match) {
            // Only the utility's own declarations (nested `&:hover`/`@media` blocks included).
            const body = node.body.replace(/@media[^{]*\{/g, "{");
            for (const property of LAYOUT_PROPERTIES) {
              if (new RegExp(`(^|[;{\\s])${property}\\s*:`).test(body)) {
                offenders.push(`${match[1]} → ${property}`);
              }
            }
          } else if (node.children) {
            visit(node.children);
          }
        }
      };
      visit(tree);
      expect(offenders).toEqual([]);
    });

    it("material/surface classes set no position, z-index, radius, margin or letter-spacing", () => {
      const offenders: string[] = [];
      for (const rule of collectRules(tree)) {
        const selectors = splitSelectors(rule.selector).filter((selector) => {
          // Zero-specificity defaults (`:where(...)`) and pseudo-elements don't fight utilities.
          if (selector.startsWith(":where(") || selector.includes("::")) return false;
          return MATERIAL_CLASS.test(subjectCompound(selector));
        });
        if (selectors.length === 0) continue;
        for (const property of LAYOUT_PROPERTIES) {
          if (new RegExp(`(^|[;{\\s])${property}\\s*:`).test(rule.body)) {
            offenders.push(`${selectors.join(", ")} → ${property}`);
          }
        }
      }
      expect(offenders).toEqual([]);
    });
  });
});

// Line numbers of comment closers with no opener. Tailwind tolerates them; Next's CSS parser fails the build.
function orphanCommentClosers(css: string): number[] {
  const lines: number[] = [];
  let inComment = false;
  for (let i = 0; i < css.length; i++) {
    if (!inComment && css.startsWith("/*", i)) {
      inComment = true;
      i++;
    } else if (inComment && css.startsWith("*/", i)) {
      inComment = false;
      i++;
    } else if (!inComment && css.startsWith("*/", i)) {
      lines.push(css.slice(0, i).split("\n").length);
      i++;
    } else if (!inComment && (css[i] === '"' || css[i] === "'")) {
      const end = css.indexOf(css[i]!, i + 1);
      if (end > i) i = end;
    }
  }
  return lines;
}

describe("stylesheet syntax (all of src/styles)", () => {
  it("has no orphan comment closers", () => {
    const offenders = listCssFiles(STYLES_DIR).flatMap((file) =>
      orphanCommentClosers(fs.readFileSync(path.join(STYLES_DIR, file), "utf-8")).map(
        (line) => `${file}:${line}`
      )
    );
    expect(offenders).toEqual([]);
  });
});
