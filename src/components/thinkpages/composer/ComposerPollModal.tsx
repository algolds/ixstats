"use client";

import { useState } from "react";
import { Vote, Plus, Minus, X } from "lucide-react";
import { Dialog, DialogContent } from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { Switch } from "~/components/ui/switch";

export interface PollDraft {
  question: string;
  pollType: "choice" | "feature-poll";
  multiple: boolean;
  options: string[];
}

export interface ComposerPollModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSavePoll: (poll: PollDraft) => void;
  initialPoll?: PollDraft | null;
}

export function ComposerPollModal({
  isOpen,
  onClose,
  onSavePoll,
  initialPoll,
}: ComposerPollModalProps) {
  const [question, setQuestion] = useState(initialPoll?.question ?? "");
  const [options, setOptions] = useState<string[]>(
    initialPoll?.options ?? ["", ""]
  );
  const [multiple, setMultiple] = useState(initialPoll?.multiple ?? false);

  const handleAddOption = () => {
    if (options.length < 6) {
      setOptions([...options, ""]);
    }
  };

  const handleRemoveOption = (index: number) => {
    if (options.length > 2) {
      setOptions(options.filter((_, i) => i !== index));
    }
  };

  const handleOptionChange = (index: number, val: string) => {
    const updated = [...options];
    updated[index] = val;
    setOptions(updated);
  };

  const handleSave = () => {
    const validOptions = options.map((o) => o.trim()).filter(Boolean);
    if (!question.trim() || validOptions.length < 2) return;

    onSavePoll({
      question: question.trim(),
      pollType: "choice",
      multiple,
      options: validOptions,
    });
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md border-white/10 bg-slate-900/95 shadow-2xl backdrop-blur-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-bold text-white">
            <Vote className="h-4 w-4 text-purple-400" />
            <span>Create Poll</span>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Question Input */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-400">Question</label>
          <Input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask a question..."
            className="border-white/10 bg-black/40 text-sm text-white placeholder:text-slate-500"
          />
        </div>

        {/* Option Inputs */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-400">Options</label>
          {options.map((opt, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input
                value={opt}
                onChange={(e) => handleOptionChange(i, e.target.value)}
                placeholder={`Option ${i + 1}`}
                className="border-white/10 bg-black/40 text-xs text-white placeholder:text-slate-500"
              />
              {options.length > 2 && (
                <button
                  onClick={() => handleRemoveOption(i)}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-500/20 hover:text-rose-400"
                >
                  <Minus className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}

          {options.length < 6 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleAddOption}
              className="mt-1 w-full border-dashed border-white/20 bg-transparent text-xs text-slate-300 hover:bg-white/5"
            >
              <Plus className="mr-1 h-3.5 w-3.5" /> Add Option
            </Button>
          )}
        </div>

        {/* Multi-select Switch */}
        <div className="flex items-center justify-between border-t border-white/10 pt-3">
          <span className="text-xs font-medium text-slate-300">Allow Multiple Choices</span>
          <Switch checked={multiple} onCheckedChange={setMultiple} />
        </div>

        {/* Footer Actions */}
        <div className="flex justify-end gap-2 pt-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="text-xs text-slate-400 hover:bg-white/5 hover:text-white"
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!question.trim() || options.filter((o) => o.trim()).length < 2}
            className="bg-purple-600 text-xs font-semibold text-white hover:bg-purple-500"
          >
            Save Poll
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
