"use client";

import React, { useState } from "react";
import { useVexelEditor } from "../VexelEditorProvider";

import { FacetMaterial } from "~/components/ui/facet";

export default function BlazonPanel() {
  const { blazon } = useVexelEditor();
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (!blazon) return;
    navigator.clipboard.writeText(blazon);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <FacetMaterial material="satin" className="overflow-hidden rounded-xl border border-white/10">
      <div className="p-4">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-xs font-bold tracking-widest text-amber-500 uppercase">
            Heraldic Blazon Description
          </h3>
          <button
            onClick={handleCopy}
            disabled={!blazon}
            className="rounded bg-white/5 px-2 py-0.5 text-[10px] font-semibold text-zinc-400 transition-all hover:bg-white/10 hover:text-amber-400"
          >
            {copied ? "✓ Copied" : "📋 Copy"}
          </button>
        </div>

        <div className="rounded-lg border border-white/5 bg-zinc-950/40 p-3">
          <p className="font-serif text-sm leading-relaxed text-zinc-300 italic">
            {blazon || "No composition loaded."}
          </p>
        </div>
      </div>
    </FacetMaterial>
  );
}
