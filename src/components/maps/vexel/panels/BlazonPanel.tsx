"use client";

import { useState } from "react";
import { Check, Copy, OpenBook } from "iconoir-react";
import { Button } from "~/components/ui/button";
import { Card, CardTitle } from "~/components/ui/card";
import { useVexelEditor } from "../VexelEditorProvider";

/** The design written out as a heraldic blazon, ready to copy. */
export default function BlazonPanel() {
  const { blazon } = useVexelEditor();
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (!blazon) return;
    void navigator.clipboard.writeText(blazon);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card padding="md" className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <CardTitle icon={<OpenBook />}>Blazon</CardTitle>
        <Button variant="ghost" size="sm" onClick={handleCopy} disabled={!blazon}>
          {copied ? <Check /> : <Copy />}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <p className="text-body text-label italic">{blazon || "Nothing on the shield yet."}</p>
    </Card>
  );
}
