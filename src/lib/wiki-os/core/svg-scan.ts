/**
 * svg-scan.ts — whether an uploaded SVG is safe to serve (plan 411, review hardening). Pure, one pass, no dependency.
 *
 * An SVG is a document the browser runs: a script, an event handler, a `javascript:` URL, a `foreignObject` that holds HTML, a
 * reference to something outside the file, an entity or a DTD subset that rewrites the document, an XHTML page with an SVG in it. The
 * scan reads the file the way an XML parser does and is strict about it: a file that is not well-formed XML would only
 * show the browser's parse error, so it is refused (this also closes the tricks that rely on a tag or comment that one reader sees and
 * another does not). What it checks:
 *   - the document is UTF-8 (a declared UTF-7 or UTF-16 body reads differently to a browser than to this scan), its tags
 *     are well-formed and every end tag closes the element that is open (a stack, at most 2048 deep), it has one root
 *     element, and that element is `svg`, in the SVG namespace (no `xmlns` of another value, no XHTML namespace declared);
 *     a DOCTYPE has no internal subset;
 *   - no `script`, `foreignObject`, `iframe`, `embed`, `object`, `handler`, `listener`; no event-handler attribute (`on...`),
 *     also as the target of `<set>` and `<animate>` (`attributeName`); a `href` goes only to a fragment (`#id`) or an inline
 *     raster image; no `url()`, `@import`, `expression()`, `javascript:`, `vbscript:` or HTML `data:` URL anywhere, judged after
 *     XML character references and CSS escapes (`\75rl(`, `@\69mport`) are resolved;
 *   - bounds that keep the cost linear and small: a tag has at most 256 attributes, names are at most 128 characters,
 *     elements nest at most 2048 deep, a `url(` that is never closed is refused.
 * The text is read once by the parser and a handful of times by native string passes; ten megabytes take a few hundred milliseconds.
 */

/** An SVG that is not well-formed XML, or breaks one of the bounds: the reason, as a fragment ("it ..."). */
class Malformed extends Error {}

const MAX_ATTRIBUTES_PER_TAG = 256;
const MAX_NAME_LENGTH = 128;
const MAX_DEPTH = 2048;

/** Elements that run code or pull in another document. */
const FORBIDDEN_ELEMENTS: ReadonlySet<string> = new Set([
  "script",
  "foreignobject",
  "iframe",
  "embed",
  "object",
  "applet",
  "handler",
  "listener",
]);
/** An image carried inline in a `data:` URL is a picture, not a document: the only `data:` value an SVG may reference. */
const INLINE_IMAGE = /^data:image\/(?:png|jpe?g|gif|webp);base64,/i;
const NAME = /^[A-Za-z_][\w:.-]*$/;
const NAMED_REFERENCES: Readonly<Record<string, string>> = {
  colon: ":",
  tab: "",
  newline: "",
  lpar: "(",
  rpar: ")",
};
const SVG_NAMESPACE = "http://www.w3.org/2000/svg";
const XHTML_NAMESPACE = "http://www.w3.org/1999/xhtml";
/** The encodings a declaration may name: UTF-8, and US-ASCII which is the same bytes. */
const ALLOWED_ENCODINGS: ReadonlySet<string> = new Set(["utf-8", "us-ascii"]);

/** Strings that must appear nowhere in an SVG (checked on the text as a browser would read it, whitespace gone). */
const FORBIDDEN_TEXT: ReadonlyArray<readonly [string, string]> = [
  ["javascript:", "it contains a javascript: URL"],
  ["vbscript:", "it contains a vbscript: URL"],
  ["data:text/html", "it contains an HTML data: URL"],
  ["@import", "it imports a stylesheet"],
  ["-moz-binding", "it binds an XBL document"],
  ["expression(", "it contains a CSS expression"],
  ["image-set(", "it loads an image by a string URL (image-set)"],
];

// ---------------------------------------------------------------------------
// Reading references the way a browser does
// ---------------------------------------------------------------------------

function safeChar(code: number): string {
  return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : "";
}

/** `value` with XML character references (`&#x6a;`, `&#106;`, `&colon;`) decoded. */
function decodeReferences(value: string): string {
  if (!value.includes("&")) return value;
  return (
    value
      // any number of digits: `&#x0000061;` is `a` (an out-of-range number is no character)
      .replace(/&#x([0-9a-f]+);?/gi, (_, hex: string) => safeChar(parseInt(hex, 16)))
      .replace(/&#(\d+);?/g, (_, dec: string) => safeChar(parseInt(dec, 10)))
      .replace(
        /&([a-z]{2,8});/gi,
        (match, name: string) => NAMED_REFERENCES[name.toLowerCase()] ?? match
      )
  );
}

/** `value` with CSS escapes resolved: `\75` and `\000075` are `u`, `\u` is `u`, a backslash before a line break is nothing. */
function unescapeCss(value: string): string {
  if (!value.includes("\\")) return value;
  return value.replace(
    /\\(?:([0-9a-f]{1,6})[ \t\n\r\f]?|([^\n\r\f0-9a-f])|[\n\r\f])/gi,
    (_, hex: string | undefined, plain: string | undefined) =>
      hex === undefined ? (plain ?? "") : safeChar(parseInt(hex, 16))
  );
}

/** `value` as a browser reads a URL in it: references decoded, whitespace and control characters dropped. */
function normalizeReference(value: string): string {
  return decodeReferences(value).replace(/[\s\u0000-\u001f\u007f-\u009f]+/g, "");
}

/** Whether a URL an SVG refers to stays inside the file: a fragment (`#grad`) or an inline raster image. */
function isLocalReference(value: string): boolean {
  const url = normalizeReference(value);
  return url === "" || url.startsWith("#") || INLINE_IMAGE.test(url);
}

// ---------------------------------------------------------------------------
// A strict reader of the tags
// ---------------------------------------------------------------------------

export interface SvgTag {
  kind: "start" | "end";
  name: string;
  attrs: Array<readonly [string, string]>;
  selfClosing: boolean;
}

const malformed = (what: string) => new Malformed(`it is not well-formed XML (${what})`);

const isSpace = (char: string): boolean =>
  char === " " || char === "\t" || char === "\n" || char === "\r" || char === "\f";

function skipSpaces(text: string, from: number): number {
  let at = from;
  while (at < text.length && isSpace(text.charAt(at))) at++;
  return at;
}

/** The name that starts at `from`, up to a space or one of `stops`, and where it ends; refused when it is no name or too long. */
function readName(
  text: string,
  from: number,
  stops: string,
  what: string
): { name: string; end: number } {
  const limit = Math.min(text.length, from + MAX_NAME_LENGTH + 1);
  let end = from;
  while (end < limit && !isSpace(text.charAt(end)) && !stops.includes(text.charAt(end))) end++;
  const name = text.slice(from, end);
  if (name.length > MAX_NAME_LENGTH)
    throw malformed(`an ${what} name is longer than ${MAX_NAME_LENGTH} characters`);
  if (!NAME.test(name)) throw malformed(`"${name.slice(0, 40)}" is not an ${what} name`);
  return { name, end };
}

function readAttribute(text: string, from: number): { name: string; value: string; end: number } {
  const { name, end: afterName } = readName(text, from, "=/>", "attribute");
  let at = skipSpaces(text, afterName);
  if (text.charAt(at) !== "=") throw malformed(`the attribute ${name} has no value`);
  at = skipSpaces(text, at + 1);
  const quote = text.charAt(at);
  if (quote !== '"' && quote !== "'") throw malformed(`the value of ${name} is not quoted`);
  const close = text.indexOf(quote, at + 1);
  if (close === -1) throw malformed(`the value of ${name} is never closed`);
  return { name, value: text.slice(at + 1, close), end: close + 1 };
}

/** The start tag that begins at `at` (a `<`), and where it ends. */
function readStartTag(text: string, at: number): { tag: SvgTag; end: number } {
  const { name, end: afterName } = readName(text, at + 1, "/>", "element");
  const attrs: Array<readonly [string, string]> = [];
  let cursor = afterName;
  // attributes are separated by white space: `a="x"b="y"` is not XML
  let separated = true;
  for (;;) {
    const next = skipSpaces(text, cursor);
    separated ||= next > cursor;
    const char = text.charAt(next);
    if (char === "") throw malformed("a tag is never closed");
    if (char === ">")
      return { tag: { kind: "start", name, attrs, selfClosing: false }, end: next + 1 };
    if (char === "/") {
      if (text.charAt(next + 1) !== ">") throw malformed("a / in a tag is not followed by >");
      return { tag: { kind: "start", name, attrs, selfClosing: true }, end: next + 2 };
    }
    if (!separated) throw malformed("two attributes are not separated by white space");
    if (attrs.length >= MAX_ATTRIBUTES_PER_TAG) {
      throw malformed(`a tag has more than ${MAX_ATTRIBUTES_PER_TAG} attributes`);
    }
    const attribute = readAttribute(text, next);
    attrs.push([attribute.name, attribute.value]);
    cursor = attribute.end;
    separated = false;
  }
}

function readEndTag(text: string, at: number): { tag: SvgTag; end: number } {
  const { name, end: afterName } = readName(text, at + 2, ">", "element");
  const close = skipSpaces(text, afterName);
  if (text.charAt(close) !== ">") throw malformed(`the end tag of ${name} is not closed`);
  return { tag: { kind: "end", name, attrs: [], selfClosing: false }, end: close + 1 };
}

/** The index of the next `<` after `from`, or -1. */
const nextTag = (text: string, from: number): number => text.indexOf("<", from);

/** Where the DOCTYPE whose name starts at `from` ends (after its `>`); an internal subset (`[`) outside the quotes is refused. */
function endOfDoctype(text: string, from: number): number {
  let quote = "";
  for (let at = from; at < text.length; at++) {
    const char = text.charAt(at);
    if (quote) quote = char === quote ? "" : quote;
    else if (char === '"' || char === "'") quote = char;
    else if (char === "[") throw new Malformed("its DOCTYPE has an internal subset");
    else if (char === ">") return at + 1;
  }
  throw malformed("the DOCTYPE is never closed");
}

/** Every start and end tag of the text, in order; comments, CDATA, processing instructions and the DOCTYPE are read and skipped. */
function* tagsOf(text: string): Generator<SvgTag> {
  let at = nextTag(text, 0);
  while (at !== -1) {
    if (text.startsWith("<!--", at)) {
      const close = text.indexOf("-->", at + 4);
      if (close === -1) throw malformed("a comment is never closed");
      // `--` may not occur inside a comment, nor close it as `--->`: a reader that ends it at `--!>` would see the markup after it
      const body = text.slice(at + 4, close);
      if (body.includes("--") || body.endsWith("-")) throw malformed("a comment contains --");
      at = nextTag(text, close + 3);
    } else if (text.startsWith("<![CDATA[", at)) {
      const close = text.indexOf("]]>", at + 9);
      if (close === -1) throw malformed("CDATA is never closed");
      at = nextTag(text, close + 3);
    } else if (text.startsWith("<?", at)) {
      const close = text.indexOf("?>", at + 2);
      if (close === -1) throw malformed("a processing instruction is never closed");
      if (text.slice(at, close).includes("<", 2))
        throw malformed("a processing instruction contains markup");
      at = nextTag(text, close + 2);
    } else if (text.startsWith("<!", at)) {
      if (text.slice(at + 2, at + 9).toLowerCase() !== "doctype")
        throw malformed("an unknown <! declaration");
      at = nextTag(text, endOfDoctype(text, at + 9));
    } else {
      const { tag, end } = text.startsWith("</", at)
        ? readEndTag(text, at)
        : readStartTag(text, at);
      yield tag;
      at = nextTag(text, end);
    }
  }
}

// ---------------------------------------------------------------------------
// What is wrong with a tag, and with the text around them
// ---------------------------------------------------------------------------

/** The part of an element name after any namespace prefix, lower-cased (`svg:script` is `script`). */
const localName = (name: string): string => name.slice(name.lastIndexOf(":") + 1).toLowerCase();

/** What is wrong with the namespace of a prefixed root (`<svg:svg xmlns:svg="...">`): the prefix must be the SVG namespace's. */
function rootNamespaceProblem({ name, attrs }: SvgTag): string | null {
  const colon = name.indexOf(":");
  if (colon === -1) return null;
  const declared = attrs.find(([key]) => key === `xmlns:${name.slice(0, colon)}`)?.[1];
  return declared !== undefined && decodeReferences(declared) !== SVG_NAMESPACE
    ? "its root element is not in the SVG namespace"
    : null;
}

/** What is wrong with one start tag, or null. */
function tagProblem({ name, attrs }: SvgTag): string | null {
  if (FORBIDDEN_ELEMENTS.has(localName(name))) return `it contains a <${localName(name)}> element`;
  for (const [attribute, value] of attrs) {
    const key = attribute.toLowerCase();
    // a default namespace other than SVG's makes the element something else (an XHTML `meta` refresh, a `form`)
    if (attribute === "xmlns" && decodeReferences(value) !== SVG_NAMESPACE) {
      return "its default namespace is not the SVG namespace";
    }
    if (
      attribute.startsWith("xmlns:") &&
      normalizeReference(value).toLowerCase() === XHTML_NAMESPACE
    ) {
      return "it declares the XHTML namespace";
    }
    if (key.startsWith("on")) return `it has an event handler (${attribute})`;
    if (localName(key) === "href" && !isLocalReference(value)) {
      return "it refers to something outside the file (href)";
    }
    // <set attributeName="href" to="javascript:..."> and <animate> write an href or a handler the checks above never see.
    if (key === "attributename") {
      const target = localName(normalizeReference(value).toLowerCase());
      if (target === "href") return "it animates an href";
      if (target.startsWith("on")) return `it sets an event handler (${target})`;
    }
  }
  return null;
}

/** `value` without one pair of quotes around it. */
function unquote(value: string): string {
  const quote = value.charAt(0);
  if ((quote === '"' || quote === "'") && value.length > 1 && value.endsWith(quote)) {
    return value.slice(1, -1).trim();
  }
  return value;
}

/**
 * The first `url(...)` (or `url (...)`) of `css` that points outside the file, or null. `css` is lower-cased, with references
 * decoded and escapes resolved. One forward pass: each `url(` is judged between itself and the `)` that closes it, and
 * the search goes on after that `)`, so no part of the text is read twice. A `url(` that is never closed is refused at once:
 * scanning on from every later `url(` to the end of the text would be quadratic, and the text is up to 10 MB of an uploader's choosing.
 */
function externalUrlFunction(css: string): string | null {
  let at = css.indexOf("url");
  while (at !== -1) {
    const open = skipSpaces(css, at + 3);
    if (css.charAt(open) !== "(") {
      at = css.indexOf("url", open);
      continue;
    }
    const close = css.indexOf(")", open + 1);
    if (close === -1) return "it has a url() that is never closed";
    const argument = unquote(css.slice(open + 1, close).trim());
    if (!isLocalReference(argument)) return "it refers to something outside the file (url())";
    at = css.indexOf("url", close + 1);
  }
  return null;
}

/** The longest XML declaration read: it is a handful of pseudo-attributes. */
const MAX_DECLARATION_LENGTH = 1024;

/** The encoding the XML declaration names, if the text starts with one: looked for in the whole declaration, up to its `?>`. */
function declaredEncoding(text: string): string | null {
  if (!/^<\?xml\s/i.test(text)) return null;
  const head = text.slice(0, MAX_DECLARATION_LENGTH);
  const end = head.indexOf("?>");
  if (end === -1)
    throw malformed(`the XML declaration is longer than ${MAX_DECLARATION_LENGTH} characters`);
  return /\bencoding\s*=\s*["']([^"']+)["']/i.exec(head.slice(0, end))?.[1] ?? null;
}

type SvgScan = { problem: string } | { problem: null; root: SvgTag };

/**
 * Read `text` (an SVG document, its BOM and leading white space gone): either what is wrong with it, as a fragment that
 * finishes "This SVG was refused because ...", or its root element.
 */
export function scanSvg(text: string): SvgScan {
  try {
    return scan(text);
  } catch (error) {
    if (error instanceof Malformed) return { problem: error.message };
    throw error;
  }
}

function scan(text: string): SvgScan {
  const encoding = declaredEncoding(text);
  if (encoding !== null && !ALLOWED_ENCODINGS.has(encoding.toLowerCase())) {
    return { problem: `it declares the encoding ${encoding.slice(0, 20)}, not UTF-8` };
  }
  // The text as a stylesheet or a URL reader sees it: character references decoded, then CSS escapes resolved.
  const css = unescapeCss(decodeReferences(text)).toLowerCase();
  if (css.includes("<!entity")) return { problem: "it declares an entity" };
  if (css.includes("<?xml-stylesheet")) return { problem: "it loads an external stylesheet" };
  const flattened = css.replace(/[\s\u0000-\u001f\u007f-\u009f]+/g, "");
  for (const [needle, reason] of FORBIDDEN_TEXT) {
    if (flattened.includes(needle)) return { problem: reason };
  }

  let root: SvgTag | null = null;
  const open: string[] = [];
  for (const tag of tagsOf(text)) {
    if (tag.kind === "end") {
      const opened = open.pop();
      if (opened === undefined) throw malformed("an end tag closes nothing");
      if (opened !== tag.name) throw malformed(`</${tag.name}> does not close <${opened}>`);
      continue;
    }
    if (open.length === 0) {
      if (root) throw malformed("more than one root element");
      if (localName(tag.name) !== "svg")
        return { problem: `its root element is <${localName(tag.name)}>, not <svg>` };
      root = tag;
      const namespace = rootNamespaceProblem(tag);
      if (namespace) return { problem: namespace };
    }
    const problem = tagProblem(tag);
    if (problem) return { problem };
    if (!tag.selfClosing) open.push(tag.name);
    if (open.length > MAX_DEPTH) throw malformed(`elements are nested deeper than ${MAX_DEPTH}`);
  }
  if (root === null) throw malformed("there is no root element");
  if (open.length !== 0) throw malformed("an element is never closed");
  const outside = externalUrlFunction(css);
  return outside ? { problem: outside } : { problem: null, root };
}
