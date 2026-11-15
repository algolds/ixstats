"use client";

import { useState } from "react";
import { Emoji } from "iconoir-react";
import { Button } from "~/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { QUICK_REACTIONS } from "~/lib/messages/reactions";
import { cn } from "~/lib/utils";
import { BUBBLE_CONTROL_CLASS } from "./MessageMenuItems";

interface ReactionPillsProps {
  reactions: Record<string, number>;
  mine: readonly string[];
  isOwn: boolean;
  onToggle: (emoji: string, mine: boolean) => void;
}

/** One pill per emoji, in the flow under the bubble. Yours is filled; pressing a pill adds or removes your reaction. */
export function ReactionPills({ reactions, mine, isOwn, onToggle }: ReactionPillsProps) {
  const entries = Object.entries(reactions);
  if (entries.length === 0) return null;
  return (
    <div className={cn("mt-1 flex flex-wrap gap-1", isOwn ? "justify-end" : "justify-start")}>
      {entries.map(([emoji, count]) => {
        const own = mine.includes(emoji);
        return (
          <button
            key={emoji}
            type="button"
            aria-pressed={own}
            aria-label={`${emoji} ${count}, ${own ? "remove your reaction" : "react too"}`}
            onClick={() => onToggle(emoji, own)}
            className={cn(
              "text-caption duration-fast flex min-h-6 items-center gap-1 rounded-full border px-2 transition-colors pointer-coarse:min-h-11 pointer-coarse:px-3",
              own
                ? "border-tint bg-tint-fill text-tint-ink"
                : "border-separator bg-surface-secondary text-label hover:bg-fill-3"
            )}
          >
            <span aria-hidden="true">{emoji}</span>
            <span className="tabular-nums">{count}</span>
          </button>
        );
      })}
    </div>
  );
}

interface ReactionPickerProps {
  mine: readonly string[];
  isOwn: boolean;
  onToggle: (emoji: string, mine: boolean) => void;
}

export function ReactionPicker({ mine, isOwn, onToggle }: ReactionPickerProps) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Add reaction"
          className={BUBBLE_CONTROL_CLASS}
        >
          <Emoji aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align={isOwn ? "end" : "start"} className="w-auto p-1">
        <div role="group" aria-label="Choose a reaction" className="flex items-center gap-0.5">
          {QUICK_REACTIONS.map((emoji) => {
            const own = mine.includes(emoji);
            return (
              <Button
                key={emoji}
                type="button"
                variant="ghost"
                aria-pressed={own}
                aria-label={own ? `Remove ${emoji}` : `React with ${emoji}`}
                className={cn("text-title-3 size-11 rounded-full px-0", own && "bg-tint-fill")}
                onClick={() => {
                  onToggle(emoji, own);
                  setOpen(false);
                }}
              >
                {emoji}
              </Button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
