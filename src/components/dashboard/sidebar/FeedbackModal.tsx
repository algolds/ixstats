"use client";

import React, { useState, useEffect } from "react";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Textarea } from "~/components/ui/textarea";
import { Label } from "~/components/ui/label";
import { useNotify } from "~/hooks/useNotify";
import { getConsoleLogs, type CapturedLog } from "~/lib/logging";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  ChatBubble as MessageSquare,
  NavArrowDown as ChevronDown,
  NavArrowUp as ChevronUp,
  Terminal,
  Globe,
  InfoCircle as Info,
  SystemRestart as Loader2,
  Cpu,
} from "iconoir-react";
import { Badge } from "~/components/ui/badge";
import { DialogDescription, DialogHeader, DialogTitle } from "~/components/ui/dialog";

interface FeedbackModalProps {
  onClose: () => void;
}

export function FeedbackModal({ onClose }: FeedbackModalProps) {
  const notify = useNotify();
  const [feedbackType, setFeedbackType] = useState<string>("suggestion");
  const [message, setMessage] = useState<string>("");
  const [url, setUrl] = useState<string>("");
  const [userAgent, setUserAgent] = useState<string>("");
  const [logs, setLogs] = useState<CapturedLog[]>([]);
  const [showDiagnostics, setShowDiagnostics] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      // oxlint-disable-next-line
      setUrl(window.location.href);
      setUserAgent(navigator.userAgent);
      setLogs(getConsoleLogs());
    }
  }, []);

  const submitMutation = api.userLogging.submitFeedback.useMutation({
    onSuccess: () => {
      notify.success("Feedback Submitted", "Thank you for helping us improve IxStats!");
      onClose();
    },
    onError: (err) => {
      notify.error(
        "Submission Failed",
        err.message || "Failed to submit feedback. Please try again."
      );
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) {
      notify.error("Validation Error", "Please enter your feedback message.");
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
      <DialogHeader className="text-left">
        <DialogTitle className="flex items-center gap-2">
          <MessageSquare aria-hidden className="text-tint size-5 shrink-0" />
          Send feedback
        </DialogTitle>
        <DialogDescription>
          Have a suggestion, bug report, or query? Fill out the form below. Diagnostic logs and
          route metadata are attached automatically to help developers debug.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-3">
        {/* Feedback Type */}
        <div className="space-y-1">
          <Label htmlFor="feedback-type" className="text-subhead text-label-secondary">
            Category
          </Label>
          <Select value={feedbackType} onValueChange={setFeedbackType}>
            <SelectTrigger id="feedback-type" className="w-full">
              <SelectValue placeholder="Select feedback type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="bug">Bug report</SelectItem>
              <SelectItem value="suggestion">Suggestion</SelectItem>
              <SelectItem value="question">Question</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Message */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <Label htmlFor="message" className="text-subhead text-label-secondary">
              Message
            </Label>
            <span className="text-label-secondary text-footnote tabular-nums">
              {message.length} / 1000
            </span>
          </div>
          <Textarea
            id="message"
            value={message}
            onChange={(e) => setMessage(e.target.value.slice(0, 1000))}
            placeholder="What's on your mind? Please describe any bugs or suggestions in detail..."
            className="min-h-[100px] resize-none"
            required
          />
        </div>

        {/* Collapsible Diagnostics */}
        <div className="border-separator rounded-row overflow-hidden border">
          <button
            type="button"
            onClick={() => setShowDiagnostics(!showDiagnostics)}
            aria-expanded={showDiagnostics}
            className="hover:bg-fill-4 focus-visible:outline-tint flex w-full items-center justify-between px-3 py-2 text-left transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2"
          >
            <span className="text-label-secondary text-caption flex items-center gap-2">
              <Terminal aria-hidden className="size-3.5" />
              <span>Diagnostic metadata preview ({logs.length} logs)</span>
            </span>
            {showDiagnostics ? (
              <ChevronUp aria-hidden className="text-label-secondary size-3.5" />
            ) : (
              <ChevronDown aria-hidden className="text-label-secondary size-3.5" />
            )}
          </button>

          {showDiagnostics && (
            <div className="border-separator bg-surface-secondary text-footnote max-h-[220px] space-y-2 overflow-y-auto border-t p-3">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div className="bg-surface rounded-control-sm flex flex-col gap-0.5 p-2">
                  <span className="text-label-secondary text-eyebrow flex items-center gap-1">
                    <Globe aria-hidden className="size-3" />
                    Active URL
                  </span>
                  <span className="text-label text-footnote truncate font-mono" title={url}>
                    {url || "Retrieving..."}
                  </span>
                </div>
                <div className="bg-surface rounded-control-sm flex flex-col gap-0.5 p-2">
                  <span className="text-label-secondary text-eyebrow flex items-center gap-1">
                    <Cpu aria-hidden className="size-3" />
                    Browser agent
                  </span>
                  <span className="text-label text-footnote truncate font-mono" title={userAgent}>
                    {userAgent || "Retrieving..."}
                  </span>
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-label-secondary text-subhead block">
                  Console log stream (last 50 events)
                </span>
                {logs.length === 0 ? (
                  <div className="bg-surface rounded-control-sm flex items-center gap-1 p-2">
                    <Info aria-hidden className="text-label-secondary size-3.5" />
                    <span className="text-label-secondary text-footnote">
                      No console messages captured yet.
                    </span>
                  </div>
                ) : (
                  <div className="bg-surface rounded-control-sm text-footnote max-h-[110px] space-y-1 overflow-y-auto p-2 font-mono">
                    {logs.map((log, index) => (
                      <div
                        key={index}
                        className="border-separator flex items-start gap-2 border-b pb-0.5 last:border-b-0"
                      >
                        <Badge
                          variant={
                            log.type === "error"
                              ? "destructive"
                              : log.type === "warn"
                                ? "caution"
                                : "info"
                          }
                          className="select-none"
                        >
                          {log.type}
                        </Badge>
                        <span className="text-label-secondary text-footnote shrink-0 tabular-nums select-none">
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </span>
                        <span className="text-label-secondary break-all select-all">
                          {log.message}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 pt-2">
        <Button type="button" variant="secondary" onClick={onClose} disabled={submitMutation.isPending}>
          Cancel
        </Button>
        <Button type="submit" variant="default" disabled={submitMutation.isPending}>
          {submitMutation.isPending ? (
            <>
              <Loader2 aria-hidden className="animate-spin" />
              Submitting...
            </>
          ) : (
            "Submit feedback"
          )}
        </Button>
      </div>
    </form>
  );
}
