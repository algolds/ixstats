"use client";

import { Input } from "~/components/ui/input";
import { Eyebrow } from "~/components/ui/eyebrow";
import React, { useState } from "react";
import { FloppyDisk as Save, Page as FileText } from "iconoir-react";
import { Button } from "~/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import { WikiVisualEditor } from "~/components/wiki-os/editor/WikiVisualEditor";

export type LoreClearance = "PUBLIC" | "ALLIANCE" | "PRIVATE";

interface NativeLoreCanvasModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (doc: { title: string; content: string; clearance: LoreClearance }) => void;
  initialTitle?: string;
  initialContent?: string;
  initialClearance?: LoreClearance;
}

export function NativeLoreCanvasModal({
  isOpen,
  onClose,
  onSave,
  initialTitle = "",
  initialContent = "",
  initialClearance = "PUBLIC",
}: NativeLoreCanvasModalProps) {
  const [title, setTitle] = useState(initialTitle);
  const [content, setContent] = useState(initialContent);
  const [clearance, setClearance] = useState<LoreClearance>(initialClearance);

  const handleSave = () => {
    if (!title.trim()) return;
    onSave({
      title: title.trim(),
      content,
      clearance,
    });
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="flex max-h-[90vh] max-w-4xl flex-col overflow-hidden p-0">
        <DialogHeader className="border-border flex flex-row flex-wrap items-center justify-between gap-3 border-b px-6 py-4 pr-12">
          <div className="flex items-center gap-3">
            <FileText className="text-muted-foreground h-5 w-5 shrink-0" />
            <div>
              <DialogTitle className="text-base font-semibold">
                {initialTitle ? "Edit Dossier Lore Document" : "New Dossier Lore Document"}
              </DialogTitle>
              <p className="text-muted-foreground text-xs">
                Author custom nation lore directly via the WikiOS Canvas Editor
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Clearance Level Selector */}
            <div
              className="bg-muted/50 flex items-center gap-1 rounded-lg p-1"
              role="group"
              aria-label="Clearance level"
            >
              {(["PUBLIC", "ALLIANCE", "PRIVATE"] as const).map((level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => setClearance(level)}
                  aria-pressed={clearance === level}
                  data-cuelume-press="tick"
                  className={`focus-visible:ring-ring rounded-md px-2.5 py-1 text-xs font-medium capitalize transition-colors outline-none focus-visible:ring-2 ${
                    clearance === level
                      ? "bg-background text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {level.toLowerCase()}
                </button>
              ))}
            </div>

            <Button
              size="sm"
              onClick={handleSave}
              disabled={!title.trim()}
              className="gap-1.5 text-xs"
            >
              <Save className="h-3.5 w-3.5" />
              Save Document
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 space-y-4 overflow-y-auto p-6">
          {/* Document Title Input */}
          <div>
            <Eyebrow className="mb-1 block" id="lore-title-label">
              Document title
            </Eyebrow>
            <Input
              type="text"
              aria-labelledby="lore-title-label"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Constitutional Charter of 1842"
              className="font-semibold"
            />
          </div>

          {/* WikiOS Visual Canvas Editor */}
          <div>
            <Eyebrow className="mb-1 block">Canvas lore content</Eyebrow>
            <div className="border-border bg-card min-h-[360px] rounded-xl border p-2">
              <WikiVisualEditor
                initialHtml={content}
                title={title || "Untitled Lore Document"}
                onSave={async (html) => setContent(html)}
                onCancel={onClose}
                onSwitchToSource={(_dirty, currentHtml) => setContent(currentHtml)}
              />
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
