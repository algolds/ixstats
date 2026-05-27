"use client";

import React, { useState, useEffect } from "react";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Textarea } from "~/components/ui/textarea";
import { Label } from "~/components/ui/label";
import { useToastHelpers } from "~/components/ui/toast";
import { getConsoleLogs, type CapturedLog } from "~/lib/console-capture";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  MessageSquare,
  ChevronDown,
  ChevronUp,
  Terminal,
  Globe,
  Info,
  Loader2,
  Cpu,
} from "lucide-react";
import { cn } from "~/lib/utils";

interface FeedbackModalProps {
  onClose: () => void;
}

export function FeedbackModal({ onClose }: FeedbackModalProps) {
  const toast = useToastHelpers();
  const [feedbackType, setFeedbackType] = useState<string>("suggestion");
  const [message, setMessage] = useState<string>("");
  const [url, setUrl] = useState<string>("");
  const [userAgent, setUserAgent] = useState<string>("");
  const [logs, setLogs] = useState<CapturedLog[]>([]);
  const [showDiagnostics, setShowDiagnostics] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setUrl(window.location.href);
      setUserAgent(navigator.userAgent);
      setLogs(getConsoleLogs());
    }
  }, []);

  const submitMutation = api.userLogging.submitFeedback.useMutation({
    onSuccess: () => {
      toast.success("Feedback Submitted", "Thank you for helping us improve IxStats!");
      onClose();
    },
    onError: (err) => {
      toast.error(
        "Submission Failed",
        err.message || "Failed to submit feedback. Please try again."
      );
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) {
      toast.error("Validation Error", "Please enter your feedback message.");
      return;
    }

    submitMutation.mutate({
      feedbackType,
      message,
      url,
      userAgent,
      logs: logs.map((log) => ({
        type: log.type,
        message: log.message,
        timestamp: log.timestamp,
      })),
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex flex-col gap-1.5 text-left">
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-sky-500/10 p-1.5 text-sky-500 dark:bg-sky-500/20">
            <MessageSquare className="h-4 w-4" />
          </div>
          <span className="text-foreground text-lg leading-none font-bold">Send Feedback</span>
        </div>
        <p className="text-muted-foreground text-xs leading-relaxed">
          Have a suggestion, bug report, or query? Fill out the form below. Diagnostic logs and
          route metadata are attached automatically to help developers debug.
        </p>
      </div>

      <div className="space-y-3">
        {/* Feedback Type */}
        <div className="space-y-1">
          <Label htmlFor="feedback-type" className="text-muted-foreground text-xs font-semibold">
            Category
          </Label>
          <Select value={feedbackType} onValueChange={setFeedbackType}>
            <SelectTrigger id="feedback-type" className="bg-background/40 w-full text-xs">
              <SelectValue placeholder="Select feedback type" />
            </SelectTrigger>
            <SelectContent className="z-[100021]">
              <SelectItem value="bug" className="text-xs">
                Bug Report
              </SelectItem>
              <SelectItem value="suggestion" className="text-xs">
                Suggestion
              </SelectItem>
              <SelectItem value="question" className="text-xs">
                Question
              </SelectItem>
              <SelectItem value="other" className="text-xs">
                Other
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Message */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <Label htmlFor="message" className="text-muted-foreground text-xs font-semibold">
              Message
            </Label>
            <span className="text-muted-foreground/75 text-[10px]">{message.length} / 1000</span>
          </div>
          <Textarea
            id="message"
            value={message}
            onChange={(e) => setMessage(e.target.value.slice(0, 1000))}
            placeholder="What's on your mind? Please describe any bugs or suggestions in detail..."
            className="border-border bg-background/25 min-h-[100px] resize-none text-xs focus-visible:ring-sky-500/50"
            required
          />
        </div>

        {/* Collapsible Diagnostics */}
        <div className="border-border/40 bg-muted/20 overflow-hidden rounded-lg border">
          <button
            type="button"
            onClick={() => setShowDiagnostics(!showDiagnostics)}
            className="hover:bg-muted/30 flex w-full items-center justify-between px-3 py-2 text-left transition-colors"
          >
            <span className="text-muted-foreground flex items-center gap-1.5 text-[10px] font-semibold">
              <Terminal className="h-3.5 w-3.5 text-sky-500" />
              <span>Diagnostic Metadata Preview ({logs.length} logs)</span>
            </span>
            {showDiagnostics ? (
              <ChevronUp className="text-muted-foreground h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="text-muted-foreground h-3.5 w-3.5" />
            )}
          </button>

          {showDiagnostics && (
            <div className="border-border/30 bg-background/30 max-h-[220px] space-y-2 overflow-y-auto border-t p-3 text-[10px]">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div className="border-border/20 bg-muted/40 flex flex-col gap-0.5 rounded-md border p-1.5">
                  <span className="text-muted-foreground flex items-center gap-1 text-[8px] font-semibold tracking-wider uppercase">
                    <Globe className="h-2.5 w-2.5" />
                    Active URL
                  </span>
                  <span className="text-foreground truncate font-mono text-[9px]" title={url}>
                    {url || "Retrieving..."}
                  </span>
                </div>
                <div className="border-border/20 bg-muted/40 flex flex-col gap-0.5 rounded-md border p-1.5">
                  <span className="text-muted-foreground flex items-center gap-1 text-[8px] font-semibold tracking-wider uppercase">
                    <Cpu className="h-2.5 w-2.5" />
                    Browser Agent
                  </span>
                  <span className="text-foreground truncate font-mono text-[9px]" title={userAgent}>
                    {userAgent || "Retrieving..."}
                  </span>
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-muted-foreground block text-[8px] font-semibold tracking-wider uppercase">
                  Console Log Stream (Last 50 Events)
                </span>
                {logs.length === 0 ? (
                  <div className="border-border/30 bg-muted/10 flex items-center gap-1 rounded-md border border-dashed p-2 text-center">
                    <Info className="text-muted-foreground/60 h-3 w-3" />
                    <span className="text-muted-foreground/60 text-[9px]">
                      No console messages captured yet.
                    </span>
                  </div>
                ) : (
                  <div className="border-border/30 max-h-[110px] space-y-1 overflow-y-auto rounded-md border bg-slate-950/80 p-2 font-mono text-[9px] leading-relaxed">
                    {logs.map((log, index) => (
                      <div
                        key={index}
                        className="flex items-start gap-1.5 border-b border-white/5 pb-0.5 last:border-b-0"
                      >
                        <span
                          className={cn(
                            "shrink-0 rounded-sm px-1 text-[7px] font-bold uppercase select-none",
                            log.type === "error"
                              ? "border border-red-500/30 bg-red-500/20 text-red-400"
                              : log.type === "warn"
                                ? "border border-amber-500/30 bg-amber-500/20 text-amber-400"
                                : "border border-blue-500/30 bg-blue-500/20 text-blue-400"
                          )}
                        >
                          {log.type}
                        </span>
                        <span className="text-muted-foreground shrink-0 text-[8px] select-none">
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </span>
                        <span className="break-all text-slate-200 select-all">{log.message}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="border-border/40 flex items-center justify-end gap-2 border-t pt-3">
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          disabled={submitMutation.isPending}
          className="border-border h-8 px-3 text-xs shadow-xs"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={submitMutation.isPending}
          className="h-8 border-0 bg-sky-600 px-4 text-xs text-white transition-colors hover:bg-sky-500"
        >
          {submitMutation.isPending ? (
            <>
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              Submitting...
            </>
          ) : (
            "Submit Feedback"
          )}
        </Button>
      </div>
    </form>
  );
}
