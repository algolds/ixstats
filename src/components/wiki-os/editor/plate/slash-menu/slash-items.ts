/**
 * slash-items.ts — Registry of slash-command items for the WikiOS Plate editor.
 * Each item carries an `execute` handler that inserts the corresponding block
 * at the current selection.
 */

import { Transforms, type Descendant, type BaseEditor } from "slate";
import { MASTER_TEMPLATE_PRESETS } from "~/lib/wiki-os/templates/master-presets";
import { templatePresetToNode } from "../insert-template";

export interface SlashItem {
  id: string;
  label: string;
  keywords: string[];
  icon: string;
  category: "Basic Blocks" | "Factbooks & Infoboxes" | "Live Simulation Connectors";
  execute: (editor: BaseEditor & Record<string, any>) => void;
}

function insertNode(node: Record<string, unknown>) {
  return (editor: BaseEditor & Record<string, any>) => {
    Transforms.insertNodes(editor, node as unknown as Descendant);
    // ensure a trailing paragraph so typing continues normally
    Transforms.insertNodes(editor, { type: "p", children: [{ text: "" }] } as unknown as Descendant);
  };
}

const CATEGORY_OF_NAME: Record<string, SlashItem["category"]> = {
  "Infobox country": "Factbooks & Infoboxes",
};

export const SLASH_ITEMS: SlashItem[] = [
  {
    id: "h2",
    label: "Heading — Section (== H2 ==)",
    keywords: ["heading", "section", "title", "h2"],
    icon: "H2",
    category: "Basic Blocks",
    execute: (editor) => {
      Transforms.setNodes(editor as never, { type: "h2" } as Partial<Descendant>);
    },
  },
  {
    id: "h3",
    label: "Heading — Subsection (=== H3 ===)",
    keywords: ["heading", "subsection", "h3"],
    icon: "H3",
    category: "Basic Blocks",
    execute: (editor) => {
      Transforms.setNodes(editor as never, { type: "h3" } as Partial<Descendant>);
    },
  },
  {
    id: "bullet-list",
    label: "Bulleted list",
    keywords: ["list", "bullet", "ul"],
    icon: "•",
    category: "Basic Blocks",
    execute: insertNode({
      type: "ul",
      children: [{ type: "li", children: [{ text: "" }] }],
    }),
  },
  {
    id: "numbered-list",
    label: "Numbered list",
    keywords: ["list", "numbered", "ol", "ordered"],
    icon: "1.",
    category: "Basic Blocks",
    execute: insertNode({
      type: "ol",
      children: [{ type: "li", children: [{ text: "" }] }],
    }),
  },
  {
    id: "quote",
    label: "Quote box",
    keywords: ["quote", "blockquote", "citation"],
    icon: "❝",
    category: "Basic Blocks",
    execute: insertNode({ type: "blockquote", children: [{ text: "" }] }),
  },
  {
    id: "table",
    label: "Table (2×2)",
    keywords: ["table", "grid", "wikitable"],
    icon: "▦",
    category: "Basic Blocks",
    execute: insertNode({
      type: "table",
      children: [
        { type: "tr", children: [{ type: "th", children: [{ text: "Header 1" }] }, { type: "th", children: [{ text: "Header 2" }] }] },
        { type: "tr", children: [{ type: "td", children: [{ text: "Cell 1" }] }, { type: "td", children: [{ text: "Cell 2" }] }] },
      ],
    }),
  },
  {
    id: "code-block",
    label: "Code block",
    keywords: ["code", "pre", "source"],
    icon: "{}",
    category: "Basic Blocks",
    execute: insertNode({ type: "code-block", children: [{ text: "" }] }),
  },
  {
    id: "divider",
    label: "Divider / horizontal rule",
    keywords: ["divider", "rule", "hr", "line"],
    icon: "—",
    category: "Basic Blocks",
    execute: insertNode({ type: "hr", children: [{ text: "" }] }),
  },

  // Template registry presets → atomic raw-html blocks with data-mw
  ...MASTER_TEMPLATE_PRESETS.map<SlashItem>((preset) => ({
    id: `template:${preset.name}`,
    label: preset.name,
    keywords: [preset.name.toLowerCase(), preset.category],
    icon: preset.category === "engine" ? "⚡" : preset.category === "sovereign" ? "🏛️" : "📋",
    category:
      preset.category === "engine"
        ? "Live Simulation Connectors"
        : CATEGORY_OF_NAME[preset.name] ?? "Factbooks & Infoboxes",
    execute: insertNode(templatePresetToNode(preset)),
  })),

  {
    id: "coords",
    label: "Coordinates chip",
    keywords: ["coords", "coordinate", "location", "map"],
    icon: "📍",
    category: "Live Simulation Connectors",
    execute: insertNode({
      type: "chip-coord",
      href: "Coords:",
      title: "Coords:",
      label: "Location",
      children: [{ text: "" }],
    }),
  },
];

export function filterSlashItems(items: SlashItem[], query: string): SlashItem[] {
  if (!query) return items;
  const q = query.toLowerCase();
  return items.filter(
    (item) =>
      item.label.toLowerCase().includes(q) ||
      item.keywords.some((k) => k.includes(q))
  );
}
