// src/components/wiki-os/editor/WikiSourceEditor.tsx
// Wikitext source editor — VS Code + Google Docs hybrid.
// CodeMirror 6 with wikitext toolbar, word count, save panel.

"use client";
import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { motion } from "motion/react";
import { useNavigationScroll } from "~/hooks/useNavigationScroll";
import { Eye, EyeOff, X } from "lucide-react";
import { api } from "~/trpc/react";
import { ImageSearchModal } from "~/components/wiki-os/editor/ImageSearchModal";
import {
  InfoboxCountryModal,
  CountryStatsModal,
  BusinessStatsModal,
  MapCoordsModal,
} from "~/components/wiki-os/editor/WikiTemplateModals";
import { AppleSwitch } from "~/components/ui/apple-switch";
import { useNotify } from "~/hooks/useNotify";
import { cn } from "~/lib/utils";
import { CANVAS_VERSION } from "~/lib/buildVersion";
import {
  DynamicIslandEffects,
  DYNAMIC_ISLAND_STYLE,
  DYNAMIC_ISLAND_BORDER_CLASS,
} from "~/app/builder/components/glass";

import {
  EditorView,
  keymap,
  lineNumbers,
  highlightActiveLine,
  highlightActiveLineGutter,
  drawSelection,
  rectangularSelection,
  Decoration,
  ViewPlugin,
} from "@codemirror/view";
import type { DecorationSet, ViewUpdate } from "@codemirror/view";
import { EditorState, RangeSetBuilder, Compartment, Prec } from "@codemirror/state";
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
  undo,
  redo,
} from "@codemirror/commands";
import {
  syntaxHighlighting,
  defaultHighlightStyle,
  bracketMatching,
  foldGutter,
} from "@codemirror/language";
import { highlightSelectionMatches, searchKeymap } from "@codemirror/search";
import { autocompletion, closeBrackets } from "@codemirror/autocomplete";
import {
  Bold,
  Italic,
  Link2,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Undo2,
  Redo2,
  Save,
  FileText,
  Image,
  Table,
  Code,
  Strikethrough,
  Subscript,
  Superscript,
  Quote,
  Minus,
  ExternalLink,
  Hash,
  FileCode,
  Type,
  ChevronDown,
  Sparkles,
  // eslint-disable-next-line unused-imports/no-unused-imports
  MapPin,
  Map as MapIcon,
  Globe,
  Crown,
  Bookmark,
  Copy,
  Check,
  Loader2,
  Settings,
} from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "~/components/ui/popover";

const headingDeco = Decoration.mark({ class: "cm-wikitext-heading" });
const listDeco = Decoration.mark({ class: "cm-wikitext-list" });
const boldDeco = Decoration.mark({ class: "cm-wikitext-bold" });
const italicDeco = Decoration.mark({ class: "cm-wikitext-italic" });
const linkDeco = Decoration.mark({ class: "cm-wikitext-link" });
const extlinkDeco = Decoration.mark({ class: "cm-wikitext-extlink" });
const templateDeco = Decoration.mark({ class: "cm-wikitext-template" });
const refDeco = Decoration.mark({ class: "cm-wikitext-ref" });

const wikitextHighlightPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = this.buildDecorations(view);
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = this.buildDecorations(update.view);
      }
    }

    buildDecorations(view: EditorView): DecorationSet {
      const builder = new RangeSetBuilder<Decoration>();

      for (const { from, to } of view.visibleRanges) {
        let pos = from;
        while (pos < to) {
          const line = view.state.doc.lineAt(pos);
          const lineText = line.text;
          const lineFrom = line.from;
          const lineTo = line.to;

          const matches: { from: number; to: number; deco: Decoration }[] = [];

          // 1. Headings
          const headingMatch = /^(={1,6})\s*(.+?)\s*\1\s*$/.exec(lineText);
          if (headingMatch) {
            matches.push({ from: lineFrom, to: lineTo, deco: headingDeco });
          } else {
            // 2. Lists
            const listMatch = /^([\*#\:\;]+)/.exec(lineText);
            if (listMatch) {
              matches.push({
                from: lineFrom,
                to: lineFrom + listMatch[1]!.length,
                deco: listDeco,
              });
            }
          }

          // 3. Bold: '''text'''
          const boldRegex = /'''([^'\n]+?)'''/g;
          let m;
          while ((m = boldRegex.exec(lineText)) !== null) {
            matches.push({
              from: lineFrom + m.index,
              to: lineFrom + m.index + m[0].length,
              deco: boldDeco,
            });
          }

          // 4. Italic: ''text''
          const italicRegex = /''([^'\n]+?)''/g;
          while ((m = italicRegex.exec(lineText)) !== null) {
            const start = m.index;
            const end = m.index + m[0].length;
            const isBoldStart = start > 0 && lineText[start - 1] === "'";
            const isBoldEnd = end < lineText.length && lineText[end] === "'";
            if (!isBoldStart && !isBoldEnd) {
              matches.push({
                from: lineFrom + start,
                to: lineFrom + end,
                deco: italicDeco,
              });
            }
          }

          // 5. Wiki Links: [[Page]] or [[Page|Title]]
          const wikiLinkRegex = /\[\[([^\]\n]+?)\]\]/g;
          while ((m = wikiLinkRegex.exec(lineText)) !== null) {
            matches.push({
              from: lineFrom + m.index,
              to: lineFrom + m.index + m[0].length,
              deco: linkDeco,
            });
          }

          // 6. External Links: [URL Title] or [URL]
          const extLinkRegex = /\[([^\[\]\n]+?)\]/g;
          while ((m = extLinkRegex.exec(lineText)) !== null) {
            const start = m.index;
            const end = m.index + m[0].length;
            const isWikiStart = start > 0 && lineText[start - 1] === "[";
            const isWikiEnd = end < lineText.length && lineText[end] === "]";
            if (!isWikiStart && !isWikiEnd) {
              matches.push({
                from: lineFrom + start,
                to: lineFrom + end,
                deco: extlinkDeco,
              });
            }
          }

          // 7. Templates: {{template}}
          const templateRegex = /\{\{([^\}\n]+?)\}\}/g;
          while ((m = templateRegex.exec(lineText)) !== null) {
            matches.push({
              from: lineFrom + m.index,
              to: lineFrom + m.index + m[0].length,
              deco: templateDeco,
            });
          }

          // 8. References: <ref>...</ref>
          const refRegex = /<ref[^>]*>|<\/ref>/gi;
          while ((m = refRegex.exec(lineText)) !== null) {
            matches.push({
              from: lineFrom + m.index,
              to: lineFrom + m.index + m[0].length,
              deco: refDeco,
            });
          }

          // Sort matches
          matches.sort((a, b) => {
            if (a.from !== b.from) return a.from - b.from;
            return b.to - a.to;
          });

          // Resolve overlaps/nesting
          const activeRanges: typeof matches = [];
          const validMatches: typeof matches = [];

          for (const match of matches) {
            while (
              activeRanges.length > 0 &&
              activeRanges[activeRanges.length - 1]!.to <= match.from
            ) {
              activeRanges.pop();
            }
            if (activeRanges.length > 0) {
              const parent = activeRanges[activeRanges.length - 1]!;
              if (match.to > parent.to) {
                match.to = parent.to;
              }
            }
            if (match.from < match.to) {
              validMatches.push(match);
              activeRanges.push(match);
            }
          }

          // Add to builder
          for (const match of validMatches) {
            builder.add(match.from, match.to, match.deco);
          }

          pos = line.to + 1;
        }
      }

      return builder.finish();
    }
  },
  {
    decorations: (v) => v.decorations,
  }
);

const wrapSelectionCM = (view: EditorView, before: string, after: string) => {
  const { from, to } = view.state.selection.main;
  const selected = view.state.sliceDoc(from, to);
  view.dispatch({
    changes: { from, to, insert: `${before}${selected}${after}` },
    selection: { anchor: from + before.length, head: to + before.length },
    userEvent: "input",
  });
  return true;
};

interface WikiSourceEditorProps {
  initialWikitext: string;
  title: string;
  onSave: (
    wikitext: string,
    summary: string,
    minor: boolean,
    keepEditing?: boolean
  ) => Promise<void> | void;
  onCancel: () => void;
  onSwitchToVisual?: (dirty: boolean, currentWikitext: string) => void;
}

export function WikiSourceEditor({
  initialWikitext,
  title,
  onSave,
  onCancel,
  onSwitchToVisual,
}: WikiSourceEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const [summary, setSummary] = useState("");
  const [minor, setMinor] = useState(false);
  const [showSavePanel, setShowSavePanel] = useState(false);
  const [showImageSearch, setShowImageSearch] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const notify = useNotify();
  const [saveDropdownOpen, setSaveDropdownOpen] = useState(false);
  const [saveActionType, setSaveActionType] = useState<"publish" | "session">("publish");
  const { scrollY } = useNavigationScroll();
  const repulsionProgress = Math.min(1, Math.max(0, scrollY / 56));
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [showLineNumbers, setShowLineNumbers] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("wikios-editor-line-numbers") !== "false";
    }
    return true;
  });

  const [enableWordWrap, setEnableWordWrap] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("wikios-editor-word-wrap") !== "false";
    }
    return true;
  });

  const [enableAutocomplete, setEnableAutocomplete] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("wikios-editor-autocomplete") !== "false";
    }
    return true;
  });

  // CodeMirror 6 Compartments for dynamic configuration reconfiguration
  const lineNumbersComp = useRef(new Compartment());
  const wordWrapComp = useRef(new Compartment());
  const autocompleteComp = useRef(new Compartment());

  const handleToggleLineNumbers = useCallback((val: boolean) => {
    setShowLineNumbers(val);
    localStorage.setItem("wikios-editor-line-numbers", String(val));
  }, []);

  const handleToggleWordWrap = useCallback((val: boolean) => {
    setEnableWordWrap(val);
    localStorage.setItem("wikios-editor-word-wrap", String(val));
  }, []);

  const handleToggleAutocomplete = useCallback((val: boolean) => {
    setEnableAutocomplete(val);
    localStorage.setItem("wikios-editor-autocomplete", String(val));
  }, []);

  // Sync preferences with CodeMirror dynamically
  useEffect(() => {
    if (viewRef.current) {
      viewRef.current.dispatch({
        effects: [
          lineNumbersComp.current.reconfigure(
            showLineNumbers ? [lineNumbers(), highlightActiveLineGutter(), foldGutter()] : []
          ),
        ],
      });
    }
  }, [showLineNumbers]);

  useEffect(() => {
    if (viewRef.current) {
      viewRef.current.dispatch({
        effects: [wordWrapComp.current.reconfigure(enableWordWrap ? EditorView.lineWrapping : [])],
      });
    }
  }, [enableWordWrap]);

  useEffect(() => {
    if (viewRef.current) {
      viewRef.current.dispatch({
        effects: [
          autocompleteComp.current.reconfigure(
            enableAutocomplete ? [autocompletion(), closeBrackets()] : []
          ),
        ],
      });
    }
  }, [enableAutocomplete]);
  const [wordCount, setWordCount] = useState(0);
  const [lineCount, setLineCount] = useState(0);
  const [cursorPos, setCursorPos] = useState({ line: 1, col: 1 });
  const [showPreview, setShowPreview] = useState(false);
  const [showInfoboxModal, setShowInfoboxModal] = useState(false);
  const [showCountryStatsModal, setShowCountryStatsModal] = useState(false);
  const [showBusinessStatsModal, setShowBusinessStatsModal] = useState(false);
  const [showMapCoordsModal, setShowMapCoordsModal] = useState(false);
  const [previewHtml, setPreviewHtml] = useState("");
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [stashesOpen, setStashesOpen] = useState(false);
  const previewTimerRef = useRef<NodeJS.Timeout | null>(null);
  const refreshPreviewRef = useRef<() => void>(() => {});
  const previewMutation = api.wikios.previewWikitext.useMutation({
    onSuccess: (data) => setPreviewHtml(data.html),
  });

  // --- Stashed Images Setup ---
  const stashesQuery = api.wikios.getStashes.useQuery(undefined, {
    staleTime: 30_000,
  });
  const stashes = stashesQuery.data || [];
  const defaultStash = stashes.find((s) => s.isDefault) || stashes[0];
  const [selectedStashId, setSelectedStashId] = useState<string | null>(null);
  const activeStashId = selectedStashId || defaultStash?.id || "";

  const stashItemsQuery = api.wikios.getStashItems.useQuery(
    { stashId: activeStashId, limit: 50 },
    { enabled: !!activeStashId, staleTime: 10_000 }
  );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const stashItems = stashItemsQuery.data?.items || [];

  const imageItems = useMemo(() => {
    return stashItems.filter((item) => item.pageTitle.startsWith("commons:"));
  }, [stashItems]);

  const imageTitles = useMemo(() => {
    return imageItems.map((item) => item.pageTitle.replace(/^commons:/, ""));
  }, [imageItems]);

  const { data: resolvedImages } = api.commons.getImageInfoByTitles.useQuery(
    { titles: imageTitles },
    { enabled: imageTitles.length > 0, staleTime: 5 * 60 * 1000 }
  );

  const imagesMap = useMemo(() => {
    const map = new Map<string, any>();
    if (resolvedImages) {
      for (const img of resolvedImages) {
        map.set(`commons:${img.title}`, img);
      }
    }
    return map;
  }, [resolvedImages]);

  useEffect(() => {
    if (!containerRef.current) return;

    const updateStats = EditorView.updateListener.of((update) => {
      if (update.docChanged || update.selectionSet) {
        const doc = update.state.doc;

        // Cursor position is cheap — update on any cursor/selection change.
        const sel = update.state.selection.main;
        const line = doc.lineAt(sel.head);
        setCursorPos({ line: line.number, col: sel.head - line.from + 1 });

        // Word/line count scans the whole doc — only recompute when text changes,
        // not on every cursor move (ponytail: full-doc scan, fine until articles get huge).
        if (update.docChanged) {
          const text = doc.toString();
          setWordCount(text.split(/\s+/).filter(Boolean).length);
          setLineCount(doc.lines);
          setIsDirty(true);
          refreshPreviewRef.current();
        }
      }
    });

    const state = EditorState.create({
      doc: initialWikitext,
      extensions: [
        lineNumbersComp.current.of(
          showLineNumbers ? [lineNumbers(), highlightActiveLineGutter(), foldGutter()] : []
        ),
        wordWrapComp.current.of(enableWordWrap ? EditorView.lineWrapping : []),
        autocompleteComp.current.of(enableAutocomplete ? [autocompletion(), closeBrackets()] : []),
        history(),
        drawSelection(),
        rectangularSelection(),
        bracketMatching(),
        highlightActiveLine(),
        highlightSelectionMatches(),
        syntaxHighlighting(defaultHighlightStyle),
        wikitextHighlightPlugin,
        Prec.highest(
          keymap.of([
            {
              key: "Mod-b",
              run: (view) => wrapSelectionCM(view, "'''", "'''"),
            },
            {
              key: "Mod-i",
              run: (view) => wrapSelectionCM(view, "''", "''"),
            },
            {
              key: "Mod-k",
              run: (view) => wrapSelectionCM(view, "[[", "]]"),
            },
          ])
        ),
        keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap, indentWithTab]),
        updateStats,
        EditorView.theme({
          "&": {
            fontSize: "14px",
            fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'Consolas', monospace",
            backgroundColor: "var(--wikios-bg) !important",
            color: "var(--wikios-text) !important",
          },
          "&.cm-focused": {
            outline: "none",
          },
          ".cm-scroller": {
            fontFamily: "inherit",
          },
          ".cm-content": {
            padding: "12px 0",
            caretColor: "var(--wikios-accent)",
          },
          ".cm-cursor": {
            borderLeftColor: "var(--wikios-accent)",
            borderLeftWidth: "2px",
          },
          ".cm-gutters": {
            backgroundColor: "var(--wikios-surface) !important",
            borderRight: "1px solid var(--wikios-border) !important",
            color: "var(--wikios-text-dim) !important",
            minWidth: "48px",
          },
          ".cm-activeLineGutter": {
            backgroundColor: "var(--wikios-border) !important",
            color: "var(--wikios-text) !important",
          },
          ".cm-activeLine": {
            backgroundColor: "rgba(120, 120, 120, 0.04) !important",
          },
          ".cm-selectionBackground": {
            backgroundColor: "var(--wikios-border) !important",
          },
          ".cm-matchingBracket": {
            backgroundColor: "rgba(59, 130, 246, 0.15)",
            outline: "1px solid rgba(59, 130, 246, 0.4)",
          },
          ".cm-foldGutter": {
            width: "12px",
          },
          ".cm-searchMatch": {
            backgroundColor: "rgba(234, 179, 8, 0.25)",
            outline: "1px solid rgba(234, 179, 8, 0.5)",
          },
          ".cm-wikitext-heading": {
            color: "var(--wikios-accent)",
            fontWeight: "bold",
          },
          ".cm-wikitext-list": {
            color: "var(--wikios-accent)",
            fontWeight: "bold",
          },
          ".cm-wikitext-bold": {
            fontWeight: "bold",
          },
          ".cm-wikitext-italic": {
            fontStyle: "italic",
          },
          ".cm-wikitext-link": {
            color: "var(--wikios-link)",
            textDecoration: "underline",
          },
          ".cm-wikitext-extlink": {
            color: "var(--wikios-link)",
            textDecoration: "underline",
            fontStyle: "italic",
          },
          ".cm-wikitext-template": {
            color: "var(--wikios-text-muted)",
          },
          ".cm-wikitext-ref": {
            color: "var(--wikios-text-dim)",
          },
        }),
      ],
    });

    const view = new EditorView({
      state,
      parent: containerRef.current,
    });

    viewRef.current = view;

    // Set initial stats
    const text = initialWikitext;
    setWordCount(text.split(/\s+/).filter(Boolean).length);
    setLineCount(text.split("\n").length);

    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialWikitext]);

  // Warn on unload with unsaved changes
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isDirty) e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  // Debounced preview refresh
  const refreshPreview = useCallback(() => {
    if (!showPreview) return;
    const wikitext = viewRef.current?.state.doc.toString() ?? "";
    if (!wikitext.trim()) return;
    if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
    previewTimerRef.current = setTimeout(() => {
      previewMutation.mutate({ wikitext, title });
    }, 600);
  }, [showPreview, title, previewMutation]);

  // Keep ref current so the CodeMirror listener always calls the latest version
  refreshPreviewRef.current = refreshPreview;

  // Trigger preview on toggle
  useEffect(() => {
    if (showPreview) {
      const wikitext = viewRef.current?.state.doc.toString() ?? "";
      if (wikitext.trim()) previewMutation.mutate({ wikitext, title });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showPreview]);

  const handleSave = useCallback(async () => {
    const wikitext = viewRef.current?.state.doc.toString() ?? initialWikitext;
    setSaving(true);
    const isSession = saveActionType === "session";
    try {
      await onSave(wikitext, summary, minor, isSession);
      localStorage.removeItem(`wikios-draft-${title}`); // Clear draft
      setIsDirty(false);
      setShowSavePanel(false);
      notify.success(
        isSession ? "Session Saved" : "Article Published",
        isSession
          ? "Your progress has been saved successfully."
          : "Your changes have been published to the wiki."
      );
    } catch (err) {
      console.error("Save failed:", err);
    } finally {
      setSaving(false);
    }
  }, [onSave, summary, minor, initialWikitext, title, saveActionType, notify]);

  const handleSaveDraft = useCallback(() => {
    const wikitext = viewRef.current?.state.doc.toString() ?? "";
    try {
      localStorage.setItem(`wikios-draft-${title}`, wikitext);
      setIsDirty(false);
      notify.success("Draft Saved", "Your draft has been saved locally.");
    } catch (err) {
      console.error("Failed to save draft:", err);
      notify.error("Save Draft Failed", "Could not write draft to local storage.");
    }
  }, [title, notify]);

  // Check for local draft on mount
  useEffect(() => {
    const draft = localStorage.getItem(`wikios-draft-${title}`);
    if (draft && draft !== initialWikitext) {
      const timer = setTimeout(() => {
        const restore = window.confirm(
          `An unsaved local draft from a previous session was found for "${title}". Would you like to restore it?`
        );
        if (restore && viewRef.current) {
          const docLength = viewRef.current.state.doc.length;
          viewRef.current.dispatch({
            changes: { from: 0, to: docLength, insert: draft },
          });
          setIsDirty(true);
        }
      }, 100);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [title, initialWikitext]);

  // Wikitext formatting helpers
  const wrapSelection = useCallback((before: string, after: string) => {
    const view = viewRef.current;
    if (!view) return;
    const { from, to } = view.state.selection.main;
    const selected = view.state.sliceDoc(from, to);
    view.dispatch({
      changes: { from, to, insert: `${before}${selected}${after}` },
      selection: { anchor: from + before.length, head: to + before.length },
    });
    view.focus();
  }, []);

  const insertAtCursor = useCallback((text: string) => {
    const view = viewRef.current;
    if (!view) return;
    const pos = view.state.selection.main.head;
    view.dispatch({
      changes: { from: pos, insert: text },
      selection: { anchor: pos + text.length },
    });
    view.focus();
  }, []);

  const handleUndo = useCallback(() => {
    const view = viewRef.current;
    if (view) {
      undo(view);
      view.focus();
    }
  }, []);

  const handleRedo = useCallback(() => {
    const view = viewRef.current;
    if (view) {
      redo(view);
      view.focus();
    }
  }, []);

  // Insert text at the start/end of the current line (for headings)
  const insertAtLine = useCallback((before: string, after: string) => {
    const view = viewRef.current;
    if (!view) return;
    const pos = view.state.selection.main.head;
    const line = view.state.doc.lineAt(pos);
    const lineText = line.text;
    view.dispatch({
      changes: { from: line.from, to: line.to, insert: `${before}${lineText}${after}` },
    });
    view.focus();
  }, []);

  return (
    <div className="wikios-editor-modern">
      {/* Title bar */}
      {/* Title bar */}
      <div className="wikios-editor-titlebar">
        <div className="wikios-editor-titlebar-left">
          <span className="wikios-editor-titlebar-name">
            <span className="mr-1 font-medium opacity-50">Editing</span>
            <span className="mr-1.5 opacity-30">:</span>
            {title}
          </span>
          {isDirty && (
            <span className="wikios-ve-dirty ml-1.5 text-[10px] font-semibold text-[var(--wikios-accent)] uppercase opacity-80">
              Unsaved
            </span>
          )}
        </div>

        {/* Center: Apple-style switch toggle */}
        <div className="wikios-editor-titlebar-center">
          <motion.div
            className={cn(
              "relative z-10 flex cursor-pointer items-center overflow-hidden rounded-full px-5 py-1.5 text-xs font-semibold select-none",
              DYNAMIC_ISLAND_BORDER_CLASS
            )}
            animate={{
              y: -repulsionProgress * 40,
              scale: 1 - repulsionProgress * 0.1,
              gap: 10 - repulsionProgress * 2,
              opacity: 1 - repulsionProgress,
              pointerEvents: repulsionProgress > 0.5 ? "none" : "auto",
              boxShadow:
                repulsionProgress > 0 && repulsionProgress < 0.8
                  ? `0 0 ${(1 - repulsionProgress) * 12}px rgba(59, 130, 246, ${(1 - repulsionProgress) * 0.4})`
                  : "none",
            }}
            transition={{
              type: "spring",
              stiffness: 400,
              damping: 30,
              mass: 1,
            }}
            style={DYNAMIC_ISLAND_STYLE}
            title="Toggle Editing Mode (Source / Canvas)"
          >
            <DynamicIslandEffects glowOpacity={0} showGlow={false} showShimmer={false} />
            <span
              style={{
                color: "var(--wikios-text)",
                opacity: 1 - repulsionProgress * 0.25,
              }}
              className="relative z-10 transition-colors duration-150"
            >
              Source
            </span>
            <div className="relative z-10">
              <AppleSwitch
                checked={false}
                onCheckedChange={(checked) => {
                  if (checked) {
                    const currentWikitext = viewRef.current?.state.doc.toString() ?? "";
                    onSwitchToVisual?.(isDirty, currentWikitext);
                  }
                }}
                size="sm"
                tone="accent"
              />
            </div>
            <span
              style={{
                color: "var(--wikios-text-dim)",
                opacity: 1 - repulsionProgress * 0.25,
              }}
              className="relative z-10 transition-colors duration-150"
            >
              Canvas
            </span>
          </motion.div>
        </div>

        <div className="wikios-editor-titlebar-actions">
          <button
            className={`wikios-editor-btn-preview ${showPreview ? "wikios-editor-btn-active" : ""}`}
            onClick={() => setShowPreview(!showPreview)}
            type="button"
            title={showPreview ? "Hide preview" : "Show preview"}
          >
            {showPreview ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
          <button
            className="wikios-editor-btn-cancel"
            onClick={onCancel}
            type="button"
            title="Cancel"
          >
            <X className="h-4 w-4" />
          </button>

          <Popover open={saveDropdownOpen} onOpenChange={setSaveDropdownOpen}>
            <PopoverTrigger
              className="wikios-editor-btn-save"
              disabled={saving}
              title="Save options"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            </PopoverTrigger>
            <PopoverContent
              align="end"
              className="glass-none z-[10001] w-52 rounded-xl border border-[var(--wikios-border)] bg-[var(--wikios-surface)] p-1 text-[var(--wikios-text)] shadow-2xl"
            >
              <div className="flex flex-col gap-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setSaveDropdownOpen(false);
                    setSaveActionType("publish");
                    setShowSavePanel(true);
                  }}
                  className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-left transition-colors hover:bg-[var(--wikios-border)]"
                >
                  <Save className="h-3.5 w-3.5 text-emerald-400" />
                  <span>Save and Publish</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSaveDropdownOpen(false);
                    handleSaveDraft();
                  }}
                  className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-left transition-colors hover:bg-[var(--wikios-border)]"
                >
                  <FileText className="h-3.5 w-3.5 text-blue-400" />
                  <span>Save as Draft</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSaveDropdownOpen(false);
                    setSaveActionType("session");
                    if (!summary) setSummary("Session save");
                    setShowSavePanel(true);
                  }}
                  className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-left transition-colors hover:bg-[var(--wikios-border)]"
                >
                  <Bookmark className="h-3.5 w-3.5 text-amber-400" />
                  <span>Save Session</span>
                </button>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Save panel (slides down) */}
      {showSavePanel && (
        <div className="wikios-editor-save-bar">
          <input
            type="text"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="Describe your changes..."
            className="wikios-editor-save-input"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave();
            }}
          />
          <label className="wikios-editor-save-minor">
            <input type="checkbox" checked={minor} onChange={(e) => setMinor(e.target.checked)} />
            Minor
          </label>
          <button
            className="flex h-8 items-center justify-center rounded-lg bg-[var(--wikios-accent)] px-3 text-xs font-semibold text-white transition-all hover:bg-[var(--wikios-accent-hover)] active:scale-95 disabled:scale-100 disabled:opacity-50"
            onClick={handleSave}
            type="button"
            disabled={saving}
          >
            {saving ? (
              <>
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                Saving...
              </>
            ) : saveActionType === "publish" ? (
              "Save & Publish"
            ) : (
              "Save Session"
            )}
          </button>
        </div>
      )}

      {/* Formatting toolbar */}
      <div className="wikios-editor-format-bar">
        {/* Undo/Redo */}
        <div className="wikios-editor-format-group">
          <FmtBtn icon={Undo2} title="Undo (Ctrl+Z)" onClick={handleUndo} />
          <FmtBtn icon={Redo2} title="Redo (Ctrl+Y)" onClick={handleRedo} />
        </div>
        <div className="wikios-editor-format-sep" />

        {/* Text formatting */}
        <div className="wikios-editor-format-group">
          <FmtBtn
            icon={Bold}
            title="Bold ('''text''')"
            onClick={() => wrapSelection("'''", "'''")}
          />
          <FmtBtn
            icon={Italic}
            title="Italic (''text'')"
            onClick={() => wrapSelection("''", "''")}
          />
          <FmtBtn
            icon={Strikethrough}
            title="Strikethrough"
            onClick={() => wrapSelection("<s>", "</s>")}
          />
          <FmtBtn
            icon={Superscript}
            title="Superscript"
            onClick={() => wrapSelection("<sup>", "</sup>")}
          />
          <FmtBtn
            icon={Subscript}
            title="Subscript"
            onClick={() => wrapSelection("<sub>", "</sub>")}
          />
          <FmtBtn icon={Code} title="Code" onClick={() => wrapSelection("<code>", "</code>")} />
        </div>
        <div className="wikios-editor-format-sep" />

        {/* Links */}
        <div className="wikios-editor-format-group">
          <FmtBtn
            icon={Link2}
            title="Wiki link ([[Page]])"
            onClick={() => wrapSelection("[[", "]]")}
          />
          <FmtBtn
            icon={ExternalLink}
            title="External link"
            onClick={() => wrapSelection("[", "]")}
          />
        </div>
        <div className="wikios-editor-format-sep" />

        {/* Headings */}
        <div className="wikios-editor-format-group">
          <FmtBtn icon={Heading1} title="Heading 1 (=)" onClick={() => insertAtLine("= ", " =")} />
          <FmtBtn
            icon={Heading2}
            title="Heading 2 (==)"
            onClick={() => insertAtLine("== ", " ==")}
          />
          <FmtBtn
            icon={Heading3}
            title="Heading 3 (===)"
            onClick={() => insertAtLine("=== ", " ===")}
          />
        </div>
        <div className="wikios-editor-format-sep" />

        {/* Structure */}
        <div className="wikios-editor-format-group">
          <FmtBtn icon={List} title="Bullet list" onClick={() => insertAtCursor("\n* ")} />
          <FmtBtn icon={ListOrdered} title="Numbered list" onClick={() => insertAtCursor("\n# ")} />
          <FmtBtn
            icon={Quote}
            title="Blockquote"
            onClick={() => wrapSelection("<blockquote>", "</blockquote>")}
          />
          <FmtBtn icon={Minus} title="Horizontal rule" onClick={() => insertAtCursor("\n----\n")} />
        </div>
        <div className="wikios-editor-format-sep" />

        {/* Media & Templates */}
        <div className="wikios-editor-format-group">
          <FmtBtn icon={Image} title="Insert image" onClick={() => setShowImageSearch(true)} />

          {/* Stashed Images Quick Insert */}
          <Popover open={stashesOpen} onOpenChange={setStashesOpen}>
            <PopoverTrigger className="wikios-editor-format-btn" title="Stashed Images">
              <Bookmark className="h-3.5 w-3.5" />
            </PopoverTrigger>
            <PopoverContent
              align="end"
              className="glass-none z-[10001] flex w-80 flex-col gap-2 rounded-xl border border-[var(--wikios-border)] bg-[var(--wikios-surface)] p-3 text-[var(--wikios-text)] shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-[var(--wikios-border)] pb-2">
                <span className="flex items-center gap-1.5 text-xs font-semibold text-[var(--wikios-text-muted)]">
                  <Bookmark className="h-3.5 w-3.5 text-rose-500" />
                  <span>Stashed Images</span>
                </span>

                {stashes.length > 1 && (
                  <select
                    value={activeStashId}
                    onChange={(e) => setSelectedStashId(e.target.value)}
                    className="cursor-pointer rounded border border-[var(--wikios-border)] bg-[var(--wikios-surface)] px-1.5 py-0.5 text-[10px] text-[var(--wikios-text)] focus:outline-none"
                  >
                    {stashes.map((s) => (
                      <option
                        key={s.id}
                        value={s.id}
                        className="bg-[var(--wikios-surface)] text-[var(--wikios-text)]"
                      >
                        {s.name} ({s.itemCount})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {stashesQuery.isLoading || (activeStashId && stashItemsQuery.isLoading) ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-4 w-4 animate-spin text-zinc-500" />
                </div>
              ) : imageItems.length === 0 ? (
                <div className="px-4 py-6 text-center">
                  <p className="text-[11px] text-zinc-400">No stashed images found.</p>
                  <p className="mt-1 text-[9px] text-zinc-500">
                    Stash images from the Category Browser to insert them here.
                  </p>
                </div>
              ) : (
                <div className="wikios-custom-scrollbar grid max-h-60 grid-cols-3 gap-2 overflow-y-auto pr-1">
                  {imageItems.map((item) => {
                    const imgInfo = imagesMap.get(item.pageTitle);
                    const filename = item.pageTitle.replace(/^commons:File:/, "");
                    const cleanTitle = filename.replace(/_/g, " ");

                    return (
                      <StashImageCard
                        key={item.id}
                        imgInfo={imgInfo}
                        cleanTitle={cleanTitle}
                        filename={filename}
                        onInsert={() => {
                          setStashesOpen(false);
                          insertAtCursor(`[[File:${filename}|thumb|]]`);
                        }}
                      />
                    );
                  })}
                </div>
              )}
            </PopoverContent>
          </Popover>

          <FmtBtn
            icon={Table}
            title="Table"
            onClick={() =>
              insertAtCursor(
                '\n{| class="wikitable"\n|-\n! Header 1 !! Header 2\n|-\n| Cell 1 || Cell 2\n|}\n'
              )
            }
          />
          <FmtBtn icon={FileCode} title="Template" onClick={() => wrapSelection("{{", "}}")} />
          <FmtBtn icon={Hash} title="Category" onClick={() => insertAtCursor("[[Category:]]")} />
          <FmtBtn icon={Type} title="Reference" onClick={() => wrapSelection("<ref>", "</ref>")} />

          <Popover open={templatesOpen} onOpenChange={setTemplatesOpen}>
            <PopoverTrigger
              className="wikios-editor-format-btn flex !w-auto items-center gap-1.5 rounded px-2.5"
              title="Insert Templates & Widgets"
            >
              <FileCode className="h-3.5 w-3.5" />
              <span className="text-xs font-semibold">Templates</span>
              <ChevronDown className="h-3 w-3 opacity-60" />
            </PopoverTrigger>
            <PopoverContent
              align="end"
              className="glass-none z-[10001] w-56 rounded-xl border border-[var(--wikios-border)] bg-[var(--wikios-surface)] p-1 text-[var(--wikios-text)] shadow-2xl"
            >
              <div className="flex flex-col gap-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setTemplatesOpen(false);
                    setShowInfoboxModal(true);
                  }}
                  className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-left transition-colors hover:bg-[var(--wikios-border)]"
                >
                  <FileText className="h-3.5 w-3.5 text-amber-400" />
                  <span>Infobox Country</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTemplatesOpen(false);
                    setShowCountryStatsModal(true);
                  }}
                  className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-left transition-colors hover:bg-[var(--wikios-border)]"
                >
                  <MyCountryTinyIcon />
                  <span>Country Stats</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTemplatesOpen(false);
                    setShowBusinessStatsModal(true);
                  }}
                  className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-left transition-colors hover:bg-[var(--wikios-border)]"
                >
                  <Sparkles className="h-3.5 w-3.5 text-teal-400" />
                  <span>Business Stats</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTemplatesOpen(false);
                    setShowMapCoordsModal(true);
                  }}
                  className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-left transition-colors hover:bg-[var(--wikios-border)]"
                >
                  <MapIcon className="h-3.5 w-3.5 text-emerald-400" />
                  <span>Map Coords &amp; Embeds</span>
                </button>
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {/* Far right: Editor Settings */}
        <div className="ml-auto flex items-center">
          <Popover open={settingsOpen} onOpenChange={setSettingsOpen}>
            <PopoverTrigger className="wikios-editor-format-btn" title="Editor Settings">
              <Settings className="h-3.5 w-3.5" />
            </PopoverTrigger>
            <PopoverContent
              align="end"
              className="glass-none z-[10001] w-56 rounded-xl border border-[var(--wikios-border)] bg-[var(--wikios-surface)] p-2 text-[var(--wikios-text)] shadow-2xl"
            >
              <div className="flex flex-col gap-2.5 p-1 text-xs">
                <div className="mb-1 border-b border-[var(--wikios-border)] pb-1.5 font-semibold text-[var(--wikios-text-dim)]">
                  Editor Settings
                </div>

                {/* Line Numbers */}
                <div className="flex items-center justify-between select-none">
                  <span className="font-medium">Line Numbers</span>
                  <AppleSwitch
                    checked={showLineNumbers}
                    onCheckedChange={handleToggleLineNumbers}
                    size="sm"
                    tone="neutral"
                  />
                </div>

                {/* Word Wrap */}
                <div className="flex items-center justify-between select-none">
                  <span className="font-medium">Word Wrap</span>
                  <AppleSwitch
                    checked={enableWordWrap}
                    onCheckedChange={handleToggleWordWrap}
                    size="sm"
                    tone="neutral"
                  />
                </div>

                {/* Autocomplete */}
                <div className="flex items-center justify-between select-none">
                  <span className="font-medium">Autocomplete</span>
                  <AppleSwitch
                    checked={enableAutocomplete}
                    onCheckedChange={handleToggleAutocomplete}
                    size="sm"
                    tone="neutral"
                  />
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Editor + optional preview split */}
      <div className={`wikios-editor-body ${showPreview ? "wikios-editor-split" : ""}`}>
        <div ref={containerRef} className="wikios-editor-cm-container" />
        {showPreview && (
          <div className="wikios-editor-preview">
            <div className="wikios-editor-preview-header">
              <Eye size={12} /> Preview
              {previewMutation.isPending && (
                <span className="wikios-editor-preview-loading">Rendering...</span>
              )}
            </div>
            <div
              className="wikios-article-content wikios-editor-preview-content"
              dangerouslySetInnerHTML={{ __html: previewHtml }}
            />
          </div>
        )}
      </div>

      {/* Status bar */}
      <div className="wikios-editor-statusbar">
        <span>
          Ln {cursorPos.line}, Col {cursorPos.col}
        </span>
        <span>{lineCount} lines</span>
        <span>{wordCount.toLocaleString()} words</span>
        <span>Canvas Editor v{CANVAS_VERSION}</span>

        {isDirty && <span className="wikios-ve-dirty-indicator">Modified</span>}
      </div>

      {/* Image search modal */}
      <ImageSearchModal
        isOpen={showImageSearch}
        onClose={() => setShowImageSearch(false)}
        onInsert={(wikitext) => insertAtCursor(wikitext)}
      />

      {/* Infobox Country Modal */}
      <InfoboxCountryModal
        isOpen={showInfoboxModal}
        onClose={() => setShowInfoboxModal(false)}
        onInsert={insertAtCursor}
      />

      {/* Country Stats Modal */}
      <CountryStatsModal
        isOpen={showCountryStatsModal}
        onClose={() => setShowCountryStatsModal(false)}
        onInsert={insertAtCursor}
      />

      {/* Business Stats Modal */}
      <BusinessStatsModal
        isOpen={showBusinessStatsModal}
        onClose={() => setShowBusinessStatsModal(false)}
        onInsert={insertAtCursor}
      />

      {/* Map Coords & Embeds Modal */}
      <MapCoordsModal
        isOpen={showMapCoordsModal}
        onClose={() => setShowMapCoordsModal(false)}
        onInsert={insertAtCursor}
      />
    </div>
  );
}

// Stash Image Card Component
function StashImageCard({
  imgInfo,
  cleanTitle,
  filename,
  onInsert,
}: {
  imgInfo: any;
  cleanTitle: string;
  filename: string;
  onInsert: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(`[[File:${filename}|thumb|]]`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      onClick={onInsert}
      className="group relative aspect-square cursor-pointer overflow-hidden rounded-lg border border-white/5 bg-white/5 transition-all hover:border-white/10 hover:bg-white/10"
      title={`Click to insert [[File:${filename}]]`}
    >
      {imgInfo?.thumbUrl ? (
        <img
          src={imgInfo.thumbUrl}
          alt={cleanTitle}
          className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          <div className="h-3 w-3 animate-spin rounded-full border border-zinc-700 border-t-zinc-400" />
        </div>
      )}

      <div className="absolute inset-0 flex items-center justify-center gap-1.5 bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
        <button
          type="button"
          onClick={handleCopy}
          className="rounded-md border border-white/10 bg-zinc-950/80 p-1 text-zinc-300 transition-colors hover:bg-zinc-900 hover:text-white"
          title="Copy Wikitext Link"
        >
          {copied ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
        </button>
      </div>

      <div className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/85 to-transparent p-1 text-[8px] text-zinc-300 group-hover:text-white">
        {cleanTitle}
      </div>
    </div>
  );
}

// Formatting button helper
function FmtBtn({ icon: Icon, title, onClick }: { icon: any; title: string; onClick: () => void }) {
  return (
    <button onClick={onClick} title={title} type="button" className="wikios-editor-format-btn">
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
}

// Tiny MyCountry Logo representation for Popovers
function MyCountryTinyIcon() {
  return (
    <div className="relative flex h-4 w-4 shrink-0 items-center justify-center">
      <div className="flex h-3.5 w-3.5 items-center justify-center rounded-full border border-amber-300/50 bg-gradient-to-br from-amber-200 to-amber-400 shadow-sm">
        <Globe className="h-2 w-2 text-amber-950" />
      </div>
      <div className="absolute -top-0.5 -right-0.5 flex items-center justify-center rounded-full border border-amber-300 bg-amber-400 p-[0.5px] shadow-sm">
        <Crown className="h-1.5 w-1.5 text-amber-950" />
      </div>
    </div>
  );
}
