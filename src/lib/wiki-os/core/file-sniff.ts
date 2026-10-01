/**
 * file-sniff.ts — what an uploaded file really is (plan 411): its type from its first bytes, its pixel size from
 * its header, and for an SVG whether it is safe to serve. Pure functions over bytes, no dependency.
 *
 * The name never decides: a PNG called `flag.jpg` is a PNG, and `extensionMatches` says the name is wrong for it
 * (MediaWiki refuses such a file too, `filetype-mime-mismatch`). Only png, jpeg, gif, webp, svg and pdf are
 * accepted (`UPLOAD_EXTENSIONS`).
 *
 * An SVG is a document, so it is checked like one: it must start like an SVG, and it is refused when it holds
 * anything that could run or load something (a script, an event handler, a `javascript:` URL, a `foreignObject`,
 * an external reference, an entity declaration). MediaWiki refuses scripted SVGs as well. The scan is one pass over
 * the text (no backtracking pattern runs over it), so a hostile 10 MB file costs a bounded, linear amount of work.
 */

export type FileKind = "png" | "jpeg" | "gif" | "webp" | "svg" | "pdf";

export interface SniffedFile {
  kind: FileKind;
  mime: string;
  /** Pixels; null for a PDF and for an SVG that states no size. */
  width: number | null;
  height: number | null;
}

/** MediaWiki-style codes (`filetype-badmime`, `empty-file`, ...) with the sentence that explains them. */
export type SniffFailureCode = "empty-file" | "filetype-badmime" | "corrupt" | "unsafe-svg";

export type SniffResult =
  { ok: true; file: SniffedFile } | { ok: false; code: SniffFailureCode; reason: string };

const MIME: Readonly<Record<FileKind, string>> = {
  png: "image/png",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  pdf: "application/pdf",
};

/** The extensions a file of each kind may carry. */
const EXTENSIONS: Readonly<Record<FileKind, readonly string[]>> = {
  png: ["png"],
  jpeg: ["jpg", "jpeg"],
  gif: ["gif"],
  webp: ["webp"],
  svg: ["svg"],
  pdf: ["pdf"],
};

/** The lower-case extension of a file name (without the dot), or "" when it has none. */
export function fileExtension(filename: string): string {
  const dot = filename.lastIndexOf(".");
  return dot === -1 ? "" : filename.slice(dot + 1).toLowerCase();
}

/** Whether `filename`'s extension is one of the extensions a file of `kind` carries. */
export function extensionMatches(kind: FileKind, filename: string): boolean {
  return EXTENSIONS[kind].includes(fileExtension(filename));
}

const fail = (code: SniffFailureCode, reason: string): SniffResult => ({ ok: false, code, reason });

const ok = (kind: FileKind, width: number | null, height: number | null): SniffResult => ({
  ok: true,
  file: { kind, mime: MIME[kind], width, height },
});

const u16be = (b: Uint8Array, at: number): number => (b[at]! << 8) | b[at + 1]!;
const u16le = (b: Uint8Array, at: number): number => b[at]! | (b[at + 1]! << 8);
const u24le = (b: Uint8Array, at: number): number =>
  b[at]! | (b[at + 1]! << 8) | (b[at + 2]! << 16);
const u32be = (b: Uint8Array, at: number): number =>
  ((b[at]! << 24) | (b[at + 1]! << 16) | (b[at + 2]! << 8) | b[at + 3]!) >>> 0;
const u32le = (b: Uint8Array, at: number): number =>
  (b[at]! | (b[at + 1]! << 8) | (b[at + 2]! << 16) | (b[at + 3]! << 24)) >>> 0;

function startsWith(bytes: Uint8Array, ...head: number[]): boolean {
  return head.every((value, at) => bytes[at] === value);
}

const ascii = (bytes: Uint8Array, from: number, length: number): string =>
  String.fromCharCode(...bytes.subarray(from, from + length));

const corrupt = (what: string): SniffResult => fail("corrupt", `The file is not a valid ${what}.`);

const positive = (width: number, height: number): boolean => width > 0 && height > 0;

// ---------------------------------------------------------------------------
// Rasters
// ---------------------------------------------------------------------------

function sniffPng(bytes: Uint8Array): SniffResult {
  // The first chunk is always IHDR: 4 bytes length, "IHDR", then width and height as 32-bit big-endian numbers.
  if (bytes.length < 24 || ascii(bytes, 12, 4) !== "IHDR") return corrupt("PNG image");
  const width = u32be(bytes, 16);
  const height = u32be(bytes, 20);
  return positive(width, height) ? ok("png", width, height) : corrupt("PNG image");
}

function sniffGif(bytes: Uint8Array): SniffResult {
  if (bytes.length < 10) return corrupt("GIF image");
  const width = u16le(bytes, 6);
  const height = u16le(bytes, 8);
  return positive(width, height) ? ok("gif", width, height) : corrupt("GIF image");
}

/** The JPEG markers that start a frame and so carry the size: SOF0..SOF15 except DHT (C4), JPG (C8) and DAC (CC). */
const isFrameMarker = (marker: number): boolean =>
  marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;

/** Markers that stand alone, with no length: TEM, RSTn, SOI and EOI. */
const isStandaloneMarker = (marker: number): boolean =>
  marker === 0x01 || (marker >= 0xd0 && marker <= 0xd9);

function sniffJpeg(bytes: Uint8Array): SniffResult {
  let at = 2;
  while (at + 3 < bytes.length) {
    if (bytes[at] !== 0xff) {
      at++;
      continue;
    }
    const marker = bytes[at + 1]!;
    if (marker === 0xff) {
      at++; // fill byte before a marker
    } else if (isStandaloneMarker(marker)) {
      at += 2;
    } else if (isFrameMarker(marker)) {
      if (at + 8 >= bytes.length) break;
      const height = u16be(bytes, at + 5);
      const width = u16be(bytes, at + 7);
      return positive(width, height) ? ok("jpeg", width, height) : corrupt("JPEG image");
    } else if (marker === 0xda) {
      break; // the scan starts: no frame header came before it
    } else {
      at += 2 + u16be(bytes, at + 2);
    }
  }
  return corrupt("JPEG image");
}

function sniffWebp(bytes: Uint8Array): SniffResult {
  const chunk = ascii(bytes, 12, 4);
  if (chunk === "VP8 " && bytes.length >= 30 && startsWith(bytes.subarray(23), 0x9d, 0x01, 0x2a)) {
    const width = u16le(bytes, 26) & 0x3fff;
    const height = u16le(bytes, 28) & 0x3fff;
    return positive(width, height) ? ok("webp", width, height) : corrupt("WebP image");
  }
  if (chunk === "VP8L" && bytes.length >= 25 && bytes[20] === 0x2f) {
    const bits = u32le(bytes, 21);
    return ok("webp", (bits & 0x3fff) + 1, ((bits >>> 14) & 0x3fff) + 1);
  }
  if (chunk === "VP8X" && bytes.length >= 30) {
    return ok("webp", u24le(bytes, 24) + 1, u24le(bytes, 27) + 1);
  }
  return corrupt("WebP image");
}

// ---------------------------------------------------------------------------
// SVG
// ---------------------------------------------------------------------------

/** What an SVG may start with: an XML declaration, a comment, a DOCTYPE or the root element itself. */
const SVG_START = /^(?:<\?xml[\s?]|<!--|<!doctype\s+svg|<svg[\s>/])/i;
const SVG_ROOT = /<svg[\s>/]/i;
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
const NAMED_REFERENCES: Readonly<Record<string, string>> = {
  colon: ":",
  tab: "",
  newline: "",
  lpar: "(",
  rpar: ")",
};

/** `value` as a browser reads a URL in it: character references decoded, whitespace and control characters dropped. */
function normalizeReference(value: string): string {
  return value
    .replace(/&#x([0-9a-f]{1,6});?/gi, (_, hex: string) => safeChar(parseInt(hex, 16)))
    .replace(/&#(\d{1,7});?/g, (_, dec: string) => safeChar(parseInt(dec, 10)))
    .replace(
      /&([a-z]{2,8});/gi,
      (match, name: string) => NAMED_REFERENCES[name.toLowerCase()] ?? match
    )
    .replace(/[\s\u0000-\u001f\u007f-\u009f]+/g, "");
}

function safeChar(code: number): string {
  return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : "";
}

interface Tag {
  name: string;
  attrs: Array<readonly [string, string]>;
}

const isSpace = (char: string): boolean =>
  char === " " || char === "\t" || char === "\n" || char === "\r" || char === "\f";

/** The end of the name that starts at `from`: the first space, `=`, `/` or `>`. */
function nameEnd(text: string, from: number, stops: string): number {
  let at = from;
  while (at < text.length && !isSpace(text.charAt(at)) && !stops.includes(text.charAt(at))) at++;
  return at;
}

function skipSpaces(text: string, from: number): number {
  let at = from;
  while (at < text.length && isSpace(text.charAt(at))) at++;
  return at;
}

/** One attribute starting at `from`: its name and value, and where the next thing starts. */
function readAttribute(text: string, from: number): { name: string; value: string; end: number } {
  const stop = nameEnd(text, from, "=/>");
  const name = text.slice(from, stop);
  let at = skipSpaces(text, stop);
  if (text.charAt(at) !== "=") return { name, value: "", end: stop === from ? from + 1 : stop };
  at = skipSpaces(text, at + 1);
  const quote = text.charAt(at);
  if (quote === '"' || quote === "'") {
    const close = text.indexOf(quote, at + 1);
    const end = close === -1 ? text.length : close;
    return { name, value: text.slice(at + 1, end), end: end + 1 };
  }
  const end = nameEnd(text, at, ">");
  return { name, value: text.slice(at, end), end };
}

/** Every element tag of the text, as a name and its attributes; comments, CDATA and processing instructions are skipped. */
function* tagsOf(text: string): Generator<Tag> {
  let at = text.indexOf("<");
  while (at !== -1 && at < text.length) {
    const next = text.charAt(at + 1);
    if (text.startsWith("<!--", at)) {
      const close = text.indexOf("-->", at + 4);
      at = close === -1 ? -1 : text.indexOf("<", close + 3);
      continue;
    }
    if (text.startsWith("<![CDATA[", at)) {
      const close = text.indexOf("]]>", at + 9);
      at = close === -1 ? -1 : text.indexOf("<", close + 3);
      continue;
    }
    if (next === "?" || next === "!" || next === "/" || next === "") {
      at = text.indexOf("<", at + 1);
      continue;
    }
    const nameStop = nameEnd(text, at + 1, "/>");
    const tag: Tag = { name: text.slice(at + 1, nameStop), attrs: [] };
    let cursor = nameStop;
    for (;;) {
      cursor = skipSpaces(text, cursor);
      const char = text.charAt(cursor);
      if (char === "" || char === ">") break;
      if (char === "/") {
        cursor++;
        continue;
      }
      const attribute = readAttribute(text, cursor);
      if (attribute.name) tag.attrs.push([attribute.name, attribute.value]);
      cursor = attribute.end;
    }
    yield tag;
    at = text.indexOf("<", cursor + 1);
  }
}

/** The part of an element name after any namespace prefix, lower-cased (`svg:script` is `script`). */
const localName = (name: string): string => name.slice(name.lastIndexOf(":") + 1).toLowerCase();

/** Whether a URL an SVG refers to stays inside the file: a fragment (`#grad`) or an inline raster image. */
function isLocalReference(value: string): boolean {
  const url = normalizeReference(value);
  return url === "" || url.startsWith("#") || INLINE_IMAGE.test(url);
}

/** What is wrong with one tag, or null. */
function tagProblem({ name, attrs }: Tag): string | null {
  if (FORBIDDEN_ELEMENTS.has(localName(name))) return `it contains a <${localName(name)}> element`;
  for (const [attribute, value] of attrs) {
    const key = attribute.toLowerCase();
    if (key.startsWith("on")) return `it has an event handler (${attribute})`;
    if (localName(key) === "href" && !isLocalReference(value)) {
      return "it refers to something outside the file (href)";
    }
    // <set attributeName="href" to="javascript:..."> and <animate> write an href the checks above never see.
    if (key === "attributename" && localName(normalizeReference(value).toLowerCase()) === "href") {
      return "it animates an href";
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

/** The first `url(...)` that points outside the file, or null. */
function externalUrlFunction(text: string): string | null {
  const lower = text.toLowerCase();
  for (let at = lower.indexOf("url("); at !== -1; at = lower.indexOf("url(", at + 4)) {
    const close = text.indexOf(")", at);
    const argument = unquote(text.slice(at + 4, close === -1 ? text.length : close).trim());
    if (!isLocalReference(argument)) return "it refers to something outside the file (url())";
  }
  return null;
}

/** Strings that must appear nowhere in an SVG (checked on the text as a browser would read it). */
const FORBIDDEN_TEXT: ReadonlyArray<readonly [string, string]> = [
  ["javascript:", "it contains a javascript: URL"],
  ["vbscript:", "it contains a vbscript: URL"],
  ["data:text/html", "it contains an HTML data: URL"],
  ["@import", "it imports a stylesheet"],
  ["-moz-binding", "it binds an XBL document"],
  ["expression(", "it contains a CSS expression"],
];

/**
 * Why `text` (an SVG document) must not be served, or null when it is clean: the reason is a sentence fragment that
 * finishes "This SVG was refused because ...".
 */
export function svgProblem(text: string): string | null {
  const lower = text.toLowerCase();
  if (lower.includes("<!entity")) return "it declares an entity";
  if (lower.includes("<?xml-stylesheet")) return "it loads an external stylesheet";
  if (/<!doctype[^>]*\[/i.test(text.slice(0, 4096))) return "its DOCTYPE has an internal subset";
  const flattened = normalizeReference(lower);
  for (const [needle, reason] of FORBIDDEN_TEXT) {
    if (flattened.includes(needle)) return reason;
  }
  for (const tag of tagsOf(text)) {
    const problem = tagProblem(tag);
    if (problem) return problem;
  }
  return externalUrlFunction(text);
}

const PIXELS_PER_UNIT: Readonly<Record<string, number>> = {
  "": 1,
  px: 1,
  in: 96,
  cm: 96 / 2.54,
  mm: 96 / 25.4,
  pt: 96 / 72,
  pc: 16,
};

/** The longest attribute value read as a length or a view box: anything longer is not one (and is not scanned). */
const MAX_NUMERIC_ATTRIBUTE = 64;

/** An SVG length (`120`, `12.5px`, `3cm`) in pixels; null for a percentage, an em or anything else. */
function lengthInPixels(value: string | undefined): number | null {
  if (value === undefined || value.length > MAX_NUMERIC_ATTRIBUTE) return null;
  const match = /^\s*(\d+(?:\.\d+)?)\s*([a-z]*)\s*$/i.exec(value);
  const scale = PIXELS_PER_UNIT[(match?.[2] ?? "").toLowerCase()];
  if (!match || scale === undefined) return null;
  const pixels = Math.round(Number(match[1]) * scale);
  return pixels > 0 ? pixels : null;
}

/** `viewBox="0 0 200 100"` as a width and height. */
function viewBoxSize(value: string | undefined): { width: number; height: number } | null {
  if (value === undefined || value.length > MAX_NUMERIC_ATTRIBUTE) return null;
  const parts = value
    .trim()
    .split(/[\s,]+/)
    .map(Number);
  const [, , width, height] = parts;
  return parts.length === 4 && width! > 0 && height! > 0
    ? { width: Math.round(width!), height: Math.round(height!) }
    : null;
}

/** The size an SVG states: its `width` and `height`, else its `viewBox`; null where it states none. */
function svgSize(text: string): { width: number | null; height: number | null } {
  let root: Tag | undefined;
  for (const tag of tagsOf(text)) {
    if (localName(tag.name) === "svg") {
      root = tag;
      break;
    }
  }
  const attr = (name: string) => root?.attrs.find(([key]) => key.toLowerCase() === name)?.[1];
  const box = viewBoxSize(attr("viewbox"));
  return {
    width: lengthInPixels(attr("width")) ?? box?.width ?? null,
    height: lengthInPixels(attr("height")) ?? box?.height ?? null,
  };
}

function sniffSvg(bytes: Uint8Array): SniffResult | null {
  const text = new TextDecoder("utf-8").decode(bytes).replace(/^﻿/, "").trimStart();
  if (!SVG_START.test(text)) return null;
  if (!SVG_ROOT.test(text)) return corrupt("SVG image");
  const problem = svgProblem(text);
  if (problem) return fail("unsafe-svg", `This SVG was refused because ${problem}.`);
  const { width, height } = svgSize(text);
  return ok("svg", width, height);
}

// ---------------------------------------------------------------------------
// The entry point
// ---------------------------------------------------------------------------

/** The first bytes of a PDF, as MediaWiki's own detection reads them. */
const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46, 0x2d];

/** What `bytes` is, from the bytes alone: one of the accepted kinds with its size, or why it is refused. */
export function sniffFile(bytes: Uint8Array): SniffResult {
  if (bytes.length === 0) return fail("empty-file", "The file you submitted was empty.");
  if (startsWith(bytes, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return sniffPng(bytes);
  if (startsWith(bytes, 0xff, 0xd8, 0xff)) return sniffJpeg(bytes);
  if (ascii(bytes, 0, 6) === "GIF87a" || ascii(bytes, 0, 6) === "GIF89a") return sniffGif(bytes);
  if (ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WEBP") return sniffWebp(bytes);
  if (startsWith(bytes, ...PDF_MAGIC)) return ok("pdf", null, null);
  return (
    sniffSvg(bytes) ??
    fail("filetype-badmime", "The file is not a PNG, JPEG, GIF, WebP, SVG or PDF file.")
  );
}
