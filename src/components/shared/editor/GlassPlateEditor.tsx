"use client";
// src/components/shared/editor/GlassPlateEditor.tsx
// Unified PlateJS Glass Editor supporting full mode, compact mode, and BBCode serialization.

import React, { useCallback, useImperativeHandle, useRef, useState, forwardRef } from "react";
import dynamic from "next/dynamic";
import { MediaImage } from "iconoir-react";
import { Plate, PlateContent } from "platejs/react";
import { Transforms, Node as SlateNode } from "slate";
import { ReactEditor } from "slate-react";
import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";
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

const MediaSearchModal = dynamic(
  () =>
    import("~/components/wiki-os/media-search/MediaSearchModal").then((m) => m.MediaSearchModal),
  { ssr: false }
);

/** Display rules shared with the post bodies so the editor previews what gets posted. */
export const POST_IMAGE_CLASSES =
  "[&_img]:my-2 [&_img]:h-auto [&_img]:max-h-[640px] [&_img]:max-w-full [&_img]:rounded-control [&_img]:object-contain";

export interface GlassPlateEditorRef {
  insertText: (text: string) => void;
  clear: () => void;
  focus: () => void;
  /** Focus, first putting the caret at the end of the document when nothing is selected. */
  focusEnd: () => void;
  getContent: () => string;
  getPlainText: () => string;
  getBbcode: () => string;
}

interface GlassPlateEditorProps {
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
  variant?: "default" | "seamless";
  actionRight?: React.ReactNode;
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
      variant = "default",
      actionRight,
    },
    ref
  ) => {
    const handleValueChange = useCallback(
      (html: string, plainText: string) => {
        if (onChange) {
          // oxlint-disable-next-line
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
      insertImageUrl,
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
          editor.tf.setValue([{ type: "p", children: [{ text: "" }] }]);
          ReactEditor.focus(editor as any);
        },
        focus: () => {
          try {
            ReactEditor.focus(editor as any);
          } catch {
            // ignore if not mounted
          }
        },
        focusEnd: () => {
          try {
            // Focus the DOM node synchronously: ReactEditor.focus defers while operations are
            // pending, and keystrokes in that gap would reach the previously focused field.
            editor.api.toDOMNode(editor)?.focus({ preventScroll: true });
            const end = editor.selection ? undefined : editor.api.end([]);
            if (end) editor.tf.select(end);
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

    const [isImagePickerOpen, setIsImagePickerOpen] = useState(false);
    const savedSelection = useRef(editor.selection);

    const openImagePicker = useCallback(() => {
      savedSelection.current = editor.selection;
      setIsImagePickerOpen(true);
    }, [editor]);

    const handleImageSelect = useCallback(
      (url: string) => {
        setIsImagePickerOpen(false);
        if (savedSelection.current) Transforms.select(editor as any, savedSelection.current);
        insertImageUrl(url);
      },
      [editor, insertImageUrl]
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
        Transforms.insertNodes(
          editor as any,
          {
            type: "link",
            url,
            children: [{ text: url }],
          } as any
        );
      },
      [editor]
    );

    return (
      <div
        className={cn(
          variant === "seamless"
            ? "group relative flex flex-col bg-transparent"
            : "group relative flex flex-col rounded-2xl border border-black/10 bg-black/[0.02] backdrop-blur-xl transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-200 dark:border-white/10 dark:bg-white/[0.03]",
          variant !== "seamless" &&
            isFocused &&
            "border-black/20 bg-black/[0.04] shadow-lg ring-1 ring-black/10 dark:border-white/20 dark:bg-white/[0.06] dark:ring-white/10",
          disabled && "cursor-not-allowed opacity-50",
          className
        )}
      >
        <Plate editor={editor} onChange={handleEditorChange}>
          <div
            className={cn(
              "flex-1 overflow-y-auto",
              variant === "seamless" ? "px-0 py-1" : "px-4 py-3"
            )}
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
                POST_IMAGE_CLASSES,
                italicPlaceholder && "placeholder:italic",
                contentClassName
              )}
            />
          </div>

          {/* Bottom Toolbar & Action Bar */}
          {!hideToolbar && (
            <div
              className={cn(
                "flex flex-wrap items-center justify-between gap-2",
                variant === "seamless"
                  ? "border-t border-white/5 bg-transparent px-0 pt-2"
                  : "border-t border-black/5 bg-black/[0.01] px-3 py-2 dark:border-white/5 dark:bg-white/[0.01]"
              )}
            >
              <EditorToolbar
                onToggleMark={handleToggleMark}
                onToggleList={handleToggleList}
                onInsertLink={handleInsertLink}
                activeMarks={activeMarks}
                className="border-transparent bg-transparent p-0 shadow-none"
              />

              <div className="flex items-center gap-2">
                {!disabled && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground hover:bg-muted h-7 w-7 rounded-xl p-0"
                    title="Insert image"
                    aria-label="Insert image"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={openImagePicker}
                  >
                    <MediaImage className="h-3.5 w-3.5" />
                  </Button>
                )}
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

                {actionRight}
              </div>
            </div>
          )}
        </Plate>

        {isImagePickerOpen && (
          <MediaSearchModal
            isOpen={isImagePickerOpen}
            onClose={() => setIsImagePickerOpen(false)}
            onImageSelect={handleImageSelect}
          />
        )}

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
