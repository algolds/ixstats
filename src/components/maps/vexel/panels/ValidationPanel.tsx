"use client";

import { CheckCircle, WarningCircle, WarningTriangle } from "iconoir-react";
import { Eyebrow } from "~/components/ui/eyebrow";
import React from "react";
import { useVexelEditor } from "../VexelEditorProvider";

import { FacetCard } from "~/components/ui/facet-container";

export default function ValidationPanel() {
  const { validationWarnings } = useVexelEditor();

  return (
    <FacetCard className="overflow-hidden">
      <div className="p-4">
        <Eyebrow className="border-separator mb-3 block border-b pb-2">Rule Audit</Eyebrow>

        {validationWarnings.length === 0 ? (
          <div className="rounded-control border-green/30 text-footnote text-green flex items-center gap-2 border p-3">
            <CheckCircle className="h-4 w-4 shrink-0" aria-hidden />
            <span>Compliant with the classic Rule of Tincture. Excellent design!</span>
          </div>
        ) : (
          <div className="space-y-2">
            {validationWarnings.map((warn, idx) => (
              <div
                key={idx}
                className={`rounded-control text-footnote flex items-start gap-2 border p-3 ${
                  warn.severity === "caution"
                    ? "border-destructive/30 text-destructive"
                    : "border-yellow/30 text-yellow"
                }`}
              >
                {warn.severity === "caution" ? (
                  <WarningCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                ) : (
                  <WarningTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                )}
                <div className="space-y-0.5">
                  <Eyebrow className="block">
                    {warn.code.replace(/_/g, " ")} ({warn.severity})
                  </Eyebrow>
                  <p className="text-label-secondary leading-normal font-medium">{warn.message}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </FacetCard>
  );
}
