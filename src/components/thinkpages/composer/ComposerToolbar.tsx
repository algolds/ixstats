"use client";

import { Image, Vote, BarChart3, Send, Loader2 } from "lucide-react";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

export interface ComposerToolbarProps {
  onOpenMediaModal: () => void;
  onOpenPollModal: () => void;
  onToggleVisualizationsPanel: () => void;
  onSubmitPost: () => void;
  isSubmitting: boolean;
  canSubmit: boolean;
  characterCount?: number;
  maxCharacters?: number;
  hasPoll?: boolean;
  hasVisualizations?: boolean;
  className?: string;
}

export function ComposerToolbar({
  onOpenMediaModal,
  onOpenPollModal,
  onToggleVisualizationsPanel,
  onSubmitPost,
  isSubmitting,
  canSubmit,
  characterCount = 0,
  maxCharacters = 280,
  hasPoll,
  hasVisualizations,
  className,
}: ComposerToolbarProps) {
  const isOverLimit = characterCount > maxCharacters;

  return (
    <div
      className={cn(
        "flex items-center justify-between border-t border-white/10 bg-white/[0.02] px-4 py-2.5 select-none",
        className
      )}
    >
      {/* Media & Widget Attachments Triggers */}
      <div className="flex items-center gap-1">
        <button
          onClick={onOpenMediaModal}
          className="rounded-xl p-2 text-slate-400 transition-all duration-150 hover:bg-white/10 hover:text-purple-400 active:scale-[0.92]"
          title="Attach Image"
        >
          <Image className="h-4 w-4" />
        </button>

        <button
          onClick={onOpenPollModal}
          className={cn(
            "rounded-xl p-2 transition-all duration-150 active:scale-[0.92]",
            hasPoll
              ? "bg-purple-500/20 text-purple-400"
              : "text-slate-400 hover:bg-white/10 hover:text-purple-400"
          )}
          title="Create Poll"
        >
          <Vote className="h-4 w-4" />
        </button>

        <button
          onClick={onToggleVisualizationsPanel}
          className={cn(
            "rounded-xl p-2 transition-all duration-150 active:scale-[0.92]",
            hasVisualizations
              ? "bg-purple-500/20 text-purple-400"
              : "text-slate-400 hover:bg-white/10 hover:text-purple-400"
          )}
          title="Attach Live Data Card"
        >
          <BarChart3 className="h-4 w-4" />
        </button>
      </div>

      {/* Counter & Submit Button */}
      <div className="flex items-center gap-3">
        {characterCount > 0 && (
          <span
            className={cn(
              "text-xs font-mono font-bold tabular-nums",
              isOverLimit ? "text-rose-400" : "text-slate-400"
            )}
          >
            {maxCharacters - characterCount}
          </span>
        )}

        <Button
          size="sm"
          onClick={onSubmitPost}
          disabled={!canSubmit || isSubmitting || isOverLimit}
          className="rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 px-4 text-xs font-bold text-white shadow-lg transition-all duration-150 hover:from-purple-500 hover:to-indigo-500 active:scale-[0.96] disabled:opacity-50"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              Posting...
            </>
          ) : (
            <>
              <Send className="mr-1.5 h-3.5 w-3.5" />
              Post
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
