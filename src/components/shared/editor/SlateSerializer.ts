// src/components/shared/editor/SlateSerializer.ts
// Serializer for Slate AST to HTML, Slate AST to BBCode, and Parsoid HTML to Slate.

import { Editor, Transforms } from "slate";

export function escapeAttr(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function serializeLeaf(node: any): string {
  let text: string = (node.text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  if (!text) return "";
  if (node.bold) text = `<strong>${text}</strong>`;
  if (node.italic) text = `<em>${text}</em>`;
  if (node.underline) text = `<u>${text}</u>`;
  return text;
}

export function serializeNode(node: any): string {
  if (typeof node.text === "string") {
    return serializeLeaf(node);
  }

  const children: string = (node.children || []).map((c: any) => serializeNode(c)).join("");

  switch (node.type) {
    case "wikiembed":
      return `<div data-wikiembed="true" data-title="${escapeAttr(node.title || "")}" data-summary="${escapeAttr(node.summary || "")}" data-imageurl="${escapeAttr(node.imageUrl || "")}" data-source="${escapeAttr(node.source || "ixwiki")}"></div>`;
    case "wikilink":
      return `<a href="/wiki/${encodeURIComponent((node.target || "").replace(/ /g, "_"))}">${children}</a>`;
    case "link":
      return `<a href="${escapeAttr(node.url || "")}" target="_blank" rel="noopener noreferrer">${children}</a>`;
    case "img":
      return `<img src="${escapeAttr(node.src || "")}" alt="${escapeAttr(node.alt || "")}" />`;
    case "ul":
      return `<ul>${children}</ul>`;
    case "ol":
      return `<ol>${children}</ol>`;
    case "li":
      return `<li>${children}</li>`;
    case "p":
    default:
      return `<p>${children}</p>`;
  }
}

export function slateNodesToHtml(nodes: any[]): string {
  return nodes.map((n: any) => serializeNode(n)).join("");
}

export function serializeNodeToBbcode(node: any): string {
  if (typeof node.text === "string") {
    let text = node.text ?? "";
    if (!text) return "";
    if (node.bold) text = `[B]${text}[/B]`;
    if (node.italic) text = `[I]${text}[/I]`;
    if (node.underline) text = `[U]${text}[/U]`;
    return text;
  }

  const children: string = (node.children || []).map((c: any) => serializeNodeToBbcode(c)).join("");

  switch (node.type) {
    case "wikiembed":
      return `\n[QUOTE="${node.title || "Wiki"}"]${node.summary || ""}\n${node.imageUrl ? `[IMG]${node.imageUrl}[/IMG]\n` : ""}[URL=/wiki/${encodeURIComponent((node.title || "").replace(/ /g, "_"))}]Read on Wiki[/URL][/QUOTE]\n`;
    case "wikilink":
      return `[URL=/wiki/${encodeURIComponent((node.target || "").replace(/ /g, "_"))}]${children || node.target}[/URL]`;
    case "link":
      return `[URL=${node.url || ""}]${children || node.url}[/URL]`;
    case "img":
      return `[IMG]${node.src || ""}[/IMG]`;
    case "ul":
      return `\n[LIST]\n${children}[/LIST]\n`;
    case "ol":
      return `\n[LIST=1]\n${children}[/LIST]\n`;
    case "li":
      return `[*]${children}\n`;
    case "p":
    default:
      return `${children}\n\n`;
  }
}

export function slateNodesToBbcode(nodes: any[]): string {
  return nodes
    .map((n: any) => serializeNodeToBbcode(n))
    .join("")
    .trim();
}

export function parsoidHtmlToSlate(htmlContent: string): any[] {
  if (!htmlContent || !htmlContent.trim()) {
    return [{ type: "p", children: [{ text: "" }] }];
  }
  if (typeof window === "undefined") {
    return [{ type: "p", children: [{ text: htmlContent }] }];
  }

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(`<div>${htmlContent}</div>`, "text/html");
    const root = doc.body.firstElementChild;
    if (!root) return [{ type: "p", children: [{ text: "" }] }];

    const deserializeNode = (el: Node): any[] => {
      const result: any[] = [];
      if (!el || !el.childNodes) return [];
      const childrenArray = Array.from(el.childNodes || []);
      for (const child of childrenArray) {
        if (!child) continue;
        if (child.nodeType === Node.TEXT_NODE) {
          const txt = child.textContent ?? "";
          if (txt) result.push({ text: txt });
          continue;
        }
        if (child.nodeType !== Node.ELEMENT_NODE) continue;

        const elem = child as HTMLElement;
        const tag = elem.tagName.toLowerCase();

        if (elem.getAttribute("data-wikiembed") === "true") {
          result.push({
            type: "wikiembed",
            title: elem.getAttribute("data-title") || "",
            summary: elem.getAttribute("data-summary") || "",
            imageUrl: elem.getAttribute("data-imageurl") || "",
            source: elem.getAttribute("data-source") || "ixwiki",
            children: [{ text: "" }],
          });
          continue;
        }

        if (tag === "p") {
          const children = deserializeNode(elem);
          result.push({
            type: "p",
            children: children.length > 0 ? children : [{ text: "" }],
          });
          continue;
        }
        if (tag === "strong" || tag === "b") {
          const inner = deserializeNode(elem);
          inner.forEach((n: any) => {
            if ("text" in n) n.bold = true;
          });
          result.push(...(inner.length > 0 ? inner : [{ text: "", bold: true }]));
          continue;
        }
        if (tag === "em" || tag === "i") {
          const inner = deserializeNode(elem);
          inner.forEach((n: any) => {
            if ("text" in n) n.italic = true;
          });
          result.push(...(inner.length > 0 ? inner : [{ text: "", italic: true }]));
          continue;
        }
        if (tag === "u" || elem.style.textDecoration === "underline") {
          const inner = deserializeNode(elem);
          inner.forEach((n: any) => {
            if ("text" in n) n.underline = true;
          });
          result.push(...(inner.length > 0 ? inner : [{ text: "", underline: true }]));
          continue;
        }
        if (tag === "ul") {
          const children = deserializeNode(elem);
          result.push({
            type: "ul",
            children: children.length > 0 ? children : [{ type: "li", children: [{ text: "" }] }],
          });
          continue;
        }
        if (tag === "ol") {
          const children = deserializeNode(elem);
          result.push({
            type: "ol",
            children: children.length > 0 ? children : [{ type: "li", children: [{ text: "" }] }],
          });
          continue;
        }
        if (tag === "li") {
          const children = deserializeNode(elem);
          result.push({
            type: "li",
            children: children.length > 0 ? children : [{ text: "" }],
          });
          continue;
        }
        if (tag === "a") {
          const href = elem.getAttribute("href") || "";
          const children = deserializeNode(elem);
          const validChildren = children.length > 0 ? children : [{ text: href || "link" }];
          if (href.startsWith("/wiki/")) {
            const target = decodeURIComponent(href.replace("/wiki/", "")).replace(/_/g, " ");
            result.push({
              type: "wikilink",
              target,
              children: validChildren,
            });
          } else {
            result.push({
              type: "link",
              url: href,
              children: validChildren,
            });
          }
          continue;
        }
        if (tag === "img") {
          result.push({
            type: "img",
            src: elem.getAttribute("src") || "",
            alt: elem.getAttribute("alt") || "",
            children: [{ text: "" }],
          });
          continue;
        }
        result.push(...deserializeNode(elem));
      }
      return result;
    };

    const res = deserializeNode(root);

    // CRITICAL: Top-level Slate nodes MUST all be Block Elements with children!
    // If res has text leaves or inlines at the top level, group/wrap them in <p>
    const normalizedBlocks: any[] = [];
    let currentInlineChildren: any[] = [];

    for (const node of res) {
      if (
        node.type === "p" ||
        node.type === "ul" ||
        node.type === "ol" ||
        node.type === "wikiembed" ||
        node.type === "img"
      ) {
        if (currentInlineChildren.length > 0) {
          normalizedBlocks.push({ type: "p", children: currentInlineChildren });
          currentInlineChildren = [];
        }
        normalizedBlocks.push(node);
      } else {
        currentInlineChildren.push(node);
      }
    }

    if (currentInlineChildren.length > 0) {
      normalizedBlocks.push({ type: "p", children: currentInlineChildren });
    }

    if (normalizedBlocks.length === 0) {
      return [{ type: "p", children: [{ text: "" }] }];
    }

    // Ensure every block node has a valid non-empty children array
    return normalizedBlocks.map((block) => {
      if (!Array.isArray(block.children) || block.children.length === 0) {
        return { ...block, children: [{ text: "" }] };
      }
      return block;
    });
  } catch (err) {
    console.warn("Failed to parse parsoid HTML to Slate:", err);
    return [{ type: "p", children: [{ text: "" }] }];
  }
}

export function isMarkActive(editor: any, mark: string): boolean {
  try {
    const marks = Editor.marks(editor);
    return marks ? (marks as any)[mark] === true : false;
  } catch {
    return false;
  }
}

export function toggleMark(editor: any, mark: string) {
  const isActive = isMarkActive(editor, mark);
  if (isActive) {
    Editor.removeMark(editor, mark);
  } else {
    Editor.addMark(editor, mark, true);
  }
}

export function isBlockActive(editor: any, type: string): boolean {
  try {
    const [match] = Editor.nodes(editor, {
      match: (n: any) => n.type === type,
    });
    return !!match;
  } catch {
    return false;
  }
}

export function toggleBlock(editor: any, type: string) {
  const isActive = isBlockActive(editor, type);

  if (isActive) {
    Transforms.unwrapNodes(editor, {
      match: (n: any) => n.type === "ul" || n.type === "ol",
      split: true,
    });
    Transforms.setNodes(editor, { type: "p" } as any);
  } else {
    Transforms.unwrapNodes(editor, {
      match: (n: any) => n.type === "ul" || n.type === "ol",
      split: true,
    });
    Transforms.setNodes(editor, { type: "li" } as any);
    const wrapper = { type, children: [] };
    Transforms.wrapNodes(editor, wrapper as any, {
      match: (n: any) => n.type === "li",
    });
  }
}

export function detectWikiUrl(
  url: string
): { title: string; source: "ixwiki" | "iiwiki" | "althistory" } | null {
  if (!url) return null;
  const iiwikiMatch = url.match(/iiwiki\.com\/wiki\/([^#?]+)/i);
  if (iiwikiMatch && iiwikiMatch[1]) {
    return { title: decodeURIComponent(iiwikiMatch[1].replace(/_/g, " ")), source: "iiwiki" };
  }
  const altMatch = url.match(/althistory\.fandom\.com\/wiki\/([^#?]+)/i);
  if (altMatch && altMatch[1]) {
    return { title: decodeURIComponent(altMatch[1].replace(/_/g, " ")), source: "althistory" };
  }
  const generalMatch = url.match(/(?:ixwiki\.com)?\/wiki\/([^#?]+)/i);
  if (generalMatch && generalMatch[1]) {
    return { title: decodeURIComponent(generalMatch[1].replace(/_/g, " ")), source: "ixwiki" };
  }
  if (url.startsWith("wiki/")) {
    return { title: decodeURIComponent(url.substring(5).replace(/_/g, " ")), source: "ixwiki" };
  }
  return null;
}
