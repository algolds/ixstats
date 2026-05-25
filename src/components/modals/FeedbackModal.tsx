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
          <div className="bg-sky-500/10 text-sky-500 rounded-lg p-1.5 dark:bg-sky-500/20">
            <MessageSquare className="h-4 w-4" />
          </div>
          <span className="text-foreground text-lg font-bold leading-none">Send Feedback</span>
        </div>
        <p className="text-muted-foreground text-xs leading-relaxed">
          Have a suggestion, bug report, or query? Fill out the form below. Diagnostic logs and route metadata are attached automatically to help developers debug.
        </p>
      </div>

      <div className="space-y-3">
        {/* Feedback Type */}
        <div className="space-y-1">
          <Label htmlFor="feedback-type" className="text-xs font-semibold text-muted-foreground">
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
            <Label htmlFor="message" className="text-xs font-semibold text-muted-foreground">
              Message
            </Label>
            <span className="text-[10px] text-muted-foreground/75">
              {message.length} / 1000
            </span>
          </div>
          <Textarea
            id="message"
            value={message}
            onChange={(e) => setMessage(e.target.value.slice(0, 1000))}
            placeholder="What's on your mind? Please describe any bugs or suggestions in detail..."
            className="border-border bg-background/25 focus-visible:ring-sky-500/50 text-xs min-h-[100px] resize-none"
            required
          />
        </div>

        {/* Collapsible Diagnostics */}
        <div className="rounded-lg border border-border/40 bg-muted/20 overflow-hidden">
          <button
            type="button"
            onClick={() => setShowDiagnostics(!showDiagnostics)}
            className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-muted/30 transition-colors"
          >
            <span className="flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground">
              <Terminal className="h-3.5 w-3.5 text-sky-500" />
              <span>Diagnostic Metadata Preview ({logs.length} logs)</span>
            </span>
            {showDiagnostics ? (
              <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            )}
          </button>

          {showDiagnostics && (
            <div className="border-t border-border/30 p-3 space-y-2 text-[10px] bg-background/30 max-h-[220px] overflow-y-auto">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div className="flex flex-col gap-0.5 rounded-md border border-border/20 bg-muted/40 p-1.5">
                  <span className="text-[8px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                    <Globe className="h-2.5 w-2.5" />
                    Active URL
                  </span>
                  <span className="text-foreground truncate font-mono text-[9px]" title={url}>
                    {url || "Retrieving..."}
                  </span>
                </div>
                <div className="flex flex-col gap-0.5 rounded-md border border-border/20 bg-muted/40 p-1.5">
                  <span className="text-[8px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                    <Cpu className="h-2.5 w-2.5" />
                    Browser Agent
                  </span>
                  <span className="text-foreground truncate font-mono text-[9px]" title={userAgent}>
                    {userAgent || "Retrieving..."}
                  </span>
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-[8px] font-semibold text-muted-foreground uppercase tracking-wider block">
                  Console Log Stream (Last 50 Events)
                </span>
                {logs.length === 0 ? (
                  <div className="flex items-center gap-1 rounded-md border border-dashed border-border/30 p-2 text-center bg-muted/10">
                    <Info className="h-3 w-3 text-muted-foreground/60" />
                    <span className="text-muted-foreground/60 text-[9px]">No console messages captured yet.</span>
                  </div>
                ) : (
                  <div className="space-y-1 max-h-[110px] overflow-y-auto rounded-md border border-border/30 bg-slate-950/80 p-2 font-mono text-[9px] leading-relaxed">
                    {logs.map((log, index) => (
                      <div key={index} className="flex items-start gap-1.5 border-b border-white/5 pb-0.5 last:border-b-0">
                        <span
                          className={cn(
                            "text-[7px] px-1 rounded-sm font-bold uppercase select-none shrink-0",
                            log.type === "error"
                              ? "bg-red-500/20 text-red-400 border border-red-500/30"
                              : log.type === "warn"
                              ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                              : "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                          )}
                        >
                          {log.type}
                        </span>
                        <span className="text-[8px] text-muted-foreground select-none shrink-0">
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </span>
                        <span className="text-slate-200 break-all select-all">{log.message}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-border/40 pt-3">
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          disabled={submitMutation.isPending}
          className="border-border text-xs px-3 h-8 shadow-xs"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={submitMutation.isPending}
          className="bg-sky-600 hover:bg-sky-500 text-white text-xs px-4 h-8 transition-colors border-0"
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
