"use client";

import { CheckCircle, WarningCircle, WarningTriangle } from "iconoir-react";
import { Eyebrow } from "~/components/ui/eyebrow";
import React from "react";
import { useVexelEditor } from "../VexelEditorProvider";

import { FacetMaterial } from "~/components/ui/facet";

export default function ValidationPanel() {
  const { validationWarnings } = useVexelEditor();

  return (
    <FacetMaterial material="satin" className="border-border overflow-hidden rounded-xl border">
      <div className="p-4">
        <Eyebrow className="border-border mb-3 block border-b pb-2">Rule Audit</Eyebrow>

        {validationWarnings.length === 0 ? (
          <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 p-3 text-xs text-emerald-500">
            <CheckCircle className="h-4 w-4 shrink-0" aria-hidden />
            <span>Compliant with the classic Rule of Tincture. Excellent design!</span>
          </div>
        ) : (
          <div className="space-y-2">
            {validationWarnings.map((warn, idx) => (
              <div
                key={idx}
                className={`flex items-start gap-2.5 rounded-lg border p-3 text-xs ${
                  warn.severity === "caution"
                    ? "border-destructive/30 text-destructive"
                    : "border-amber-500/30 text-amber-500"
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
                  <p className="text-muted-foreground leading-normal font-medium">{warn.message}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </FacetMaterial>
  );
}
