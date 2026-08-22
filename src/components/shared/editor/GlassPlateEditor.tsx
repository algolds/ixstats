// src/components/shared/editor/GlassPlateEditor.tsx
// Unified PlateJS Glass Editor supporting full mode, compact mode, and BBCode serialization.

"use client";

import React, {
  useCallback,
  useImperativeHandle,
  forwardRef,
} from "react";
import { Plate, PlateContent } from "platejs/react";
import { Transforms, Node as SlateNode } from "slate";
import { ReactEditor } from "slate-react";
import { cn } from "~/lib/utils";
import { EditorToolbar } from "./EditorToolbar";
import {
  slateNodesToHtml,
  slateNodesToBbcode,
  isMarkActive,
  toggleMark,
  toggleBlock,
} from "./SlateSerializer";
import { MentionMenuPortal } from "./MentionMenuPortal";
import { useGlassPlateEditor } from "./useGlassPlateEditor";
import { WikiAndStashPopovers } from "./WikiAndStashPopovers";

export interface GlassPlateEditorRef {
  insertText: (text: string) => void;
  clear: () => void;
  focus: () => void;
  getContent: () => string;
  getPlainText: () => string;
  getBbcode: () => string;
}

export interface GlassPlateEditorProps {
  value?: string;
  onChange?: (htmlContent: string, plainText: string, bbcode: string) => void;
  placeholder?: string;
  disabled?: boolean;
  onFocus?: () => void;
  onBlur?: () => void;
  italicPlaceholder?: boolean;
  onSubmit?: () => void;
  submitOnEnter?: boolean;
  minHeight?: number | string;
  maxHeight?: number | string;
  className?: string;
  contentClassName?: string;
  hideToolbar?: boolean;
}

export const GlassPlateEditor = forwardRef<GlassPlateEditorRef, GlassPlateEditorProps>(
  (
    {
      value = "",
      onChange,
      placeholder = "Write something rich...",
      disabled = false,
      onFocus,
      onBlur,
      italicPlaceholder = false,
      onSubmit,
      submitOnEnter = false,
      minHeight,
      maxHeight,
      className,
      contentClassName,
      hideToolbar = false,
    },
    ref
  ) => {
    const handleValueChange = useCallback(
      (html: string, plainText: string) => {
        if (onChange) {
          const bbcode = slateNodesToBbcode(editor.children || []);
          onChange(html, plainText, bbcode);
        }
      },
      [onChange]
    );

    const {
      editor,
      version: _version,
      isFocused,
      setIsFocused,
      handleEditorChange,
      handleKeyDown,
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
      setIsEmojiOpen,
      handleSelectEmoji,
    } = useGlassPlateEditor({
      value,
      onChange: handleValueChange,
      onFocus,
      onBlur,
      onSubmit,
      submitOnEnter,
    });

    useImperativeHandle(
      ref,
      () => ({
        insertText: (text: string) => {
          Transforms.insertText(editor as any, text);
        },
        clear: () => {
          editor.children = [{ type: "p", children: [{ text: "" }] }];
          ReactEditor.focus(editor as any);
        },
        focus: () => {
          try {
            ReactEditor.focus(editor as any);
          } catch {
            // ignore if not mounted
          }
        },
        getContent: () => {
          return slateNodesToHtml(editor.children || []);
        },
        getPlainText: () => {
          return (editor.children || [])
            .map((n: any) => SlateNode.string(n))
            .join("\n")
            .trim();
        },
        getBbcode: () => {
          return slateNodesToBbcode(editor.children || []);
        },
      }),
      [editor]
    );

    const activeMarks = {
      bold: isMarkActive(editor as any, "bold"),
      italic: isMarkActive(editor as any, "italic"),
      underline: isMarkActive(editor as any, "underline"),
    };

    const handleToggleMark = useCallback(
      (mark: "bold" | "italic" | "underline") => {
        toggleMark(editor as any, mark);
      },
      [editor]
    );

    const handleToggleList = useCallback(
      (listType: "ul" | "ol") => {
        toggleBlock(editor as any, listType);
      },
      [editor]
    );

    const handleInsertLink = useCallback(
      (url: string) => {
        Transforms.insertNodes(editor as any, {
          type: "link",
          url,
          children: [{ text: url }],
        } as any);
      },
      [editor]
    );

    return (
      <div
        className={cn(
          "group relative flex flex-col rounded-2xl border border-black/10 bg-black/[0.02] backdrop-blur-xl transition-all duration-200 dark:border-white/10 dark:bg-white/[0.03]",
          isFocused &&
            "border-black/20 bg-black/[0.04] shadow-lg ring-1 ring-black/10 dark:border-white/20 dark:bg-white/[0.06] dark:ring-white/10",
          disabled && "cursor-not-allowed opacity-50",
          className
        )}
      >
        <Plate editor={editor} onChange={handleEditorChange}>
          <div
            className="flex-1 overflow-y-auto px-4 py-3"
            style={{
              minHeight: minHeight ?? 80,
              maxHeight: maxHeight ?? 280,
            }}
          >
            <PlateContent
              readOnly={disabled}
              placeholder={placeholder}
              onFocus={() => {
                setIsFocused(true);
                onFocus?.();
              }}
              onBlur={() => {
                setIsFocused(false);
                onBlur?.();
              }}
              onKeyDown={handleKeyDown}
              className={cn(
                "prose dark:prose-invert text-foreground placeholder:text-muted-foreground max-w-none text-sm outline-none select-text focus:outline-none",
                italicPlaceholder && "placeholder:italic",
                contentClassName
              )}
            />
          </div>

          {/* Bottom Toolbar & Action Bar */}
          {!hideToolbar && (
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-black/5 bg-black/[0.01] px-3 py-2 dark:border-white/5 dark:bg-white/[0.01]">
              <EditorToolbar
                onToggleMark={handleToggleMark}
                onToggleList={handleToggleList}
                onInsertLink={handleInsertLink}
                activeMarks={activeMarks}
                className="border-transparent bg-transparent p-0 shadow-none"
              />

              <WikiAndStashPopovers
                disabled={disabled}
                isWikiOpen={isWikiOpen}
                setIsWikiOpen={setIsWikiOpen}
                wikiInsertMode={wikiInsertMode}
                setWikiInsertMode={setWikiInsertMode}
                wikiSource={selectedWikiSource}
                setWikiSource={setSelectedWikiSource}
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
          )}
        </Plate>

        {/* Mention autocomplete floating portal */}
        {mentionCoords && (
          <MentionMenuPortal
            coords={mentionCoords}
            results={mentionResults}
            selectedIndex={mentionSelectedIndex}
            onSelect={handleSelectMention}
            query={mentionQuery}
            isLoading={mentionSearch.isLoading}
          />
        )}
      </div>
    );
  }
);

GlassPlateEditor.displayName = "GlassPlateEditor";
