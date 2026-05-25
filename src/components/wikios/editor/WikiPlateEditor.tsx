// src/components/wikios/editor/WikiPlateEditor.tsx
// PlateJS visual editor for wiki articles.
// Parses Parsoid HTML into editable Slate nodes. Preserves data-mw for roundtrip.

"use client";

import { useMemo, useCallback, useRef, useEffect, useState } from "react";
import {
  Plate,
  PlateContent,
  createPlateEditor,
  createPlatePlugin,
  ParagraphPlugin,
} from "platejs/react";
import { Transforms, Editor } from "slate";
import type { HTMLAttributes, ReactNode } from "react";

interface RenderNodeProps {
  children: ReactNode;
  element?: Record<string, unknown>;
  attributes?: HTMLAttributes<HTMLElement>;
}

// Custom Slate node type with flexible properties for wiki content
type WikiNode =
  | { children: WikiNode[]; [key: string]: unknown }
  | { text: string; [key: string]: unknown };
type WikiDescendant = WikiNode;
import {
  Bold,
  Italic,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Image as ImageIcon,
  Puzzle,
  Eye,
} from "lucide-react";
import { cn } from "~/lib/utils";
import { TemplateInserter } from "~/components/wikios/editor/TemplateInserter";
import { api } from "~/trpc/react";

// ---------------------------------------------------------------------------
// Custom plugins for Parsoid HTML elements
// ---------------------------------------------------------------------------

const HeadingPlugin = createPlatePlugin({
  key: "heading",
  node: { isElement: true },
  render: {
    node: ({ children, element, attributes }: RenderNodeProps) => {
      const level = element.level ?? 2;
      const Tag = `h${Math.min(Math.max(level, 1), 6)}` as keyof JSX.IntrinsicElements;
      return (
        <Tag {...attributes} style={{ marginTop: 24, marginBottom: 8 }}>
          {children}
        </Tag>
      );
    },
  },
});

const BlockquotePlugin = createPlatePlugin({
  key: "blockquote",
  node: { isElement: true },
  render: {
    node: ({ children, attributes }: RenderNodeProps) => (
      <blockquote
        {...attributes}
        style={{
          borderLeft: "3px solid #3b82f6",
          paddingLeft: 16,
          margin: "12px 0",
          color: "#a1a1aa",
        }}
      >
        {children}
      </blockquote>
    ),
  },
});

const ImagePlugin = createPlatePlugin({
  key: "img",
  node: { isElement: true, isVoid: true },
  render: {
    node: ({ element, attributes, children }: RenderNodeProps) => (
      <div {...attributes} contentEditable={false} style={{ margin: "8px 0" }}>
        <img
          src={element.src}
          alt={element.alt ?? ""}
          style={{ maxWidth: "100%", height: "auto", borderRadius: 4 }}
          referrerPolicy="no-referrer"
        />
        {children}
      </div>
    ),
  },
});

// Template transclusion — enhanced with parameter display + preview
const TemplatePlugin = createPlatePlugin({
  key: "template",
  node: { isElement: true, isVoid: true },
  render: {
    node: ({ element, attributes, children }: RenderNodeProps) => (
      <TemplateBlock element={element} attributes={attributes}>
        {children}
      </TemplateBlock>
    ),
  },
});

function TemplateBlock({ element, attributes, children }: RenderNodeProps) {
  const [showPreview, setShowPreview] = useState(false);
  const templateName = element.templateName ?? "Template";

  // Parse parameters from dataMw if available
  let params: Record<string, string> = {};
  try {
    const parsed = JSON.parse(element.dataMw ?? "{}");
    const tmplParams = parsed.parts?.[0]?.template?.params;
    if (tmplParams) {
      params = Object.fromEntries(
        Object.entries(tmplParams).map(([k, v]: [string, any]) => [k, v.wt ?? String(v)])
      );
    }
  } catch {
    /* ignore */
  }

  const paramEntries = Object.entries(params).slice(0, 8);
  const hasMoreParams = Object.keys(params).length > 8;

  const previewQuery = api.wikios.getTemplatePreview.useQuery(
    { name: templateName.replace(/^Template:/, ""), params },
    { enabled: showPreview, staleTime: 300000 }
  );

  return (
    <div {...attributes} contentEditable={false} className="wikios-template-block">
      <div className="wikios-template-block-header">
        <span className="wikios-template-block-badge">
          <Puzzle size={10} />
          {templateName}
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowPreview(!showPreview);
          }}
          className="wikios-template-block-preview-btn"
          title={showPreview ? "Hide preview" : "Show preview"}
        >
          <Eye size={11} />
          {showPreview ? "Hide" : "Preview"}
        </button>
      </div>
      {paramEntries.length > 0 && !showPreview && (
        <div className="wikios-template-block-params">
          {paramEntries.map(([k, v]) => (
            <div key={k} className="wikios-template-block-param">
              <span className="wikios-template-block-key">{k}</span>
              <span className="wikios-template-block-val">{String(v).slice(0, 60)}</span>
            </div>
          ))}
          {hasMoreParams && (
            <div className="wikios-template-block-more">+{Object.keys(params).length - 8} more</div>
          )}
        </div>
      )}
      {showPreview && previewQuery.data && (
        <div
          className="wikios-template-block-rendered"
          dangerouslySetInnerHTML={{ __html: previewQuery.data.html }}
        />
      )}
      {showPreview && previewQuery.isLoading && (
        <div className="wikios-template-block-loading">Loading preview...</div>
      )}
      {children}
    </div>
  );
}

// Table plugins
const TablePlugin = createPlatePlugin({
  key: "table",
  node: { isElement: true },
  render: {
    node: ({ children, attributes }: any) => (
      <table
        {...attributes}
        style={{ borderCollapse: "collapse", margin: "16px 0", width: "100%", fontSize: 13 }}
      >
        <tbody>{children}</tbody>
      </table>
    ),
  },
});
const TableRowPlugin = createPlatePlugin({
  key: "tr",
  node: { isElement: true },
  render: { node: ({ children, attributes }: any) => <tr {...attributes}>{children}</tr> },
});
const TableCellPlugin = createPlatePlugin({
  key: "td",
  node: { isElement: true },
  render: {
    node: ({ children, attributes }: any) => (
      <td
        {...attributes}
        style={{
          padding: "4px 8px",
          border: "1px solid rgba(255,255,255,0.08)",
          verticalAlign: "top",
        }}
      >
        {children}
      </td>
    ),
  },
});
const TableHeaderPlugin = createPlatePlugin({
  key: "th",
  node: { isElement: true },
  render: {
    node: ({ children, attributes }: any) => (
      <th
        {...attributes}
        style={{
          padding: "4px 8px",
          border: "1px solid rgba(255,255,255,0.08)",
          fontWeight: 600,
          background: "rgba(255,255,255,0.04)",
        }}
      >
        {children}
      </th>
    ),
  },
});

// List plugins
const UnorderedListPlugin = createPlatePlugin({
  key: "ul",
  node: { isElement: true },
  render: {
    node: ({ children, attributes }: any) => (
      <ul {...attributes} style={{ paddingLeft: 24, margin: "8px 0" }}>
        {children}
      </ul>
    ),
  },
});
const OrderedListPlugin = createPlatePlugin({
  key: "ol",
  node: { isElement: true },
  render: {
    node: ({ children, attributes }: any) => (
      <ol {...attributes} style={{ paddingLeft: 24, margin: "8px 0" }}>
        {children}
      </ol>
    ),
  },
});
const ListItemPlugin = createPlatePlugin({
  key: "li",
  node: { isElement: true },
  render: {
    node: ({ children, attributes }: any) => (
      <li {...attributes} style={{ margin: "2px 0" }}>
        {children}
      </li>
    ),
  },
});

// Leaf marks
const BoldPlugin = createPlatePlugin({
  key: "bold",
  node: { isLeaf: true },
  render: { node: ({ children, attributes }: any) => <strong {...attributes}>{children}</strong> },
});
const ItalicPlugin = createPlatePlugin({
  key: "italic",
  node: { isLeaf: true },
  render: { node: ({ children, attributes }: any) => <em {...attributes}>{children}</em> },
});

// ---------------------------------------------------------------------------
// Parsoid HTML → Slate nodes deserializer
// ---------------------------------------------------------------------------

function parsoidHtmlToSlate(html: string): WikiDescendant[] {
  const clean = html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<link[^>]*>/gi, "")
    .replace(/<meta[^>]*\/?>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "");

  if (typeof window === "undefined") return [{ type: "p", children: [{ text: "" }] }];

  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div>${clean}</div>`, "text/html");
  const root = doc.body.firstElementChild;
  if (!root) return [{ type: "p", children: [{ text: "" }] }];

  const nodes = deserializeElement(root);
  return nodes.length > 0 ? nodes : [{ type: "p", children: [{ text: "" }] }];
}

function deserializeElement(el: Element): WikiDescendant[] {
  const nodes: WikiDescendant[] = [];
  for (const child of Array.from(el.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) {
      const text = child.textContent ?? "";
      if (text.trim() || text === " ") nodes.push({ text });
      continue;
    }
    if (child.nodeType !== Node.ELEMENT_NODE) continue;

    const elem = child as HTMLElement;
    const tag = elem.tagName.toLowerCase();
    const typeofAttr = elem.getAttribute("typeof") ?? "";

    if (typeofAttr.includes("mw:Transclusion")) {
      const dataMw = elem.getAttribute("data-mw");
      let templateName = "Template";
      try {
        const parsed = JSON.parse(dataMw ?? "{}");
        templateName = parsed.parts?.[0]?.template?.target?.wt ?? "Template";
      } catch {
        /* ignore */
      }
      nodes.push({
        type: "template",
        templateName,
        wikitext: templateName,
        dataMw: dataMw ?? "",
        children: [{ text: "" }],
      });
      continue;
    }

    if (typeofAttr.includes("mw:File")) {
      const img = elem.querySelector("img");
      if (img) {
        const src = img.getAttribute("src") ?? "";
        nodes.push({
          type: "img",
          src: src.startsWith("/") ? `https://ixwiki.com${src}` : src,
          alt: img.getAttribute("alt") ?? "",
          children: [{ text: "" }],
        });
      }
      continue;
    }

    if (tag === "section") {
      nodes.push(...deserializeElement(elem));
      continue;
    }
    if (tag === "p") {
      const c = deserializeInline(elem);
      if (c.length > 0) nodes.push({ type: "p", children: c });
      continue;
    }
    if (tag.match(/^h[1-6]$/)) {
      const level = parseInt(tag[1]!, 10);
      const c = deserializeInline(elem);
      nodes.push({ type: "heading", level, children: c.length > 0 ? c : [{ text: "" }] });
      continue;
    }
    if (tag === "ul") {
      nodes.push({ type: "ul", children: deserializeListItems(elem) });
      continue;
    }
    if (tag === "ol") {
      nodes.push({ type: "ol", children: deserializeListItems(elem) });
      continue;
    }
    if (tag === "blockquote") {
      nodes.push({ type: "blockquote", children: deserializeElement(elem) });
      continue;
    }
    if (tag === "table") {
      const rows = deserializeTable(elem);
      if (rows.length > 0) nodes.push({ type: "table", children: rows });
      continue;
    }
    if (tag === "figure" || tag === "figure-inline") {
      const img = elem.querySelector("img");
      if (img) {
        const src = img.getAttribute("src") ?? "";
        nodes.push({
          type: "img",
          src: src.startsWith("/") ? `https://ixwiki.com${src}` : src,
          alt: img.getAttribute("alt") ?? "",
          children: [{ text: "" }],
        });
      }
      continue;
    }
    if (tag === "div") {
      const cls = elem.className ?? "";
      if (cls.includes("mw-heading")) {
        const h = elem.querySelector("h1, h2, h3, h4, h5, h6");
        if (h) {
          const level = parseInt(h.tagName[1]!, 10);
          nodes.push({ type: "heading", level, children: deserializeInline(h as HTMLElement) });
        }
        continue;
      }
      nodes.push(...deserializeElement(elem));
      continue;
    }
    if (["span", "small", "abbr", "sup", "sub"].includes(tag)) {
      const inl = deserializeInline(elem);
      if (inl.length > 0) nodes.push({ type: "p", children: inl });
      continue;
    }
    nodes.push(...deserializeElement(elem));
  }
  return nodes;
}

function deserializeInline(el: Element): WikiDescendant[] {
  const result: WikiDescendant[] = [];
  for (const child of Array.from(el.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) {
      result.push({ text: child.textContent ?? "" });
      continue;
    }
    if (child.nodeType !== Node.ELEMENT_NODE) continue;
    const elem = child as HTMLElement;
    const tag = elem.tagName.toLowerCase();
    if (tag === "b" || tag === "strong") {
      const inner = deserializeInline(elem);
      inner.forEach((n: Record<string, unknown>) => {
        n.bold = true;
      });
      result.push(...inner);
      continue;
    }
    if (tag === "i" || tag === "em") {
      const inner = deserializeInline(elem);
      inner.forEach((n: Record<string, unknown>) => {
        n.italic = true;
      });
      result.push(...inner);
      continue;
    }
    if (tag === "a") {
      result.push({ text: elem.textContent ?? "" });
      continue;
    }
    if (tag === "img") continue;
    if (tag === "sup" || tag === "sub" || tag === "small") {
      result.push({ text: elem.textContent ?? "" });
      continue;
    }
    if (tag === "br") {
      result.push({ text: "\n" });
      continue;
    }
    if (tag === "span") {
      result.push(...deserializeInline(elem));
      continue;
    }
    result.push({ text: elem.textContent ?? "" });
  }
  if (result.length === 0) result.push({ text: "" });
  return result;
}

function deserializeListItems(el: Element): WikiDescendant[] {
  const items: WikiDescendant[] = [];
  for (const li of Array.from(el.querySelectorAll(":scope > li"))) {
    const children = deserializeInline(li as HTMLElement);
    items.push({ type: "li", children: children.length > 0 ? children : [{ text: "" }] });
  }
  return items.length > 0 ? items : [{ type: "li", children: [{ text: "" }] }];
}

function deserializeTable(el: Element): WikiDescendant[] {
  const rows: WikiDescendant[] = [];
  for (const tr of Array.from(el.querySelectorAll("tr"))) {
    const cells: WikiDescendant[] = [];
    for (const cell of Array.from(tr.querySelectorAll("td, th"))) {
      const tag = cell.tagName.toLowerCase();
      const children = deserializeInline(cell as HTMLElement);
      cells.push({ type: tag, children: children.length > 0 ? children : [{ text: "" }] });
    }
    if (cells.length > 0) rows.push({ type: "tr", children: cells });
  }
  return rows;
}

// ---------------------------------------------------------------------------
// Toolbar helpers
// ---------------------------------------------------------------------------

function isMarkActive(editor: Editor, mark: string): boolean {
  try {
    const marks = Editor.marks(editor);
    return marks ? marks[mark] === true : false;
  } catch {
    return false;
  }
}

function toggleMark(editor: Editor, mark: string) {
  const isActive = isMarkActive(editor, mark);
  if (isActive) {
    Editor.removeMark(editor, mark);
  } else {
    Editor.addMark(editor, mark, true);
  }
}

function isBlockActive(editor: Editor, type: string, level?: number): boolean {
  try {
    const [match] = Editor.nodes(editor, {
      match: (n: any) => n.type === type && (level === undefined || n.level === level),
    });
    return !!match;
  } catch {
    return false;
  }
}

function toggleBlock(editor: Editor, type: string, props?: Record<string, any>) {
  const isActive = isBlockActive(editor, type, props?.level);
  Transforms.setNodes(editor, isActive ? { type: "p" } : { type, ...props }, {
    match: (n: Record<string, unknown>) => Editor.isBlock(editor, n),
  });
}

// ---------------------------------------------------------------------------
// Main editor component
// ---------------------------------------------------------------------------

interface WikiPlateEditorProps {
  initialHtml: string;
  title: string;
  onSave: (html: string, summary: string, minor: boolean) => void;
  onCancel: () => void;
  onSwitchToSource: () => void;
}

export function WikiPlateEditor({
  initialHtml,
  title,
  onSave,
  onCancel,
  onSwitchToSource,
}: WikiPlateEditorProps) {
  const summaryRef = useRef("");
  const minorRef = useRef(false);
  const [ready] = useState(true);
  const [showTemplateInserter, setShowTemplateInserter] = useState(false);

  const editor = useMemo(() => {
    const value = parsoidHtmlToSlate(initialHtml);
    return createPlateEditor({
      plugins: [
        ParagraphPlugin,
        HeadingPlugin,
        BlockquotePlugin,
        ImagePlugin,
        TemplatePlugin,
        TablePlugin,
        TableRowPlugin,
        TableCellPlugin,
        TableHeaderPlugin,
        UnorderedListPlugin,
        OrderedListPlugin,
        ListItemPlugin,
        BoldPlugin,
        ItalicPlugin,
      ],
      value,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSave = useCallback(() => {
    try {
      const html = editor.api.htmlReact?.serialize?.();
      onSave(typeof html === "string" ? html : "", summaryRef.current, minorRef.current);
    } catch {
      onSave("", summaryRef.current, minorRef.current);
    }
  }, [editor, onSave]);

  const handleInsertTemplate = useCallback(
    (templateName: string, params: Record<string, string>) => {
      const paramParts = Object.entries(params)
        .filter(([, v]) => v.trim())
        .map(([k, v]) => `|${k}=${v}`);
      const wikitext = `{{${templateName}${paramParts.join("")}}}`;
      Transforms.insertNodes(editor, {
        type: "template",
        templateName,
        wikitext,
        dataMw: JSON.stringify({
          parts: [
            {
              template: {
                target: { wt: templateName },
                params: Object.fromEntries(Object.entries(params).map(([k, v]) => [k, { wt: v }])),
              },
            },
          ],
        }),
        children: [{ text: "" }],
      } as any);
    },
    [editor]
  );

  if (!ready) return null;

  return (
    <div className="wikios-editor-modern">
      {/* Title bar */}
      <div className="wikios-editor-titlebar">
        <div className="wikios-editor-titlebar-left">
          <span className="wikios-editor-titlebar-badge">Visual</span>
          <span className="wikios-editor-titlebar-name">{title}</span>
        </div>
        <div className="wikios-editor-titlebar-actions">
          <button className="wikios-editor-btn-secondary" onClick={onSwitchToSource} type="button">
            Source
          </button>
          <button className="wikios-editor-btn-secondary" onClick={onCancel} type="button">
            Cancel
          </button>
          <button className="wikios-editor-btn-primary" onClick={handleSave} type="button">
            Publish
          </button>
        </div>
      </div>

      {/* Save bar */}
      <div className="wikios-editor-save-bar">
        <input
          type="text"
          onChange={(e) => {
            summaryRef.current = e.target.value;
          }}
          placeholder="Edit summary..."
          className="wikios-editor-save-input"
        />
        <label className="wikios-editor-save-minor">
          <input
            type="checkbox"
            onChange={(e) => {
              minorRef.current = e.target.checked;
            }}
          />{" "}
          Minor
        </label>
      </div>

      {/* Formatting toolbar */}
      <div className="wikios-editor-toolbar">
        <ToolbarBtn
          icon={<Bold size={14} />}
          title="Bold"
          active={isMarkActive(editor, "bold")}
          onClick={() => toggleMark(editor, "bold")}
        />
        <ToolbarBtn
          icon={<Italic size={14} />}
          title="Italic"
          active={isMarkActive(editor, "italic")}
          onClick={() => toggleMark(editor, "italic")}
        />
        <span className="wikios-editor-toolbar-sep" />
        <ToolbarBtn
          icon={<Heading1 size={14} />}
          title="Heading 2"
          active={isBlockActive(editor, "heading", 2)}
          onClick={() => toggleBlock(editor, "heading", { level: 2 })}
        />
        <ToolbarBtn
          icon={<Heading2 size={14} />}
          title="Heading 3"
          active={isBlockActive(editor, "heading", 3)}
          onClick={() => toggleBlock(editor, "heading", { level: 3 })}
        />
        <ToolbarBtn
          icon={<Heading3 size={14} />}
          title="Heading 4"
          active={isBlockActive(editor, "heading", 4)}
          onClick={() => toggleBlock(editor, "heading", { level: 4 })}
        />
        <span className="wikios-editor-toolbar-sep" />
        <ToolbarBtn
          icon={<List size={14} />}
          title="Bullet list"
          active={isBlockActive(editor, "ul")}
          onClick={() => toggleBlock(editor, "ul")}
        />
        <ToolbarBtn
          icon={<ListOrdered size={14} />}
          title="Numbered list"
          active={isBlockActive(editor, "ol")}
          onClick={() => toggleBlock(editor, "ol")}
        />
        <ToolbarBtn
          icon={<Quote size={14} />}
          title="Blockquote"
          active={isBlockActive(editor, "blockquote")}
          onClick={() => toggleBlock(editor, "blockquote")}
        />
        <span className="wikios-editor-toolbar-sep" />
        <ToolbarBtn
          icon={<Puzzle size={14} />}
          title="Insert template"
          onClick={() => setShowTemplateInserter(!showTemplateInserter)}
        />
        <ToolbarBtn
          icon={<ImageIcon size={14} />}
          title="Insert image"
          onClick={() => {
            /* Phase 2 */
          }}
        />
      </div>

      {/* Template inserter dropdown */}
      {showTemplateInserter && (
        <TemplateInserter
          onInsert={handleInsertTemplate}
          onClose={() => setShowTemplateInserter(false)}
        />
      )}

      {/* Editor content */}
      <div className="wikios-plate-content">
        <Plate editor={editor}>
          <PlateContent className="wikios-plate-editable" placeholder="Start writing..." />
        </Plate>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
function ToolbarBtn({
  icon,
  title,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => {
        e.preventDefault();
        onClick();
      }}
      className={cn("wikios-editor-toolbar-btn", active && "wikios-editor-toolbar-btn-active")}
      title={title}
    >
      {icon}
    </button>
  );
}
