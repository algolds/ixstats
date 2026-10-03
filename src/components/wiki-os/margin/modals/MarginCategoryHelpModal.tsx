"use client";
// Interactive Category Guide modal for the 5 Ws Thread Categories in WikiOS Margin.
import { Compass } from "iconoir-react";
import { Button } from "~/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "~/components/ui/dialog";
import { LORE_DIMENSIONS } from "../tabs/MarginThreadsTab";

interface ThemeColors {
  primary: string;
  secondary: string;
  accent: string;
}

interface MarginCategoryHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
  themeColors?: ThemeColors | null;
}

export function MarginCategoryHelpModal({
  isOpen,
  onClose,
  // oxlint-disable-next-line eslint/no-unused-vars
  themeColors,
}: MarginCategoryHelpModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[85vh] max-w-lg flex-col gap-0 overflow-hidden p-0">
        {/* Header */}
        <div className="border-separator flex items-center gap-3 border-b p-4 pr-14">
          <div className="bg-margin-accent rounded-row flex size-10 shrink-0 items-center justify-center text-(--margin-badge-text)">
            <Compass className="size-5" aria-hidden="true" />
          </div>
          <div>
            <DialogTitle className="text-title-3">Category guide</DialogTitle>
            <DialogDescription className="text-footnote">
              The 5 Ws classification system for lore discussions
            </DialogDescription>
          </div>
        </div>

        {/* Scrollable Category Cards */}
        <div className="text-footnote scrollbar-thin space-y-3 overflow-y-auto p-5">
          <p className="text-footnote text-label-secondary pb-1 leading-relaxed">
            Discussions in Margin are categorized into five core dimensions to keep worldbuilding
            structured and easy to search:
          </p>

          {LORE_DIMENSIONS.map((dim) => (
            <div key={dim.id} className="rounded-row bg-surface-secondary space-y-2 p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-body">{dim.emoji}</span>
                  <span className="text-caption text-label font-semibold">{dim.label}</span>
                </div>
                <span
                  style={{
                    backgroundColor:
                      dim.color === "#fef036" ? "rgba(254, 240, 54, 0.25)" : `${dim.color}20`,
                    borderColor:
                      dim.color === "#fef036" ? "rgba(250, 204, 21, 0.6)" : `${dim.color}50`,
                    color: dim.color === "#fef036" ? "var(--wikios-text)" : dim.color,
                  }}
                  className="text-caption rounded-full border px-2 py-0.5 font-semibold"
                >
                  {dim.short}
                </span>
              </div>
              <p className="text-footnote text-label-secondary leading-relaxed">{dim.desc}.</p>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="border-separator flex justify-end border-t p-4">
          <Button
            size="sm"
            onClick={onClose}
            className="bg-margin-accent hover:bg-margin-accent-hover text-(--margin-badge-text)"
          >
            Got it
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
