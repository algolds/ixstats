"use client";

import React, { useState } from "react";
import { Badge as UIBadge } from "~/components/ui/badge";
import { WarningTriangle as AlertTriangle } from "iconoir-react";
import { taxSystemTemplates } from "../TaxSystemTemplates";

interface TaxSystemTemplatesModalProps {
  open: boolean;
  onClose: () => void;
  onApplyTemplate: (template: (typeof taxSystemTemplates)[number]) => void;
}

export function TaxSystemTemplatesModal({
  open,
  onClose,
  onApplyTemplate,
}: TaxSystemTemplatesModalProps) {
  const [templateToConfirm, setTemplateToConfirm] = useState<
    (typeof taxSystemTemplates)[number] | null
  >(null);

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
        <div className="mx-4 max-h-[80vh] w-full max-w-4xl overflow-y-auto rounded-xl border border-emerald-500/25 bg-zinc-900/90 shadow-2xl backdrop-blur-xl">
          <div className="border-border/40 sticky top-0 z-10 flex items-center justify-between border-b bg-white/[0.02] px-6 py-4 backdrop-blur-xl dark:bg-black/[0.1]">
            <h2 className="text-foreground text-xl font-bold">Tax System Templates</h2>
            <button
              type="button"
              onClick={onClose}
              className="text-foreground/50 hover:text-foreground rounded-md px-3 py-1.5 text-sm font-medium transition-colors hover:bg-white/5"
            >
              Close
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 p-6 md:grid-cols-2">
            {taxSystemTemplates.map((template, index) => (
              <div
                key={index}
                className="flex flex-col gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4 transition-colors hover:border-emerald-500/30 hover:bg-emerald-500/[0.04]"
              >
                <div>
                  <h3 className="text-foreground text-base font-bold">{template.name}</h3>
                  <p className="text-muted-foreground mt-1 text-sm">{template.description}</p>
                </div>
                <div>
                  <UIBadge variant="secondary">
                    {template.progressiveTax ? "Progressive" : "Flat"} Tax
                  </UIBadge>
                  <UIBadge variant="outline" className="ml-2">
                    {template.categories.length} Categories
                  </UIBadge>
                </div>
                <div className="text-sm">
                  <strong className="text-foreground">Categories:</strong>
                  <ul className="text-muted-foreground mt-1">
                    {template.categories.slice(0, 3).map((cat) => (
                      <li key={cat.categoryName}>
                        • {cat.categoryName} ({cat.baseRate}%)
                      </li>
                    ))}
                    {template.categories.length > 3 && (
                      <li>• +{template.categories.length - 3} more...</li>
                    )}
                  </ul>
                </div>
                <button
                  type="button"
                  onClick={() => setTemplateToConfirm(template)}
                  className="mt-auto w-full rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-sm font-semibold text-emerald-400 transition-colors hover:bg-emerald-500/20"
                >
                  Use This Template
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Template Confirmation Dialog */}
      {templateToConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-md rounded-xl border border-emerald-500/25 bg-zinc-900/90 p-6 shadow-2xl backdrop-blur-xl">
            <div className="flex items-start gap-4">
              <div className="mt-1 flex h-10 w-10 items-center justify-center rounded-full border border-amber-500/25 bg-amber-500/10">
                <AlertTriangle className="h-5 w-5 text-amber-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-foreground text-lg font-bold">Apply Template?</h3>
                <p className="text-muted-foreground mt-2 text-sm">
                  This will replace your current tax configuration with{" "}
                  <strong className="text-foreground">{templateToConfirm.name}</strong>. All
                  existing categories, brackets, exemptions, and deductions will be overwritten.
                </p>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setTemplateToConfirm(null)}
                className="text-foreground/70 hover:text-foreground rounded-lg border border-white/10 px-4 py-2 text-sm font-medium transition-colors hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onApplyTemplate(templateToConfirm);
                  setTemplateToConfirm(null);
                  onClose();
                }}
                className="rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-400 transition-colors hover:bg-emerald-500/20"
              >
                Apply Template
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
