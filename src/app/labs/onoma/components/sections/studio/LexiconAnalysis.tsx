"use client";

// src/app/labs/onoma/components/sections/studio/LexiconAnalysis.tsx
// Onoma Custom Studio Workshop — Lexicon Analysis Component

interface LexiconAnalysisProps {
  selectedTerm: string;
  stashedEntry?: any;
  originLabel?: string | null;
}

export function LexiconAnalysis({ selectedTerm, stashedEntry, originLabel }: LexiconAnalysisProps) {
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
      <h4 className="text-label-secondary text-subhead">Lexical & phonotactic analysis</h4>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {/* CV Pattern */}
        <div className="border-separator bg-background rounded-row border p-3 text-center">
          <span className="text-label-secondary text-eyebrow mb-1 block">Phonotactic pattern</span>
          <span className="text-tint text-body font-mono font-semibold">
            {getCvPattern(selectedTerm)}
          </span>
        </div>

        {/* Composition */}
        <div className="border-separator bg-background rounded-row border p-3 text-center">
          <span className="text-label-secondary text-eyebrow mb-1 block">Composition</span>
          <span className="text-label text-footnote font-mono font-semibold">
            {getLetterComposition(selectedTerm)}
          </span>
        </div>

        {/* Stash Folder */}
        {(() => {
          const entry = stashedEntry as { stashName?: string; stashColor?: string } | undefined;
          if (!entry?.stashName) return null;
          const color = entry.stashColor || "#3b82f6";
          return (
            <div className="border-separator bg-background rounded-row flex flex-col items-center justify-center border p-3 text-center">
              <span className="text-label-secondary text-eyebrow mb-1 block">Stash folder</span>
              <span
                className="rounded-control-sm text-caption inline-flex items-center gap-1 px-2 py-0.5 font-semibold select-none"
                style={{
                  backgroundColor: `${color}20`,
                  color: color,
                }}
              >
                📁 {entry.stashName}
              </span>
            </div>
          );
        })()}

        {/* Origin / Name Set */}
        {originLabel && (
          <div className="border-separator bg-background rounded-row flex flex-col items-center justify-center border p-3 text-center">
            <span className="text-label-secondary text-eyebrow mb-1 block">Origin / Name Set</span>
            <span className="text-label text-footnote block w-full truncate px-1 font-semibold">
              {originLabel}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
