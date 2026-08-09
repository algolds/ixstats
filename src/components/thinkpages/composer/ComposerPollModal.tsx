"use client";

import React from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { Vote, X, Info, Plus, Minus } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Switch } from "~/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { withBasePath } from "~/lib/base-path";

export interface ComposerPollModalProps {
  showPollModal: boolean;
  setShowPollModal: (val: boolean) => void;
  pollDraft: {
    question: string;
    pollType: "choice" | "feature-poll";
    multiple: boolean;
    options: string[];
  } | null;
  setPollDraft: (val: any) => void;
  isRegularUser: boolean;
  notify: any;
}

export function ComposerPollModal({
  showPollModal,
  setShowPollModal,
  pollDraft,
  setPollDraft,
  isRegularUser,
  notify,
}: ComposerPollModalProps) {
  if (typeof window === "undefined" || !showPollModal || !pollDraft) return null;

  return createPortal(
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setShowPollModal(false)}
          className="absolute inset-0 bg-black/60 backdrop-blur-md"
        />

        {/* Modal Container */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="text-foreground relative z-10 w-full max-w-md space-y-4 rounded-2xl border border-slate-200 bg-slate-900/95 p-5 shadow-2xl backdrop-blur-xl dark:border-white/10 dark:bg-neutral-900/95"
        >
          <div className="flex items-center justify-between border-b border-slate-200 pb-3 dark:border-white/10">
            <div className="flex items-center gap-2 text-sm font-bold text-[#ff8a65]">
              <Vote className="h-4 w-4" />
              <span>Configure Poll Draft</span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowPollModal(false)}
              className="h-7 w-7 cursor-pointer rounded-full text-slate-400 hover:bg-slate-500/10 hover:text-slate-200"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Poll Question */}
          <div className="space-y-1">
            <label className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
              Question / Topic *
            </label>
            <Input
              type="text"
              placeholder="Ask a question..."
              value={pollDraft.question}
              onChange={(e) => setPollDraft({ ...pollDraft, question: e.target.value })}
              className="bg-background/50 w-full focus-visible:ring-[#ff8a65]/50"
              required
            />
          </div>

          {/* Poll Type & Multiple Options */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <label className="text-muted-foreground mb-1 block text-[10px] font-bold tracking-wider uppercase">
                Poll Type
              </label>
              <Select
                value={pollDraft.pollType}
                onValueChange={(val: "choice" | "feature-poll") =>
                  setPollDraft({
                    ...pollDraft,
                    pollType: val,
                  })
                }
              >
                <SelectTrigger className="bg-background/50 h-8 w-full border border-slate-200 text-xs focus:border-[#ff8a65]/50 dark:border-white/10">
                  <SelectValue placeholder="Select Poll Type" />
                </SelectTrigger>
                <SelectContent className="bg-popover z-[100020] border border-slate-200 text-xs dark:border-slate-800">
                  <SelectItem value="choice">Choice Poll</SelectItem>
                  {!isRegularUser && (
                    <SelectItem value="feature-poll">Feature Poll</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col justify-end space-y-1 pb-1">
              <div className="flex items-center gap-2">
                <Switch
                  id="modal-poll-multiple-toggle"
                  checked={pollDraft.multiple}
                  onCheckedChange={(checked) =>
                    setPollDraft({ ...pollDraft, multiple: checked })
                  }
                  className="scale-90"
                />
                <label
                  htmlFor="modal-poll-multiple-toggle"
                  className="text-slate-650 cursor-pointer text-[11px] font-semibold dark:text-neutral-300"
                >
                  Multiple Selection
                </label>
              </div>
            </div>
          </div>

          {/* Blurb Prompt Notice for Regular Users */}
          {isRegularUser && (
            <div className="flex items-start gap-2 rounded-lg border border-[#ff8a65]/20 bg-[#ff8a65]/5 p-3 text-[11px] leading-relaxed text-[#ff8a65]">
              <Info className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                Citizen accounts can only launch Choice Polls. To prioritize features,
                create a structured roadmap, or run custom campaigns, submit a{" "}
                <a
                  href={withBasePath("/blurbs")}
                  className="font-bold underline hover:text-[#ff8a65]/80"
                  onClick={() => setShowPollModal(false)}
                >
                  Blurb prompt
                </a>{" "}
                instead.
              </span>
            </div>
          )}

          {/* Poll Options */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-muted-foreground block text-[10px] font-bold tracking-wider uppercase">
                Options * (min 2)
              </label>
              <span className="text-muted-foreground/60 text-[9px] font-medium">
                {pollDraft.options.filter((o) => o.trim()).length} / 10
              </span>
            </div>

            <div className="max-h-[180px] space-y-2 overflow-y-auto pr-1">
              {pollDraft.options.map((option, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <span className="text-muted-foreground/60 w-4 text-center text-[10px] font-bold">
                    {idx + 1}
                  </span>
                  <Input
                    type="text"
                    placeholder={`Option ${idx + 1}`}
                    value={option}
                    onChange={(e) => {
                      const updated = [...pollDraft.options];
                      updated[idx] = e.target.value;
                      setPollDraft({ ...pollDraft, options: updated });
                    }}
                    className="bg-background/50 flex-1 text-xs focus-visible:ring-[#ff8a65]/50"
                    required
                  />
                  {pollDraft.options.length > 2 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setPollDraft({
                          ...pollDraft,
                          options: pollDraft.options.filter((_, i) => i !== idx),
                        });
                      }}
                      className="h-7 w-7 shrink-0 cursor-pointer text-rose-500 hover:bg-rose-500/10 hover:text-rose-600"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              ))}
            </div>

            {pollDraft.options.length < 10 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setPollDraft({
                    ...pollDraft,
                    options: [...pollDraft.options, ""],
                  });
                }}
                className="mt-1 h-8 w-full cursor-pointer border-dashed border-[#ff8a65]/35 text-[10px] font-semibold text-[#ff8a65] hover:bg-[#ff8a65]/10 dark:text-[#ff8a65]"
              >
                <Plus className="mr-1 h-3 w-3" /> Add Option
              </Button>
            )}
          </div>

          {/* Actions */}
          <div className="mt-2 flex justify-end gap-2 border-t border-slate-200 pt-3.5 dark:border-white/10">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setPollDraft(null);
                setShowPollModal(false);
              }}
              className="h-8 cursor-pointer px-3 text-xs font-semibold text-rose-500 hover:bg-rose-500/10"
            >
              Discard Poll
            </Button>
            <Button
              type="button"
              onClick={() => {
                const validOpts = pollDraft.options.map((o) => o.trim()).filter(Boolean);
                if (!pollDraft.question.trim()) {
                  notify.error("Please enter a question");
                  return;
                }
                if (validOpts.length < 2) {
                  notify.error("At least 2 non-empty options are required");
                  return;
                }
                setShowPollModal(false);
                notify.success("Poll configured successfully!");
              }}
              className="h-8 cursor-pointer bg-[#ff8a65] px-4 text-xs font-bold text-white hover:bg-[#ff8a65]/90"
            >
              Save & Apply
            </Button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body
  );
}
