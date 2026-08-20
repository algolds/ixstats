"use client";

import React from "react";
import { motion } from "motion/react";
import { BarChart3, Image, Loader2, Send, Vote } from "lucide-react";
import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Switch } from "~/components/ui/switch";
import { Tooltip, TooltipTrigger, TooltipContent } from "~/components/ui/tooltip";
import { GifPicker } from "../GifPicker";

export interface ComposerActionBarProps {
  showActionBar: boolean;
  remainingChars: number;
  showVisualizationPanel: boolean;
  setShowVisualizationPanel: (val: boolean) => void;
  isGeneratingVisualization: boolean;
  setShowMediaModal: (val: boolean) => void;
  isUploadingImage: boolean;
  selectedImages: string[];
  handleInsertGif: (url: string) => void;
  pollDraft: any;
  setPollDraft: (val: any) => void;
  setShowPollModal: (val: boolean) => void;
  postToDiscord: boolean;
  setPostToDiscord: (val: boolean) => void;
  handleSubmit: () => void;
  isPending: boolean;
  plainText: string;
  selectedVisualizations: any[];
}

export function ComposerActionBar({
  showActionBar,
  remainingChars,
  showVisualizationPanel,
  setShowVisualizationPanel,
  isGeneratingVisualization,
  setShowMediaModal,
  isUploadingImage,
  selectedImages,
  handleInsertGif,
  pollDraft,
  setPollDraft,
  setShowPollModal,
  postToDiscord,
  setPostToDiscord,
  handleSubmit,
  isPending,
  plainText,
  selectedVisualizations,
}: ComposerActionBarProps) {
  return (
    <motion.div
      layout
      initial={false}
      animate={{
        height: showActionBar ? "auto" : 0,
        opacity: showActionBar ? 1 : 0,
        marginTop: showActionBar ? 10 : 0,
      }}
      transition={{
        type: "spring",
        stiffness: 380,
        damping: 30,
      }}
      className={cn("overflow-hidden", !showActionBar && "pointer-events-none")}
    >
      <div className="space-y-2 pt-1">
        <div className="flex justify-end text-[0.65rem]">
          <span
            className={cn(
              "font-semibold tracking-tight transition-colors duration-150",
              remainingChars < 20
                ? "font-bold text-red-500"
                : remainingChars < 50
                  ? "text-amber-500"
                  : "text-slate-400 dark:text-slate-500"
            )}
          >
            {remainingChars} characters remaining
          </span>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowVisualizationPanel(!showVisualizationPanel)}
                  className={cn(
                    "h-8 w-8 rounded-xl p-0 text-blue-600 transition-all duration-150 hover:bg-blue-500/10 hover:text-blue-700 active:scale-95 dark:text-blue-400 dark:hover:text-blue-300",
                    showVisualizationPanel && "bg-blue-500/15 ring-1 ring-blue-500/30"
                  )}
                  aria-label="Add live data chart"
                >
                  {isGeneratingVisualization ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <BarChart3 className="h-4 w-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent
                side="top"
                className="bg-slate-900/90 text-[11px] font-medium tracking-tight text-white backdrop-blur-md"
              >
                Add live data chart
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowMediaModal(true)}
                  disabled={isUploadingImage || selectedImages.length >= 4}
                  className="h-8 w-8 rounded-xl p-0 text-emerald-600 transition-all duration-150 hover:bg-emerald-500/10 hover:text-emerald-700 active:scale-95 dark:text-emerald-400 dark:hover:text-emerald-300"
                  aria-label="Add media or images"
                >
                  {isUploadingImage ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <div className="relative">
                      <Image className="h-4 w-4" />
                      {selectedImages.length > 0 && (
                        <Badge
                          variant="secondary"
                          className="border-background absolute -top-2 -right-2 flex h-3.5 min-w-3.5 items-center justify-center rounded-full border bg-emerald-500 p-0 text-[7px] font-bold text-white shadow-sm"
                        >
                          {selectedImages.length}
                        </Badge>
                      )}
                    </div>
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent
                side="top"
                className="bg-slate-900/90 text-[11px] font-medium tracking-tight text-white backdrop-blur-md"
              >
                Add media / images
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <GifPicker onSelectGif={handleInsertGif} disabled={selectedImages.length >= 4} />
              </TooltipTrigger>
              <TooltipContent
                side="top"
                className="bg-slate-900/90 text-[11px] font-medium tracking-tight text-white backdrop-blur-md"
              >
                Insert GIF
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (!pollDraft) {
                      setPollDraft({
                        question: "",
                        pollType: "choice",
                        multiple: false,
                        options: ["", ""],
                      });
                    }
                    setShowPollModal(true);
                  }}
                  className={cn(
                    "text-poll hover:bg-poll/10 hover:text-poll h-8 w-8 rounded-xl p-0 transition-all duration-150 active:scale-95",
                    pollDraft && "bg-poll/15 ring-poll/30 ring-1"
                  )}
                  aria-label="Add Poll"
                >
                  <Vote className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent
                side="top"
                className="bg-slate-900/90 text-[11px] font-medium tracking-tight text-white backdrop-blur-md"
              >
                Add Poll
              </TooltipContent>
            </Tooltip>

            <div className="flex h-5 items-center gap-2 border-l border-black/10 px-2.5 dark:border-white/10">
              <Switch
                id="share-to-discord-toggle"
                checked={postToDiscord}
                onCheckedChange={setPostToDiscord}
                tone="discord"
                className="scale-90"
              />
              <label
                htmlFor="share-to-discord-toggle"
                className="flex cursor-pointer items-center gap-1.5 text-[10px] font-semibold tracking-tight text-slate-500 transition-colors select-none hover:text-slate-800 dark:text-neutral-400 dark:hover:text-neutral-200"
              >
                <svg
                  viewBox="0 0 24 24"
                  className={cn(
                    "h-3 w-3 fill-current transition-colors duration-200",
                    postToDiscord ? "text-discord" : "text-neutral-500"
                  )}
                >
                  <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.094 13.094 0 0 1-1.873-.894.077.077 0 0 1-.008-.128c.126-.093.252-.19.372-.287a.075.075 0 0 1 .077-.011c3.92 1.793 8.18 1.793 12.061 0a.073.073 0 0 1 .078.009c.12.099.246.195.373.289a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.894.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.156-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.156 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.156-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.156 2.418z" />
                </svg>
                Share to Discord
              </label>
            </div>
          </div>

          <Button
            onClick={handleSubmit}
            size="sm"
            disabled={
              isPending ||
              remainingChars < 0 ||
              (plainText.trim().length === 0 &&
                selectedVisualizations.length === 0 &&
                selectedImages.length === 0)
            }
            className="h-8 rounded-xl bg-blue-600 px-4 text-xs font-bold tracking-tight text-white shadow-md transition-all duration-150 hover:bg-blue-500 active:scale-[0.97]"
          >
            {isPending ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="mr-1.5 h-3.5 w-3.5" />
            )}
            Share
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
