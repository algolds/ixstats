/**
 * src/lib/wiki-os/wikitext/link-parser.ts — MediaWiki Link & Media Tokenizer.
 */

import { splitBalancedPipes, parseParameterList } from "./parameter-parser";
import { classifyTemplate } from "./resolver";
import type {
  WikiInlineNode,
  // oxlint-disable-next-line typescript/no-unused-vars
  WikiExternalLinkInline,
  // oxlint-disable-next-line typescript/no-unused-vars
  EngineDataChipInline,
  // oxlint-disable-next-line typescript/no-unused-vars
  MediaBlock,
  WikiInlineTemplateNode,
} from "./types";

export interface ParsedMediaLink {
  filename: string;
  caption?: string;
  align?: "left" | "center" | "right" | "thumb" | "frameless";
  width?: number;
  height?: number;
  raw: string;
}

/**
 * Finds the index of the matching closing "]]" for a "[[" starting at startIndex.
 * Balances nested "[[" and "]]" pairs so that media captions with wikilinks like
 * [[File:Flag.png|thumb|Flag of [[Urcea]]]] are captured in their entirety.
 */
export function findMatchingClosingBrackets(text: string, startIndex: number): number {
  if (!text.startsWith("[[", startIndex)) return -1;
  let depth = 0;
  let inComment = false;
  let j = startIndex;
  while (j < text.length) {
    if (!inComment && text.startsWith("<!--", j)) {
      inComment = true;
      j += 4;
      continue;
    }
    if (inComment) {
      if (text.startsWith("-->", j)) {
        inComment = false;
        j += 3;
        continue;
      }
      j++;
      continue;
    }
    if (text.startsWith("[[", j)) {
      depth++;
      j += 2;
      continue;
    }
    if (text.startsWith("]]", j)) {
      depth--;
      if (depth === 0) {
        return j;
      }
      j += 2;
      continue;
    }
    j++;
  }
  return -1;
}

/**
 * Finds the index of the matching closing "}}" for a "{{" starting at startIndex.
 * Balances nested braces, wikilinks, and comments.
 */
export function findMatchingClosingBraces(text: string, startIndex: number): number {
  if (!text.startsWith("{{", startIndex)) return -1;
  let depth = 0;
  let linkDepth = 0;
  let inComment = false;
  let j = startIndex;
  while (j < text.length) {
    if (!inComment && text.startsWith("<!--", j)) {
      inComment = true;
      j += 4;
      continue;
    }
    if (inComment) {
      if (text.startsWith("-->", j)) {
        inComment = false;
        j += 3;
        continue;
      }
      j++;
      continue;
    }
    if (text.startsWith("[[", j)) {
      linkDepth++;
      j += 2;
      continue;
    }
    if (text.startsWith("]]", j)) {
      linkDepth = Math.max(0, linkDepth - 1);
      j += 2;
      continue;
    }
    if (text.startsWith("{{", j)) {
      depth++;
      j += 2;
      continue;
    }
    if (text.startsWith("}}", j)) {
      depth--;
      if (depth === 0) {
        return j;
      }
      j += 2;
      continue;
    }
    j++;
  }
  return -1;
}

export function parseMediaLink(raw: string): ParsedMediaLink | null {
  const trimmed = raw.trim();
  if (!/^\[\[(File|Image):/i.test(trimmed) || !trimmed.endsWith("]]")) {
    return null;
  }

  const content = trimmed.slice(2, -2);
  const parts = splitBalancedPipes(content).map((p) => p.trim());
  if (parts.length === 0) return null;

  const colonIdx = parts[0]!.indexOf(":");
  if (colonIdx === -1) return null;
  const filename = parts[0]!.slice(colonIdx + 1).trim();

  let caption: string | undefined;
  let align: ParsedMediaLink["align"] = "thumb";
  let width: number | undefined;
  let height: number | undefined;

  for (let i = 1; i < parts.length; i++) {
    const part = parts[i]!;
    if (/^(left|right|center|none)$/i.test(part)) {
      align = part.toLowerCase() as ParsedMediaLink["align"];
    } else if (/^(thumb|thumbnail|frameless|frame)$/i.test(part)) {
      align = "thumb";
    } else if (/^(\d+)px$/i.test(part)) {
      width = parseInt(part, 10);
    } else if (/^(\d+)x(\d+)px$/i.test(part)) {
      const dim = /^(\d+)x(\d+)px$/i.exec(part);
      if (dim) {
        width = parseInt(dim[1]!, 10);
        height = parseInt(dim[2]!, 10);
      }
    } else {
      caption = part;
    }
  }

  return { filename, caption, align, width, height, raw };
}

export function parseInlineLinksAndFormatting(text: string): WikiInlineNode[] {
  const nodes: WikiInlineNode[] = [];
  let i = 0;

  while (i < text.length) {
    // 1. Media: [[File:...]] or [[Image:...]]
    if (text.startsWith("[[File:", i) || text.startsWith("[[Image:", i)) {
      const closeIdx = findMatchingClosingBrackets(text, i);
      if (closeIdx !== -1) {
        const raw = text.slice(i, closeIdx + 2);
        const media = parseMediaLink(raw);
        if (media) {
          nodes.push({
            type: "wiki-link",
            target: `File:${media.filename}`,
            label: media.caption || media.filename,
            children: [{ text: media.caption || media.filename }],
          });
          i = closeIdx + 2;
          continue;
        }
      }
    }

    // 2. Engine Data Chips: [[CountryData:slug|metric]]
    if (
      text.startsWith("[[CountryData:", i) ||
      text.startsWith("[[BusinessData:", i) ||
      text.startsWith("[[DefenseData:", i)
    ) {
      const closeIdx = findMatchingClosingBrackets(text, i);
      if (closeIdx !== -1) {
        const raw = text.slice(i, closeIdx + 2);
        const inner = raw.slice(2, -2);
        const colonIdx = inner.indexOf(":");
        const pipeIdx = inner.indexOf("|");
        const connector = inner.slice(0, colonIdx) as
          "CountryData" | "BusinessData" | "DefenseData";
        const slug =
          pipeIdx !== -1 ? inner.slice(colonIdx + 1, pipeIdx) : inner.slice(colonIdx + 1);
        const metric = pipeIdx !== -1 ? inner.slice(pipeIdx + 1) : "name";

        nodes.push({
          type: "chip-engine-data",
          connector,
          slug,
          metric,
          wikitext: raw,
          children: [{ text: "" }],
        });
        i = closeIdx + 2;
        continue;
      }
    }

    // 3. Coordinate Chips: [[Coords:lat,lng|label]] or [[Coord:...]]
    if (text.startsWith("[[Coords:", i) || text.startsWith("[[Coord:", i)) {
      const closeIdx = findMatchingClosingBrackets(text, i);
      if (closeIdx !== -1) {
        const raw = text.slice(i, closeIdx + 2);
        const inner = raw.slice(2, -2);
        const colonIdx = inner.indexOf(":");
        const pipeIdx = inner.indexOf("|");
        const coords =
          pipeIdx !== -1 ? inner.slice(colonIdx + 1, pipeIdx) : inner.slice(colonIdx + 1);
        const label = pipeIdx !== -1 ? inner.slice(pipeIdx + 1) : undefined;
        const [latStr, lngStr] = coords.split(",");
        const lat = latStr ? parseFloat(latStr) : undefined;
        const lng = lngStr ? parseFloat(lngStr) : undefined;

        nodes.push({
          type: "chip-coord",
          lat,
          lng,
          label: label || coords,
          wikitext: raw,
          children: [{ text: "" }],
        });
        i = closeIdx + 2;
        continue;
      }
    }

    // 4. Standard Wiki Link: [[Target|Label]] or [[Target]]
    if (text.startsWith("[[", i)) {
      const closeIdx = findMatchingClosingBrackets(text, i);
      if (closeIdx !== -1) {
        const raw = text.slice(i + 2, closeIdx);
        const pipeIdx = raw.indexOf("|");
        const target = pipeIdx !== -1 ? raw.slice(0, pipeIdx).trim() : raw.trim();
        const label = pipeIdx !== -1 ? raw.slice(pipeIdx + 1).trim() : target;

        nodes.push({
          type: "wiki-link",
          target,
          label: label !== target ? label : undefined,
          children: [{ text: label }],
        });
        i = closeIdx + 2;
        continue;
      }
    }

    // 5. External Link: [URL Title] or [URL]
    if (text.startsWith("[", i) && !text.startsWith("[[", i)) {
      const closeIdx = text.indexOf("]", i);
      if (closeIdx !== -1 && /^https?:\/\//i.test(text.slice(i + 1))) {
        const inner = text.slice(i + 1, closeIdx).trim();
        const spaceIdx = inner.indexOf(" ");
        const url = spaceIdx !== -1 ? inner.slice(0, spaceIdx) : inner;
        const label = spaceIdx !== -1 ? inner.slice(spaceIdx + 1) : url;

        nodes.push({
          type: "external-link",
          url,
          children: [{ text: label }],
        });
        i = closeIdx + 1;
        continue;
      }
    }

    // 6. Citations: <ref>...</ref> or <ref name="foo" />
    if (text.startsWith("<ref", i)) {
      const closeTagIdx = text.indexOf("</ref>", i);
      const selfCloseIdx = text.indexOf("/>", i);
      if (closeTagIdx !== -1 && (selfCloseIdx === -1 || closeTagIdx < selfCloseIdx)) {
        const rawRef = text.slice(i, closeTagIdx + 6);
        const openTagEnd = rawRef.indexOf(">");
        const openTag = rawRef.slice(0, openTagEnd);
        const nameMatch = /name=["']([^"']+)["']/i.exec(openTag);
        const refContent = rawRef.slice(openTagEnd + 1, -6);

        nodes.push({
          type: "citation-ref",
          name: nameMatch ? nameMatch[1] : undefined,
          rawWikitext: rawRef,
          children: [{ text: refContent }],
        });
        i = closeTagIdx + 6;
        continue;
      } else if (
        selfCloseIdx !== -1 &&
        selfCloseIdx < (closeTagIdx === -1 ? Infinity : closeTagIdx)
      ) {
        const rawRef = text.slice(i, selfCloseIdx + 2);
        const nameMatch = /name=["']([^"']+)["']/i.exec(rawRef);

        nodes.push({
          type: "citation-ref",
          name: nameMatch ? nameMatch[1] : undefined,
          rawWikitext: rawRef,
          children: [{ text: "" }],
        });
        i = selfCloseIdx + 2;
        continue;
      }
    }

    // 7. Inline Templates & Chips: {{TemplateName|...}}
    if (text.startsWith("{{", i)) {
      const closeIdx = findMatchingClosingBraces(text, i);
      if (closeIdx !== -1) {
        const raw = text.slice(i, closeIdx + 2);
        const inner = text.slice(i + 2, closeIdx);
        const parts = splitBalancedPipes(inner);
        if (parts.length > 0) {
          const rawHead = parts[0]?.trim() ?? "";
          if (rawHead) {
            const { params, paramList, positional } = parseParameterList(parts);
            const classification = classifyTemplate(rawHead, params);

            if (classification === "chip-coord") {
              const [latStr, lngStr] = (positional[0] || "").split(",");
              const lat = latStr ? parseFloat(latStr) : undefined;
              const lng = lngStr ? parseFloat(lngStr) : undefined;
              nodes.push({
                type: "chip-coord",
                lat,
                lng,
                label: positional[1] || positional[0],
                wikitext: raw,
                children: [{ text: "" }],
              });
            } else if (classification === "chip-engine") {
              nodes.push({
                type: "chip-engine-data",
                connector: "CountryData",
                slug: positional[0] || "",
                metric: positional[1] || "name",
                wikitext: raw,
                children: [{ text: "" }],
              });
            } else {
              nodes.push({
                type: "inline-template",
                templateName: rawHead,
                name: rawHead,
                params,
                paramList,
                positional,
                raw,
                rawWikitext: raw,
                children: [{ text: "" }],
              });
            }
            i = closeIdx + 2;
            continue;
          }
        }
      }
    }

    // 8. Regular text chunk up to next special syntax
    let nextSpecial = text.length;
    const candidates = [
      text.indexOf("[[", i),
      text.indexOf("[", i),
      text.indexOf("<ref", i),
      text.indexOf("{{", i),
      text.indexOf("'''", i),
      text.indexOf("''", i),
    ].filter((pos) => pos > i);

    if (candidates.length > 0) {
      nextSpecial = Math.min(...candidates);
    }

    const chunk = text.slice(i, nextSpecial);
    if (chunk) {
      // Parse bold/italic marks inside chunk
      parseFormattedText(chunk, nodes);
    }
    i = nextSpecial;
  }

  if (nodes.length === 0) {
    nodes.push({ text: "" });
  }

  return nodes;
}

function parseFormattedText(text: string, nodes: WikiInlineNode[]): void {
  // Simple regex tokenizer for bold (''') and italic ('')
  const tokenRegex = /('''''|'''|'')/g;
  let lastIndex = 0;
  let bold = false;
  let italic = false;
  let m;

  while ((m = tokenRegex.exec(text)) !== null) {
    const rawMatch = m[0];
    const matchStart = m.index;

    if (matchStart > lastIndex) {
      const slice = text.slice(lastIndex, matchStart);
      nodes.push({
        text: slice,
        ...(bold ? { bold: true } : {}),
        ...(italic ? { italic: true } : {}),
      });
    }

    if (rawMatch === "'''''") {
      bold = !bold;
      italic = !italic;
    } else if (rawMatch === "'''") {
      bold = !bold;
    } else if (rawMatch === "''") {
      italic = !italic;
    }

    lastIndex = matchStart + rawMatch.length;
  }

  if (lastIndex < text.length) {
    const slice = text.slice(lastIndex);
    nodes.push({
      text: slice,
      ...(bold ? { bold: true } : {}),
      ...(italic ? { italic: true } : {}),
    });
  }
}
