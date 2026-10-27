"use client";
// Interactive help modal for WikiOS Margin suite.
// Signature Highlighter Yellow / Warm Amber branding for Margin.

import {
  ChatBubble as MessageSquare,
  DesignPencil as Highlighter,
  Bookmark,
  Keyframe as Keyboard,
  Compass,
  CheckCircle as CheckCircle2,
} from "iconoir-react";
import { Button } from "~/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "~/components/ui/dialog";

interface ThemeColors {
  primary: string;
  secondary: string;
  accent: string;
}

interface MarginHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
  themeColors?: ThemeColors | null;
}

export function MarginHelpModal({ isOpen, onClose, themeColors }: MarginHelpModalProps) {
  const primaryColor = themeColors?.primary || "var(--wikios-accent, #fef036)";

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[85vh] max-w-lg flex-col gap-0 overflow-hidden p-0">
        {/* Header */}
        <div className="border-separator flex items-center gap-3 border-b p-4 pr-14">
          <div className="bg-margin-accent rounded-row flex size-10 shrink-0 items-center justify-center text-(--margin-badge-text)">
            <Highlighter className="size-5" aria-hidden="true" />
          </div>
          <div>
            <DialogTitle className="text-title-3">WikiOS Margin© guide</DialogTitle>
            <DialogDescription className="text-footnote">
              Discuss lore, highlight passages, and keep notes without leaving the page
            </DialogDescription>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="text-footnote scrollbar-thin space-y-4 overflow-y-auto p-5">
          {/* Feature 1: Selection Capsule */}
          <div className="rounded-row bg-surface-secondary space-y-2 p-3">
            <div className="text-headline text-label flex items-center gap-2">
              <Compass className="text-yellow h-4 w-4" />
              <span>1. Selecting text</span>
            </div>
            <p className="text-footnote text-label-secondary leading-relaxed">
              Select prose in the article to highlight, start a discussion, suggest an edit, or save
              a quote:
            </p>
            <div className="text-footnote grid grid-cols-2 gap-2 pt-1">
              <div className="rounded-control bg-surface flex items-center gap-2 p-2">
                <span className="bg-margin-accent h-3 w-3 shrink-0 rounded-full" />
                <span>Highlight</span>
              </div>
              <div className="rounded-control bg-surface flex items-center gap-2 p-2">
                <MessageSquare className="text-yellow h-3.5 w-3.5 shrink-0" />
                <span>Discuss</span>
              </div>
              <div className="rounded-control bg-surface flex items-center gap-2 p-2">
                <Bookmark className="text-red h-3.5 w-3.5 shrink-0" />
                <span>Save quote</span>
              </div>
              <div className="rounded-control bg-surface flex items-center gap-2 p-2">
                <CheckCircle2 className="text-green h-3.5 w-3.5 shrink-0" />
                <span>Copy text</span>
              </div>
            </div>
          </div>

          {/* Feature 2: Threads & Comments */}
          <div className="rounded-row bg-surface-secondary space-y-2 p-3">
            <div className="text-headline flex items-center gap-2" style={{ color: primaryColor }}>
              <MessageSquare className="h-4 w-4" />
              <span>2. Discussions</span>
            </div>
            <p className="text-footnote text-label-secondary leading-relaxed">
              Talk through lore details, dispute claims, or suggest edits. Long-press &ldquo;Hold to
              resolve&rdquo; when a discussion is settled.
            </p>
          </div>

          {/* Feature 3: Markup & Jump to Text */}
          <div className="rounded-row bg-surface-secondary space-y-2 p-3">
            <div className="text-headline flex items-center gap-2" style={{ color: primaryColor }}>
              <Highlighter className="h-4 w-4" />
              <span>3. Highlights & quotes</span>
            </div>
            <p className="text-footnote text-label-secondary leading-relaxed">
              Highlights appear in the Markup tab. Click &ldquo;Jump&rdquo; to scroll to the passage
              in the article.
            </p>
          </div>

          {/* Feature 4: Keyboard Shortcuts */}
          <div className="rounded-row bg-surface-secondary space-y-2 p-3">
            <div className="text-headline flex items-center gap-2" style={{ color: primaryColor }}>
              <Keyboard className="h-4 w-4" />
              <span>Shortcuts</span>
            </div>
            <div className="text-footnote grid grid-cols-2 gap-2 pt-0.5">
              <div className="rounded-control bg-surface flex items-center justify-between p-2">
                <span className="text-label-secondary">Toggle margin</span>
                <kbd className="rounded-control-sm border-separator bg-surface text-footnote text-label border px-2 py-0.5 tabular-nums">
                  T
                </kbd>
              </div>
              <div className="rounded-control bg-surface flex items-center justify-between p-2">
                <span className="text-label-secondary">Close drawer</span>
                <kbd className="rounded-control-sm border-separator bg-surface text-footnote text-label border px-2 py-0.5 tabular-nums">
                  Esc
                </kbd>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-separator flex justify-end border-t p-4">
          <Button
            size="sm"
            onClick={onClose}
            className="bg-margin-accent hover:bg-margin-accent-hover text-(--margin-badge-text)"
          >
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
