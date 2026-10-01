/**
 * scope-template-styles.ts: what survives of a TemplateStyles `<style>` block inside a WikiOS article
 * (plan 415, COMPAT-10).
 *
 * MediaWiki's TemplateStyles puts a template's CSS in the page as `<style data-mw-deduplicate>` with every
 * selector under `.mw-parser-output`. The article sanitizer used to delete every `<style>`, so templates
 * that lay themselves out with TemplateStyles broke. It now keeps those blocks, but only after this
 * filter, which is deliberately small and fails closed:
 *
 *  - every selector is prefixed with `.wikios-article` (the reader's root), so a template's CSS can only
 *    reach the article, never the app around it. `.mw-parser-output`, the wrapper MediaWiki scopes to
 *    and WikiOS does not render, becomes `.wikios-article`; a selector already scoped is left alone, so
 *    sanitizing twice gives the same CSS;
 *  - `@media` blocks are kept (their rules scoped); every other at-rule (`@import`, `@font-face`,
 *    `@keyframes`, `@supports`, ...) is dropped with its block;
 *  - a declaration is dropped when it uses `expression(`, `behavior`, `-moz-binding`, `javascript:`, an
 *    image function that loads a URL without `url(` (`image-set(`, `src(`, ...) or a `url()` whose
 *    target is not `https:` or relative;
 *  - anything the splitter cannot read with certainty (an unterminated string, unbalanced brackets, a
 *    stray `}`, a nested rule inside a rule, a `<` that could end the `<style>` element) drops the whole
 *    sheet or the rule: the browser must never parse the output differently from this code.
 *
 * CSS escapes (`\75 rl(`) are resolved before the declarations are judged, comments are replaced by a
 * space (as a browser does), and only the original text is ever emitted.
 */

export const ARTICLE_STYLE_SCOPE = ".wikios-article";

/** MediaWiki's wrapper class: WikiOS renders no such element, so it stands for the article root. */
const MEDIAWIKI_WRAPPER = ".mw-parser-output";
/** A sheet longer than this is dropped (a DoS guard: the splitter is linear, the output is not). */
const MAX_CSS_LENGTH = 200_000;
const MAX_SELECTOR_LENGTH = 1_000;
/** `@media` inside `@media` is fine; this is how deep the splitter follows. */
const MAX_AT_RULE_DEPTH = 2;

/** Marks a masked-out string literal in the text the splitter reads. Input never contains them. */
const STRING_OPEN = "\u0001";
const STRING_CLOSE = "\u0002";
const STRING_MARK = new RegExp(`${STRING_OPEN}(\\d+)${STRING_CLOSE}`, "g");
const CONTROL_MARKS = /[\u0000-\u0002]/g;

const PROPERTY_NAME = /^-{0,2}[a-z_][a-z0-9_-]*$/i;
const BLOCKED_PROPERTY = /^(?:behavior|-ms-behavior|-moz-binding|binding)$/;
const BLOCKED_VALUE = /expression\s*\(|(?:java|vb|live)script\s*:/;
/** Functions that load a URL without `url(`, and the old IE/Mozilla script hooks. */
const BLOCKED_FUNCTION =
  /(?:^|[^\w-])(?:-webkit-|-moz-)?(?:image-set|image|cross-fade|element|paint|src)\s*\(/;
const URL_FUNCTION = /url\s*\(([^)]*)\)/g;
const URL_SCHEME = /^[a-z][a-z0-9+.-]*:/i;
const MEDIA_QUERY = /^[a-z0-9\s:,.()\-_/>=+*%]*$/i;
const BLOCKED_MEDIA = /\b(?:url|expression)\s*\(/i;

interface Lexed {
  /** The sheet with comments turned into a space and every string literal turned into a mark. */
  masked: string;
  /** The string literals, quotes included. */
  strings: string[];
}

interface RawRule {
  prelude: string;
  /** The text between the braces, or null for a statement ending in `;`. */
  body: string | null;
}

/** The index of the quote that closes the string opened at `start`, or -1 (a bad or unterminated string). */
function endOfString(css: string, start: number): number {
  const quote = css.charAt(start);
  for (let i = start + 1; i < css.length; i++) {
    const ch = css.charAt(i);
    if (ch === "\\") i++;
    else if (ch === quote) return i;
    else if (ch === "\n" || ch === "\r" || ch === "\f") return -1;
  }
  return -1;
}

function lex(css: string): Lexed | null {
  const strings: string[] = [];
  let masked = "";
  let i = 0;
  while (i < css.length) {
    const ch = css.charAt(i);
    if (ch === "\\") {
      masked += css.slice(i, i + 2);
      i += 2;
    } else if (ch === "/" && css.charAt(i + 1) === "*") {
      const end = css.indexOf("*/", i + 2);
      if (end === -1) break; // an unterminated comment runs to the end of the sheet
      masked += " ";
      i = end + 2;
    } else if (ch === '"' || ch === "'") {
      const end = endOfString(css, i);
      if (end === -1) return null;
      strings.push(css.slice(i, end + 1));
      masked += `${STRING_OPEN}${strings.length - 1}${STRING_CLOSE}`;
      i = end + 1;
    } else {
      masked += ch;
      i++;
    }
  }
  return { masked, strings };
}

function inflate(text: string, strings: readonly string[]): string {
  return text.replace(STRING_MARK, (_mark, index: string) => strings[Number(index)] ?? "");
}

/** `text` with its CSS escapes resolved (`\75 rl(` is `url(`): only ever used to judge, never emitted. */
function unescapeCss(text: string): string {
  return text.replace(/\\(?:([0-9a-f]{1,6})[ \t\n\r\f]?|(\n)|(.))/gi, (_escape, hex?: string, newline?: string, char?: string) => {
    if (hex) {
      const codePoint = Number.parseInt(hex, 16);
      return codePoint === 0 || codePoint > 0x10ffff ? "�" : String.fromCodePoint(codePoint);
    }
    return newline ? "" : (char ?? "");
  });
}

/** Splits `text` at the top-level `separator` (not inside parentheses or brackets); null when they do not balance. */
function splitTopLevel(text: string, separator: string): string[] | null {
  const parts: string[] = [];
  const closers: string[] = [];
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text.charAt(i);
    if (ch === "\\") i++;
    else if (ch === "(") closers.push(")");
    else if (ch === "[") closers.push("]");
    else if (ch === ")" || ch === "]") {
      if (closers.pop() !== ch) return null;
    } else if (ch === separator && closers.length === 0) {
      parts.push(text.slice(start, i));
      start = i + 1;
    }
  }
  if (closers.length > 0) return null;
  parts.push(text.slice(start));
  return parts;
}

/** The rules of `text` (a sheet or the body of an `@media`), or null when its brackets and braces do not balance. */
function parseRules(text: string): RawRule[] | null {
  const rules: RawRule[] = [];
  const closers: string[] = [];
  let preludeStart = 0;
  let bodyStart = 0;
  let braces = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text.charAt(i);
    if (ch === "\\") i++;
    else if (ch === "(") closers.push(")");
    else if (ch === "[") closers.push("]");
    else if (ch === ")" || ch === "]") {
      if (closers.pop() !== ch) return null;
    } else if (ch === "{") {
      if (closers.length > 0) return null;
      if (braces === 0) bodyStart = i;
      braces++;
    } else if (ch === "}") {
      if (closers.length > 0 || braces === 0) return null;
      braces--;
      if (braces === 0) {
        rules.push({ prelude: text.slice(preludeStart, bodyStart), body: text.slice(bodyStart + 1, i) });
        preludeStart = i + 1;
      }
    } else if (ch === ";" && braces === 0 && closers.length === 0) {
      rules.push({ prelude: text.slice(preludeStart, i), body: null });
      preludeStart = i + 1;
    }
  }
  return braces === 0 && closers.length === 0 ? rules : null;
}

function startsWithToken(selector: string, token: string): boolean {
  return selector.startsWith(token) && !/[\w-]/.test(selector.charAt(token.length));
}

/** `selector` confined to the article: under the scope, `.mw-parser-output` standing for the scope itself. */
function scopeSelector(selector: string): string {
  if (startsWithToken(selector, ARTICLE_STYLE_SCOPE)) return selector;
  if (startsWithToken(selector, MEDIAWIKI_WRAPPER)) {
    return `${ARTICLE_STYLE_SCOPE}${selector.slice(MEDIAWIKI_WRAPPER.length)}`;
  }
  return `${ARTICLE_STYLE_SCOPE} ${selector}`;
}

/** The selector list of a rule, scoped; null when any selector is empty or unsafe (the browser drops such a rule too). */
function scopeSelectors(prelude: string, strings: readonly string[]): string | null {
  const selectors = splitTopLevel(prelude, ",");
  if (!selectors) return null;
  const scoped: string[] = [];
  for (const raw of selectors) {
    const selector = inflate(raw, strings).trim();
    if (!selector || selector.length > MAX_SELECTOR_LENGTH || selector.includes("<")) return null;
    scoped.push(scopeSelector(selector));
  }
  return scoped.join(",");
}

/** Whether every `url()` in `declaration` (escapes resolved) is `https:` or relative. */
function urlsAreAllowed(declaration: string): boolean {
  for (const match of declaration.matchAll(URL_FUNCTION)) {
    const target = (match[1] ?? "")
      .trim()
      .replace(/^["']|["']$/g, "")
      // the URL parser drops tabs and newlines inside a scheme: "java\tscript:" is "javascript:"
      .replace(/[\u0000- \u007f]/g, "");
    if (URL_SCHEME.test(target) && !/^https:/i.test(target)) return false;
  }
  return true;
}

function isAllowedDeclaration(property: string, declaration: string): boolean {
  const judged = unescapeCss(declaration).toLowerCase();
  return (
    PROPERTY_NAME.test(property) &&
    !BLOCKED_PROPERTY.test(unescapeCss(property).toLowerCase()) &&
    !BLOCKED_VALUE.test(judged) &&
    !BLOCKED_FUNCTION.test(judged) &&
    urlsAreAllowed(judged) &&
    !declaration.includes("<")
  );
}

/** The declarations of a rule body that may stay, or null when the body is not a plain declaration list. */
function cleanDeclarations(body: string, strings: readonly string[]): string[] | null {
  if (body.includes("{") || body.includes("}")) return null; // a nested rule: not read, so not kept
  const parts = splitTopLevel(body, ";");
  if (!parts) return null;
  const kept: string[] = [];
  for (const part of parts) {
    const colon = part.indexOf(":");
    if (colon < 1) continue;
    const property = part.slice(0, colon).trim();
    const declaration = inflate(part, strings).trim();
    if (isAllowedDeclaration(property, declaration)) kept.push(declaration);
  }
  return kept;
}

function scopeQualifiedRule(rule: RawRule, strings: readonly string[]): string {
  if (rule.body === null) return "";
  const selectors = scopeSelectors(rule.prelude, strings);
  const declarations = selectors === null ? null : cleanDeclarations(rule.body, strings);
  return selectors && declarations && declarations.length > 0
    ? `${selectors}{${declarations.join(";")}}`
    : "";
}

function scopeAtRule(rule: RawRule, strings: readonly string[], depth: number): string {
  // `@media` only, spelled plainly: an escaped at-keyword is not read
  const query = /^@media(?=[\s(])([\s\S]*)$/i.exec(rule.prelude.trim())?.[1]?.trim();
  const inner = rule.body !== null && depth < MAX_AT_RULE_DEPTH ? parseRules(rule.body) : null;
  if (query === undefined || !inner || !MEDIA_QUERY.test(query) || BLOCKED_MEDIA.test(query)) return "";
  const scoped = scopeRules(inner, strings, depth + 1);
  return scoped ? `@media ${query}{${scoped}}` : "";
}

function scopeRules(rules: readonly RawRule[], strings: readonly string[], depth: number): string {
  let out = "";
  for (const rule of rules) {
    const prelude = rule.prelude.trim();
    if (!prelude) continue;
    out += prelude.startsWith("@")
      ? scopeAtRule(rule, strings, depth)
      : scopeQualifiedRule(rule, strings);
  }
  return out;
}

/**
 * The CSS of a TemplateStyles block as it may appear in an article: scoped under the article root and
 * stripped of everything that could load, run or reach outside it. An empty string when nothing is left.
 */
export function scopeTemplateStyles(css: string): string {
  if (css.length > MAX_CSS_LENGTH) return "";
  const lexed = lex(css.replace(CONTROL_MARKS, "�"));
  const rules = lexed ? parseRules(lexed.masked) : null;
  return lexed && rules ? scopeRules(rules, lexed.strings, 0) : "";
}
