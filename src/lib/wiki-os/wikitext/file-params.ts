/**
 * src/lib/wiki-os/wikitext/file-params.ts — the pipe parameters of `[[File:name|…]]`.
 *
 * MediaWiki gives every parameter that is not a display option (`thumb`, `200px`, `alt=…`, …) to
 * the caption, and the last such parameter wins. The editor keeps all parameters verbatim and only
 * replaces that one when the caption is edited.
 */

import { splitBalancedPipes } from "./parameter-parser";

const FILE_KEYWORDS = new Set([
  "thumb",
  "thumbnail",
  "frame",
  "framed",
  "frameless",
  "border",
  "left",
  "right",
  "center",
  "centre",
  "none",
  "baseline",
  "sub",
  "super",
  "top",
  "text-top",
  "middle",
  "bottom",
  "text-bottom",
  "upright",
  "muted",
  "loop",
  "autoplay",
]);

const FILE_KEYED_OPTION =
  /^(?:thumb|thumbnail|framed|frame|upright|alt|link|page|class|lang|lossy|start|end|thumbtime|gif)\s*=/i;
const FILE_SIZE = /^(?:\d+)?(?:x\d+)?\s*px$/i;

function isFileOption(param: string): boolean {
  const p = param.trim();
  return FILE_KEYWORDS.has(p.toLowerCase()) || FILE_KEYED_OPTION.test(p) || FILE_SIZE.test(p);
}

/** Index in `params` of the caption (the last parameter that is not an option), or -1 when there is none. */
export function fileCaptionIndex(params: readonly string[]): number {
  for (let i = params.length - 1; i >= 0; i--) {
    if (!isFileOption(params[i]!)) return i;
  }
  return -1;
}

export interface ParsedFileLink {
  /** The target as written, trimmed (`File:x.png`). */
  target: string;
  /** Every pipe parameter, verbatim. */
  params: string[];
  caption: string;
}

/** Splits the inside of `[[…]]` (without the brackets) into target, verbatim parameters and caption. */
export function parseFileLinkInner(inner: string): ParsedFileLink {
  const [target = "", ...params] = splitBalancedPipes(inner);
  const captionIndex = fileCaptionIndex(params);
  return {
    target: target.trim(),
    params,
    caption: captionIndex === -1 ? "" : params[captionIndex]!.trim(),
  };
}

/**
 * The wikitext of a file link whose caption is `caption`: the original parameters in their original
 * order, with only the caption parameter replaced (dropped when empty, appended when there was none).
 */
export function buildFileLink(target: string, params: readonly string[], caption: string): string {
  const next = [...params];
  const index = fileCaptionIndex(next);
  const text = caption.trim();
  if (index === -1) {
    if (text !== "") next.push(text);
  } else if (text === "") {
    next.splice(index, 1);
  } else if (next[index]!.trim() !== text) {
    next[index] = text;
  }
  return `[[${[target, ...next].join("|")}]]`;
}
