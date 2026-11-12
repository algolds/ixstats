"use client";

// src/app/labs/onoma/components/sections/studio/SoundShiftSymbolBar.tsx
// Onoma Lab — quick-insert bar for sound shift rule environments and IPA symbols

import { Button } from "~/components/ui/button";

const QUICK_SYMBOLS = [
  { label: "#_ (Initial)", value: "#_" },
  { label: "_# (Final)", value: "_#" },
  { label: "V_V (Intervocalic)", value: "V_V" },
  { label: "_[ei] (Front Vowels)", value: "_[ei]" },
  { label: "θ", value: "θ" },
  { label: "ʃ", value: "ʃ" },
  { label: "tʃ", value: "tʃ" },
  { label: "dʒ", value: "dʒ" },
  { label: "ʒ", value: "ʒ" },
  { label: "č", value: "č" },
  { label: "ž", value: "ž" },
  { label: "š", value: "š" },
  { label: "ʰ", value: "ʰ" },
  { label: "∅ (Delete)", value: "" },
];

interface SoundShiftSymbolBarProps {
  onInsert: (symbol: string) => void;
}

export function SoundShiftSymbolBar({ onInsert }: SoundShiftSymbolBarProps) {
  return (
    <div className="border-separator bg-fill-4 rounded-row flex flex-wrap items-center gap-2 border p-3">
      <span className="text-label-secondary text-eyebrow mr-1">Insert:</span>
      {QUICK_SYMBOLS.map((sym) => (
        <Button
          variant="outline"
          size="sm"
          key={sym.label}
          onClick={() => onInsert(sym.value)}
          className="h-7 px-2 font-mono"
        >
          {sym.label}
        </Button>
      ))}
    </div>
  );
}
