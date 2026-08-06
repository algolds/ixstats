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
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden bg-zinc-950/95 border-white/10 backdrop-blur-xl">
        <DialogHeader className="px-6 py-4 border-b border-white/10 flex flex-row items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-extrabold uppercase tracking-wider">
                {initialTitle ? "Edit Dossier Lore Document" : "New Dossier Lore Document"}
              </DialogTitle>
              <p className="text-xs text-muted-foreground">
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
                  className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition-colors ${
                    clearance === level
                      ? level === "PUBLIC"
                        ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                        : level === "ALLIANCE"
                        ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                        : "bg-red-500/20 text-red-400 border border-red-500/30"
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
              className="bg-blue-600 hover:bg-blue-500 text-white font-bold gap-1.5 text-xs"
            >
              <Save className="h-3.5 w-3.5" />
              Save Document
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Document Title Input */}
          <div>
            <label className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground mb-1 block">
              Document Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Constitutional Charter of 1842"
              className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm font-bold text-foreground focus:border-blue-500 focus:outline-none"
            />
          </div>

          {/* WikiOS Visual Canvas Editor */}
          <div>
            <label className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground mb-1 block">
              Canvas Lore Content
            </label>
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-2 min-h-[360px]">
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
