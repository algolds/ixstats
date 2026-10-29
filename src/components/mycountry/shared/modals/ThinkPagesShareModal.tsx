"use client";

import { useState } from "react";
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
import { withBasePath } from "~/lib/base-path";
import { useNotify } from "~/hooks/useNotify";

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
  countryName: string;
  countrySlug: string;
  /** "completed" only once the owner completed it; an active directive was declared. */
  status: string | null | undefined;
}

/** The post a directive's summation starts from: its goal, the measures taken and its hashtags. */
function summationDraft({
  goal,
  tier,
  category,
  summary,
  changesJson,
  countryName,
  countrySlug,
  status,
}: Pick<
  ThinkPagesShareModalProps,
  "goal" | "summary" | "changesJson" | "countryName" | "countrySlug" | "status"
> & { tier: string; category: string }): string {
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

  return (
    `**Executive summary: ${goal}**\n\n` +
    `${countryName} ${status === "completed" ? "completed" : "declared"} a ${tier} Directive: "${goal}".\n\n` +
    `**Measures taken:**\n` +
    `• ${changesSummary}\n\n` +
    `#${countrySlug.replace(/[^A-Za-z0-9]/g, "")} #ExecutiveDirective #${category}`
  );
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
  countryName,
  countrySlug,
  status,
}: ThinkPagesShareModalProps) {
  const notify = useNotify();
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
    onError: (e) => notify.error("Could not share the directive", e.message),
  });

  // Opening the modal, or new directive details while it is open, starts a fresh draft, during render.
  const draft = isOpen
    ? summationDraft({
        goal,
        tier,
        category,
        summary,
        changesJson,
        countryName,
        countrySlug,
        status,
      })
    : null;
  const [draftedFrom, setDraftedFrom] = useState<string | null>(null);
  if (draft !== draftedFrom) {
    setDraftedFrom(draft);
    if (draft !== null) {
      setPublishStatus("idle");
      setContent(draft);
    }
  }

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
            <Badge variant="default">
              <ShieldCheck />
              Official government account
            </Badge>
          </div>
          <DialogTitle className="text-label text-title-3">
            Share Directive summary to ThinkPages
          </DialogTitle>
          <DialogDescription className="text-label-secondary text-footnote">
            Review and edit your post before publishing it to the ThinkPages feed.
          </DialogDescription>
        </DialogHeader>

        {publishStatus !== "idle" ? (
          <div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
            <CheckCircle2 className="text-green h-8 w-8" />
            <h3 className="text-label text-title-3">
              {publishStatus === "published"
                ? "Published to ThinkPages"
                : "Draft saved in ThinkPages"}
            </h3>
            <p className="text-label-secondary text-footnote max-w-md">
              {publishStatus === "published"
                ? "Your summary is now visible in the national news feed."
                : "Your Directive summary is saved as an editable draft in ThinkPages."}
            </p>
            <div className="flex items-center gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={onClose}>
                Close
              </Button>
              <Button size="sm" onClick={() => window.open(withBasePath("/dashboard"), "_blank")}>
                <Globe className="h-3.5 w-3.5" />
                Open the feed
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="thinkpages-share-draft">Post draft (editable)</Label>
              <Textarea
                id="thinkpages-share-draft"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={7}
                className="text-footnote tabular-nums"
              />
            </div>

            <DialogFooter className="border-separator flex items-center justify-between gap-2 border-t pt-3">
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
                  Save as draft
                </Button>
                <Button
                  size="sm"
                  disabled={generateM.isPending}
                  onClick={() => handlePublish("public")}
                >
                  <Send className="h-3.5 w-3.5" />
                  Publish now live
                </Button>
              </div>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
