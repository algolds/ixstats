/**
 * scope-template-styles.ts: what survives of a TemplateStyles `<style>` block inside a WikiOS article
 * (plan 415, COMPAT-10).
 *
 * MediaWiki's TemplateStyles puts a template's CSS in the page as `<style data-mw-deduplicate>` with every
 * selector under `.mw-parser-output`, the wrapper of the parsed page. The article sanitizer used to delete every
 * `<style>`, so templates that lay themselves out with TemplateStyles broke. It now keeps those blocks, but only
 * after this filter, which is deliberately small and fails closed:
 *
 *  - every selector is under `.mw-parser-output`, the one class the reader gives to each element whose
 *    innerHTML is a part of the article (the body, the infobox, the page-top notices, the editors' previews):
 *    exactly where MediaWiki puts it, so MediaWiki's own selectors (`.mw-parser-output > .infobox`) mean what they
 *    meant, and a template's CSS can never reach the reader's header, toolbar, byline or margin around the
 *    article. A selector that already starts with the root is left alone (sanitizing twice gives the same CSS); a
 *    selector that starts with the root and then asks for its siblings (`~`, `+`), or starts with a combinator,
 *    would reach outside it and is dropped;
 *  - `@media` blocks are kept (their rules scoped); every other at-rule (`@import`, `@font-face`,
 *    `@keyframes`, `@supports`, ...) is dropped with its block;
 *  - a declaration is dropped when it uses `expression(`, `behavior`, `-moz-binding`, `javascript:`, an
 *    image function that loads a URL without `url(` (`image-set(`, `src(`, ...) or a `url()` whose target,
 *    resolved the way a browser does, is neither relative to the page (`/images/a.png`, `a.png`; not `//host/...`)
 *    nor on the wiki's own origin (the `ownOrigin` argument, `https:` only): no other host is ever contacted by a
 *    template's CSS, so a page cannot make a reader's browser call out to a host the wiki does not control. The
 *    target is read as the CSS tokenizer delimits it (a quoted one is the whole string, an unquoted one runs to
 *    the first unescaped `)`) and only then unescaped; a `url(` that reading does not find (an escaped name) drops
 *    the declaration;
 *  - anything the splitter cannot read with certainty (an unterminated string, unbalanced brackets, a
 *    stray `}`, a nested rule inside a rule, a bad-url token, a `<` that could end the `<style>` element, a
 *    trailing backslash) drops the whole sheet or the rule: the browser must never parse the output differently
 *    from this code.
 *
 * CSS escapes (`\75 rl(`) are resolved before the declarations are judged, comments are replaced by a
 * space (as a browser does), and only the original text is ever emitted.
 */

/** The class of the elements the article's parts are rendered into: the root every selector is confined to. */
export const ARTICLE_STYLE_ROOT_CLASS = "mw-parser-output";
export const ARTICLE_STYLE_SCOPE = `.${ARTICLE_STYLE_ROOT_CLASS}`;

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
/** `url(` written plainly, not the tail of a longer name (`xurl(`, `-url(`). */
const URL_NAME = /(?<![\w\-\u0080-\uffff])url\s*\(/gi;
/** Every `url(` of a text with its escapes resolved: how many a browser will find. */
const URL_NAME_COUNT = new RegExp(URL_NAME.source, "gi");
/** What ends an unquoted url's text: the `)`, or what makes it a bad url (a quote, a `(`, whitespace). */
const UNQUOTED_URL_STOP = /[)"'(\s]/;
const URL_SCHEME = /^[a-z][a-z0-9+.-]*:/i;
/** Relative URLs resolve against this; one that comes out on any other origin named a host. */
const RELATIVE_BASE = "https://relative.invalid/";
const RELATIVE_ORIGIN = new URL(RELATIVE_BASE).origin;
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

const CSS_SPACE = /[ \t\n\r\f]/;
const HEX_DIGIT = /[0-9a-f]/i;
/** U+0000-0008, U+000B, U+000E-001F and U+007F: a url token must not hold them (CSS Syntax 4.3.6). */
const NON_PRINTABLE = /[\u0000-\u0008\u000b\u000e-\u001f\u007f]/;

/** The index just past the escape that starts at `css[i]` (a backslash), or -1 when it is not a valid escape (CSS Syntax 4.3.7). */
function escapeEnd(css: string, i: number): number {
  const next = css.charAt(i + 1);
  if (next === "" || next === "\n" || next === "\r" || next === "\f") return -1;
  let end = i + 1;
  if (!HEX_DIGIT.test(next)) return end + 1;
  while (end < i + 7 && HEX_DIGIT.test(css.charAt(end))) end++;
  if (css.charAt(end) === "\r" && css.charAt(end + 1) === "\n") return end + 2;
  return CSS_SPACE.test(css.charAt(end)) ? end + 1 : end;
}

/** Whether `masked` ends in the function name `url` (escapes resolved: `\75 rl` is `url`, `xurl` and `-url` are not). */
function endsWithUrlName(masked: string): boolean {
  return /(?:^|[^a-z0-9_\-\u0080-\uffff])url$/i.test(unescapeCss(masked.slice(-256)));
}

/**
 * Whether the unquoted `url(` whose contents begin at `start` is read differently by a browser and by `lex()`: a
 * <bad-url-token> (CSS Syntax 4.3.6: a quote, a `(`, a character a url must not hold, a bad escape, or whitespace
 * followed by more than the closing `)`), or a comment opener, which is text inside an unquoted url but a comment to
 * `lex()` (a `)` after it ends the url for the browser, while the lexer drops it with the comment).
 * A browser reads a bad url as running to the first unescaped `)`, with its quotes and braces inert; a lexer that read
 * the quote as a string would see the sheet's structure somewhere else, and the text it keeps would not be what it
 * judged. `url("...")` and `url( '...' )` (a function holding a string) are not this case.
 */
function isBadUrl(css: string, start: number): boolean {
  let i = start;
  while (CSS_SPACE.test(css.charAt(i))) i++;
  const first = css.charAt(i);
  if (first === '"' || first === "'") return false;
  for (; i < css.length; i++) {
    const ch = css.charAt(i);
    if (ch === ")") return false;
    if (ch === '"' || ch === "'" || ch === "(" || NON_PRINTABLE.test(ch)) return true;
    if (ch === "/" && css.charAt(i + 1) === "*") return true; // url text to a browser, a comment to this lexer
    if (CSS_SPACE.test(ch)) {
      let after = i + 1;
      while (CSS_SPACE.test(css.charAt(after))) after++;
      return after < css.length && css.charAt(after) !== ")";
    }
    if (ch === "\\") {
      const end = escapeEnd(css, i);
      if (end === -1) return true;
      i = end - 1;
    }
  }
  return false; // the sheet ends inside the url: nothing follows to misread
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
    } else if (ch === "(") {
      if (endsWithUrlName(masked) && isBadUrl(css, i + 1)) return null;
      masked += ch;
      i++;
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

/** Whether `text` ends in a backslash that is not itself escaped: it would escape whatever is written after it. */
function endsInEscape(text: string): boolean {
  let backslashes = 0;
  for (let i = text.length - 1; i >= 0 && text.charAt(i) === "\\"; i--) backslashes++;
  return backslashes % 2 === 1;
}

/** A character that continues an identifier (CSS Syntax 4.2): `token` is not finished before one. */
const IDENT_CHAR = /[\w\-\\\u0080-\uffff]/;

function startsWithToken(selector: string, token: string): boolean {
  return selector.startsWith(token) && !IDENT_CHAR.test(selector.charAt(token.length));
}

/**
 * Whether the first combinator of `selector`, from index `from` on (outside parentheses and brackets, escapes read
 * as the spec reads them: a hex escape takes the one space after it), is `+` or `~`: a selector that starts with the
 * root and then asks for its next or later siblings styles elements outside it.
 */
function reachesSiblings(selector: string, from: number): boolean {
  let depth = 0;
  for (let i = from; i < selector.length; i++) {
    const ch = selector.charAt(i);
    if (ch === "\\") {
      const end = escapeEnd(selector, i);
      if (end !== -1) i = end - 1;
    } else if (ch === "(" || ch === "[") depth++;
    else if (ch === ")" || ch === "]") depth--;
    else if (depth === 0 && (ch === "+" || ch === "~")) return true;
    else if (depth === 0 && (ch === ">" || CSS_SPACE.test(ch))) return /^[ \t\n\r\f]*[+~]/.test(selector.slice(i));
  }
  return false;
}

/**
 * `selector` confined to the article: under the root. Null for a selector that would reach outside it: one that
 * starts with a combinator, or that starts with the root and then asks for its siblings (`.mw-parser-output ~ *`).
 */
function scopeSelector(selector: string): string | null {
  if (/^[>+~]/.test(selector)) return null;
  if (!startsWithToken(selector, ARTICLE_STYLE_SCOPE)) return `${ARTICLE_STYLE_SCOPE} ${selector}`;
  return reachesSiblings(selector, ARTICLE_STYLE_SCOPE.length) ? null : selector;
}

/** The selector list of a rule, scoped; null when any selector is empty or unsafe (the browser drops such a rule too). */
function scopeSelectors(prelude: string, strings: readonly string[]): string | null {
  const selectors = splitTopLevel(prelude, ",");
  if (!selectors) return null;
  const scoped: string[] = [];
  for (const raw of selectors) {
    const selector = inflate(raw, strings).trim();
    if (!selector || selector.length > MAX_SELECTOR_LENGTH || selector.includes("<")) return null;
    if (endsInEscape(selector)) return null; // trimmed, it would escape the "," or "{" written after it
    const confined = scopeSelector(selector);
    if (confined === null) return null;
    scoped.push(confined);
  }
  return scoped.join(",");
}

/**
 * The target of the `url(` whose argument starts at `from`, read the way the CSS tokenizer reads it, from text
 * with its escapes still in it: a quoted target is the whole string (a `)` inside it is part of the URL), an unquoted
 * one runs to the first unescaped `)`. It is unescaped after it is delimited, never before. Null when the argument is
 * anything else (a bad url, a string followed by more tokens, no closing `)`). Linear: it only moves forward.
 */
function readUrlArgument(css: string, from: number): { target: string; end: number } | null {
  let start = from;
  while (CSS_SPACE.test(css.charAt(start))) start++;
  const quote = css.charAt(start);
  const quoted = quote === '"' || quote === "'";
  if (quoted) start++;
  let close = start;
  for (; close < css.length; close++) {
    const ch = css.charAt(close);
    if (ch === "\\") {
      const end = escapeEnd(css, close);
      if (end === -1) return null;
      close = end - 1;
    } else if (quoted ? ch === quote : UNQUOTED_URL_STOP.test(ch)) {
      break;
    }
  }
  if (quoted && css.charAt(close) !== quote) return null;
  let end = quoted ? close + 1 : close;
  while (CSS_SPACE.test(css.charAt(end))) end++;
  return css.charAt(end) === ")" ? { target: unescapeCss(css.slice(start, close)), end: end + 1 } : null;
}

/**
 * The targets of the `url()` functions of `declaration` (escapes still in it, strings restored), each read as the
 * tokenizer reads it, then unescaped. Null when the declaration holds a `url(` this reading did not find (an escaped
 * name, an argument it cannot read): what is not judged is not kept.
 */
function urlTargets(declaration: string): string[] | null {
  const targets: string[] = [];
  URL_NAME.lastIndex = 0;
  for (let open = URL_NAME.exec(declaration); open; open = URL_NAME.exec(declaration)) {
    const read = readUrlArgument(declaration, open.index + open[0].length);
    if (!read) return null;
    targets.push(read.target);
    URL_NAME.lastIndex = read.end;
  }
  const opens = unescapeCss(declaration).match(URL_NAME_COUNT)?.length ?? 0;
  return opens === targets.length ? targets : null;
}

/**
 * Whether `raw`, the inside of a `url()`, is relative to the page or `https://` on `ownOrigin`. Two readings must
 * agree, the URL parser's and a plain syntactic one, so that a browser that parses an odd form (`https:/host`,
 * `\\\\host`) differently cannot reach another host.
 */
function urlIsAllowed(raw: string, ownOrigin: string | undefined): boolean {
  const target = raw
    .trim()
    // the URL parser drops tabs and newlines inside a scheme: "java\tscript:" is "javascript:"
    .replace(/[\u0000- \u007f]/g, "");
  const absolute = URL_SCHEME.test(target);
  if (absolute ? !/^https:\/\/[^/\\]/i.test(target) : /^[/\\]{2}/.test(target)) return false;
  try {
    const resolved = new URL(target, RELATIVE_BASE);
    return absolute
      ? ownOrigin !== undefined && resolved.protocol === "https:" && resolved.origin === ownOrigin
      : resolved.origin === RELATIVE_ORIGIN;
  } catch {
    return false;
  }
}

/** Whether every `url()` in `declaration` stays on the page or the wiki's own origin. */
function urlsAreAllowed(declaration: string, ownOrigin: string | undefined): boolean {
  const targets = urlTargets(declaration);
  return targets !== null && targets.every((raw) => urlIsAllowed(raw, ownOrigin));
}

function isAllowedDeclaration(property: string, declaration: string, ownOrigin: string | undefined): boolean {
  const judged = unescapeCss(declaration).toLowerCase();
  return (
    PROPERTY_NAME.test(property) &&
    !BLOCKED_PROPERTY.test(unescapeCss(property).toLowerCase()) &&
    !BLOCKED_VALUE.test(judged) &&
    !BLOCKED_FUNCTION.test(judged) &&
    urlsAreAllowed(declaration, ownOrigin) &&
    !declaration.includes("<") &&
    !endsInEscape(declaration) // trimmed, it would escape the ";" or "}" written after it
  );
}

/** The declarations of a rule body that may stay, or null when the body is not a plain declaration list. */
function cleanDeclarations(
  body: string,
  strings: readonly string[],
  ownOrigin: string | undefined
): string[] | null {
  if (body.includes("{") || body.includes("}")) return null; // a nested rule: not read, so not kept
  const parts = splitTopLevel(body, ";");
  if (!parts) return null;
  const kept: string[] = [];
  for (const part of parts) {
    const colon = part.indexOf(":");
    if (colon < 1) continue;
    const property = part.slice(0, colon).trim();
    const declaration = inflate(part, strings).trim();
    if (isAllowedDeclaration(property, declaration, ownOrigin)) kept.push(declaration);
  }
  return kept;
}

function scopeQualifiedRule(
  rule: RawRule,
  strings: readonly string[],
  ownOrigin: string | undefined
): string {
  if (rule.body === null) return "";
  const selectors = scopeSelectors(rule.prelude, strings);
  const declarations = selectors === null ? null : cleanDeclarations(rule.body, strings, ownOrigin);
  return selectors && declarations && declarations.length > 0
    ? `${selectors}{${declarations.join(";")}}`
    : "";
}

function scopeAtRule(
  rule: RawRule,
  strings: readonly string[],
  depth: number,
  ownOrigin: string | undefined
): string {
  // `@media` only, spelled plainly: an escaped at-keyword is not read
  const query = /^@media(?=[\s(])([\s\S]*)$/i.exec(rule.prelude.trim())?.[1]?.trim();
  const inner = rule.body !== null && depth < MAX_AT_RULE_DEPTH ? parseRules(rule.body) : null;
  if (query === undefined || !inner || !MEDIA_QUERY.test(query) || BLOCKED_MEDIA.test(query)) return "";
  const scoped = scopeRules(inner, strings, depth + 1, ownOrigin);
  return scoped ? `@media ${query}{${scoped}}` : "";
}

function scopeRules(
  rules: readonly RawRule[],
  strings: readonly string[],
  depth: number,
  ownOrigin: string | undefined
): string {
  let out = "";
  for (const rule of rules) {
    const prelude = rule.prelude.trim();
    if (!prelude) continue;
    out += prelude.startsWith("@")
      ? scopeAtRule(rule, strings, depth, ownOrigin)
      : scopeQualifiedRule(rule, strings, ownOrigin);
  }
  return out;
}

/**
 * Every identifier of `css` (escapes resolved), which is every class name it names, however it names it (`.x`,
 * `:is(.x)`, `[class~=x]`, `.x\\2d y`): a superset of the classes it styles, read in one pass.
 */
export function cssIdentifiers(css: string): Set<string> {
  return new Set(unescapeCss(css).match(/[\w\-\u0080-\uffff]+/g) ?? []);
}

/**
 * The CSS of a TemplateStyles block as it may appear in an article: scoped under the article root and
 * stripped of everything that could load, run or reach outside it. An empty string when nothing is left.
 * `ownOrigin` is the wiki's origin (`https://host`): the one absolute origin a `url()` may name.
 */
export function scopeTemplateStyles(css: string, ownOrigin?: string): string {
  if (css.length > MAX_CSS_LENGTH) return "";
  const lexed = lex(css.replace(CONTROL_MARKS, "�"));
  const rules = lexed ? parseRules(lexed.masked) : null;
  return lexed && rules ? scopeRules(rules, lexed.strings, 0, ownOrigin) : "";
}
