"use client";

import { useState, useEffect } from "react";
import {
  Send,
  Page as FileText,
  CheckCircle as CheckCircle2,
  Globe,
  ShieldCheck,
} from "iconoir-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { Badge } from "~/components/ui/badge";
import { api } from "~/trpc/react";

interface ThinkPagesShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  intentId: string;
  countryId: string;
  goal: string;
  tier?: string;
  category?: string;
  summary?: string;
  changesJson?: string;
  countryName?: string;
  countrySlug?: string;
}

export function ThinkPagesShareModal({
  isOpen,
  onClose,
  intentId,
  countryId,
  goal,
  tier = "EXECUTIVE",
  category = "policy",
  summary,
  changesJson,
  countryName = "The Government",
  countrySlug = "Statecraft",
}: ThinkPagesShareModalProps) {
  const [content, setContent] = useState("");
  const [publishStatus, setPublishStatus] = useState<"idle" | "drafted" | "published">("idle");

  const generateM = api.intent.generateSummationDraft.useMutation({
    onSuccess: (_, variables) => {
      if (variables.visibility === "public") {
        setPublishStatus("published");
      } else {
        setPublishStatus("drafted");
      }
    },
  });

  useEffect(() => {
    if (isOpen) {
      // oxlint-disable-next-line
      setPublishStatus("idle");
      let changesSummary = summary || goal;
      try {
        if (changesJson) {
          const parsed = JSON.parse(changesJson);
          if (Array.isArray(parsed) && parsed.length > 0) {
            changesSummary = parsed
              .filter(
                (c): c is { label: string } => typeof c === "object" && c !== null && "label" in c
              )
              .map((c) => c.label)
              .join(", ");
          }
        }
      } catch {
        /* fallback */
      }

      const initialText =
        `🏛️ **EXECUTIVE SUMMATION: ${goal}**\n\n` +
        `Under ${tier.toUpperCase()} Directive authority, ${countryName} has successfully completed state actions regarding "${goal}".\n\n` +
        `**Key Policy & Budget Measures Implemented:**\n` +
        `• ${changesSummary}\n\n` +
        `#${countrySlug} #ExecutiveDirective #${category}`;

      setContent(initialText);
    }
  }, [isOpen, goal, tier, category, summary, changesJson, countryName, countrySlug]);

  const handlePublish = (visibility: "public" | "draft") => {
    generateM.mutate({
      intentId,
      countryId,
      visibility,
      customContent: content,
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">
              <ShieldCheck />
              Official Government Account
            </Badge>
          </div>
          <DialogTitle className="text-foreground text-lg font-semibold tracking-tight">
            Share Directive Summation to ThinkPages
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-xs">
            Confirm or tweak your executive post before publishing directly to the ThinkPages feed.
          </DialogDescription>
        </DialogHeader>

        {publishStatus !== "idle" ? (
          <div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
            <CheckCircle2 className="h-8 w-8 text-emerald-500" />
            <h3 className="text-foreground text-base font-semibold">
              {publishStatus === "published"
                ? "Published Live to ThinkPages!"
                : "Saved as Draft in ThinkPages!"}
            </h3>
            <p className="text-muted-foreground max-w-md text-xs">
              {publishStatus === "published"
                ? "Your official executive summation is now visible in the national news feed."
                : "Your directive summation has been saved as an editable draft in ThinkPages."}
            </p>
            <div className="flex items-center gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={onClose}>
                Close
              </Button>
              <Button size="sm" onClick={() => window.open("/thinkpages", "_blank")}>
                <Globe className="h-3.5 w-3.5" />
                View ThinkPages Feed
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="thinkpages-share-draft">Post draft (editable)</Label>
              <Textarea
                id="thinkpages-share-draft"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={7}
                className="font-mono text-xs"
              />
            </div>

            <DialogFooter className="border-border flex items-center justify-between gap-2 border-t pt-3">
              <Button variant="ghost" size="sm" onClick={onClose}>
                Cancel
              </Button>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={generateM.isPending}
                  onClick={() => handlePublish("draft")}
                >
                  <FileText className="h-3.5 w-3.5" />
                  Save as Draft
                </Button>
                <Button
                  size="sm"
                  disabled={generateM.isPending}
                  onClick={() => handlePublish("public")}
                >
                  <Send className="h-3.5 w-3.5" />
                  Publish Now Live
                </Button>
              </div>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
