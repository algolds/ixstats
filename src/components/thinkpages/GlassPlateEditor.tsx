// @ts-nocheck
"use client";

import React, { useMemo, useState, useCallback, useEffect, useImperativeHandle, forwardRef } from "react";

import {
  Plate,
  PlateContent,
  createPlateEditor,
  createPlatePlugin,
  ParagraphPlugin,
} from "platejs/react";
import { Transforms, Editor, Element as SlateElement } from "slate";
import { ReactEditor } from "slate-react";
import {
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  Link as LinkIcon,
  Sparkles,
  Bookmark,
  Loader2,
  Plus,
} from "lucide-react";
import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { api } from "~/trpc/react";
import { withBasePath } from "~/lib/base-path";
import { EmojiPicker } from "./EmojiPicker";

// ---------------------------------------------------------------------------
// Slate plugins for Rich Text Formatting
// ---------------------------------------------------------------------------

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

const UnderlinePlugin = createPlatePlugin({
  key: "underline",
  node: { isLeaf: true },
  render: { node: ({ children, attributes }: any) => <u {...attributes}>{children}</u> },
});

const UnorderedListPlugin = createPlatePlugin({
  key: "ul",
  node: { isElement: true },
  render: {
    node: ({ children, attributes }: any) => (
      <ul {...attributes} className="list-disc pl-5 my-1 space-y-0.5 text-slate-800 dark:text-slate-200">
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
      <ol {...attributes} className="list-decimal pl-5 my-1 space-y-0.5 text-slate-800 dark:text-slate-200">
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
      <li {...attributes} className="text-sm">
        {children}
      </li>
    ),
  },
});

const LinkPlugin = createPlatePlugin({
  key: "link",
  node: { isElement: true, isInline: true },
  render: {
    node: ({ children, element, attributes }: any) => (
      <a
        {...attributes}
        href={element?.url as string | undefined}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-600 dark:text-blue-400 font-medium underline hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
      >
        {children}
      </a>
    ),
  },
});

const WikiLinkPlugin = createPlatePlugin({
  key: "wikilink",
  node: { isElement: true, isInline: true },
  render: {
    node: ({ children, element, attributes }: any) => (
      <a
        {...attributes}
        href={`/wiki/${(element?.target as string || "").replace(/ /g, "_")}`}
        className="text-purple-600 dark:text-purple-400 font-semibold underline hover:text-purple-700 dark:hover:text-purple-300 transition-colors"
      >
        {children}
      </a>
    ),
  },
});

const WikiEmbedPlugin = createPlatePlugin({
  key: "wikiembed",
  node: { isElement: true, isVoid: true },
  render: {
    node: ({ element, attributes, children }: any) => {
      const title = (element?.title as string) ?? "";
      const summary = (element?.summary as string) ?? "";
      const imageUrl = (element?.imageUrl as string) ?? "";
      const source = (element?.source as string) ?? "ixwiki";

      return (
        <div
          {...attributes}
          contentEditable={false}
          data-wikiembed="true"
          data-title={title}
          data-summary={summary}
          data-imageurl={imageUrl}
          data-source={source}
          className="my-3 select-none"
        >
          <div className="flex items-center gap-3.5 p-3.5 rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-500/[0.03] dark:bg-white/[0.03] backdrop-blur-md shadow-xs hover:border-slate-300 dark:hover:border-white/20 transition-all duration-200">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-1 select-none">
                <img
                  src="https://cdn.simpleicons.org/wikipedia/1d4e89"
                  className="h-3 w-3 dark:hidden"
                  alt=""
                />
                <img
                  src="https://cdn.simpleicons.org/wikipedia/38bdf8"
                  className="h-3 w-3 hidden dark:block"
                  alt=""
                />
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  {source === "iiwiki" ? "IIWiki Article" : "IxWiki Article"}
                </span>
              </div>
              <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate leading-snug">
                {title}
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mt-0.5 leading-normal">
                {summary}
              </p>
            </div>
            {imageUrl && (
              <img
                src={imageUrl}
                className="h-16 w-16 rounded-xl object-cover border border-slate-200 dark:border-white/10"
                alt=""
              />
            )}
          </div>
          {children}
        </div>
      );
    },
  },
});

const ImagePlugin = createPlatePlugin({
  key: "img",
  node: { isElement: true, isVoid: true },
  render: {
    node: ({ element, attributes, children }: any) => (
      <div {...attributes} contentEditable={false} className="my-2 max-w-full relative group">
        <img
          src={element?.src as string | undefined}
          alt={(element?.alt as string) ?? "Stashed image"}
          className="max-h-60 max-w-full rounded-lg border border-white/10 object-contain bg-black/20"
        />
        {children}
      </div>
    ),
  },
});

// ---------------------------------------------------------------------------
// Custom Slate-to-HTML Serializer
// ---------------------------------------------------------------------------

function escapeAttr(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function serializeLeaf(node: any): string {
  let text: string = (node.text ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  if (!text) return "";
  if (node.bold) text = `<strong>${text}</strong>`;
  if (node.italic) text = `<em>${text}</em>`;
  if (node.underline) text = `<u>${text}</u>`;
  return text;
}

function serializeNode(node: any): string {
  // Leaf text nodes
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

function slateNodesToHtml(nodes: any[]): string {
  return nodes.map((n: any) => serializeNode(n)).join("");
}

// ---------------------------------------------------------------------------
// Editor Helpers
// ---------------------------------------------------------------------------

function isMarkActive(editor: any, mark: string): boolean {
  try {
    const marks = Editor.marks(editor);
    return marks ? (marks as any)[mark] === true : false;
  } catch {
    return false;
  }
}

function toggleMark(editor: any, mark: string) {
  const isActive = isMarkActive(editor, mark);
  if (isActive) {
    Editor.removeMark(editor, mark);
  } else {
    Editor.addMark(editor, mark, true);
  }
}

function isBlockActive(editor: any, type: string): boolean {
  try {
    const [match] = Editor.nodes(editor, {
      match: (n: any) => n.type === type,
    });
    return !!match;
  } catch {
    return false;
  }
}

function toggleBlock(editor: any, type: string) {
  const isActive = isBlockActive(editor, type);
  
  if (isActive) {
    Transforms.unwrapNodes(editor, {
      match: (n: any) => n.type === "ul" || n.type === "ol",
      split: true,
    });
    Transforms.setNodes(editor, { type: "p" });
  } else {
    Transforms.unwrapNodes(editor, {
      match: (n: any) => n.type === "ul" || n.type === "ol",
      split: true,
    });
    Transforms.setNodes(editor, { type: "li" });
    const wrapper = { type, children: [] };
    Transforms.wrapNodes(editor, wrapper, {
      match: (n: any) => n.type === "li",
    });
  }
}

function detectWikiUrl(url: string): { title: string; source: "ixwiki" | "iiwiki" | "althistory" } | null {
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

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

interface GlassPlateEditorProps {
  value?: string;
  onChange: (htmlContent: string, plainText: string) => void;
  placeholder?: string;
  disabled?: boolean;
  onFocus?: () => void;
  onBlur?: () => void;
  italicPlaceholder?: boolean;
}

export const GlassPlateEditor = forwardRef<any, GlassPlateEditorProps>(
  (
    {
      value = "",
      onChange,
      placeholder = "Write something rich...",
      disabled = false,
      onFocus,
      onBlur,
      italicPlaceholder = false,
    },
    ref
  ) => {
    const [version, setVersion] = useState(0);

    // Expose ref methods
    useImperativeHandle(ref, () => ({
      insertText: (text: string) => {
        safeFocus();
        try {
          Transforms.insertText(editor, text);
        } catch (err) {
          // Fallback: append text to last node if selection is lost
          const lastNodePath = [editor.children.length - 1];
          Transforms.insertText(editor, text, { at: lastNodePath });
        }
        handleEditorChange();
      },
      clear: () => {
        // Direct assignment is robust for Slate clearing
        editor.children = [{ type: "p", children: [{ text: "" }] }];
        // Reset selection
        editor.selection = null;
        editor.onChange();
        handleEditorChange();
      }
    }));

  // Link Insertion states
  const [isLinkOpen, setIsLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkText, setLinkText] = useState("");

  // Focus and popover tracking for floating toolbar
  const [isFocused, setIsFocused] = useState(false);
  const [isEmojiOpen, setIsEmojiOpen] = useState(false);

  // WikiLink Insertion states
  const [isWikiOpen, setIsWikiOpen] = useState(false);
  const [wikiTarget, setWikiTarget] = useState("");
  const [wikiText, setWikiText] = useState("");
  const [wikiSearchQuery, setWikiSearchQuery] = useState("");

  const [wikiInsertMode, setWikiInsertMode] = useState<"link" | "embed">("link");
  const [selectedWikiSource, setSelectedWikiSource] = useState<"ixwiki" | "iiwiki" | "althistory">("ixwiki");
  const [selectedWikiImageUrl, setSelectedWikiImageUrl] = useState<string>("");

  const wikiSearch = api.wikios.search.useQuery(
    { query: wikiSearchQuery, limit: 5, wikiSource: "all" },
    { enabled: isWikiOpen && wikiSearchQuery.trim().length > 1, staleTime: 10_000 }
  );

  // Fetch Wiki Details when target is selected
  const wikiIntroQuery = api.wiki.getIntro.useQuery(
    { title: wikiTarget, wiki: selectedWikiSource },
    {
      enabled: isWikiOpen && wikiInsertMode === "embed" && !!wikiTarget.trim(),
      staleTime: 30_000,
    }
  );

  const wikiImagesQuery = api.wiki.getPageImages.useQuery(
    { title: wikiTarget },
    {
      enabled: isWikiOpen && wikiInsertMode === "embed" && !!wikiTarget.trim(),
      staleTime: 30_000,
    }
  );

  // Set the first image's URL as the default selected image when list changes
  useEffect(() => {
    if (wikiImagesQuery.data && wikiImagesQuery.data.length > 0) {
      setSelectedWikiImageUrl(wikiImagesQuery.data[0].thumbUrl || wikiImagesQuery.data[0].url);
    } else {
      setSelectedWikiImageUrl("");
    }
  }, [wikiImagesQuery.data]);

  useEffect(() => {
    if (!isWikiOpen) {
      setWikiSearchQuery("");
    }
  }, [isWikiOpen]);

  // Stashes states
  const [isStashesOpen, setIsStashesOpen] = useState(false);
  const [selectedStashId, setSelectedStashId] = useState<string | null>(null);

  // Fetch stashes query
  const stashesQuery = api.wikios.getStashes.useQuery(undefined, {
    enabled: isStashesOpen,
    staleTime: 30_000,
  });
  const stashes = stashesQuery.data || [];
  const defaultStash = stashes.find((s) => s.isDefault) || stashes[0];
  const activeStashId = selectedStashId || defaultStash?.id || "";

  const stashItemsQuery = api.wikios.getStashItems.useQuery(
    { stashId: activeStashId, limit: 50 },
    { enabled: isStashesOpen && !!activeStashId, staleTime: 10_000 }
  );
  const stashItems = stashItemsQuery.data?.items || [];

  const imageItems = useMemo(() => {
    return stashItems.filter((item) => item.pageTitle.startsWith("commons:"));
  }, [stashItems]);

  const imageTitles = useMemo(() => {
    return imageItems.map((item) => item.pageTitle.replace(/^commons:/, ""));
  }, [imageItems]);

  const resolvedImagesQuery = api.commons.getImageInfoByTitles.useQuery(
    { titles: imageTitles },
    { enabled: isStashesOpen && imageTitles.length > 0, staleTime: 5 * 60 * 1000 }
  );
  const resolvedImages = resolvedImagesQuery.data || {};

  // Setup PlateJS editor instance
  const editor = useMemo(() => {
    // Deserialize initial HTML string into Slate elements
    const initialNodes = parsoidHtmlToSlate(value);
    
    return createPlateEditor({
      plugins: [
        ParagraphPlugin,
        BoldPlugin,
        ItalicPlugin,
        UnderlinePlugin,
        UnorderedListPlugin,
        OrderedListPlugin,
        ListItemPlugin,
        LinkPlugin,
        WikiLinkPlugin,
        WikiEmbedPlugin,
        ImagePlugin,
      ],
      value: initialNodes as any,
    });
  }, []);

  const safeFocus = useCallback(() => {
    try {
      ReactEditor.focus(editor);
    } catch (err) {
      console.warn("ReactEditor.focus failed, using fallback:", err);
      try {
        const domNode = ReactEditor.toDOMNode(editor, editor);
        domNode?.focus();
      } catch (domErr) {
        // Safe no-op
      }
    }
  }, [editor]);

  // Sync Plate content change back to parent
  const handleEditorChange = useCallback(() => {
    setVersion((v) => v + 1);
    try {
      const html = slateNodesToHtml(editor.children as any[]);
      const plainText = Editor.string(editor, []);
      onChange(html, plainText);
    } catch (err) {
      console.warn("Failed to serialize Slate content to HTML:", err);
    }
  }, [editor, onChange]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (!event.ctrlKey && !event.metaKey) return;

      const key = event.key.toLowerCase();
      if (key === "b" || key === "i" || key === "u") {
        event.preventDefault();
        
        let mark = "";
        if (key === "b") mark = "bold";
        else if (key === "i") mark = "italic";
        else if (key === "u") mark = "underline";

        if (mark) {
          toggleMark(editor, mark);
          handleEditorChange();
        }
      }
    },
    [editor, handleEditorChange]
  );

  const handleSelectEmoji = useCallback((emoji: string) => {
    safeFocus();
    try {
      Transforms.insertText(editor, emoji);
    } catch (err) {
      // Fallback: append text to last node if selection is lost
      const lastNodePath = [editor.children.length - 1];
      Transforms.insertText(editor, emoji, { at: lastNodePath });
    }
    handleEditorChange();
  }, [editor, handleEditorChange]);

  const insertLink = useCallback(() => {
    if (!linkUrl.trim()) return;
    
    // Select editor range to insert
    safeFocus();
    
    Transforms.insertNodes(editor, [
      {
        type: "link",
        url: linkUrl.startsWith("http") ? linkUrl : `https://${linkUrl}`,
        children: [{ text: linkText.trim() || linkUrl }],
      },
      { text: " " }
    ] as any);
    
    setLinkUrl("");
    setLinkText("");
    setIsLinkOpen(false);
    handleEditorChange();
  }, [editor, linkUrl, linkText, handleEditorChange]);

  const insertWikiLink = useCallback(() => {
    if (!wikiTarget.trim()) return;
    
    safeFocus();
    
    if (wikiInsertMode === "embed") {
      Transforms.insertNodes(editor, [
        {
          type: "wikiembed",
          title: wikiTarget.trim(),
          summary: wikiIntroQuery.data?.text || "No description available.",
          imageUrl: selectedWikiImageUrl || "",
          source: selectedWikiSource || "ixwiki",
          children: [{ text: "" }],
        },
        {
          type: "p",
          children: [{ text: "" }]
        }
      ] as any);
    } else {
      Transforms.insertNodes(editor, [
        {
          type: "wikilink",
          target: wikiTarget.trim(),
          children: [{ text: wikiText.trim() || wikiTarget }],
        },
        { text: " " }
      ] as any);
    }
    
    setWikiTarget("");
    setWikiText("");
    setIsWikiOpen(false);
    handleEditorChange();
  }, [
    editor,
    wikiTarget,
    wikiText,
    wikiInsertMode,
    wikiIntroQuery.data,
    selectedWikiImageUrl,
    selectedWikiSource,
    handleEditorChange
  ]);

  const insertStashedImage = useCallback((imageUrl: string, title: string) => {
    safeFocus();
    
    Transforms.insertNodes(editor, [
      {
        type: "img",
        src: imageUrl,
        alt: title || "Stashed Image",
        children: [{ text: "" }],
      },
      {
        type: "p",
        children: [{ text: "" }]
      }
    ] as any);
    
    setIsStashesOpen(false);
    handleEditorChange();
  }, [editor, handleEditorChange]);

  // Deserialize HTML helper
  function parsoidHtmlToSlate(htmlContent: string): any[] {
    if (!htmlContent) return [{ type: "p", children: [{ text: "" }] }];
    if (typeof window === "undefined") return [{ type: "p", children: [{ text: "" }] }];

    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(`<div>${htmlContent}</div>`, "text/html");
      const root = doc.body.firstElementChild;
      if (!root) return [{ type: "p", children: [{ text: "" }] }];

      const nodes: any[] = [];
      const deserializeNode = (el: Node): any[] => {
        const result: any[] = [];
        for (const child of Array.from(el.childNodes)) {
          if (child.nodeType === Node.TEXT_NODE) {
            const txt = child.textContent ?? "";
            if (txt.trim() || txt === " ") result.push({ text: txt });
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
            result.push({ type: "p", children: deserializeNode(elem) });
            continue;
          }
          if (tag === "strong" || tag === "b") {
            const inner = deserializeNode(elem);
            inner.forEach((n: any) => { if ('text' in n) n.bold = true; });
            result.push(...inner);
            continue;
          }
          if (tag === "em" || tag === "i") {
            const inner = deserializeNode(elem);
            inner.forEach((n: any) => { if ('text' in n) n.italic = true; });
            result.push(...inner);
            continue;
          }
          if (tag === "u" || elem.style.textDecoration === "underline") {
            const inner = deserializeNode(elem);
            inner.forEach((n: any) => { if ('text' in n) n.underline = true; });
            result.push(...inner);
            continue;
          }
          if (tag === "ul") {
            result.push({ type: "ul", children: deserializeNode(elem) });
            continue;
          }
          if (tag === "ol") {
            result.push({ type: "ol", children: deserializeNode(elem) });
            continue;
          }
          if (tag === "li") {
            result.push({ type: "li", children: deserializeNode(elem) });
            continue;
          }
          if (tag === "a") {
            const href = elem.getAttribute("href") || "";
            if (href.startsWith("/wiki/")) {
              const target = decodeURIComponent(href.replace("/wiki/", "")).replace(/_/g, " ");
              result.push({
                type: "wikilink",
                target,
                children: deserializeNode(elem),
              });
            } else {
              result.push({
                type: "link",
                url: href,
                children: deserializeNode(elem),
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
        if (result.length === 0) result.push({ text: "" });
        return result;
      };

      const finalNodes = deserializeNode(root);
      // Clean up final list items to wrap properly if needed
      return finalNodes.length > 0 ? finalNodes : [{ type: "p", children: [{ text: "" }] }];
    } catch (err) {
      console.warn("Parsoid deserializer failed, falling back:", err);
      return [{ type: "p", children: [{ text: htmlContent }] }];
    }
  }

  const isToolbarVisible = isFocused || isLinkOpen || isWikiOpen || isStashesOpen || isEmojiOpen;

  const isEditorEmpty = useMemo(() => {
    if (!editor || !editor.children) return true;
    if (editor.children.length > 1) return false;
    const firstChild = editor.children[0] as any;
    if (!firstChild) return true;
    if (firstChild.type !== "p") return false;
    if (firstChild.children?.length > 1) return false;
    return (firstChild.children?.[0]?.text ?? "").trim() === "";
  }, [editor, version]);

  return (
    <div className="relative flex flex-col rounded-xl glass-surface glass-refraction-none glass-composer-editor focus-within:border-blue-500/50 dark:focus-within:border-blue-400/50 focus-within:ring-1 focus-within:ring-blue-500/20 dark:focus-within:ring-blue-400/20 shadow-xs focus-within:shadow-md transition-all duration-300">
      {/* ── Embedded Top Toolbar Wrapper ── */}
      <div
        className={cn(
          "grid transition-[grid-template-rows,opacity] duration-300 ease-in-out select-none",
          isToolbarVisible ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0 pointer-events-none"
        )}
      >
        <div className="overflow-hidden">
          <div className="flex flex-wrap items-center gap-1 bg-slate-500/[0.03] dark:bg-white/[0.03] p-1.5 rounded-t-xl">
        <ToolbarButton
          icon={<Bold className="h-3.5 w-3.5" />}
          title="Bold (Ctrl+B)"
          active={isMarkActive(editor, "bold")}
          onClick={() => {
            toggleMark(editor, "bold");
            handleEditorChange();
          }}
          disabled={disabled}
        />
        <ToolbarButton
          icon={<Italic className="h-3.5 w-3.5" />}
          title="Italic (Ctrl+I)"
          active={isMarkActive(editor, "italic")}
          onClick={() => {
            toggleMark(editor, "italic");
            handleEditorChange();
          }}
          disabled={disabled}
        />
        <ToolbarButton
          icon={<Underline className="h-3.5 w-3.5" />}
          title="Underline (Ctrl+U)"
          active={isMarkActive(editor, "underline")}
          onClick={() => {
            toggleMark(editor, "underline");
            handleEditorChange();
          }}
          disabled={disabled}
        />

        <div className="h-4 w-px bg-slate-200 dark:bg-white/10 mx-0.5" />

        <ToolbarButton
          icon={<List className="h-3.5 w-3.5" />}
          title="Bullet List"
          active={isBlockActive(editor, "ul")}
          onClick={() => {
            toggleBlock(editor, "ul");
            handleEditorChange();
          }}
          disabled={disabled}
        />
        <ToolbarButton
          icon={<ListOrdered className="h-3.5 w-3.5" />}
          title="Numbered List"
          active={isBlockActive(editor, "ol")}
          onClick={() => {
            toggleBlock(editor, "ol");
            handleEditorChange();
          }}
          disabled={disabled}
        />

        <div className="h-4 w-px bg-slate-200 dark:bg-white/10 mx-0.5" />

        {/* ── Link Popover ── */}
        <Popover open={isLinkOpen} onOpenChange={setIsLinkOpen}>
          <PopoverTrigger
            render={
              <Button
                variant="ghost"
                size="sm"
                disabled={disabled}
                className={cn(
                  "h-7 w-7 p-0 rounded-full transition-all duration-200",
                  isLinkOpen
                    ? "bg-blue-500/20 dark:bg-blue-500/30 text-blue-600 dark:text-blue-300 ring-1 ring-blue-500/30"
                    : "text-blue-500 dark:text-blue-400 hover:bg-blue-500/10 dark:hover:bg-blue-500/20 hover:text-blue-600 dark:hover:text-blue-300"
                )}
                title="Insert Link"
              >
                <LinkIcon className="h-3.5 w-3.5" />
              </Button>
            }
          />
          <PopoverContent side="bottom" align="center" sideOffset={8} className="w-72 p-3 space-y-3 z-50 text-foreground bg-card/95 border border-slate-200 dark:border-white/10 shadow-2xl backdrop-blur-xl rounded-xl">
            <div className="space-y-1">
              <Label htmlFor="link-url" className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-bold">Link URL</Label>
              <Input
                id="link-url"
                size="sm"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="https://example.com"
                className="h-8 text-xs bg-slate-500/5 dark:bg-white/5 border-slate-200 dark:border-white/10 text-foreground placeholder-slate-400/80 dark:placeholder-white/30 focus-visible:ring-1 focus-visible:ring-blue-500"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="link-text" className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-bold">Display Text</Label>
              <Input
                id="link-text"
                size="sm"
                value={linkText}
                onChange={(e) => setLinkText(e.target.value)}
                placeholder="Click here"
                className="h-8 text-xs bg-slate-500/5 dark:bg-white/5 border-slate-200 dark:border-white/10 text-foreground placeholder-slate-400/80 dark:placeholder-white/30 focus-visible:ring-1 focus-visible:ring-blue-500"
              />
            </div>
            <Button
              size="sm"
              onClick={insertLink}
              disabled={!linkUrl.trim()}
              className="w-full h-8 text-xs bg-blue-600 hover:bg-blue-700 text-white font-medium"
            >
              Insert Hyperlink
            </Button>
          </PopoverContent>
        </Popover>

        {/* ── Wiki Link Popover ── */}
        <Popover open={isWikiOpen} onOpenChange={setIsWikiOpen}>
          <PopoverTrigger
            render={
              <Button
                variant="ghost"
                size="sm"
                disabled={disabled}
                className={cn(
                  "h-7 w-7 p-0 rounded-full transition-all duration-200",
                  isWikiOpen
                    ? "bg-[#1d4e89]/20 dark:bg-sky-500/30 text-[#163b68] dark:text-sky-300 ring-1 ring-[#1d4e89]/30"
                    : "text-[#1d4e89] dark:text-sky-400 hover:bg-[#1d4e89]/10 dark:hover:bg-sky-500/20"
                )}
                title="Insert Wiki Link"
              >
                <img
                  src="https://cdn.simpleicons.org/wikipedia/1d4e89"
                  className="h-3.5 w-3.5 dark:hidden"
                  alt="Wiki"
                />
                <img
                  src="https://cdn.simpleicons.org/wikipedia/38bdf8"
                  className="h-3.5 w-3.5 hidden dark:block"
                  alt="Wiki"
                />
              </Button>
            }
          />
          <PopoverContent side="bottom" align="center" sideOffset={8} className="w-80 p-3 space-y-3 z-50 text-foreground bg-card/95 border border-slate-200 dark:border-white/10 shadow-2xl backdrop-blur-xl rounded-xl">
            {/* Segment Toggle */}
            <div className="flex rounded-lg bg-slate-500/5 dark:bg-white/5 p-0.5 border border-slate-200 dark:border-white/5">
              <button
                type="button"
                onClick={() => setWikiInsertMode("link")}
                className={cn(
                  "flex-1 text-center py-1 text-[10px] font-bold rounded-md uppercase tracking-wider transition-all",
                  wikiInsertMode === "link"
                    ? "bg-white dark:bg-neutral-800 text-slate-800 dark:text-white shadow-xs"
                    : "text-slate-500 hover:text-slate-800 dark:hover:text-white"
                )}
              >
                Text Link
              </button>
              <button
                type="button"
                onClick={() => setWikiInsertMode("embed")}
                className={cn(
                  "flex-1 text-center py-1 text-[10px] font-bold rounded-md uppercase tracking-wider transition-all",
                  wikiInsertMode === "embed"
                    ? "bg-white dark:bg-neutral-800 text-[#1d4e89] dark:text-sky-300 shadow-xs"
                    : "text-slate-500 hover:text-slate-800 dark:hover:text-white"
                )}
              >
                Card Embed
              </button>
            </div>

            <div className="space-y-1 relative">
              <Label htmlFor="wiki-target" className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-bold">Wiki Article Title</Label>
              <Input
                id="wiki-target"
                size="sm"
                value={wikiTarget}
                onChange={(e) => {
                  const val = e.target.value;
                  const detected = detectWikiUrl(val);
                  if (detected) {
                    setWikiTarget(detected.title);
                    setSelectedWikiSource(detected.source);
                    setWikiSearchQuery(detected.title);
                  } else {
                    setWikiTarget(val);
                    setWikiSearchQuery(val);
                  }
                }}
                placeholder="Main Page"
                className="h-8 text-xs bg-slate-500/5 dark:bg-white/5 border-slate-200 dark:border-white/10 text-foreground placeholder-slate-400/80 dark:placeholder-white/30 focus-visible:ring-1 focus-visible:ring-blue-500"
              />
              {/* Suggestions dropdown list */}
              {wikiSearchQuery.trim().length > 1 && (
                <div className="absolute left-0 right-0 z-50 bg-card/98 border border-slate-200 dark:border-white/10 rounded-lg shadow-xl backdrop-blur-xl max-h-40 overflow-y-auto thin-scrollbar mt-1">
                  {wikiSearch.isLoading ? (
                    <div className="flex p-2 items-center justify-center text-xs text-slate-500">
                      <Loader2 className="h-3 w-3 animate-spin mr-1.5 text-blue-500" />
                      <span>Searching...</span>
                    </div>
                  ) : wikiSearch.data && wikiSearch.data.length > 0 ? (
                    <div className="p-1 space-y-0.5">
                      {wikiSearch.data.map((item) => (
                        <button
                          key={`${item.source}-${item.title}`}
                          type="button"
                          onClick={() => {
                            setWikiTarget(item.title);
                            setSelectedWikiSource(item.source);
                            if (!wikiText.trim()) {
                              setWikiText(item.title);
                            }
                            setWikiSearchQuery(""); // close dropdown
                          }}
                          className="w-full text-left truncate px-2 py-1.5 text-xs rounded-md hover:bg-slate-500/10 dark:hover:bg-white/5 text-foreground transition-colors"
                        >
                          📖 {item.title} <span className="text-[10px] text-muted-foreground ml-1">({item.source})</span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="p-3 text-center text-xs text-slate-500">
                      No articles found.
                    </div>
                  )}
                </div>
              )}
            </div>

            {wikiInsertMode === "link" && (
              <div className="space-y-1">
                <Label htmlFor="wiki-text" className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-bold">Display Text (Optional)</Label>
                <Input
                  id="wiki-text"
                  size="sm"
                  value={wikiText}
                  onChange={(e) => setWikiText(e.target.value)}
                  placeholder="Go to wiki page"
                  className="h-8 text-xs bg-slate-500/5 dark:bg-white/5 border-slate-200 dark:border-white/10 text-foreground placeholder-slate-400/80 dark:placeholder-white/30 focus-visible:ring-1 focus-visible:ring-blue-500"
                />
              </div>
            )}

            {wikiInsertMode === "embed" && (
              <>
                <div className="space-y-1">
                  <Label className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-bold">Wiki Source</Label>
                  <div className="flex gap-1">
                    {(["ixwiki", "iiwiki", "althistory"] as const).map((src) => (
                      <button
                        key={src}
                        type="button"
                        onClick={() => setSelectedWikiSource(src)}
                        className={cn(
                          "flex-1 py-1 text-[9px] font-bold rounded-md border transition-all uppercase tracking-wide",
                          selectedWikiSource === src
                            ? "bg-[#1d4e89]/15 dark:bg-sky-500/20 border-[#1d4e89]/30 dark:border-sky-500/30 text-[#1d4e89] dark:text-sky-300 font-extrabold"
                            : "border-slate-200 dark:border-white/5 hover:bg-slate-500/5 dark:hover:bg-white/5 text-slate-500"
                        )}
                      >
                        {src === "ixwiki" ? "IxWiki" : src === "iiwiki" ? "IIWiki" : "AltHist"}
                      </button>
                    ))}
                  </div>
                </div>

                {wikiTarget.trim() && (
                  <>
                    {/* Summary Excerpt */}
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-bold">Summary Preview</Label>
                      {wikiIntroQuery.isLoading ? (
                        <div className="flex items-center gap-1.5 py-1.5 justify-center bg-slate-500/5 dark:bg-white/5 rounded-lg border border-slate-200 dark:border-white/5">
                          <Loader2 className="h-3 w-3 animate-spin text-blue-500" />
                          <span className="text-[10px] text-slate-500">Fetching summary...</span>
                        </div>
                      ) : wikiIntroQuery.data ? (
                        <div className="p-2 text-[11px] leading-relaxed text-slate-600 dark:text-slate-300 bg-slate-500/5 dark:bg-white/5 rounded-lg border border-slate-200 dark:border-white/5 max-h-16 overflow-y-auto thin-scrollbar">
                          {wikiIntroQuery.data.text || "No description available."}
                        </div>
                      ) : (
                        <div className="p-2 text-[11px] text-slate-400 dark:text-slate-500 bg-slate-500/5 dark:bg-white/5 rounded-lg border border-slate-200 dark:border-white/5">
                          No preview available.
                        </div>
                      )}
                    </div>

                    {/* Image Selector Strip */}
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-bold">Thumbnail Image</Label>
                      {wikiImagesQuery.isLoading ? (
                        <div className="flex h-12 items-center justify-center bg-slate-500/5 dark:bg-white/5 rounded-lg border border-slate-200 dark:border-white/5">
                          <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
                        </div>
                      ) : (
                        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-white/10 scrollbar-track-transparent snap-x">
                          {/* No Image Option */}
                          <button
                            type="button"
                            onClick={() => setSelectedWikiImageUrl("")}
                            className={cn(
                              "flex-none w-12 h-12 rounded-lg border flex flex-col items-center justify-center text-[9px] font-bold snap-start transition-all",
                              selectedWikiImageUrl === ""
                                ? "border-blue-500 bg-blue-500/10 text-blue-600 dark:text-blue-400"
                                : "border-slate-200 dark:border-white/10 hover:border-slate-300 text-slate-500 dark:text-slate-400"
                            )}
                          >
                            No Image
                          </button>
                          {/* Retrieved Images */}
                          {wikiImagesQuery.data && wikiImagesQuery.data.length > 0 ? (
                            wikiImagesQuery.data.map((img, idx) => {
                              const url = img.thumbUrl || img.url;
                              return (
                                <button
                                  key={idx}
                                  type="button"
                                  onClick={() => setSelectedWikiImageUrl(url)}
                                  className={cn(
                                    "flex-none w-12 h-12 rounded-lg border overflow-hidden snap-start relative transition-all",
                                    selectedWikiImageUrl === url
                                      ? "border-blue-500 ring-1 ring-blue-500/30"
                                      : "border-slate-200 dark:border-white/10 hover:border-slate-300"
                                  )}
                                >
                                  <img
                                    src={url}
                                    className="w-full h-full object-cover"
                                    alt=""
                                  />
                                  {selectedWikiImageUrl === url && (
                                    <div className="absolute inset-0 bg-blue-500/20 flex items-center justify-center">
                                      <div className="h-1.5 w-1.5 rounded-full bg-white" />
                                    </div>
                                  )}
                                </button>
                              );
                            })
                          ) : (
                            <div className="flex-none text-[9px] text-slate-400 dark:text-slate-500 flex items-center justify-center px-2">
                              No page images found
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </>
            )}

            <Button
              size="sm"
              onClick={insertWikiLink}
              disabled={!wikiTarget.trim()}
              style={{ backgroundColor: "#1d4e89" }}
              className="w-full h-8 text-xs hover:bg-[#163b68] text-white font-medium transition-colors"
            >
              {wikiInsertMode === "embed" ? "Insert Card Embed" : "Insert Wiki Link"}
            </Button>
          </PopoverContent>
        </Popover>

        {/* ── Stashes Images Drawer Popover ── */}
        <Popover open={isStashesOpen} onOpenChange={setIsStashesOpen}>
          <PopoverTrigger
            render={
              <Button
                variant="ghost"
                size="sm"
                disabled={disabled}
                className={cn(
                  "h-7 w-7 p-0 rounded-full transition-all duration-200",
                  isStashesOpen
                    ? "bg-amber-500/20 dark:bg-amber-500/30 text-amber-600 dark:amber-300 ring-1 ring-amber-500/30"
                    : "text-amber-500 dark:text-amber-400 hover:bg-amber-500/10 dark:hover:bg-amber-500/20 hover:text-amber-600 dark:hover:text-amber-300"
                )}
                title="Insert Stashed Assets"
              >
                <Bookmark className="h-3.5 w-3.5" />
              </Button>
            }
          />
          <PopoverContent side="bottom" align="center" sideOffset={8} className="w-80 p-3 space-y-3 z-50 text-foreground bg-card/95 border border-slate-200 dark:border-white/10 shadow-2xl backdrop-blur-xl rounded-xl">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 pb-2">
              <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-blue-400" />
                Insert Stash Assets
              </span>
            </div>

            {/* Folder Switcher */}
            {stashes.length > 0 && (
              <div className="flex flex-col gap-1">
                <label className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-bold">Select Folder</label>
                <div className="grid grid-cols-2 gap-1 max-h-24 overflow-y-auto thin-scrollbar">
                  {stashes.map((stash) => (
                    <button
                      key={stash.id}
                      onClick={() => setSelectedStashId(stash.id)}
                      className={cn(
                        "text-left truncate px-2 py-1 text-[11px] rounded-md transition-colors border",
                        activeStashId === stash.id
                          ? "bg-blue-500/10 dark:bg-blue-500/20 border-blue-500/30 text-blue-600 dark:text-blue-300"
                          : "border-transparent hover:bg-slate-500/5 dark:hover:bg-white/5 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                      )}
                    >
                      📁 {stash.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Stash items grid */}
            <div className="max-h-52 overflow-y-auto pr-1 thin-scrollbar">
              {stashesQuery.isLoading || stashItemsQuery.isLoading ? (
                <div className="flex h-24 items-center justify-center">
                  <Loader2 className="h-5 w-5 animate-spin text-blue-400" />
                </div>
              ) : imageItems.length > 0 ? (
                <div className="grid grid-cols-3 gap-1.5">
                  {imageItems.map((item) => {
                    const cleanTitle = item.pageTitle.replace(/^commons:/, "");
                    const info = resolvedImages[cleanTitle];
                    const url = info?.url;

                    if (!url) return null;

                    return (
                      <div
                        key={item.id}
                        onClick={() => insertStashedImage(url, cleanTitle)}
                        className="group relative cursor-pointer aspect-square rounded-lg border border-slate-200 dark:border-white/5 bg-slate-500/5 dark:bg-black/30 overflow-hidden hover:border-blue-500 dark:hover:border-blue-500 transition-all duration-200"
                        title={cleanTitle}
                      >
                        <img
                          src={url}
                          alt={cleanTitle}
                          className="h-full w-full object-cover transition-transform group-hover:scale-110"
                        />
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center p-1">
                          <Plus className="h-4 w-4 text-white" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-6 text-slate-500 text-xs">
                  {activeStashId ? "No stashed Commons images in this folder." : "Please create or select a folder."}
                </div>
              )}
            </div>
          </PopoverContent>
        </Popover>

        {/* ── Emoji Picker ── */}
        <div className="h-4 w-px bg-slate-200 dark:bg-white/10 mx-0.5" />
        <EmojiPicker
          onSelectEmoji={handleSelectEmoji}
          disabled={disabled}
          onOpenChange={setIsEmojiOpen}
          side="bottom"
        />
          </div>
        </div>
      </div>

      {/* ── Editable Canvas area ── */}
      <div
        className={cn(
          "wikios-plate-content max-h-[300px] overflow-y-auto thin-scrollbar px-3.5 pt-2 pb-3 text-foreground bg-transparent outline-none transition-all duration-300 ease-in-out min-h-[96px]"
        )}
      >
        <Plate editor={editor} onChange={handleEditorChange}>
          <PlateContent
            className={cn(
              "outline-none text-sm [&_[data-slate-placeholder]]:text-slate-400 dark:[&_[data-slate-placeholder]]:text-white/30 [&_[data-slate-placeholder]]:transition-opacity [&_[data-slate-placeholder]]:duration-300 focus-within:[&_[data-slate-placeholder]]:opacity-0 [&_p]:mb-1.5 [&_p:last-child]:mb-0 transition-all duration-300 ease-in-out min-h-[80px]",
              italicPlaceholder ? "[&_[data-slate-placeholder]]:italic" : "[&_[data-slate-placeholder]]:not-italic"
            )}
            placeholder={placeholder}
            disabled={disabled}
            onKeyDown={handleKeyDown}
            onFocus={() => {
              setIsFocused(true);
              onFocus?.();
            }}
            onBlur={() => {
              setTimeout(() => {
                setIsFocused(false);
                onBlur?.();
              }, 200);
            }}
          />
        </Plate>
      </div>
    </div>
  );
});

GlassPlateEditor.displayName = "GlassPlateEditor";

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ToolbarButton({
  icon,
  title,
  active,
  onClick,
  disabled,
}: {
  icon: React.ReactNode;
  title: string;
  active?: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={disabled}
      onMouseDown={(e) => {
        e.preventDefault();
        onClick();
      }}
      className={cn(
        "h-7 w-7 p-0 rounded-full transition-all duration-200",
        active
          ? "bg-blue-500/15 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 hover:bg-blue-500/25 dark:hover:bg-blue-500/30 hover:text-blue-700 dark:hover:text-blue-300"
          : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-500/10 dark:hover:bg-white/10"
      )}
      title={title}
    >
      {icon}
    </Button>
  );
}
