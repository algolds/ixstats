"use client";

import React from "react";
import { CheckSquare as Vote, InfoCircle as Info, Plus, Minus } from "iconoir-react";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
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
  if (!pollDraft) return null;

  return (
    <Dialog open={showPollModal} onOpenChange={setShowPollModal}>
      <DialogContent className="gap-4 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-title-3 flex items-center gap-2">
            <Vote className="text-tint size-5" aria-hidden="true" />
            Configure Poll Draft
          </DialogTitle>
          <DialogDescription className="sr-only">
            Set the poll question, type and options.
          </DialogDescription>
        </DialogHeader>

        {/* Poll Question */}
        <div className="space-y-2">
          <label htmlFor="poll-question" className="text-subhead text-label">
            Question / Topic *
          </label>
          <Input
            id="poll-question"
            type="text"
            placeholder="Ask a question..."
            value={pollDraft.question}
            onChange={(e) => setPollDraft({ ...pollDraft, question: e.target.value })}
            required
          />
        </div>

        {/* Poll Type & Multiple Options */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <span className="text-subhead text-label block">Poll Type</span>
            <Select
              value={pollDraft.pollType}
              onValueChange={(val: "choice" | "feature-poll") =>
                setPollDraft({
                  ...pollDraft,
                  pollType: val,
                })
              }
            >
              <SelectTrigger aria-label="Poll type">
                <SelectValue placeholder="Select Poll Type" />
              </SelectTrigger>
              <SelectContent>
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
              />
              <label
                htmlFor="modal-poll-multiple-toggle"
                className="text-body text-label cursor-pointer"
              >
                Multiple Selection
              </label>
            </div>
          </div>
        </div>

        {/* Blurb Prompt Notice for Regular Users */}
        {isRegularUser && (
          <div className="bg-info/10 text-callout text-label rounded-row flex items-start gap-2 p-3">
            <Info className="text-info mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>
              Citizen accounts can only launch Choice Polls. To prioritize features, create a
              structured roadmap, or run custom campaigns, submit a{" "}
              <a
                href={withBasePath("/blurbs")}
                className="text-tint font-medium underline"
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
            <span className="text-subhead text-label block">Options * (min 2)</span>
            <span className="text-footnote text-label-secondary tabular-nums">
              {pollDraft.options.filter((o) => o.trim()).length} / 10
            </span>
          </div>

          <div className="max-h-[180px] space-y-2 overflow-y-auto pr-1">
            {pollDraft.options.map((option, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <span className="text-footnote text-label-secondary w-4 text-center tabular-nums">
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
                  aria-label={`Option ${idx + 1}`}
                  className="flex-1"
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
                    aria-label={`Remove option ${idx + 1}`}
                    className="text-destructive hover:bg-destructive/10 hover:text-destructive size-7 shrink-0"
                  >
                    <Minus />
                  </Button>
                )}
              </div>
            ))}
          </div>

          {pollDraft.options.length < 10 && (
            <Button
              type="button"
              variant="bordered"
              size="sm"
              onClick={() => {
                setPollDraft({
                  ...pollDraft,
                  options: [...pollDraft.options, ""],
                });
              }}
              className="mt-1 w-full border-dashed"
            >
              <Plus aria-hidden="true" /> Add Option
            </Button>
          )}
        </div>

        {/* Actions */}
        <DialogFooter className="border-separator border-t pt-4">
          <Button
            type="button"
            variant="plain"
            onClick={() => {
              setPollDraft(null);
              setShowPollModal(false);
            }}
            className="text-destructive hover:text-destructive"
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
          >
            Save & Apply
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
