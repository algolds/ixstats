"use client";

import { Eyebrow } from "~/components/ui/eyebrow";
import { Button } from "~/components/ui/button";
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
    <FacetMaterial material="satin" className="border-border overflow-hidden rounded-xl border">
      <div className="p-4">
        <div className="mb-2 flex items-center justify-between">
          <Eyebrow className="block">Heraldic Blazon Description</Eyebrow>
          <Button variant="outline" size="xs" onClick={handleCopy} disabled={!blazon}>
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>

        <div className="border-border bg-card/40 rounded-lg border p-3">
          <p className="text-muted-foreground font-serif text-sm leading-relaxed italic">
            {blazon || "No composition loaded."}
          </p>
        </div>
      </div>
    </FacetMaterial>
  );
}
