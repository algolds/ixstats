/**
 * file-sniff.ts — what an uploaded file really is (plan 411): its type from its first bytes, its pixel size from
 * its header, and for an SVG whether it is safe to serve. Pure functions over bytes, no dependency.
 *
 * The name never decides: a PNG called `flag.jpg` is a PNG, and `extensionMatches` says the name is wrong for it
 * (MediaWiki refuses such a file too, `filetype-mime-mismatch`). Only png, jpeg, gif, webp, svg and pdf are
 * accepted (`UPLOAD_EXTENSIONS`).
 *
 * An SVG is a document, so it is checked like one (`svg-scan.ts`): it must be well-formed UTF-8 XML with an `svg` root, and
 * it is refused when it holds anything that could run or load something (a script, an event handler, a `javascript:` URL,
 * a `foreignObject`, an external reference, an entity declaration). MediaWiki refuses scripted SVGs as well. The scan is
 * linear in the size of the file, so a hostile 10 MB file costs a bounded amount of work.
 */

import { scanSvg, type SvgTag } from "./svg-scan";

export type FileKind = "png" | "jpeg" | "gif" | "webp" | "svg" | "pdf";

export interface SniffedFile {
  kind: FileKind;
  mime: string;
  /** Pixels; null for a PDF and for an SVG that states no size. */
  width: number | null;
  height: number | null;
}

/** MediaWiki-style codes (`filetype-badmime`, `empty-file`, ...) with the sentence that explains them. */
export type SniffFailureCode =
  "empty-file" | "filetype-badmime" | "corrupt" | "unsafe-svg" | "file-too-large";

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

/** The largest number a PostgreSQL `Int` column holds: `wiki_assets.width` and `height` are two of them. */
const MAX_PIXEL_SIDE = 2_147_483_647;

/** A size the header can state and the database can store: both sides at least a pixel, neither past an `Int`. */
const positive = (width: number, height: number): boolean =>
  width > 0 && height > 0 && width <= MAX_PIXEL_SIDE && height <= MAX_PIXEL_SIDE;

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
  // An absurd length is a size the file does not usefully state (and would not fit the column): none.
  return pixels > 0 && pixels <= MAX_PIXEL_SIDE ? pixels : null;
}

/** `viewBox="0 0 200 100"` as a width and height. */
function viewBoxSize(value: string | undefined): { width: number; height: number } | null {
  if (value === undefined || value.length > MAX_NUMERIC_ATTRIBUTE) return null;
  const parts = value
    .trim()
    .split(/[\s,]+/)
    .map(Number);
  const [, , width, height] = parts;
  return parts.length === 4 && positive(Math.round(width!), Math.round(height!))
    ? { width: Math.round(width!), height: Math.round(height!) }
    : null;
}

/** The size an SVG states: its `width` and `height`, else its `viewBox`; null where it states none. */
function svgSize(root: SvgTag): { width: number | null; height: number | null } {
  const attr = (name: string) => root.attrs.find(([key]) => key.toLowerCase() === name)?.[1];
  const box = viewBoxSize(attr("viewbox"));
  return {
    width: lengthInPixels(attr("width")) ?? box?.width ?? null,
    height: lengthInPixels(attr("height")) ?? box?.height ?? null,
  };
}

/** The text of an SVG file, its BOM and leading white space gone; null when the bytes are not UTF-8. */
function svgText(bytes: Uint8Array): string | null {
  try {
    return new TextDecoder("utf-8", { fatal: true })
      .decode(bytes)
      .replace(/^\uFEFF/, "")
      .trimStart();
  } catch {
    return null;
  }
}

function sniffSvg(bytes: Uint8Array, maxBytes: number): SniffResult | null {
  const text = svgText(bytes);
  if (text === null) {
    // not UTF-8: refused as an unsafe SVG when it starts like one, else it is just not a file we take
    const head = new TextDecoder("utf-8")
      .decode(bytes.subarray(0, 512))
      .replace(/^\uFEFF/, "")
      .trimStart();
    return SVG_START.test(head)
      ? fail("unsafe-svg", "This SVG was refused because it is not UTF-8.")
      : null;
  }
  if (!SVG_START.test(text)) return null;
  // before the scan: its cost grows with the size
  if (bytes.length > maxBytes) {
    return fail(
      "file-too-large",
      `The SVG is larger than the ${maxBytes / 1_000_000} MB limit for SVG files.`
    );
  }
  if (!SVG_ROOT.test(text)) return corrupt("SVG image");
  const scan = scanSvg(text);
  if (scan.problem !== null)
    return fail("unsafe-svg", `This SVG was refused because ${scan.problem}.`);
  const { width, height } = svgSize(scan.root);
  return ok("svg", width, height);
}

// ---------------------------------------------------------------------------
// The entry point
// ---------------------------------------------------------------------------

/** The first bytes of a PDF, as MediaWiki's own detection reads them. */
const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46, 0x2d];

/**
 * What `bytes` is, from the bytes alone: one of the accepted kinds with its size, or why it is refused. An SVG over
 * `maxSvgBytes` is refused before it is scanned; the default is no limit of its own (a file already staged is not held to a
 * limit that changed since, and the 10 MB limit of every upload was applied where it came in).
 */
export function sniffFile(bytes: Uint8Array, maxSvgBytes = Infinity): SniffResult {
  if (bytes.length === 0) return fail("empty-file", "The file you submitted was empty.");
  if (startsWith(bytes, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return sniffPng(bytes);
  if (startsWith(bytes, 0xff, 0xd8, 0xff)) return sniffJpeg(bytes);
  if (ascii(bytes, 0, 6) === "GIF87a" || ascii(bytes, 0, 6) === "GIF89a") return sniffGif(bytes);
  if (ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WEBP") return sniffWebp(bytes);
  if (startsWith(bytes, ...PDF_MAGIC)) return ok("pdf", null, null);
  return (
    sniffSvg(bytes, maxSvgBytes) ??
    fail("filetype-badmime", "The file is not a PNG, JPEG, GIF, WebP, SVG or PDF file.")
  );
}
