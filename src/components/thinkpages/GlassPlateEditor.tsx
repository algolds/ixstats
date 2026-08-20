"use client";

import React, {
  useMemo,
  useState,
  useCallback,
  useEffect,
  useImperativeHandle,
  forwardRef,
} from "react";
import { createPortal } from "react-dom";

import {
  Plate,
  PlateContent,
  createPlateEditor,
  createPlatePlugin,
  ParagraphPlugin,
} from "platejs/react";
// eslint-disable-next-line unused-imports/no-unused-imports
import { Transforms, Editor, Element as SlateElement, Range } from "slate";
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
// eslint-disable-next-line unused-imports/no-unused-imports
import { EmojiPicker } from "./EmojiPicker";
import {
  EDITOR_PLUGINS,
  BoldPlugin,
  ItalicPlugin,
  UnderlinePlugin,
  UnorderedListPlugin,
  OrderedListPlugin,
  ListItemPlugin,
  LinkPlugin,
  WikiLinkPlugin,
} from "./editor/EditorPlugins";
import { EditorToolbar } from "./editor/EditorToolbar";
import {
  slateNodesToHtml,
  isMarkActive,
  toggleMark,
  isBlockActive,
  toggleBlock,
  detectWikiUrl,
} from "./editor/SlateSerializer";
import { MentionMenuPortal } from "./editor/MentionMenuPortal";
import { useGlassPlateEditor } from "./editor/useGlassPlateEditor";
import { WikiAndStashPopovers } from "./editor/WikiAndStashPopovers";

// ---------------------------------------------------------------------------
// Slate plugins for Rich Text Formatting
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Custom Slate-to-HTML Serializer
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Editor Helpers
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

function getMentionItemIcon(name: string, type: "user" | "league" | "club" | "country"): string {
  if (type === "user") return "👤";
  if (type === "country") return "🌐";

  const lower = name.toLowerCase();
  if (lower.includes("hockey")) return "🏒";
  if (lower.includes("basketball")) return "🏀";
  if (lower.includes("football") || lower.includes("gridiron")) return "🏈";
  if (lower.includes("baseball")) return "⚾";
  if (lower.includes("f1") || lower.includes("racing") || lower.includes("motorsport")) return "🏎️";
  if (lower.includes("boxing") || lower.includes("fight")) return "🥊";
  if (
    lower.includes("soccer") ||
    lower.includes("football") ||
    lower.includes("fc") ||
    lower.includes("sc")
  )
    return "⚽";

  return type === "league" ? "🏆" : "🛡️";
}

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
    const {
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
    } = useGlassPlateEditor({
      value,
      onChange,
      onFocus,
      onBlur,
    });

    useImperativeHandle(ref, () => ({
      insertText: (text: string) => {
        try {
          ReactEditor.focus(editor as any);
          Transforms.insertText(editor as any, text);
        } catch (_err) {
          const lastNodePath = [editor.children.length - 1];
          Transforms.insertText(editor as any, text, { at: lastNodePath });
        }
        handleEditorChange();
      },
      clear: () => {
        editor.children = [{ type: "p", children: [{ text: "" }] }];
        editor.selection = null;
        (editor as any).onChange?.();
        handleEditorChange();
      },
    }));

    const isToolbarVisible = isFocused || isLinkOpen || isWikiOpen || isStashesOpen || isEmojiOpen;

    const isEditorEmpty = useMemo(() => {
      if (!editor || !editor.children) return true;
      if (editor.children.length > 1) return false;
      const firstChild = editor.children[0] as any;
      if (!firstChild) return true;
      if (firstChild.type !== "p") return false;
      if (firstChild.children?.length > 1) return false;
      return (firstChild.children?.[0]?.text ?? "").trim() === "";
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [editor, version]);

    return (
      <div className="glass-surface glass-refraction-none glass-composer-editor relative flex flex-col rounded-xl shadow-xs transition-all duration-300 focus-within:border-blue-500/50 focus-within:shadow-md focus-within:ring-1 focus-within:ring-blue-500/20 dark:focus-within:border-blue-400/50 dark:focus-within:ring-blue-400/20">
        {/* ── Embedded Top Toolbar Wrapper ── */}
        <div
          className={cn(
            "grid transition-[grid-template-rows,opacity] duration-300 ease-in-out select-none",
            isToolbarVisible
              ? "grid-rows-[1fr] opacity-100"
              : "pointer-events-none grid-rows-[0fr] opacity-0"
          )}
        >
          <div className="overflow-hidden">
            <div className="flex flex-wrap items-center gap-1 rounded-t-xl bg-slate-500/[0.03] p-1.5 dark:bg-white/[0.03]">
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

              <div className="mx-0.5 h-4 w-px bg-slate-200 dark:bg-white/10" />

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

              <div className="mx-0.5 h-4 w-px bg-slate-200 dark:bg-white/10" />

              {/* ── Link Popover ── */}
              <Popover open={isLinkOpen} onOpenChange={setIsLinkOpen}>
                <PopoverTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={disabled}
                      className={cn(
                        "h-7 w-7 rounded-full p-0 transition-all duration-200",
                        isLinkOpen
                          ? "bg-blue-500/20 text-blue-600 ring-1 ring-blue-500/30 dark:bg-blue-500/30 dark:text-blue-300"
                          : "text-blue-500 hover:bg-blue-500/10 hover:text-blue-600 dark:text-blue-400 dark:hover:bg-blue-500/20 dark:hover:text-blue-300"
                      )}
                      title="Insert Link"
                    >
                      <LinkIcon className="h-3.5 w-3.5" />
                    </Button>
                  }
                />
                <PopoverContent
                  side="bottom"
                  align="center"
                  sideOffset={8}
                  className="text-foreground bg-card/95 z-50 w-72 space-y-3 rounded-xl border border-slate-200 p-3 shadow-2xl backdrop-blur-xl dark:border-white/10"
                >
                  <div className="space-y-1">
                    <Label
                      htmlFor="link-url"
                      className="text-[10px] font-bold tracking-wider text-slate-500 uppercase dark:text-slate-400"
                    >
                      Link URL
                    </Label>
                    <Input
                      id="link-url"
                      value={linkUrl}
                      onChange={(e) => setLinkUrl(e.target.value)}
                      placeholder="https://example.com"
                      className="text-foreground h-8 border-slate-200 bg-slate-500/5 text-xs placeholder-slate-400/80 focus-visible:ring-1 focus-visible:ring-blue-500 dark:border-white/10 dark:bg-white/5 dark:placeholder-white/30"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label
                      htmlFor="link-text"
                      className="text-[10px] font-bold tracking-wider text-slate-500 uppercase dark:text-slate-400"
                    >
                      Display Text
                    </Label>
                    <Input
                      id="link-text"
                      value={linkText}
                      onChange={(e) => setLinkText(e.target.value)}
                      placeholder="Click here"
                      className="text-foreground h-8 border-slate-200 bg-slate-500/5 text-xs placeholder-slate-400/80 focus-visible:ring-1 focus-visible:ring-blue-500 dark:border-white/10 dark:bg-white/5 dark:placeholder-white/30"
                    />
                  </div>
                  <Button
                    size="sm"
                    onClick={insertLink}
                    disabled={!linkUrl.trim()}
                    className="h-8 w-full bg-blue-600 text-xs font-medium text-white hover:bg-blue-700"
                  >
                    Insert Hyperlink
                  </Button>
                </PopoverContent>
              </Popover>

              {/* Wiki, Stash, and Emoji Popovers */}
              <WikiAndStashPopovers
                disabled={disabled}
                isWikiOpen={isWikiOpen}
                setIsWikiOpen={setIsWikiOpen}
                wikiInsertMode={wikiInsertMode}
                setWikiInsertMode={setWikiInsertMode}
                wikiSource={selectedWikiSource === "iiwiki" ? "iiwiki" : "ixwiki"}
                setWikiSource={(src) => setSelectedWikiSource(src)}
                wikiTarget={wikiTarget}
                setWikiTarget={setWikiTarget}
                wikiLabel={wikiText}
                setWikiLabel={setWikiText}
                wikiSearchResults={wikiSearch.data || []}
                isSearchingWiki={wikiSearch.isLoading}
                wikiIntroQuery={wikiIntroQuery}
                wikiImagesQuery={wikiImagesQuery}
                selectedWikiImageUrl={selectedWikiImageUrl}
                setSelectedWikiImageUrl={setSelectedWikiImageUrl}
                insertWikiLink={insertWikiLink}
                isStashesOpen={isStashesOpen}
                setIsStashesOpen={setIsStashesOpen}
                stashes={stashes}
                activeStashId={activeStashId}
                setSelectedStashId={setSelectedStashId}
                stashesQuery={stashesQuery}
                stashItemsQuery={stashItemsQuery}
                imageItems={imageItems}
                resolvedImages={resolvedImages}
                insertStashedImage={insertStashedImage}
                handleSelectEmoji={handleSelectEmoji}
                setIsEmojiOpen={setIsEmojiOpen}
              />
            </div>
          </div>
        </div>

        {/* ── Editable Canvas area ── */}
        <div
          className={cn(
            "wikios-plate-content thin-scrollbar text-foreground max-h-[300px] min-h-[96px] overflow-y-auto bg-transparent px-3.5 pt-2 pb-3 transition-all duration-300 ease-in-out outline-none"
          )}
        >
          <Plate editor={editor} onChange={handleEditorChange}>
            <PlateContent
              className={cn(
                "min-h-[80px] text-sm transition-all duration-300 ease-in-out outline-none [&_[data-slate-placeholder]]:text-slate-400 [&_[data-slate-placeholder]]:transition-opacity [&_[data-slate-placeholder]]:duration-300 focus-within:[&_[data-slate-placeholder]]:opacity-0 dark:[&_[data-slate-placeholder]]:text-white/30 [&_p]:mb-1.5 [&_p:last-child]:mb-0",
                italicPlaceholder
                  ? "[&_[data-slate-placeholder]]:italic"
                  : "[&_[data-slate-placeholder]]:not-italic"
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
        {showMentionMenu && mentionCoords && (
          <MentionMenuPortal
            coords={mentionCoords}
            results={combinedMentionResults}
            selectedIndex={selectedMentionIndex}
            onSelect={handleSelectMention}
            query={mentionQuery}
            isLoading={
              accountsSearch.isLoading || sportsSearch.isLoading || countriesSearch.isLoading
            }
          />
        )}
      </div>
    );
  }
);

GlassPlateEditor.displayName = "GlassPlateEditor";

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
      onClick={onClick}
      className={cn(
        "h-7 w-7 rounded-full p-0 transition-all duration-200",
        active
          ? "bg-slate-500/20 text-slate-900 ring-1 ring-slate-500/30 dark:bg-white/20 dark:text-white"
          : "text-slate-500 hover:bg-slate-500/10 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-slate-200"
      )}
      title={title}
    >
      {icon}
    </Button>
  );
}
