"use client";

import React from "react";
import { useVexelEditor } from "../VexelEditorProvider";

import { FacetMaterial } from "~/components/facet-ui";

export default function ValidationPanel() {
  const { validationWarnings } = useVexelEditor();

  return (
    <FacetMaterial material="satin" className="overflow-hidden rounded-xl border border-white/10">
      <div className="p-4">
        <h3 className="mb-3 border-b border-white/5 pb-2 text-xs font-bold tracking-widest text-zinc-400 uppercase">
          Rule Audit
        </h3>

        {validationWarnings.length === 0 ? (
          <div className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs text-emerald-400">
            <span>✓</span>
            <span>Compliant with the classic Rule of Tincture. Excellent design!</span>
          </div>
        ) : (
          <div className="space-y-2">
            {validationWarnings.map((warn, idx) => (
              <div
                key={idx}
                className={`flex items-start gap-2.5 rounded-lg border p-3 text-xs ${
                  warn.severity === "caution"
                    ? "border-red-500/20 bg-red-500/10 text-red-400"
                    : "border-amber-500/20 bg-amber-500/10 text-amber-400"
                }`}
              >
                <span className="mt-0.5 text-sm leading-none font-bold">
                  {warn.severity === "caution" ? "🛑" : "⚠️"}
                </span>
                <div className="space-y-0.5">
                  <span className="block text-[9px] font-semibold tracking-wider uppercase">
                    {warn.code.replace(/_/g, " ")} ({warn.severity})
                  </span>
                  <p className="leading-normal font-medium text-zinc-300">{warn.message}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </FacetMaterial>
  );
}
