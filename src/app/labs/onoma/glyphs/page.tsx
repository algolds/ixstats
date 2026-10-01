"use client";

// src/app/labs/onoma/glyphs/page.tsx
// ⟨ONOMA⟩ Glyph Catalog — Interactive Developer & Design Engineering Gallery
// Philosophy: Apple SF Symbols × IPA × Linguistic Notation × Scientific Diagrams

import React, { useState, useMemo } from "react";
import Link from "next/link";
import {
  // oxlint-disable-next-line eslint/no-unused-vars
  Settings,
  ArrowLeft,
  Check,
  Component,
  ControlSlider,
  Copy,
  Search,
  ViewGrid,
} from "iconoir-react";
import {
  OnomaGlyph,
  type OnomaGlyphSize,
  type OnomaGlyphState,
} from "../components/glyphs/OnomaGlyph";
import { type OnomaGlyphName } from "../components/glyphs/onoma-glyphs-catalog";
import { cn } from "~/lib/utils";
import { Input } from "~/components/ui/input";

interface GlyphMeta {
  name: OnomaGlyphName;
  domain:
    "SOUND" | "STRUCTURE" | "TRANSFORMATION" | "MEMORY" | "COMPOSITION" | "EMERGENCE" | "SYSTEM";
  title: string;
  description: string;
  linguisticNotation: string;
  domainColor: string;
}

const GLYPH_METADATA: GlyphMeta[] = [
  // SOUND (Phonology & Acoustics)
  {
    name: "sound-phoneme",
    domain: "SOUND",
    title: "Phoneme Unit",
    description: "Discrete phonetic sound unit before realization in phonotactic context.",
    linguisticNotation: "/f/",
    domainColor: "#0091ff",
  },
  {
    name: "sound-articulation",
    domain: "SOUND",
    title: "Articulation Focal Node",
    description: "Place and manner of vocal tract constriction (bilabial, velar, coronal).",
    linguisticNotation: "[+coronal]",
    domainColor: "#0091ff",
  },
  {
    name: "sound-acoustic",
    domain: "SOUND",
    title: "Acoustic Wave & Harmonics",
    description: "Spectral formants, fundamental frequency (F0), and acoustic resonance.",
    linguisticNotation: "F1/F2 (Hz)",
    domainColor: "#0091ff",
  },
  {
    name: "sound-vowel-quad",
    domain: "SOUND",
    title: "IPA Vowel Quadrilateral",
    description: "Canonical 2D vowel space (Front/Back × High/Low) with cardinal vowel anchors.",
    linguisticNotation: "[i, u, a, ɑ]",
    domainColor: "#0091ff",
  },

  // STRUCTURE (Phonotactics & Syntax)
  {
    name: "struct-phonotactics",
    domain: "STRUCTURE",
    title: "Phonotactic Template",
    description: "Permissible syllable structure constraints (Onset + Nucleus + Coda / CVC).",
    linguisticNotation: ".(C)V(C).",
    domainColor: "#10b981",
  },
  {
    name: "struct-syntax",
    domain: "STRUCTURE",
    title: "Syntax Parse Node",
    description: "Hierarchical phrase structure generator (Head-Initial/Final constituent trees).",
    linguisticNotation: "[S [NP] [VP]]",
    domainColor: "#10b981",
  },
  {
    name: "struct-syllable",
    domain: "STRUCTURE",
    title: "Syllable Boundary (σ)",
    description: "Universal syllable weight, moraic structure, and prosodic foot segmentation.",
    linguisticNotation: "σ → μμ",
    domainColor: "#10b981",
  },

  // TRANSFORMATION (Sound Shifts & Mutations)
  {
    name: "transform-shift",
    domain: "TRANSFORMATION",
    title: "Sound Shift Mutation",
    description:
      "Diachronic phonetic shift across historical eras (e.g. Grimm's Law, Great Vowel Shift).",
    linguisticNotation: "p > f / V_V",
    domainColor: "#a855f7",
  },
  {
    name: "transform-arrow",
    domain: "TRANSFORMATION",
    title: "Geometric Transformation Arrow",
    description:
      "Pure directional generative arrow for rules, shifts, and morphological production.",
    linguisticNotation: "A → B",
    domainColor: "#a855f7",
  },
  {
    name: "transform-correspond",
    domain: "TRANSFORMATION",
    title: "Cognate Correspondence",
    description:
      "Bidirectional cognate mapping between sister languages of a shared proto-ancestor.",
    linguisticNotation: "L₁ ↔ L₂",
    domainColor: "#a855f7",
  },
  {
    name: "transform-deletion",
    domain: "TRANSFORMATION",
    title: "Elision / Deletion (∅)",
    description: "Phonological apocope, syncope, or null morpheme zero-allomorph representation.",
    linguisticNotation: "X → ∅ / _#",
    domainColor: "#a855f7",
  },

  // MEMORY (Etymology & Vault)
  {
    name: "memory-etymology",
    domain: "MEMORY",
    title: "Etymological Origin Chain",
    description: "Proto-language root descent and historical word genealogy lineage.",
    linguisticNotation: "*k̂m̥tóm < PIE",
    domainColor: "#f59e0b",
  },
  {
    name: "memory-dataset",
    domain: "MEMORY",
    title: "Corpus / Seed Dataset",
    description: "Structured naming corpus, frequency-ranked lexicon, and training n-grams.",
    linguisticNotation: "N = 10,480",
    domainColor: "#f59e0b",
  },
  {
    name: "memory-stash",
    domain: "MEMORY",
    title: "Stash / Bounded Vault",
    description: "Pinned bookmarks, saved lexicon entries, and exported name registries.",
    linguisticNotation: "⟨VAULT⟩",
    domainColor: "#f59e0b",
  },

  // COMPOSITION (Morphology & Lexicon)
  {
    name: "compose-morphology",
    domain: "COMPOSITION",
    title: "Morphological Composition",
    description: "Root compounding, agglutinative affixes, and morphological derivation.",
    linguisticNotation: "[Root] + [Suf]",
    domainColor: "#06b6d4",
  },
  {
    name: "compose-lexicon",
    domain: "COMPOSITION",
    title: "Lexicon Dictionary",
    description: "Headword index, part-of-speech taxonomy, and semantic gloss mapping.",
    linguisticNotation: "{gloss, pos}",
    domainColor: "#06b6d4",
  },
  {
    name: "compose-loanword",
    domain: "COMPOSITION",
    title: "Loanword Borrowing",
    description: "Substrate influence, language contact, and phonetic nativization path.",
    linguisticNotation: "A ⤳ B (Adapt)",
    domainColor: "#06b6d4",
  },

  // EMERGENCE (Markov & Generation)
  {
    name: "emerge-branch",
    domain: "EMERGENCE",
    title: "Markov Probability Fork",
    description: "N-gram transition probability tree and weighted stochastic branching.",
    linguisticNotation: "P(wₙ|wₙ₋₁,wₙ₋₂)",
    domainColor: "#ec4899",
  },
  {
    name: "emerge-synthesis",
    domain: "EMERGENCE",
    title: "Emergence / Generation (✦)",
    description: "Deterministic linguistic generation from phonotactic constraints and seed state.",
    linguisticNotation: "Generate()",
    domainColor: "#ec4899",
  },
  {
    name: "emerge-engine",
    domain: "EMERGENCE",
    title: "Canonical Onoma Engine Mark",
    description: "The official Onoma tripartite engine mark: Input (◌) → Machine (●) → Output (◌).",
    linguisticNotation: "⟨ONOMA⟩",
    domainColor: "#ec4899",
  },

  // SYSTEM (Platform & Notation)
  {
    name: "system-pack",
    domain: "SYSTEM",
    title: "Language Pack",
    description: "Self-contained conlang archive containing phonology, rules, lexicon, and voices.",
    linguisticNotation: ".onoma-pack",
    domainColor: "#6366f1",
  },
  {
    name: "system-compare",
    domain: "SYSTEM",
    title: "Comparator & Delta Divergence",
    description: "Phonological contrast matrix, distance metric, and vowel formant overlap.",
    linguisticNotation: "Δ(L₁, L₂)",
    domainColor: "#6366f1",
  },
  {
    name: "system-writing",
    domain: "SYSTEM",
    title: "Orthography & Grapheme Script",
    description: "Phoneme-to-grapheme orthographic transliteration and writing systems.",
    linguisticNotation: "⟨grapheme⟩",
    domainColor: "#6366f1",
  },
  {
    name: "system-frame",
    domain: "SYSTEM",
    title: "Bounded Linguistic Object",
    description: "Chevrons indicating an official bounded linguistic entity or package.",
    linguisticNotation: "⟨...⟩",
    domainColor: "#6366f1",
  },
];

const DOMAINS = [
  "ALL",
  "SOUND",
  "STRUCTURE",
  "TRANSFORMATION",
  "MEMORY",
  "COMPOSITION",
  "EMERGENCE",
  "SYSTEM",
] as const;

const PALETTES = [
  { label: "Default (Foreground)", value: undefined },
  { label: "Onoma Blue", value: "#0091ff" },
  { label: "Emerald", value: "#10b981" },
  { label: "Purple", value: "#a855f7" },
  { label: "Amber", value: "#f59e0b" },
  { label: "Cyan", value: "#06b6d4" },
  { label: "Pink", value: "#ec4899" },
  { label: "Indigo", value: "#6366f1" },
];

export default function OnomaGlyphsDevPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDomain, setSelectedDomain] = useState<string>("ALL");
  const [selectedSize, setSelectedSize] = useState<OnomaGlyphSize>("lg");
  const [selectedState, setSelectedState] = useState<OnomaGlyphState>("idle");
  const [selectedStroke, setSelectedStroke] = useState<number>(1.75);
  const [selectedColor, setSelectedColor] = useState<string | undefined>(undefined);
  const [copiedName, setCopiedName] = useState<string | null>(null);

  const filteredGlyphs = useMemo(() => {
    return GLYPH_METADATA.filter((glyph) => {
      const matchesDomain = selectedDomain === "ALL" || glyph.domain === selectedDomain;
      const matchesSearch =
        searchQuery.trim() === "" ||
        glyph.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        glyph.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        glyph.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        glyph.linguisticNotation.toLowerCase().includes(searchQuery.toLowerCase());

      return matchesDomain && matchesSearch;
    });
  }, [searchQuery, selectedDomain]);

  const copyCode = (name: string, snippet: string) => {
    navigator.clipboard.writeText(snippet);
    setCopiedName(name);
    setTimeout(() => setCopiedName(null), 2000);
  };

  return (
    <div className="bg-background text-label min-h-screen p-4 antialiased sm:p-8">
      <div className="mx-auto max-w-7xl space-y-8">
        {/* Navigation & Header */}
        <div className="border-separator flex flex-col justify-between gap-4 border-b pb-6 md:flex-row md:items-center">
          <div className="space-y-1.5">
            <div className="text-label-secondary text-footnote flex items-center gap-2 font-mono">
              <Link
                href="/labs/onoma"
                className="hover:text-label flex items-center gap-1 transition-colors"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Labs / Onoma</span>
              </Link>
              <span>/</span>
              <span className="text-label font-semibold">Glyph Catalog</span>
            </div>

            <div className="flex items-center gap-3">
              <div className="bg-tint/10 text-tint border-tint/20 rounded-row border p-2">
                <OnomaGlyph name="emerge-engine" size="lg" />
              </div>
              <div>
                <h1 className="text-title-1 font-mono font-bold">
                  Onoma Glyph Catalog{" "}
                  <span className="text-label-secondary bg-fill-3 border-separator text-footnote rounded-full border px-2 py-0.5 font-mono">
                    v0.1
                  </span>
                </h1>
                <p className="text-label-secondary text-footnote sm:text-body">
                  Mathematical vector grammar for notation over illustration (SF Symbols × IPA ×
                  Scientific Diagrams).
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto">
            <Link
              href="/labs/onoma"
              className="border-separator bg-fill-3 hover:bg-fill-3 rounded-row text-footnote inline-flex items-center gap-2 border px-3.5 py-2 font-semibold transition-[color,background-color,border-color,box-shadow,opacity,transform] active:scale-95"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Back to Onoma Workspace</span>
            </Link>
          </div>
        </div>

        {/* Interactive Controls Bench */}
        <div className="border-separator bg-fill-4 rounded-card shadow-card space-y-4 border p-4 sm:p-6">
          <div className="border-separator flex items-center justify-between gap-2 border-b pb-3">
            <div className="text-label-secondary text-eyebrow flex items-center gap-2 font-mono">
              <ControlSlider className="text-tint h-4 w-4" />
              <span>Live Testing Controls</span>
            </div>
            <span className="text-label-secondary text-footnote font-mono">
              Showing {filteredGlyphs.length} of {GLYPH_METADATA.length} Glyphs
            </span>
          </div>

          {/* Search & Domain Filters */}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {/* Search Input */}
            <div className="relative md:col-span-1">
              <Search className="text-label-secondary absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
              <Input
                type="text"
                placeholder="Search glyph name, IPA notation, or concept..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="text-footnote w-full pr-3 pl-9 font-mono"
              />
            </div>

            {/* Domain Pills */}
            <div className="flex scrollbar-none items-center gap-1.5 overflow-x-auto pb-1 md:col-span-2">
              {DOMAINS.map((domain) => (
                <button
                  key={domain}
                  onClick={() => setSelectedDomain(domain)}
                  className={cn(
                    "rounded-control text-caption shrink-0 cursor-pointer px-2.5 py-1.5 font-mono font-semibold transition-[color,background-color,border-color,box-shadow,opacity,transform] select-none",
                    selectedDomain === domain
                      ? "bg-label text-surface shadow-card"
                      : "bg-surface border-separator text-label-secondary hover:text-label hover:bg-background border"
                  )}
                >
                  {domain}
                </button>
              ))}
            </div>
          </div>

          {/* Sizing, States, Stroke & Palette Control Row */}
          <div className="border-separator grid grid-cols-1 gap-3 border-t pt-2 sm:grid-cols-2 lg:grid-cols-4">
            {/* Sizing Switcher */}
            <div className="space-y-1.5">
              <label className="text-label-secondary text-subhead font-mono">
                Scale: <span className="text-label">{selectedSize}</span>
              </label>
              <div className="bg-surface border-separator rounded-row flex items-center gap-1 border p-1">
                {(["xs", "sm", "md", "lg", "xl", "display"] as OnomaGlyphSize[]).map((sz) => (
                  <button
                    key={sz}
                    onClick={() => setSelectedSize(sz)}
                    className={cn(
                      "rounded-control text-caption flex-1 cursor-pointer py-1 font-mono font-semibold transition-[color,background-color,border-color,box-shadow,opacity,transform]",
                      selectedSize === sz
                        ? "bg-tint text-on-tint shadow-card"
                        : "text-label-secondary hover:text-label"
                    )}
                  >
                    {sz}
                  </button>
                ))}
              </div>
            </div>

            {/* State Switcher */}
            <div className="space-y-1.5">
              <label className="text-label-secondary text-subhead font-mono">
                State: <span className="text-label">{selectedState}</span>
              </label>
              <div className="bg-surface border-separator rounded-row flex items-center gap-1 border p-1">
                {(["idle", "active", "generating", "disabled"] as OnomaGlyphState[]).map((st) => (
                  <button
                    key={st}
                    onClick={() => setSelectedState(st)}
                    className={cn(
                      "rounded-control text-caption flex-1 cursor-pointer py-1 font-mono font-semibold transition-[color,background-color,border-color,box-shadow,opacity,transform]",
                      selectedState === st
                        ? "bg-label text-surface shadow-card"
                        : "text-label-secondary hover:text-label"
                    )}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>

            {/* Stroke Weight */}
            <div className="space-y-1.5">
              <label className="text-label-secondary text-subhead flex items-center justify-between font-mono">
                <span>Stroke:</span>
                <span className="text-label font-mono">{selectedStroke.toFixed(2)}px</span>
              </label>
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="range"
                  min="1.0"
                  max="3.0"
                  step="0.25"
                  value={selectedStroke}
                  onChange={(e) => setSelectedStroke(parseFloat(e.target.value))}
                  className="accent-tint w-full cursor-pointer"
                />
              </div>
            </div>

            {/* Accent Color Palette */}
            <div className="space-y-1.5">
              <label className="text-label-secondary text-subhead font-mono">Accent Color</label>
              <div className="bg-surface border-separator rounded-row flex items-center gap-1.5 border p-1.5">
                {PALETTES.map((p, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedColor(p.value)}
                    title={p.label}
                    className={cn(
                      "rounded-control h-6 w-6 cursor-pointer border transition-transform duration-150 active:scale-90",
                      selectedColor === p.value
                        ? "ring-separator scale-110 ring-2"
                        : "opacity-75 hover:opacity-100",
                      p.value ? "" : "bg-label"
                    )}
                    style={p.value ? { backgroundColor: p.value } : undefined}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Glyph Cards Grid */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {filteredGlyphs.map((glyph) => {
            const jsxCode = `<OnomaGlyph name="${glyph.name}" size="${selectedSize}" />`;
            const isCopied = copiedName === glyph.name;

            return (
              <div
                key={glyph.name}
                className="group border-separator bg-fill-4 hover:border-separator hover:bg-fill-3 rounded-card shadow-card relative flex flex-col justify-between border p-4.5 transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-200"
              >
                {/* Top Badge Row */}
                <div className="flex items-center justify-between gap-2">
                  <span
                    className="rounded-control-sm text-eyebrow border px-2 py-0.5 font-mono"
                    style={{
                      color: glyph.domainColor,
                      borderColor: `${glyph.domainColor}40`,
                      backgroundColor: `${glyph.domainColor}10`,
                    }}
                  >
                    {glyph.domain}
                  </span>
                  <span className="text-label-secondary bg-surface border-separator rounded-control-sm text-caption border px-1.5 py-0.5 font-mono">
                    {glyph.linguisticNotation}
                  </span>
                </div>

                {/* Hero Glyph Canvas Preview */}
                <div className="bg-surface border-separator rounded-row my-6 flex h-24 items-center justify-center border transition-transform group-hover:scale-[1.02]">
                  <OnomaGlyph
                    name={glyph.name}
                    size={selectedSize}
                    state={selectedState}
                    strokeWidth={selectedStroke}
                    accentColor={selectedColor || glyph.domainColor}
                  />
                </div>

                {/* Info & Code Copy */}
                <div className="space-y-2">
                  <div>
                    <h3 className="text-label text-footnote sm:text-body font-semibold">
                      {glyph.title}
                    </h3>
                    <p className="text-label-secondary text-caption font-mono">{glyph.name}</p>
                  </div>

                  <p className="text-label-secondary text-caption line-clamp-2 leading-relaxed">
                    {glyph.description}
                  </p>

                  <button
                    onClick={() => copyCode(glyph.name, jsxCode)}
                    className={cn(
                      "rounded-row text-caption flex w-full cursor-pointer items-center justify-between border px-2.5 py-1.5 font-mono transition-[color,background-color,border-color,box-shadow,opacity,transform] select-none active:scale-[0.97]",
                      isCopied
                        ? "border-green/30 bg-green/10 text-green font-semibold"
                        : "bg-surface border-separator text-label-secondary hover:text-label hover:bg-background"
                    )}
                  >
                    <span className="truncate">{isCopied ? "Copied to Clipboard!" : jsxCode}</span>
                    {isCopied ? (
                      <Check className="text-green ml-1 h-3 w-3 shrink-0" />
                    ) : (
                      <Copy className="ml-1 h-3 w-3 shrink-0 opacity-60 group-hover:opacity-100" />
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Special Variants Playground (Composed & Framed) */}
        <div className="border-separator bg-fill-4 rounded-card space-y-6 border p-6">
          <div className="border-separator border-b pb-3">
            <h2 className="text-title-3 flex items-center gap-2 font-mono font-bold">
              <Component className="text-tint h-4 w-4" />
              <span>Special Linguistic Notation Variants</span>
            </h2>
            <p className="text-label-secondary text-footnote">
              Composed transformations (sound shifts) and framed brand/entity objects.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {/* Framed Linguistic Objects ⟨LABEL⟩ */}
            <div className="bg-surface border-separator rounded-row space-y-3 border p-4">
              <h3 className="text-label-secondary text-subhead font-mono">
                1. Framed Linguistic Objects (⟨LABEL⟩)
              </h3>
              <div className="flex flex-wrap items-center gap-3">
                <OnomaGlyph
                  variant="framed"
                  label="ONOMA"
                  size="lg"
                  state="active"
                  accentColor="#0091ff"
                />
                <OnomaGlyph
                  variant="framed"
                  label="KOKORO"
                  size="md"
                  state="active"
                  accentColor="#ec4899"
                />
                <OnomaGlyph
                  variant="framed"
                  label="HIGH_VALYRIAN"
                  size="md"
                  state="active"
                  accentColor="#a855f7"
                />
                <OnomaGlyph variant="framed" label="SINDARIN" size="md" state="idle" />
              </div>
              <p className="text-label-secondary text-caption font-mono">
                Usage: {'<OnomaGlyph variant="framed" label="ONOMA" size="lg" />'}
              </p>
            </div>

            {/* Composed Sound Shift Expressions from → to */}
            <div className="bg-surface border-separator rounded-row space-y-3 border p-4">
              <h3 className="text-label-secondary text-subhead font-mono">
                2. Sound Shift Expressions (From → To)
              </h3>
              <div className="flex flex-wrap items-center gap-4">
                <OnomaGlyph
                  variant="composed"
                  from="[p]"
                  to="[f]"
                  size="md"
                  state="active"
                  accentColor="#10b981"
                />
                <OnomaGlyph
                  variant="composed"
                  from="[k]"
                  to="[tʃ]"
                  size="md"
                  state="active"
                  accentColor="#a855f7"
                />
                <OnomaGlyph variant="composed" from="[a:]" to="[eɪ]" size="md" state="idle" />
              </div>
              <p className="text-label-secondary text-caption font-mono">
                Usage: {'<OnomaGlyph variant="composed" from="[p]" to="[f]" />'}
              </p>
            </div>
          </div>
        </div>

        {/* Optical Scale Matrix */}
        <div className="border-separator bg-fill-4 rounded-card space-y-4 border p-6">
          <div className="border-separator border-b pb-3">
            <h2 className="text-title-3 flex items-center gap-2 font-mono font-bold">
              <ViewGrid className="text-tint h-4 w-4" />
              <span>Optical Scale Verification Matrix</span>
            </h2>
            <p className="text-label-secondary text-footnote">
              Verify stroke hierarchy and optical balance at Micro (16px), Standard (24px), and
              Display (48px).
            </p>
          </div>

          <div className="overflow-x-auto pb-2">
            <table className="text-footnote w-full text-left font-mono">
              <thead>
                <tr className="border-separator text-label-secondary border-b">
                  <th className="py-2.5 pr-4">Glyph Name</th>
                  <th className="px-4 py-2.5 text-center">Micro (16px)</th>
                  <th className="px-4 py-2.5 text-center">Standard (24px)</th>
                  <th className="px-4 py-2.5 text-center">Display (48px)</th>
                </tr>
              </thead>
              <tbody className="divide-separator divide-y">
                {GLYPH_METADATA.map((glyph) => (
                  <tr key={glyph.name} className="hover:bg-fill-3 transition-colors">
                    <td className="text-label py-3 pr-4 font-semibold">{glyph.name}</td>
                    <td className="px-4 py-3 text-center">
                      <div className="bg-surface border-separator rounded-control-sm inline-flex items-center justify-center border p-1">
                        <OnomaGlyph name={glyph.name} size="sm" />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="bg-surface border-separator rounded-control-sm inline-flex items-center justify-center border p-1.5">
                        <OnomaGlyph name={glyph.name} size="lg" />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="bg-surface border-separator rounded-control-sm inline-flex items-center justify-center border p-2">
                        <OnomaGlyph name={glyph.name} size="display" />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
