"use client";

// src/app/labs/onoma/components/sections/studio/LexiconAnalysis.tsx
// Onoma Custom Studio Workshop — Lexicon Analysis Component

interface LexiconAnalysisProps {
  selectedTerm: string;
  stashedEntry?: any;
  originLabel?: string | null;
}

export function LexiconAnalysis({
  selectedTerm,
  stashedEntry,
  originLabel,
}: LexiconAnalysisProps) {
  const getCvPattern = (word: string) => {
    const vowels = "aeiouyáéíóúäëïöüæœāēīōūăěĭŏŭ";
    return word
      .toLowerCase()
      .split("")
      .map((char) => {
        if (vowels.includes(char)) return "V";
        if (char.match(/[a-z]/)) return "C";
        return char;
      })
      .join("");
  };

  const getLetterComposition = (word: string) => {
    const vowelsList = "aeiouyáéíóúäëïöüæœāēīōūăěĭŏŭ";
    let vCount = 0;
    let cCount = 0;
    const cleanWord = word.toLowerCase().replace(/[^a-z]/g, "");
    for (const char of cleanWord) {
      if (vowelsList.includes(char)) {
        vCount++;
      } else {
        cCount++;
      }
    }
    return `${vCount} V · ${cCount} C`;
  };

  return (
    <div className="space-y-2">
      <h4 className="text-muted-foreground text-xs font-bold tracking-wider uppercase">
        Lexical & Phonotactic Analysis
      </h4>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {/* CV Pattern */}
        <div className="border-border/40 bg-background rounded-xl border p-3 text-center">
          <span className="text-muted-foreground mb-1 block text-[10px] font-bold tracking-wider uppercase">
            Phonotactic Pattern
          </span>
          <span className="font-mono text-sm font-bold text-[#0091ff]">
            {getCvPattern(selectedTerm)}
          </span>
        </div>

        {/* Composition */}
        <div className="border-border/40 bg-background rounded-xl border p-3 text-center">
          <span className="text-muted-foreground mb-1 block text-[10px] font-bold tracking-wider uppercase">
            Composition
          </span>
          <span className="text-foreground font-mono text-xs font-bold">
            {getLetterComposition(selectedTerm)}
          </span>
        </div>

        {/* Stash Folder */}
        {stashedEntry && (stashedEntry as any).stashName && (
          <div className="border-border/40 bg-background rounded-xl border p-3 text-center flex flex-col items-center justify-center">
            <span className="text-muted-foreground mb-1 block text-[10px] font-bold tracking-wider uppercase">
              Stash Folder
            </span>
            <span
              className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-bold select-none"
              style={{
                backgroundColor: `${(stashedEntry as any).stashColor || "#3b82f6"}20`,
                color: (stashedEntry as any).stashColor || "#3b82f6",
              }}
            >
              📁 {(stashedEntry as any).stashName}
            </span>
          </div>
        )}

        {/* Origin / Name Set */}
        {originLabel && (
          <div className="border-border/40 bg-background rounded-xl border p-3 text-center flex flex-col items-center justify-center">
            <span className="text-muted-foreground mb-1 block text-[10px] font-bold tracking-wider uppercase">
              Origin / Name Set
            </span>
            <span className="text-foreground text-xs font-bold truncate block px-1 w-full">
              {originLabel}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export default LexiconAnalysis;
