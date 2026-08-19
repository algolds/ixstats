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
          className="absolute inset-0 bg-black/60 backdrop-blur-2xl"
        />

        {/* Modal Sheet Container (Apple HIG Control Surface) */}
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 16 }}
          transition={{ type: "spring", stiffness: 420, damping: 30 }}
          className="text-foreground dark:border-border dark:bg-popover/98 relative z-10 w-full max-w-md space-y-4 rounded-3xl border border-black/10 bg-white/95 p-6 shadow-2xl backdrop-blur-2xl dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]"
        >
          <div className="dark:border-border/60 flex items-center justify-between border-b border-black/5 pb-3">
            <div className="flex items-center gap-2 text-sm font-bold tracking-tight text-[#ff8a65]">
              <Vote className="h-4 w-4" />
              <span>Configure Poll Draft</span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowPollModal(false)}
              className="text-muted-foreground hover:text-foreground h-7 w-7 rounded-full transition-all hover:bg-black/5 active:scale-95 dark:hover:bg-white/10"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Poll Question */}
          <div className="space-y-1.5">
            <label className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
              Question / Topic *
            </label>
            <Input
              type="text"
              placeholder="Ask a question..."
              value={pollDraft.question}
              onChange={(e) => setPollDraft({ ...pollDraft, question: e.target.value })}
              className="dark:border-border dark:bg-secondary/40 rounded-xl border-black/10 bg-black/[0.03] text-xs font-medium focus-visible:ring-[#ff8a65]/50"
              required
            />
          </div>

          {/* Poll Type & Multiple Options */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
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
                <SelectTrigger className="dark:border-border dark:bg-secondary/40 h-8 rounded-xl border border-black/10 bg-black/[0.03] text-xs font-semibold focus:border-[#ff8a65]/50">
                  <SelectValue placeholder="Select Poll Type" />
                </SelectTrigger>
                <SelectContent className="dark:border-border dark:bg-popover/98 z-[100020] rounded-xl border border-black/10 bg-white/95 text-xs shadow-2xl backdrop-blur-2xl">
                  <SelectItem value="choice">Choice Poll</SelectItem>
                  {!isRegularUser && <SelectItem value="feature-poll">Feature Poll</SelectItem>}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col justify-end space-y-1 pb-1">
              <div className="flex items-center gap-2">
                <Switch
                  id="modal-poll-multiple-toggle"
                  checked={pollDraft.multiple}
                  onCheckedChange={(checked) => setPollDraft({ ...pollDraft, multiple: checked })}
                  className="scale-90"
                />
                <label
                  htmlFor="modal-poll-multiple-toggle"
                  className="cursor-pointer text-[11px] font-semibold text-slate-700 dark:text-slate-300"
                >
                  Multiple Selection
                </label>
              </div>
            </div>
          </div>

          {/* Blurb Prompt Notice for Regular Users */}
          {isRegularUser && (
            <div className="flex items-start gap-2 rounded-xl border border-[#ff8a65]/20 bg-[#ff8a65]/5 p-3 text-[11px] leading-relaxed text-[#ff8a65]">
              <Info className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                Citizen accounts can only launch Choice Polls. To prioritize features, create a
                structured roadmap, or run custom campaigns, submit a{" "}
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
              <label className="block text-[10px] font-bold tracking-wider text-slate-500 uppercase dark:text-slate-400">
                Options * (min 2)
              </label>
              <span className="text-[9px] font-semibold text-slate-400">
                {pollDraft.options.filter((o) => o.trim()).length} / 10
              </span>
            </div>

            <div className="max-h-[180px] space-y-2 overflow-y-auto pr-1">
              {pollDraft.options.map((option, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <span className="w-4 text-center text-[10px] font-bold text-slate-400">
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
                    className="flex-1 rounded-xl border-black/10 bg-black/[0.03] text-xs font-medium focus-visible:ring-[#ff8a65]/50 dark:border-white/10 dark:bg-white/[0.04]"
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
                      className="h-7 w-7 shrink-0 cursor-pointer rounded-lg text-rose-500 transition-all hover:bg-rose-500/10 hover:text-rose-600 active:scale-95"
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
                className="mt-1 h-8 w-full rounded-xl border-dashed border-[#ff8a65]/35 text-[10px] font-bold text-[#ff8a65] transition-all hover:bg-[#ff8a65]/10 active:scale-[0.98]"
              >
                <Plus className="mr-1 h-3 w-3" /> Add Option
              </Button>
            )}
          </div>

          {/* Actions */}
          <div className="mt-3 flex justify-end gap-2 border-t border-black/5 pt-3.5 dark:border-white/10">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setPollDraft(null);
                setShowPollModal(false);
              }}
              className="h-8 rounded-xl px-3.5 text-xs font-semibold text-rose-500 transition-all hover:bg-rose-500/10 active:scale-95"
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
              className="h-8 rounded-xl bg-[#ff8a65] px-4 text-xs font-bold text-white shadow-md transition-all hover:bg-[#ff8a65]/90 active:scale-[0.97]"
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
