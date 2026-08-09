"use client";

import React, { useState } from "react";
import { X, Save, Lock, Shield, Eye, FileText, Sparkles } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import { WikiVisualEditor } from "~/components/wiki-os/editor/WikiVisualEditor";
import { Badge } from "~/components/ui/badge";

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
      <DialogContent className="flex max-h-[90vh] max-w-4xl flex-col overflow-hidden border-white/10 bg-zinc-950/95 p-0 backdrop-blur-xl">
        <DialogHeader className="flex flex-row items-center justify-between border-b border-white/10 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl border border-blue-500/20 bg-blue-500/10 p-2 text-blue-400">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-extrabold tracking-wider uppercase">
                {initialTitle ? "Edit Dossier Lore Document" : "New Dossier Lore Document"}
              </DialogTitle>
              <p className="text-muted-foreground text-xs">
                Author custom nation lore directly via the WikiOS Canvas Editor
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Clearance Level Selector */}
            <div className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] p-1">
              {(["PUBLIC", "ALLIANCE", "PRIVATE"] as const).map((level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => setClearance(level)}
                  className={`rounded-md px-2.5 py-1 text-[10px] font-bold transition-colors ${
                    clearance === level
                      ? level === "PUBLIC"
                        ? "border border-emerald-500/30 bg-emerald-500/20 text-emerald-400"
                        : level === "ALLIANCE"
                          ? "border border-amber-500/30 bg-amber-500/20 text-amber-400"
                          : "border border-red-500/30 bg-red-500/20 text-red-400"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {level}
                </button>
              ))}
            </div>

            <Button
              size="sm"
              onClick={handleSave}
              disabled={!title.trim()}
              className="gap-1.5 bg-blue-600 text-xs font-bold text-white hover:bg-blue-500"
            >
              <Save className="h-3.5 w-3.5" />
              Save Document
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 space-y-4 overflow-y-auto p-6">
          {/* Document Title Input */}
          <div>
            <label className="text-muted-foreground mb-1 block text-[10px] font-extrabold tracking-wider uppercase">
              Document Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Constitutional Charter of 1842"
              className="text-foreground w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm font-bold focus:border-blue-500 focus:outline-none"
            />
          </div>

          {/* WikiOS Visual Canvas Editor */}
          <div>
            <label className="text-muted-foreground mb-1 block text-[10px] font-extrabold tracking-wider uppercase">
              Canvas Lore Content
            </label>
            <div className="min-h-[360px] rounded-xl border border-white/10 bg-white/[0.02] p-2">
              <WikiVisualEditor
                initialWikitext={content}
                onChangeAction={setContent}
                pageTitle={title || "Untitled Lore Document"}
              />
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
