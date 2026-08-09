"use client";

import { useState } from "react";
import { Bold, Italic, Underline, List, ListOrdered, Link as LinkIcon } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { EmojiPicker } from "../EmojiPicker";
import { cn } from "~/lib/utils";

export interface EditorToolbarProps {
  onToggleMark: (mark: "bold" | "italic" | "underline") => void;
  onToggleList: (listType: "ul" | "ol") => void;
  onInsertLink: (url: string) => void;
  onInsertEmoji: (emoji: string) => void;
  activeMarks?: Record<string, boolean>;
  className?: string;
}

export function EditorToolbar({
  onToggleMark,
  onToggleList,
  onInsertLink,
  onInsertEmoji,
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
        "flex flex-wrap items-center gap-1 rounded-xl border border-white/10 bg-white/[0.04] p-1 shadow-sm backdrop-blur-xl select-none",
        className
      )}
    >
      {/* Bold */}
      <button
        onClick={() => onToggleMark("bold")}
        className={cn(
          "rounded-lg p-1.5 transition-all duration-150 active:scale-[0.92]",
          activeMarks.bold
            ? "bg-purple-500/20 text-purple-300"
            : "text-slate-400 hover:bg-white/10 hover:text-white"
        )}
        title="Bold"
      >
        <Bold className="h-4 w-4" />
      </button>

      {/* Italic */}
      <button
        onClick={() => onToggleMark("italic")}
        className={cn(
          "rounded-lg p-1.5 transition-all duration-150 active:scale-[0.92]",
          activeMarks.italic
            ? "bg-purple-500/20 text-purple-300"
            : "text-slate-400 hover:bg-white/10 hover:text-white"
        )}
        title="Italic"
      >
        <Italic className="h-4 w-4" />
      </button>

      {/* Underline */}
      <button
        onClick={() => onToggleMark("underline")}
        className={cn(
          "rounded-lg p-1.5 transition-all duration-150 active:scale-[0.92]",
          activeMarks.underline
            ? "bg-purple-500/20 text-purple-300"
            : "text-slate-400 hover:bg-white/10 hover:text-white"
        )}
        title="Underline"
      >
        <Underline className="h-4 w-4" />
      </button>

      <div className="mx-1 h-4 w-px bg-white/10" />

      {/* Unordered List */}
      <button
        onClick={() => onToggleList("ul")}
        className="rounded-lg p-1.5 text-slate-400 transition-all duration-150 hover:bg-white/10 hover:text-white active:scale-[0.92]"
        title="Bullet List"
      >
        <List className="h-4 w-4" />
      </button>

      {/* Ordered List */}
      <button
        onClick={() => onToggleList("ol")}
        className="rounded-lg p-1.5 text-slate-400 transition-all duration-150 hover:bg-white/10 hover:text-white active:scale-[0.92]"
        title="Numbered List"
      >
        <ListOrdered className="h-4 w-4" />
      </button>

      <div className="mx-1 h-4 w-px bg-white/10" />

      {/* Link Popover */}
      <Popover open={linkOpen} onOpenChange={setLinkOpen}>
        <PopoverTrigger asChild>
          <button
            className="rounded-lg p-1.5 text-slate-400 transition-all duration-150 hover:bg-white/10 hover:text-white active:scale-[0.92]"
            title="Insert Link"
          >
            <LinkIcon className="h-4 w-4" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-64 border-white/10 bg-slate-900/95 p-3 backdrop-blur-xl">
          <div className="space-y-2">
            <span className="text-xs font-semibold text-white">Insert Web Link</span>
            <Input
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="https://..."
              className="border-white/10 bg-black/40 text-xs text-white"
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

      {/* Emoji Picker */}
      <Popover>
        <PopoverTrigger asChild>
          <button className="rounded-lg p-1.5 text-slate-400 transition-all duration-150 hover:bg-white/10 hover:text-white active:scale-[0.92]">
            <span className="text-sm">😊</span>
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="p-0 border-white/10 bg-slate-900/95 backdrop-blur-xl">
          <EmojiPicker onSelectEmoji={(emoji: string) => onInsertEmoji(emoji)} />
        </PopoverContent>
      </Popover>
    </div>
  );
}
