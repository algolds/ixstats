"use client";

import React, { useMemo, useState, useCallback, useEffect } from "react";
import { createPlateEditor, ParagraphPlugin } from "platejs/react";
import { Transforms, Editor, Range } from "slate";
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

export interface UseGlassPlateEditorProps {
  value?: string;
  onChange: (html: string, text: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
}

export function useGlassPlateEditor({
  value = "",
  onChange,
  onFocus,
  onBlur,
}: UseGlassPlateEditorProps) {
  const [version, setVersion] = useState(0);
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

  const wikiIntroQuery = api.wiki.getIntro.useQuery(
    { title: wikiTarget, wiki: selectedWikiSource },
    { enabled: isWikiOpen && wikiInsertMode === "embed" && !!wikiTarget.trim(), staleTime: 30_000 }
  );

  const wikiImagesQuery = api.wiki.getPageImages.useQuery(
    { title: wikiTarget },
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

  // Stashes states
  const [isStashesOpen, setIsStashesOpen] = useState(false);
  const [selectedStashId, setSelectedStashId] = useState<string | null>(null);

  const stashesQuery = api.wikios.getStashes.useQuery(undefined, {
    enabled: isStashesOpen,
    staleTime: 30_000,
  });
  const stashes = stashesQuery.data || [];
  const defaultStash = stashes.find((s: any) => s.isDefault) || stashes[0];
  const activeStashId = selectedStashId || defaultStash?.id || "";

  const stashItemsQuery = api.wikios.getStashItems.useQuery(
    { stashId: activeStashId, limit: 50 },
    { enabled: isStashesOpen && !!activeStashId, staleTime: 10_000 }
  );
  const stashItems = stashItemsQuery.data?.items || [];

  const imageItems = useMemo(() => {
    return stashItems.filter((item: any) => item.pageTitle.startsWith("commons:"));
  }, [stashItems]);

  const imageTitles = useMemo(() => {
    return imageItems.map((item: any) => item.pageTitle.replace(/^commons:/, ""));
  }, [imageItems]);

  const resolvedImagesQuery = api.commons.getImageInfoByTitles.useQuery(
    { titles: imageTitles },
    { enabled: isStashesOpen && imageTitles.length > 0, staleTime: 5 * 60 * 1000 }
  );
  const resolvedImages = resolvedImagesQuery.data || {};

  // Mention Autocomplete States
  const [showMentionMenu, setShowMentionMenu] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionCoords, setMentionCoords] = useState<{ top: number; left: number } | null>(null);
  const [selectedMentionIndex, setSelectedMentionIndex] = useState(0);

  const accountsSearch = api.thinkpages.searchAccounts.useQuery(
    { query: mentionQuery },
    { enabled: showMentionMenu && mentionQuery.trim().length > 0, staleTime: 10_000 }
  );

  const sportsSearch = api.sports.searchSportsEntities.useQuery(
    { query: mentionQuery },
    { enabled: showMentionMenu && mentionQuery.trim().length > 0, staleTime: 10_000 }
  );

  const countriesSearch = api.countries.getSelectList.useQuery(
    { search: mentionQuery, limit: 5 },
    { enabled: showMentionMenu && mentionQuery.trim().length > 0, staleTime: 10_000 }
  );

  const combinedMentionResults = useMemo(() => {
    const list: {
      type: "user" | "league" | "club" | "country";
      id: string;
      name: string;
      description: string;
      icon: string;
      url: string;
    }[] = [];

    if (!showMentionMenu) return list;

    if (accountsSearch.data) {
      accountsSearch.data.forEach((acc: any) => {
        list.push({
          type: "user",
          id: acc.id,
          name: acc.username,
          description: `${acc.displayName} (${acc.accountType || "Citizen"})`,
          icon: "👤",
          url: `@${acc.username}`,
        });
      });
    }

    if (sportsSearch.data?.leagues) {
      sportsSearch.data.leagues.forEach((league: any) => {
        list.push({
          type: "league",
          id: league.id,
          name: league.name,
          description: `League · ${league.sportPreset?.toUpperCase() || "SPORTS"}`,
          icon: getMentionItemIcon(league.name, "league"),
          url: `/myleague/${league.id}`,
        });
      });
    }

    if (sportsSearch.data?.teams) {
      sportsSearch.data.teams.forEach((team: any) => {
        list.push({
          type: "club",
          id: team.id,
          name: team.name,
          description: `Club · ${team.leagueName || "Sports"}`,
          icon: getMentionItemIcon(team.name, "club"),
          url: `/myclub/${team.id}`,
        });
      });
    }

    if (countriesSearch.data) {
      countriesSearch.data.forEach((country: any) => {
        list.push({
          type: "country",
          id: country.slug || country.id,
          name: country.name,
          description: `Country · ${country.continent || "Global"}`,
          icon: "🌐",
          url: `/countries/${country.slug || country.id}`,
        });
      });
    }

    return list;
  }, [showMentionMenu, accountsSearch.data, sportsSearch.data, countriesSearch.data]);

  const editor = useMemo(() => {
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
      ReactEditor.focus(editor as any);
    } catch (err) {
      try {
        const domNode = ReactEditor.toDOMNode(editor as any, editor as any);
        domNode?.focus();
      } catch (domErr) {}
    }
  }, [editor]);

  const handleEditorChange = useCallback(() => {
    setVersion((v) => v + 1);
    try {
      const html = slateNodesToHtml(editor.children as any[]);
      const plainText = Editor.string(editor as any, []);
      onChange(html, plainText);

      const { selection } = editor;
      if (selection && Range.isCollapsed(selection)) {
        try {
          const blockStart = Editor.start(editor as any, selection.focus.path);
          const textToCursor = Editor.string(editor as any, {
            anchor: blockStart,
            focus: selection.focus,
          });

          const match = textToCursor.match(/@([a-zA-Z0-9_\s]*)$/);
          if (match) {
            const query = match[1] || "";
            setMentionQuery(query);
            setShowMentionMenu(true);
            setSelectedMentionIndex(0);

            setTimeout(() => {
              const domSelection = window.getSelection();
              if (domSelection && domSelection.rangeCount > 0) {
                const domRange = domSelection.getRangeAt(0);
                const rect = domRange.getBoundingClientRect();
                setMentionCoords({
                  top: rect.bottom + window.scrollY,
                  left: rect.left + window.scrollX,
                });
              }
            }, 0);
          } else {
            setShowMentionMenu(false);
            setMentionCoords(null);
          }
        } catch {}
      } else {
        setShowMentionMenu(false);
        setMentionCoords(null);
      }
    } catch (err) {
      console.warn("Failed to serialize Slate content to HTML:", err);
    }
  }, [editor, onChange]);

  const handleSelectMention = useCallback(
    (index: number) => {
      const item = combinedMentionResults[index];
      if (!item) return;

      safeFocus();

      const { selection } = editor;
      if (!selection) return;

      const totalChars = mentionQuery.length + 1;
      const startPoint = Editor.before(editor as any, selection.focus, {
        distance: totalChars,
        unit: "character",
      });

      if (startPoint) {
        Transforms.select(editor as any, { anchor: startPoint, focus: selection.focus });
      }

      if (item.type === "user") {
        Transforms.insertText(editor as any, `@${item.name} `);
      } else {
        Transforms.insertNodes(
          editor as any,
          [
            {
              type: "link",
              url: item.url,
              children: [{ text: item.name }],
            },
            { text: " " },
          ] as any
        );
      }

      setShowMentionMenu(false);
      setMentionCoords(null);
      setMentionQuery("");
      setSelectedMentionIndex(0);
      handleEditorChange();
    },
    [editor, combinedMentionResults, mentionQuery, safeFocus, handleEditorChange]
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (showMentionMenu && mentionCoords && combinedMentionResults.length > 0) {
        const resultsCount = combinedMentionResults.length;

        if (event.key === "ArrowDown") {
          event.preventDefault();
          setSelectedMentionIndex((prev) => (prev + 1) % resultsCount);
          return;
        }
        if (event.key === "ArrowUp") {
          event.preventDefault();
          setSelectedMentionIndex((prev) => (prev - 1 + resultsCount) % resultsCount);
          return;
        }
        if (event.key === "Enter") {
          event.preventDefault();
          handleSelectMention(selectedMentionIndex);
          return;
        }
        if (event.key === "Escape") {
          event.preventDefault();
          setShowMentionMenu(false);
          setMentionCoords(null);
          return;
        }
      }

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
    [
      showMentionMenu,
      mentionCoords,
      combinedMentionResults,
      selectedMentionIndex,
      handleSelectMention,
      editor,
      handleEditorChange,
    ]
  );

  const handleSelectEmoji = useCallback(
    (emoji: string) => {
      safeFocus();
      try {
        Transforms.insertText(editor as any, emoji);
      } catch (err) {
        const lastNodePath = [editor.children.length - 1];
        Transforms.insertText(editor as any, emoji, { at: lastNodePath });
      }
      handleEditorChange();
    },
    [editor, safeFocus, handleEditorChange]
  );

  const insertLink = useCallback(() => {
    if (!linkUrl.trim()) return;

    safeFocus();

    Transforms.insertNodes(
      editor as any,
      [
        {
          type: "link",
          url: linkUrl.startsWith("http") ? linkUrl : `https://${linkUrl}`,
          children: [{ text: linkText.trim() || linkUrl }],
        },
        { text: " " },
      ] as any
    );

    setLinkUrl("");
    setLinkText("");
    setIsLinkOpen(false);
    handleEditorChange();
  }, [editor, linkUrl, linkText, safeFocus, handleEditorChange]);

  const insertWikiLink = useCallback(() => {
    if (!wikiTarget.trim()) return;

    safeFocus();

    if (wikiInsertMode === "embed") {
      Transforms.insertNodes(
        editor as any,
        [
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
            children: [{ text: "" }],
          },
        ] as any
      );
    } else {
      Transforms.insertNodes(
        editor as any,
        [
          {
            type: "wikilink",
            target: wikiTarget.trim(),
            children: [{ text: wikiText.trim() || wikiTarget }],
          },
          { text: " " },
        ] as any
      );
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
    safeFocus,
    handleEditorChange,
  ]);

  const insertStashedImage = useCallback(
    (imageUrl: string, title: string) => {
      safeFocus();

      Transforms.insertNodes(
        editor as any,
        [
          {
            type: "img",
            src: imageUrl,
            alt: title || "Stashed Image",
            children: [{ text: "" }],
          },
          {
            type: "p",
            children: [{ text: "" }],
          },
        ] as any
      );

      setIsStashesOpen(false);
      handleEditorChange();
    },
    [editor, safeFocus, handleEditorChange]
  );

  return {
    editor,
    version,
    isFocused,
    setIsFocused,
    isLinkOpen,
    setIsLinkOpen,
    linkUrl,
    setLinkUrl,
    linkText,
    setLinkText,
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
    isEmojiOpen,
    setIsEmojiOpen,
    isStashesOpen,
    setIsStashesOpen,
    stashes,
    activeStashId,
    setSelectedStashId,
    stashesQuery,
    stashItemsQuery,
    imageItems,
    resolvedImages,
    showMentionMenu,
    mentionCoords,
    selectedMentionIndex,
    mentionQuery,
    accountsSearch,
    sportsSearch,
    countriesSearch,
    combinedMentionResults,
    handleEditorChange,
    handleSelectMention,
    handleKeyDown,
    handleSelectEmoji,
    insertLink,
    insertWikiLink,
    insertStashedImage,
  };
}
