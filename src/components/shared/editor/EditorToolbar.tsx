// src/components/shared/editor/EditorToolbar.tsx
// Formatting toolbar for GlassPlateEditor with Facet glass physics styling.

"use client";

import { useState } from "react";
import { Bold, Italic, Underline, List, NumberedListLeft as ListOrdered, Link as LinkIcon } from "iconoir-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { cn } from "~/lib/utils";

export interface EditorToolbarProps {
  onToggleMark: (mark: "bold" | "italic" | "underline") => void;
  onToggleList: (listType: "ul" | "ol") => void;
  onInsertLink: (url: string) => void;
  onInsertEmoji?: (emoji: string) => void;
  activeMarks?: Record<string, boolean>;
  className?: string;
}

export function EditorToolbar({
  onToggleMark,
  onToggleList,
  onInsertLink,
  activeMarks = {},
  className,
}: EditorToolbarProps) {
  const [linkUrl, setLinkUrl] = useState("");
  const [linkOpen, setLinkOpen] = useState(false);

  const handleAddLink = () => {
    if (linkUrl.trim()) {
      onInsertLink(linkUrl.trim());
      setLinkUrl("");
      setLinkOpen(false);
    }
  };

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-1 rounded-xl border border-black/10 bg-black/[0.02] p-1 shadow-xs backdrop-blur-xl select-none dark:border-white/10 dark:bg-white/[0.03]",
        className
      )}
    >
      {/* Bold */}
      <button
        type="button"
        onClick={() => onToggleMark("bold")}
        className={cn(
          "rounded-lg p-1.5 transition-all duration-150 active:scale-[0.92]",
          activeMarks.bold
            ? "bg-purple-500/20 text-purple-600 dark:text-purple-300"
            : "text-muted-foreground hover:bg-black/5 hover:text-foreground dark:hover:bg-white/10 dark:hover:text-white"
        )}
        title="Bold"
      >
        <Bold className="h-4 w-4" />
      </button>

      {/* Italic */}
      <button
        type="button"
        onClick={() => onToggleMark("italic")}
        className={cn(
          "rounded-lg p-1.5 transition-all duration-150 active:scale-[0.92]",
          activeMarks.italic
            ? "bg-purple-500/20 text-purple-600 dark:text-purple-300"
            : "text-muted-foreground hover:bg-black/5 hover:text-foreground dark:hover:bg-white/10 dark:hover:text-white"
        )}
        title="Italic"
      >
        <Italic className="h-4 w-4" />
      </button>

      {/* Underline */}
      <button
        type="button"
        onClick={() => onToggleMark("underline")}
        className={cn(
          "rounded-lg p-1.5 transition-all duration-150 active:scale-[0.92]",
          activeMarks.underline
            ? "bg-purple-500/20 text-purple-600 dark:text-purple-300"
            : "text-muted-foreground hover:bg-black/5 hover:text-foreground dark:hover:bg-white/10 dark:hover:text-white"
        )}
        title="Underline"
      >
        <Underline className="h-4 w-4" />
      </button>

      <div className="mx-1 h-4 w-px bg-black/10 dark:bg-white/10" />

      {/* Unordered List */}
      <button
        type="button"
        onClick={() => onToggleList("ul")}
        className="text-muted-foreground hover:bg-black/5 hover:text-foreground dark:hover:bg-white/10 dark:hover:text-white rounded-lg p-1.5 transition-all duration-150 active:scale-[0.92]"
        title="Bullet List"
      >
        <List className="h-4 w-4" />
      </button>

      {/* Ordered List */}
      <button
        type="button"
        onClick={() => onToggleList("ol")}
        className="text-muted-foreground hover:bg-black/5 hover:text-foreground dark:hover:bg-white/10 dark:hover:text-white rounded-lg p-1.5 transition-all duration-150 active:scale-[0.92]"
        title="Numbered List"
      >
        <ListOrdered className="h-4 w-4" />
      </button>

      <div className="mx-1 h-4 w-px bg-black/10 dark:bg-white/10" />

      {/* Link Popover */}
      <Popover open={linkOpen} onOpenChange={setLinkOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="text-muted-foreground hover:bg-black/5 hover:text-foreground dark:hover:bg-white/10 dark:hover:text-white rounded-lg p-1.5 transition-all duration-150 active:scale-[0.92]"
            title="Insert Link"
          >
            <LinkIcon className="h-4 w-4" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="border-border bg-popover/98 text-popover-foreground z-[200000] w-64 rounded-2xl border p-3 shadow-2xl backdrop-blur-2xl"
        >
          <div className="space-y-2">
            <span className="text-foreground text-xs font-semibold">Insert Web Link</span>
            <Input
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="https://..."
              className="border-input bg-secondary text-foreground text-xs"
            />
            <Button
              size="sm"
              onClick={handleAddLink}
              disabled={!linkUrl.trim()}
              className="w-full bg-purple-600 text-xs font-semibold text-white hover:bg-purple-500"
            >
              Add Link
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
