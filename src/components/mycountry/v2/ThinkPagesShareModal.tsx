"use client";

import { useState, useEffect } from "react";
import { Send, FileText, CheckCircle2, Globe, ShieldCheck } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
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
      setPublishStatus("idle");
      let changesSummary = summary || goal;
      try {
        if (changesJson) {
          const parsed = JSON.parse(changesJson);
          if (Array.isArray(parsed) && parsed.length > 0) {
            changesSummary = parsed.map((c: any) => c.label).join(", ");
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
      <DialogContent className="max-w-xl border-purple-500/30 bg-card/95 backdrop-blur-xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Badge className="border-purple-500/40 bg-purple-500/20 text-purple-300">
              <ShieldCheck className="mr-1 h-3 w-3" />
              Official Government Account
            </Badge>
          </div>
          <DialogTitle className="text-lg font-black tracking-tight text-foreground">
            Share Directive Summation to ThinkPages
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Confirm or tweak your executive post before publishing directly to the ThinkPages feed.
          </DialogDescription>
        </DialogHeader>

        {publishStatus !== "idle" ? (
          <div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
            <CheckCircle2 className="h-12 w-12 text-emerald-400 animate-bounce" />
            <h3 className="text-base font-extrabold text-foreground">
              {publishStatus === "published" ? "Published Live to ThinkPages!" : "Saved as Draft in ThinkPages!"}
            </h3>
            <p className="text-xs text-muted-foreground max-w-md">
              {publishStatus === "published"
                ? "Your official executive summation is now visible in the national news feed."
                : "Your directive summation has been saved as an editable draft in ThinkPages."}
            </p>
            <div className="flex items-center gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={onClose} className="cursor-pointer">
                Close
              </Button>
              <Button
                size="sm"
                className="bg-purple-600 hover:bg-purple-500 text-white font-bold cursor-pointer"
                onClick={() => window.open("/thinkpages", "_blank")}
              >
                <Globe className="mr-1.5 h-3.5 w-3.5" />
                View ThinkPages Feed
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Post Prose Draft (Editable)
              </label>
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={7}
                className="font-mono text-xs border-white/10 bg-black/40 focus:border-purple-500/50"
              />
            </div>

            <DialogFooter className="flex items-center justify-between gap-2 border-t border-border/30 pt-3">
              <Button variant="ghost" size="sm" onClick={onClose} className="cursor-pointer">
                Cancel
              </Button>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={generateM.isPending}
                  onClick={() => handlePublish("draft")}
                  className="border-purple-500/30 text-purple-300 hover:bg-purple-500/10 cursor-pointer"
                >
                  <FileText className="mr-1.5 h-3.5 w-3.5" />
                  Save as Draft
                </Button>
                <Button
                  size="sm"
                  disabled={generateM.isPending}
                  onClick={() => handlePublish("public")}
                  className="bg-purple-600 hover:bg-purple-500 text-white font-bold cursor-pointer shadow-md"
                >
                  <Send className="mr-1.5 h-3.5 w-3.5" />
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
