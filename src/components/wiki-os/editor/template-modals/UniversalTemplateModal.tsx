"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { useTemplateSchema } from "../hooks/useTemplateSchema";
import { serializeTemplateToWikitext } from "~/lib/wiki-os/wikitext/serializer";
import { MASTER_TEMPLATE_PRESETS } from "~/lib/wiki-os/templates/master-presets";

export interface UniversalTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInsert: (wikitext: string) => void;
  initialTemplateName?: string;
}

export function UniversalTemplateModal({
  isOpen,
  onClose,
  onInsert,
  initialTemplateName = "Infobox country",
}: UniversalTemplateModalProps) {
  const [selectedTemplate, setSelectedTemplate] = useState(initialTemplateName);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  // oxlint-disable-next-line eslint/no-unused-vars
  const [searchQuery, setSearchQuery] = useState("");

  const { paramList, hasSchema, loading } = useTemplateSchema(selectedTemplate);

  const filteredPresets = MASTER_TEMPLATE_PRESETS.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleFieldChange = (key: string, value: string) => {
    setFieldValues((prev) => ({ ...prev, [key]: value }));
  };

  const handleInsert = () => {
    const wikitext = serializeTemplateToWikitext({
      templateName: selectedTemplate,
      params: fieldValues,
    });
    onInsert(wikitext);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="bg-card border-border flex max-h-[85vh] max-w-2xl flex-col overflow-hidden p-0">
        <DialogHeader className="border-border/40 border-b px-6 pt-5 pb-3">
          <DialogTitle className="text-foreground text-base font-bold">
            Insert Interactive Template
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 space-y-4 overflow-y-auto p-6">
          {/* Preset Selector */}
          <div className="space-y-1.5">
            <label className="text-foreground text-xs font-semibold">
              Select Preset or Template Name
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={selectedTemplate}
                onChange={(e) => setSelectedTemplate(e.target.value)}
                placeholder="e.g. Infobox country, Quote, Flag..."
                className="border-border/50 bg-background text-foreground focus:border-wiki/60 flex-1 rounded-xl border px-3.5 py-2 text-xs focus:outline-none"
              />
            </div>
            {filteredPresets.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {filteredPresets.slice(0, 8).map((preset) => (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() => {
                      setSelectedTemplate(preset.name);
                      setFieldValues({});
                    }}
                    className={`rounded-lg px-2.5 py-1 text-[11px] font-medium transition-all ${
                      selectedTemplate === preset.name
                        ? "bg-wiki/20 text-wiki border-wiki/30 border font-bold"
                        : "bg-secondary/60 text-muted-foreground hover:text-foreground hover:bg-secondary"
                    }`}
                  >
                    {preset.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Form Fields */}
          <div className="border-border/40 space-y-3 border-t pt-2">
            <div className="text-foreground text-xs font-bold">Template Parameters</div>

            {loading && (
              <div className="text-muted-foreground text-xs">Loading template parameters...</div>
            )}

            {hasSchema &&
              paramList.map(({ key, meta }) => {
                const val = fieldValues[key] ?? meta.default ?? "";
                return (
                  <div key={key} className="space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <label className="text-foreground font-semibold">
                        {meta.label || key}
                        {meta.required && <span className="ml-1 font-bold text-red-500">*</span>}
                      </label>
                      {meta.description && (
                        <span className="text-muted-foreground max-w-[60%] truncate text-[10px]">
                          {meta.description}
                        </span>
                      )}
                    </div>
                    {val.includes("\n") || meta.type === "content" ? (
                      <textarea
                        rows={2}
                        value={val}
                        placeholder={meta.example || meta.default || `Enter ${key}...`}
                        onChange={(e) => handleFieldChange(key, e.target.value)}
                        className="border-border/50 bg-background text-foreground focus:border-wiki/60 w-full rounded-lg border px-3 py-1.5 text-xs focus:outline-none"
                      />
                    ) : (
                      <input
                        type="text"
                        value={val}
                        placeholder={meta.example || meta.default || `Enter ${key}...`}
                        onChange={(e) => handleFieldChange(key, e.target.value)}
                        className="border-border/50 bg-background text-foreground focus:border-wiki/60 w-full rounded-lg border px-3 py-1.5 text-xs focus:outline-none"
                      />
                    )}
                  </div>
                );
              })}

            {!hasSchema && !loading && (
              <div className="border-border/60 text-muted-foreground rounded-xl border border-dashed p-4 text-center text-xs">
                No schema parameters discovered for <strong>{selectedTemplate}</strong>. The
                template will be inserted and parameters can be edited inside the canvas card.
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="border-border/40 bg-secondary/10 flex justify-end gap-2 border-t px-6 py-3">
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleInsert}>
            Insert Template
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
