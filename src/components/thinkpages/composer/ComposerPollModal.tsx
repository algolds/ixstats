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
          <div className="border-border/60 flex items-center justify-between border-b pb-3">
            <div className="text-poll flex items-center gap-2 text-sm font-bold tracking-tight">
              <Vote className="h-4 w-4" />
              <span>Configure Poll Draft</span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowPollModal(false)}
              className="text-muted-foreground hover:text-foreground hover:bg-muted h-7 w-7 rounded-full transition-all active:scale-95"
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
              className="border-input bg-secondary focus-visible:ring-poll/50 rounded-xl text-xs font-medium"
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
                <SelectTrigger className="border-input bg-secondary focus:border-poll/50 h-8 rounded-xl text-xs font-semibold">
                  <SelectValue placeholder="Select Poll Type" />
                </SelectTrigger>
                <SelectContent className="border-border bg-popover/98 z-[100020] rounded-xl text-xs shadow-2xl backdrop-blur-2xl">
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
                  className="text-foreground cursor-pointer text-[11px] font-semibold"
                >
                  Multiple Selection
                </label>
              </div>
            </div>
          </div>

          {/* Blurb Prompt Notice for Regular Users */}
          {isRegularUser && (
            <div className="border-poll/20 bg-poll/5 text-poll flex items-start gap-2 rounded-xl border p-3 text-[11px] leading-relaxed">
              <Info className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                Citizen accounts can only launch Choice Polls. To prioritize features, create a
                structured roadmap, or run custom campaigns, submit a{" "}
                <a
                  href={withBasePath("/blurbs")}
                  className="hover:text-poll/80 font-bold underline"
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
              <span className="text-muted-foreground text-[9px] font-semibold">
                {pollDraft.options.filter((o) => o.trim()).length} / 10
              </span>
            </div>

            <div className="max-h-[180px] space-y-2 overflow-y-auto pr-1">
              {pollDraft.options.map((option, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <span className="text-muted-foreground w-4 text-center text-[10px] font-bold">
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
                    className="border-input bg-secondary focus-visible:ring-poll/50 flex-1 rounded-xl text-xs font-medium"
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
                className="border-poll/35 text-poll hover:bg-poll/10 mt-1 h-8 w-full rounded-xl border-dashed text-[10px] font-bold transition-all active:scale-[0.98]"
              >
                <Plus className="mr-1 h-3 w-3" /> Add Option
              </Button>
            )}
          </div>

          {/* Actions */}
          <div className="border-border/60 mt-3 flex justify-end gap-2 border-t pt-3.5">
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
              className="bg-poll hover:bg-poll/90 h-8 rounded-xl px-4 text-xs font-bold text-white shadow-md transition-all active:scale-[0.97]"
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
