"use client";

import { Eyebrow } from "~/components/ui/eyebrow";
import { Button } from "~/components/ui/button";
import React, { useState } from "react";
import { useVexelEditor } from "../VexelEditorProvider";
import { Card } from "~/components/ui/card";

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
    <Card className="overflow-hidden">
      <div className="p-4">
        <div className="mb-2 flex items-center justify-between">
          <Eyebrow className="block">Heraldic Blazon Description</Eyebrow>
          <Button variant="outline" size="xs" onClick={handleCopy} disabled={!blazon}>
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>

        <Card variant="inset" padding="none" className="p-3">
          <p className="text-label-secondary text-body leading-relaxed italic">
            {blazon || "No composition loaded."}
          </p>
        </Card>
      </div>
    </Card>
  );
}
