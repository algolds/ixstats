"use client";
// src/components/shared/editor/useGlassPlateEditor.ts
// Hook managing PlateJS editor state, mention autocompletion, popovers, and keyboard submission.

import React, { useMemo, useState, useCallback, useEffect, useRef } from "react";
import { createPlateEditor, ParagraphPlugin } from "platejs/react";
import { Transforms, Editor, Point, Range, Text, Node as SlateNode } from "slate";
import { ReactEditor } from "slate-react";
import { api } from "~/trpc/react";
import {
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
} from "./EditorPlugins";
import { slateNodesToHtml, parsoidHtmlToSlate, toggleMark } from "./SlateSerializer";
import { userMentionItems, type MentionSource } from "./mention-source";

function getMentionItemIcon(name: string, type: "league" | "club") {
  const lower = name.toLowerCase();
  if (
    lower.includes("ball") ||
    lower.includes("football") ||
    lower.includes("soccer") ||
    lower.includes("fc") ||
    lower.includes("sc")
  )
    return "⚽";
  return type === "league" ? "🏆" : "🛡️";
}

/** The server's mention rule (`MENTION_PATTERN`): an `@` not preceded by a name character or another `@`, then the name so far. */
const TYPED_MENTION = /(?<![A-Za-z0-9_@])@[A-Za-z0-9_]*$/;

/**
 * The `@name` being typed before `cursor`, or null. Slate's word unit stops at `@` and at `_`, so it cannot find a
 * name: read the text node up to the cursor instead and apply the server's rule for where a mention may start. The
 * server parses text nodes too, so a link or a mark right before the `@` counts as the start of the text.
 */
function typedMentionRange(editor: Editor, cursor: Point): Range | null {
  const node = SlateNode.get(editor, cursor.path);
  if (!Text.isText(node)) return null;
  const typed = TYPED_MENTION.exec(node.text.slice(0, cursor.offset))?.[0];
  if (!typed) return null;
  return { anchor: { path: cursor.path, offset: cursor.offset - typed.length }, focus: cursor };
}

interface UseGlassPlateEditorProps {
  value?: string;
  onChange?: (html: string, text: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  onSubmit?: () => void;
  submitOnEnter?: boolean;
  /** Replaces the member's own personas in the @ menu (wiki and sports entries stay). */
  mentionSource?: MentionSource;
}

export function useGlassPlateEditor({
  value = "",
  onChange,
  onFocus,
  onBlur,
  onSubmit,
  submitOnEnter = false,
  mentionSource,
}: UseGlassPlateEditorProps) {
  const [_version, setVersion] = useState(0);
  const [isFocused, setIsFocused] = useState(false);

  // Formatting state
  const [isLinkOpen, setIsLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkText, setLinkText] = useState("");

  // Wiki insertion state
  const [isWikiOpen, setIsWikiOpen] = useState(false);
  const [wikiInsertMode, setWikiInsertMode] = useState<"link" | "embed">("link");
  const [wikiTarget, setWikiTarget] = useState("");
  const [wikiText, setWikiText] = useState("");
  const [selectedWikiSource, setSelectedWikiSource] = useState<"ixwiki" | "iiwiki" | "althistory">(
    "ixwiki"
  );
  const [selectedWikiImageUrl, setSelectedWikiImageUrl] = useState("");
  const [wikiSearchQuery, setWikiSearchQuery] = useState("");

  const [isEmojiOpen, setIsEmojiOpen] = useState(false);

  // Wiki search queries
  const wikiSearch = api.wikios.search.useQuery(
    { query: wikiSearchQuery, limit: 5, wikiSource: "all" },
    { enabled: isWikiOpen && wikiSearchQuery.trim().length > 1, staleTime: 10_000 }
  );

  const wikiIntroQuery = api.wikios.getIntro.useQuery(
    { title: wikiTarget, wiki: selectedWikiSource },
    { enabled: isWikiOpen && wikiInsertMode === "embed" && !!wikiTarget.trim(), staleTime: 30_000 }
  );

  const wikiImagesQuery = api.wikios.getPageImages.useQuery(
    { title: wikiTarget, wiki: selectedWikiSource },
    { enabled: isWikiOpen && wikiInsertMode === "embed" && !!wikiTarget.trim(), staleTime: 30_000 }
  );

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

  // Mention State
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionCoords, setMentionCoords] = useState<{ top: number; left: number } | null>(null);
  const [mentionRange, setMentionRange] = useState<Range | null>(null);
  const [mentionSelectedIndex, setMentionSelectedIndex] = useState(0);

  // The member's own personas, unless a source replaces them (a source also makes the menu people only).
  const mentionSearch = api.thinkpages.getMyAccounts.useQuery(undefined, {
    staleTime: 60_000,
    enabled: !mentionSource,
  });
  const hasMentionSource = !!mentionSource;
  const onMentionQueryChange = mentionSource?.onQueryChange;
  useEffect(() => {
    onMentionQueryChange?.(mentionQuery);
  }, [mentionQuery, onMentionQueryChange]);
  // A new query is a new list: start on its first row.
  useEffect(() => {
    setMentionSelectedIndex(0);
  }, [mentionQuery]);

  const wikiSearchForMention = api.wikios.search.useQuery(
    { query: mentionQuery, limit: 3, wikiSource: "all" },
    { enabled: !mentionSource && mentionQuery.trim().length > 1, staleTime: 10_000 }
  );

  const sportsMentionSearch = api.sports.searchSportsEntities.useQuery(
    { query: mentionQuery },
    { enabled: !mentionSource && mentionQuery.trim().length > 1, staleTime: 10_000 }
  );

  const mentionResults = useMemo(() => {
    const results: Array<{
      type: "user" | "wiki" | "league" | "club";
      id: string;
      name: string;
      description: string;
      icon: string;
      raw: any;
    }> = [];

    results.push(...userMentionItems(mentionSource, mentionSearch.data, mentionQuery));

    // A disabled query still returns what react-query cached for its key, so a forum menu must not read them.
    if (!mentionSource && sportsMentionSearch.data) {
      for (const l of sportsMentionSearch.data.leagues || []) {
        results.push({
          type: "league",
          id: l.id,
          name: l.name,
          description: "Sports League",
          icon: getMentionItemIcon(l.name, "league"),
          raw: l,
        });
      }
      for (const t of sportsMentionSearch.data.teams || []) {
        results.push({
          type: "club",
          id: t.id,
          name: t.name,
          description: t.leagueName ? `Sports Club (${t.leagueName})` : "Sports Club",
          icon: getMentionItemIcon(t.name, "club"),
          raw: t,
        });
      }
    }

    if (!mentionSource && wikiSearchForMention.data) {
      for (const w of wikiSearchForMention.data) {
        results.push({
          type: "wiki",
          id: w.title,
          name: `[[${w.title}]]`,
          description: `${w.source.toUpperCase()} Article`,
          icon: "📖",
          raw: w,
        });
      }
    }

    return results.slice(0, 6);
  }, [
    mentionQuery,
    mentionSource,
    mentionSearch.data,
    wikiSearchForMention.data,
    sportsMentionSearch.data,
  ]);

  // Lore Stash State
  const [isStashesOpen, setIsStashesOpen] = useState(false);
  const stashesQuery = api.wikios.getStashes.useQuery(undefined, {
    staleTime: 30_000,
    enabled: isStashesOpen,
  });
  const stashes = stashesQuery.data || [];
  const defaultStash = stashes.find((s) => s.isDefault) || stashes[0];
  const [selectedStashId, setSelectedStashId] = useState<string | null>(null);
  const activeStashId = selectedStashId || defaultStash?.id || "";

  const stashItemsQuery = api.wikios.getStashItems.useQuery(
    { stashId: activeStashId, limit: 50 },
    { enabled: isStashesOpen && !!activeStashId, staleTime: 10_000 }
  );
  const stashItems = stashItemsQuery.data?.items || [];
  const imageItems = useMemo(
    () => stashItems.filter((item) => item.pageTitle.startsWith("commons:")),
    // oxlint-disable-next-line
    [stashItems]
  );
  const imageTitles = useMemo(
    () => imageItems.map((item) => item.pageTitle.replace(/^commons:/, "")),
    [imageItems]
  );

  const { data: resolvedImagesList } = api.commons.getImageInfoByTitles.useQuery(
    { titles: imageTitles },
    { enabled: isStashesOpen && imageTitles.length > 0, staleTime: 5 * 60 * 1000 }
  );

  const resolvedImages = useMemo(() => {
    const map: Record<string, any> = {};
    if (resolvedImagesList) {
      for (const img of resolvedImagesList) {
        map[`commons:${img.title}`] = img;
      }
    }
    return map;
  }, [resolvedImagesList]);

  const lastEmittedHtmlRef = useRef<string | null>(null);
  const lastEmittedPlainRef = useRef<string | null>(null);

  // Initial Slate state (computed once on initial mount)
  const initialValue = useMemo(() => {
    if (!value || value.trim() === "") {
      return [{ type: "p", children: [{ text: "" }] }];
    }
    return parsoidHtmlToSlate(value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Initialize Editor once
  const editor = useMemo(() => {
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
      value: initialValue,
    });
  }, [initialValue]);

  // Sync editor if external value changes from outside (e.g. reset or prefilled)
  useEffect(() => {
    if (!value || value === "") {
      if (lastEmittedHtmlRef.current !== "" && lastEmittedPlainRef.current !== "") {
        editor.tf.setValue([{ type: "p", children: [{ text: "" }] }]);
        lastEmittedHtmlRef.current = "";
        lastEmittedPlainRef.current = "";
        setVersion((v) => v + 1);
      }
      return;
    }

    if (value !== lastEmittedHtmlRef.current && value !== lastEmittedPlainRef.current) {
      try {
        const newNodes = parsoidHtmlToSlate(value);
        editor.tf.setValue(newNodes);
        lastEmittedHtmlRef.current = value;
        setVersion((v) => v + 1);
      } catch (e) {
        console.warn("Failed to sync external value to Plate editor:", e);
      }
    }
  }, [value, editor]);

  // Change handler
  const handleEditorChange = useCallback(
    ({ value: slateValue }: any) => {
      const html = slateNodesToHtml(slateValue);
      const plainText = slateValue
        .map((n: any) => SlateNode.string(n))
        .join("\n")
        .trim();

      lastEmittedHtmlRef.current = html;
      lastEmittedPlainRef.current = plainText;

      onChange?.(html, plainText);
      setVersion((v) => v + 1);

      // Mention checking
      const { selection } = editor;
      if (selection && Range.isCollapsed(selection)) {
        const [start] = Range.edges(selection);
        // Only the forum's source reads the typed name; every other editor keeps opening on a bare `@`.
        const wordRange = hasMentionSource
          ? (typedMentionRange(editor as never, start) ?? Editor.range(editor as any, start, start))
          : Editor.range(
              editor as any,
              Editor.before(editor as any, start, { unit: "word" }) || start,
              start
            );
        const wordText = Editor.string(editor as any, wordRange);

        if (wordText.startsWith("@")) {
          setMentionQuery(wordText.slice(1));
          setMentionRange(wordRange);
          try {
            const domSelection = window.getSelection();
            if (domSelection && domSelection.rangeCount > 0) {
              const domRange = domSelection.getRangeAt(0);
              const rect = domRange.getBoundingClientRect();
              setMentionCoords({
                top: rect.bottom + window.scrollY,
                left: rect.left + window.scrollX,
              });
            }
          } catch {
            setMentionCoords(null);
          }
          return;
        }
      }

      setMentionCoords(null);
      setMentionRange(null);
      setMentionQuery("");
    },
    [editor, onChange, hasMentionSource]
  );

  // Mention selection
  const handleSelectMention = useCallback(
    (index: number) => {
      const item = mentionResults[index];
      if (!item || !mentionRange) return;

      Transforms.select(editor as any, mentionRange);

      if (item.type === "wiki") {
        Transforms.insertNodes(
          editor as any,
          {
            type: "wikilink",
            target: item.id,
            children: [{ text: item.id }],
          } as any
        );
      } else {
        Transforms.insertText(editor as any, `${item.name} `);
      }

      setMentionCoords(null);
      setMentionRange(null);
      setMentionQuery("");
      setMentionSelectedIndex(0);
      ReactEditor.focus(editor as any);
    },
    [editor, mentionRange, mentionResults]
  );

  // Keyboard navigation for mentions + Enter submission
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (mentionCoords && mentionResults.length > 0) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setMentionSelectedIndex((prev) => (prev + 1) % mentionResults.length);
          return;
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          setMentionSelectedIndex(
            (prev) => (prev - 1 + mentionResults.length) % mentionResults.length
          );
          return;
        }
        if (e.key === "Enter" || e.key === "Tab") {
          e.preventDefault();
          handleSelectMention(Math.min(mentionSelectedIndex, mentionResults.length - 1));
          return;
        }
        if (e.key === "Escape") {
          e.preventDefault();
          setMentionCoords(null);
          return;
        }
      }

      if (submitOnEnter && e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        onSubmit?.();
        return;
      }

      if ((e.metaKey || e.ctrlKey) && !e.shiftKey) {
        switch (e.key.toLowerCase()) {
          case "b":
            e.preventDefault();
            toggleMark(editor as any, "bold");
            setVersion((v) => v + 1);
            break;
          case "i":
            e.preventDefault();
            toggleMark(editor as any, "italic");
            setVersion((v) => v + 1);
            break;
          case "u":
            e.preventDefault();
            toggleMark(editor as any, "underline");
            setVersion((v) => v + 1);
            break;
          case "k":
            e.preventDefault();
            setIsLinkOpen(true);
            break;
        }
      }
    },
    [
      mentionCoords,
      mentionResults.length,
      mentionSelectedIndex,
      handleSelectMention,
      submitOnEnter,
      onSubmit,
      editor,
    ]
  );

  // Insert helpers
  const insertLink = useCallback(() => {
    if (!linkUrl.trim()) return;
    const textToInsert = linkText.trim() || linkUrl.trim();
    Transforms.insertNodes(
      editor as any,
      {
        type: "link",
        url: linkUrl.trim(),
        children: [{ text: textToInsert }],
      } as any
    );
    setIsLinkOpen(false);
    setLinkUrl("");
    setLinkText("");
    ReactEditor.focus(editor as any);
  }, [editor, linkUrl, linkText]);

  const insertWikiLink = useCallback(() => {
    if (!wikiTarget.trim()) return;
    if (wikiInsertMode === "embed") {
      Transforms.insertNodes(
        editor as any,
        {
          type: "wikiembed",
          title: wikiTarget.trim(),
          summary: wikiIntroQuery.data?.intro || "",
          imageUrl: selectedWikiImageUrl || "",
          source: selectedWikiSource,
          children: [{ text: "" }],
        } as any
      );
    } else {
      const textToInsert = wikiText.trim() || wikiTarget.trim();
      Transforms.insertNodes(
        editor as any,
        {
          type: "wikilink",
          target: wikiTarget.trim(),
          children: [{ text: textToInsert }],
        } as any
      );
    }
    setIsWikiOpen(false);
    setWikiTarget("");
    setWikiText("");
    setSelectedWikiImageUrl("");
    ReactEditor.focus(editor as any);
  }, [
    editor,
    wikiTarget,
    wikiInsertMode,
    wikiIntroQuery.data,
    selectedWikiImageUrl,
    selectedWikiSource,
    wikiText,
  ]);

  const insertImageUrl = useCallback(
    (url: string, alt = "") => {
      Transforms.insertNodes(
        editor as any,
        {
          type: "img",
          src: url,
          alt,
          children: [{ text: "" }],
        } as any
      );
      ReactEditor.focus(editor as any);
    },
    [editor]
  );

  const insertStashedImage = useCallback(
    (url: string, title: string) => {
      insertImageUrl(url, title);
      setIsStashesOpen(false);
    },
    [insertImageUrl]
  );

  const handleSelectEmoji = useCallback(
    (emoji: string) => {
      Transforms.insertText(editor as any, emoji);
      setIsEmojiOpen(false);
      ReactEditor.focus(editor as any);
    },
    [editor]
  );

  return {
    editor,
    version: _version,
    isFocused,
    setIsFocused,
    onFocus,
    onBlur,
    handleEditorChange,
    handleKeyDown,
    isLinkOpen,
    setIsLinkOpen,
    linkUrl,
    setLinkUrl,
    linkText,
    setLinkText,
    insertLink,
    isWikiOpen,
    setIsWikiOpen,
    wikiInsertMode,
    setWikiInsertMode,
    wikiTarget,
    setWikiTarget,
    wikiText,
    setWikiText,
    selectedWikiSource,
    setSelectedWikiSource,
    selectedWikiImageUrl,
    setSelectedWikiImageUrl,
    wikiSearchQuery,
    setWikiSearchQuery,
    wikiSearch,
    wikiIntroQuery,
    wikiImagesQuery,
    insertWikiLink,
    mentionCoords,
    mentionResults,
    mentionSelectedIndex,
    mentionQuery,
    mentionSearch,
    mentionLoading: mentionSource ? mentionSource.isLoading : mentionSearch.isLoading,
    handleSelectMention,
    isStashesOpen,
    setIsStashesOpen,
    stashes,
    activeStashId,
    setSelectedStashId,
    stashesQuery,
    stashItemsQuery,
    imageItems,
    resolvedImages,
    insertStashedImage,
    insertImageUrl,
    isEmojiOpen,
    setIsEmojiOpen,
    handleSelectEmoji,
  };
}
