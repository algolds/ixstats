/**
 * Inline conversion between WikiAST and Plate leaves (split out of wiki-ast-converter.ts): links, file
 * links, marks, references and the void inlines the editor keeps as source.
 */

import { decodeTitleParam } from "../core/title";
import { buildFileLink } from "../wikitext/file-params";
import { wrapQuotes } from "../wikitext/quote-marks";
import { linkOuterMarks, markProps, voidInlineMarks } from "./plate-marks";
import { plateFingerprint } from "./plate-fingerprint";
import type { PlateNode } from "./plate-node";
import type { WikiInlineNode, WikiInlineMarks } from "../core/wiki-ast";

/**
 * Ensures that all inline nodes within a Slate block are surrounded by text nodes,
 * preserving Slate invariants and preventing caret placement crashes.
 */
export function ensureSlateInlineSurroundings(nodes: any[]): any[] {
  if (!nodes || nodes.length === 0) return [{ text: "" }];
  const result: any[] = [];
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    const isInline = Boolean(node && typeof node === "object" && "type" in node);
    if (i === 0 && isInline) {
      result.push({ text: "" });
    }
    result.push(node);
    if (isInline) {
      const nextNode = nodes[i + 1];
      const nextIsInline = Boolean(nextNode && typeof nextNode === "object" && "type" in nextNode);
      const isLast = i === nodes.length - 1;
      if (nextIsInline || isLast) {
        result.push({ text: "" });
      }
    }
  }
  return result;
}

/** The reader URL of a page; text that is not valid Unicode cannot be percent-encoded and is left as typed. */
function wikiLinkUrl(target: string): string {
  try {
    return `/wiki/${encodeURIComponent(target)}`;
  } catch {
    return `/wiki/${target}`;
  }
}

/** The bold/italic state of an inline construct, as properties (none when it is off). */
function inlineMarks(marks: WikiInlineMarks): { bold?: true; italic?: true } {
  return {
    ...(marks.bold ? { bold: true as const } : {}),
    ...(marks.italic ? { italic: true as const } : {}),
  };
}

/**
 * The label of a link as text leaves. Each leaf has the marks of its place in the label plus those
 * around the whole link (`outer`): marks live on leaves, so toggling one off removes it everywhere.
 */
function labelLeaves(
  children: WikiInlineNode[] | undefined,
  fallback: string,
  outer: WikiInlineMarks
): Array<{ text: string; bold?: true; italic?: true }> {
  const leaves = (children ?? []).flatMap((child) =>
    "type" in child
      ? []
      : [
          {
            text: child.text,
            ...inlineMarks({
              bold: outer.bold || child.bold,
              italic: outer.italic || child.italic,
            }),
          },
        ]
  );
  return leaves.length > 0 ? leaves : [{ text: fallback, ...inlineMarks(outer) }];
}

/** The one child leaf of a void inline element; the marks around the element sit on it. */
const voidLeaf = (
  marks: WikiInlineMarks,
  text = ""
): { text: string; bold?: true; italic?: true } => ({
  text,
  ...inlineMarks(marks),
});

/** Keeps the construct's source text on its element, valid while the element's content is unchanged. */
export function keepSource(
  el: PlateNode,
  raw: string | undefined,
  outer?: WikiInlineMarks
): PlateNode {
  if (raw !== undefined) {
    el.wikiRaw = raw;
    if (outer) el.wikiOuter = markProps(outer);
    el.wikiFp = plateFingerprint(el);
  }
  return el;
}

export function astInlinesToPlateLeaves(inlines?: WikiInlineNode[]): any[] {
  if (!inlines || inlines.length === 0) {
    return [{ text: "" }];
  }

  const leaves: any[] = [];

  for (const inline of inlines) {
    if (!("type" in inline) || (inline as any).type === "text") {
      leaves.push({
        text: (inline as any).text ?? "",
        bold: (inline as any).bold,
        italic: (inline as any).italic,
        code: (inline as any).code,
        strikethrough: (inline as any).strikethrough,
        underline: (inline as any).underline,
        superscript: (inline as any).superscript,
        subscript: (inline as any).subscript,
      });
    } else {
      switch (inline.type) {
        case "wiki-link":
          leaves.push(
            keepSource(
              {
                type: "link",
                url: wikiLinkUrl(inline.target),
                target: inline.target,
                internal: true,
                children: labelLeaves(inline.children, inline.label || inline.target, inline),
              },
              inline.raw,
              inline
            )
          );
          break;
        case "wiki-file":
          leaves.push(
            keepSource(
              {
                type: "wiki-file",
                target: inline.target,
                fileParams: inline.params,
                caption: inline.caption,
                children: [voidLeaf(inline)],
              },
              inline.raw
            )
          );
          break;
        case "external-link": {
          const firstChild = inline.children?.[0];
          const textVal =
            firstChild && "text" in firstChild && typeof firstChild.text === "string"
              ? firstChild.text
              : inline.url;
          leaves.push(
            keepSource(
              {
                type: "link",
                url: inline.url,
                internal: false,
                children: labelLeaves(inline.children, textVal, inline),
              },
              inline.raw,
              inline
            )
          );
          break;
        }
        case "chip-coord":
          leaves.push({
            type: "chip-coord",
            lat: inline.lat,
            lng: inline.lng,
            label: inline.label,
            wikitext: inline.wikitext,
            children: [voidLeaf(inline)],
          });
          break;
        case "chip-engine-data":
          leaves.push({
            type: "chip-engine",
            connector: inline.connector,
            slug: inline.slug,
            metric: inline.metric,
            wikitext: inline.wikitext,
            children: [voidLeaf(inline)],
          });
          break;
        case "citation-ref": {
          const firstChild = inline.children?.[0];
          const textVal =
            firstChild && "text" in firstChild && typeof firstChild.text === "string"
              ? firstChild.text
              : "";
          leaves.push({
            type: "citation-ref",
            name: inline.name,
            rawWikitext: inline.rawWikitext,
            children: [voidLeaf(inline, textVal)],
          });
          break;
        }
        case "inline-template":
          leaves.push({
            type: "chip-template",
            templateName: inline.templateName || inline.name,
            params: inline.params || {},
            paramList: inline.paramList || [],
            positional: inline.positional || [],
            rawWikitext: inline.raw || inline.rawWikitext,
            children: [voidLeaf(inline)],
          });
          break;
      }
    }
  }

  if (leaves.length === 0) {
    leaves.push({ text: "" });
  }

  return ensureSlateInlineSurroundings(leaves);
}

export function plateLeavesToAstInlines(leaves?: any[]): WikiInlineNode[] {
  if (!leaves || leaves.length === 0) {
    return [{ text: "" }];
  }

  const inlines: WikiInlineNode[] = [];

  for (const leaf of leaves) {
    if (typeof leaf.text === "string") {
      inlines.push({
        text: leaf.text,
        bold: leaf.bold,
        italic: leaf.italic,
        code: leaf.code || leaf.codeMark,
        strikethrough: leaf.strikethrough || leaf.strike,
        underline: leaf.underline,
        superscript: leaf.superscript || leaf.sup,
        subscript: leaf.subscript || leaf.sub,
      });
    } else if (leaf.type === "a" || leaf.type === "link") {
      const isInternal =
        leaf.internal ?? Boolean(leaf.target || (leaf.url ? !/^https?:/i.test(leaf.url) : true));
      const target =
        leaf.target ||
        (leaf.url ? decodeTitleParam(leaf.url.replace(/^\/wiki\//, "").replace(/_/g, " ")) : "");
      // The label as wikitext: its text leaves with the quote marks they carry beyond those around the link.
      const around = linkOuterMarks(leaf);
      const labelText = (leaf.children ?? [])
        .map((child: any) =>
          wrapQuotes(
            child.text ?? "",
            Boolean(child.bold) && !around.bold,
            Boolean(child.italic) && !around.italic
          )
        )
        .join("");
      const label = labelText || target;
      const marks = markProps(around);
      if (isInternal && target) {
        inlines.push({
          type: "wiki-link",
          target,
          label: label !== target ? label : undefined,
          ...marks,
          children: [{ text: label }],
        });
      } else {
        inlines.push({
          type: "external-link",
          url: leaf.url || "",
          ...marks,
          children: [{ text: labelText || leaf.url || "" }],
        });
      }
    } else if (leaf.type === "wiki-file") {
      inlines.push({
        type: "wiki-file",
        target: leaf.target || "",
        params: leaf.fileParams || [],
        caption: leaf.caption || "",
        raw: buildFileLink(leaf.target || "", leaf.fileParams || [], leaf.caption || ""),
        ...markProps(voidInlineMarks(leaf)),
        children: [{ text: "" }],
      });
    } else if (leaf.type === "chip-coord") {
      inlines.push({
        type: "chip-coord",
        lat: leaf.lat,
        lng: leaf.lng,
        label: leaf.label,
        wikitext: leaf.wikitext,
        ...markProps(voidInlineMarks(leaf)),
        children: [{ text: "" }],
      });
    } else if (leaf.type === "chip-engine") {
      inlines.push({
        type: "chip-engine-data",
        connector: leaf.connector || "CountryData",
        slug: leaf.slug || "",
        metric: leaf.metric || "",
        wikitext: leaf.wikitext,
        ...markProps(voidInlineMarks(leaf)),
        children: [{ text: "" }],
      });
    } else if (leaf.type === "citation-ref") {
      inlines.push({
        type: "citation-ref",
        name: leaf.name,
        rawWikitext: leaf.rawWikitext,
        ...markProps(voidInlineMarks(leaf)),
        children: [{ text: leaf.children?.[0]?.text || "" }],
      });
    } else if (leaf.type === "chip-template" || leaf.type === "inline-template") {
      inlines.push({
        type: "inline-template",
        templateName: leaf.templateName || leaf.name || "template",
        name: leaf.templateName || leaf.name || "template",
        params: leaf.params || {},
        paramList: leaf.paramList,
        positional: leaf.positional,
        raw: leaf.rawWikitext || "",
        rawWikitext: leaf.rawWikitext,
        ...markProps(voidInlineMarks(leaf)),
        children: [{ text: "" }],
      });
    }
  }

  if (inlines.length === 0) {
    inlines.push({ text: "" });
  }

  return inlines;
}
