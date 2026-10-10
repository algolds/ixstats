/**
 * A Canvas post is member-authored wikitext, and the wiki sanitizer keeps `style` and `class` (infoboxes and tables
 * need them). Left alone, `<div style="position:fixed;inset:0;z-index:99999">` or `class="fixed inset-0 z-50"` (the
 * app's own Tailwind classes apply to a post) would draw over the whole app. This pure pass, run on the rendered HTML
 * before it is stored, removes what takes an element out of its flow: from `style` the position, stacking, offset and
 * transform properties and any `fixed`/`sticky` value, from `class` the Tailwind classes that do the same (any
 * variant prefix, `!`, negative sign, arbitrary value). `relative` goes too: nothing MediaWiki emits needs it, and it
 * is what lets a child's offsets anchor to an ancestor. Every other class (`wikitable`, `infobox`, `mw-*`) and
 * property stays. `.forum-post` also contains and clips whatever a stylesheet still lets through (thinkpages-forum.css).
 *
 * The input is serialized, sanitized HTML (the sanitizer's output, always double-quoted); single-quoted and unquoted
 * values are handled anyway. An attribute that spells something with entities other than `&amp; &quot; &lt; &gt;
 * &apos; &#39;` cannot be read reliably, so its style is dropped and such a class token is removed.
 */

const OVERLAY_PROPERTY =
  /^(?:-[a-z]+-)?(?:position(?:-[a-z-]+)?|z-index|inset(?:-[a-z-]+)?|top|right|bottom|left|transform(?:-[a-z-]+)?|translate|scale|rotate|perspective(?:-origin)?|anchor-name)$/;
const OVERLAY_VALUE = /(?:^|[^a-z0-9_-])(?:fixed|sticky)(?![a-z0-9_-])/i;
const KNOWN_ENTITY = /&(?:amp|quot|lt|gt|apos|#39);/g;
const OTHER_AMPERSAND = /&(?!(?:amp|quot|lt|gt|apos|#39);)/;
const DECODED: Readonly<Record<string, string>> = {
  "&amp;": "&",
  "&quot;": '"',
  "&lt;": "<",
  "&gt;": ">",
  "&apos;": "'",
  "&#39;": "'",
};

const decodeEntities = (value: string): string =>
  value.replace(KNOWN_ENTITY, (entity) => DECODED[entity] ?? entity);

const encodeEntities = (value: string): string =>
  value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Removes `/* ... *\/` comments (an unterminated one runs to the end), which could hide a property from a reader. */
function withoutComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?(?:\*\/|$)/g, "");
}

/** Splits a declaration list at top-level `;`, so a `;` in a string or `url()` does not split a value. */
function splitDeclarations(css: string): string[] {
  const out: string[] = [];
  let quote = "";
  let depth = 0;
  let start = 0;
  for (let i = 0; i < css.length; i++) {
    const ch = css.charAt(i);
    if (quote) {
      if (ch === "\\") i++;
      else if (ch === quote) quote = "";
    } else if (ch === '"' || ch === "'") quote = ch;
    else if (ch === "(") depth++;
    else if (ch === ")") depth = Math.max(0, depth - 1);
    else if (ch === ";" && depth === 0) {
      out.push(css.slice(start, i));
      start = i + 1;
    }
  }
  out.push(css.slice(start));
  return out;
}

function keepDeclaration(declaration: string): boolean {
  const colon = declaration.indexOf(":");
  if (colon < 1) return false;
  const property = declaration.slice(0, colon).trim().toLowerCase();
  // A CSS escape can spell any property name (`p\6fsition`): such a name is refused outright.
  if (property.includes("\\") || OVERLAY_PROPERTY.test(property)) return false;
  return !OVERLAY_VALUE.test(declaration.slice(colon + 1));
}

/**
 * A style attribute's text (entities already decoded) without its overlay declarations. Kept declarations are
 * returned as written (trimmed, joined by `;`); a style with nothing to remove is returned unchanged.
 */
export function stripStyleDeclarations(css: string): string {
  const declarations = splitDeclarations(withoutComments(css)).filter((d) => d.trim() !== "");
  const kept = declarations.filter(keepDeclaration);
  if (kept.length === declarations.length && !css.includes("/*")) return css;
  return kept.map((d) => d.trim()).join(";");
}

const POSITION_CLASS = /^(?:fixed|absolute|sticky|relative)$/;
const OFFSET_CLASS =
  /^(?:inset(?:-(?:x|y|block|inline)(?:-(?:start|end))?)?|top|right|bottom|left|start|end)-(?:\d\S*|px|auto|full)$/;
const STACKING_CLASS = /^(?:z-(?:\d+|auto)|translate-\S+|transform(?:-\S+)?)$/;

function overlayClass(token: string): boolean {
  if (token.includes("[") || token.includes("(") || token.includes("&")) return true;
  // The utility is what follows the last variant prefix (`md:`, `hover:`, `max-md:`); `!` and `-` only modify it.
  const utility = (token.split(":").pop() ?? token).replace(/^!/, "").replace(/^-/, "");
  return POSITION_CLASS.test(utility) || OFFSET_CLASS.test(utility) || STACKING_CLASS.test(utility);
}

/** A class attribute's text without the classes that position an element. */
export function stripClassTokens(classes: string): string {
  return classes
    .split(/\s+/)
    .filter((token) => token !== "" && !overlayClass(token))
    .join(" ");
}

const OPENING_TAG = /<[A-Za-z][^\s/>]*(?:[^>"']|"[^"]*"|'[^']*')*>/g;
const STYLE_OR_CLASS = /(\s+)([^\s"'<>/=]+)(\s*=\s*)(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g;

/** The attribute's cleaned value, entity-encoded; null when it is already clean (the tag keeps its own spelling). */
function cleanedValue(name: "style" | "class", raw: string): string | null {
  if (name === "style" && OTHER_AMPERSAND.test(raw)) return "";
  const decoded = decodeEntities(raw);
  const cleaned = name === "style" ? stripStyleDeclarations(decoded) : stripClassTokens(decoded);
  return cleaned === decoded ? null : encodeEntities(cleaned);
}

function cleanTag(tag: string): string {
  return tag.replace(
    STYLE_OR_CLASS,
    (
      whole: string,
      space: string,
      name: string,
      equals: string,
      double: string | undefined,
      single: string | undefined,
      bare: string | undefined
    ) => {
      const lower = name.toLowerCase();
      if (lower !== "style" && lower !== "class") return whole;
      const cleaned = cleanedValue(lower, double ?? single ?? bare ?? "");
      if (cleaned === null) return whole;
      return cleaned === "" ? "" : `${space}${name}${equals}"${cleaned}"`;
    }
  );
}

/** The post's HTML with every element's overlay styles and classes removed (see the file header). */
export function stripPositioning(html: string): string {
  return html.replace(OPENING_TAG, cleanTag);
}
