// src/app/labs/onoma/components/glyphs/onoma-glyphs-catalog.tsx
// Pure SVG path definitions and vector geometry for the ⟨ONOMA⟩ Glyph System v0.1
// Philosophy: Apple SF Symbols × IPA × Linguistic Notation × Scientific Precision

import React from "react";

export type OnomaGlyphName =
  | "sound-phoneme"
  | "sound-articulation"
  | "sound-acoustic"
  | "sound-vowel-quad"
  | "struct-phonotactics"
  | "struct-syntax"
  | "struct-syllable"
  | "transform-shift"
  | "transform-arrow"
  | "transform-correspond"
  | "transform-deletion"
  | "memory-etymology"
  | "memory-dataset"
  | "memory-stash"
  | "compose-morphology"
  | "compose-lexicon"
  | "compose-loanword"
  | "emerge-branch"
  | "emerge-synthesis"
  | "emerge-engine"
  | "system-pack"
  | "system-compare"
  | "system-writing"
  | "system-frame";

/** The shapes of each glyph, drawn on a shared 24x24 stroke canvas by {@link GlyphSvg}. */
const GLYPH_CATALOG: Record<OnomaGlyphName, React.ReactNode> = {
  // 1. SOUND: Phoneme Unit (Open Dashed Circle)
  "sound-phoneme": (
    <>
      <circle cx="12" cy="12" r="7.5" strokeDasharray="3 2" />
    </>
  ),

  // 2. SOUND: Articulation Focal Node
  "sound-articulation": (
    <>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="3" fill="currentColor" />
    </>
  ),

  // 3. SOUND: Acoustic Wave / Harmonic Formant
  "sound-acoustic": (
    <>
      <path d="M2.5 12c2.5-7 5.5-7 8 0s5.5 7 8 0 2.5-3.5 3-3.5" />
    </>
  ),

  // 4. SOUND: IPA Vowel Quadrilateral (Trapezoid)
  "sound-vowel-quad": (
    <>
      <polygon points="4 5 20 5 16 19 8 19" />
      <line x1="6" y1="12" x2="18" y2="12" strokeDasharray="2 2" />
      <circle cx="6" cy="5" r="1.5" fill="currentColor" />
      <circle cx="18" cy="5" r="1.5" fill="currentColor" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
    </>
  ),

  // 5. STRUCTURE: Phonotactics (CVC Syllable Template)
  "struct-phonotactics": (
    <>
      <text
        x="3"
        y="15"
        fontSize="8.5"
        fontFamily="monospace"
        fontWeight="700"
        fill="currentColor"
        stroke="none"
      >
        C
      </text>
      <text
        x="9.5"
        y="15"
        fontSize="8.5"
        fontFamily="monospace"
        fontWeight="700"
        fill="currentColor"
        stroke="none"
      >
        V
      </text>
      <text
        x="16"
        y="15"
        fontSize="8.5"
        fontFamily="monospace"
        fontWeight="700"
        fill="currentColor"
        stroke="none"
      >
        C
      </text>
      <line x1="3" y1="18" x2="21" y2="18" strokeWidth={strokeWidth} />
    </>
  ),

  // 6. STRUCTURE: Syntax Parse Node / Phrase Node
  "struct-syntax": (
    <>
      <circle cx="12" cy="5" r="2.5" />
      <line x1="12" y1="7.5" x2="7" y2="15" />
      <line x1="12" y1="7.5" x2="17" y2="15" />
      <circle cx="7" cy="17.5" r="2.5" />
      <circle cx="17" cy="17.5" r="2.5" />
    </>
  ),

  // 7. STRUCTURE: Syllable Boundary (Sigma Node)
  "struct-syllable": (
    <>
      <text
        x="4"
        y="16"
        fontSize="13"
        fontFamily="serif"
        fontStyle="italic"
        fontWeight="600"
        fill="currentColor"
        stroke="none"
      >
        σ
      </text>
      <circle cx="17" cy="12" r="2.5" fill="currentColor" />
    </>
  ),

  // 8. TRANSFORMATION: Sound Shift (Node to Node Mutation)
  "transform-shift": (
    <>
      <circle cx="5.5" cy="12" r="3" />
      <path d="M9.5 12h8m-3-3.5l3.5 3.5-3.5 3.5" />
      <circle cx="18.5" cy="12" r="1.5" fill="currentColor" />
    </>
  ),

  // 9. TRANSFORMATION: Pure Geometric Transformation Arrow
  "transform-arrow": (
    <>
      <path d="M4 12h14m-5-5l5 5-5 5" />
    </>
  ),

  // 10. TRANSFORMATION: Correspondence (Bidirectional Cognate Map)
  "transform-correspond": (
    <>
      <path d="M7 8l-4 4 4 4M17 8l4 4-4 4M4 12h16" />
    </>
  ),

  // 11. TRANSFORMATION: Null / Elision / Deletion (Slashed Zero)
  "transform-deletion": (
    <>
      <circle cx="12" cy="12" r="7.5" />
      <line x1="5" y1="19" x2="19" y2="5" />
    </>
  ),

  // 12. MEMORY: Etymological Origin Chain (A ← B)
  "memory-etymology": (
    <>
      <circle cx="6" cy="12" r="2.5" fill="currentColor" />
      <path d="M18 12H9m3.5-3.5L9 12l3.5 3.5" />
      <circle cx="18" cy="12" r="2.5" />
    </>
  ),

  // 13. MEMORY: Corpus / Indexed Sequence
  "memory-dataset": (
    <>
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <line x1="8" y1="9" x2="16" y2="9" />
      <line x1="8" y1="13" x2="14" y2="13" />
      <line x1="8" y1="17" x2="11" y2="17" />
    </>
  ),

  // 14. MEMORY: Stash / Bounded Vault
  "memory-stash": (
    <>
      <path d="M5 4h14a1 1 0 011 1v15l-8-4-8 4V5a1 1 0 011-1z" />
      <circle cx="12" cy="10" r="1.5" fill="currentColor" />
    </>
  ),

  // 15. COMPOSITION: Morphology Composition (A + B)
  "compose-morphology": (
    <>
      <circle cx="7" cy="12" r="3" />
      <path d="M12 9.5v5m-2.5-2.5h5" />
      <circle cx="17" cy="12" r="3" />
    </>
  ),

  // 16. COMPOSITION: Lexicon Dictionary (Word List Sequence)
  "compose-lexicon": (
    <>
      <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
      <line x1="8.5" y1="7" x2="15.5" y2="7" />
      <line x1="8.5" y1="11" x2="13.5" y2="11" />
    </>
  ),

  // 17. COMPOSITION: Loanword Registry (Wavy Borrowing Arrow)
  "compose-loanword": (
    <>
      <circle cx="5" cy="12" r="2.5" />
      <path d="M8 12c2.5-4 5.5-4 8 0m-2-3l2 3-3 2" />
      <circle cx="19" cy="12" r="2.5" fill="currentColor" />
    </>
  ),

  // 18. EMERGENCE: Branching / Markov Probability Fork (⑂)
  "emerge-branch": (
    <>
      <circle cx="6" cy="12" r="2" fill="currentColor" />
      <path d="M8 12h4m0 0l5-6m-5 6l5 6" />
      <circle cx="18" cy="6" r="2" />
      <circle cx="18" cy="18" r="2" />
    </>
  ),

  // 19. EMERGENCE: Word Creation / Drafting Stylus (Apple "Create / Compose" Mark)
  "emerge-synthesis": (
    <>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
    </>
  ),

  // 20. EMERGENCE: The Canonical Onoma Engine Mark (◌─●─◌)
  "emerge-engine": (
    <>
      <circle cx="5" cy="12" r="3" strokeDasharray="2 1.5" />
      <line x1="8" y1="12" x2="10" y2="12" />
      <circle cx="12" cy="12" r="2.5" fill="currentColor" />
      <line x1="14" y1="12" x2="16" y2="12" />
      <circle cx="19" cy="12" r="3" />
    </>
  ),

  // 21. SYSTEM: Language Pack (Framed Package)
  "system-pack": (
    <>
      <rect x="3.5" y="4" width="17" height="16" rx="3" />
      <path d="M8 8h8M8 12h8M8 16h5" />
      <circle cx="16" cy="16" r="1.5" fill="currentColor" />
    </>
  ),

  // 22. SYSTEM: Comparator / Delta Divergence
  "system-compare": (
    <>
      <line x1="12" y1="4" x2="12" y2="20" strokeDasharray="3 2" />
      <circle cx="6" cy="12" r="3.5" />
      <circle cx="18" cy="12" r="3.5" />
    </>
  ),

  // 23. SYSTEM: Orthography / Grapheme Script ([A])
  "system-writing": (
    <>
      <path d="M7 5H4v14h3M17 5h3v14h-3" />
      <text
        x="8.5"
        y="16"
        fontSize="10"
        fontFamily="sans-serif"
        fontWeight="700"
        fill="currentColor"
        stroke="none"
      >
        A
      </text>
    </>
  ),

  // 24. SYSTEM: Bounded Linguistic Object (⟨ ⟩ Frame)
  "system-frame": (
    <>
      <path d="M7 5l-4 7 4 7M17 5l4 7-4 7" />
    </>
  ),
};

export function GlyphSvg({ name, strokeWidth }: { name: OnomaGlyphName; strokeWidth: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-full w-full"
    >
      {GLYPH_CATALOG[name] ?? GLYPH_CATALOG["emerge-engine"]}
    </svg>
  );
}
