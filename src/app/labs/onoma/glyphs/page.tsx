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
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "~/components/ui/table";
import { Button } from "~/components/ui/button";
import { SegmentedControl } from "~/components/ui/segmented-control";
import { Slider } from "~/components/ui/slider";
import { ToggleGroup, ToggleGroupItem } from "~/components/ui/toggle-group";

interface GlyphMeta {
  name: OnomaGlyphName;
  domain:
    "SOUND" | "STRUCTURE" | "TRANSFORMATION" | "MEMORY" | "COMPOSITION" | "EMERGENCE" | "SYSTEM";
  title: string;
  description: string;
  linguisticNotation: string;
}

const DOMAIN_COLORS: Record<GlyphMeta["domain"], string> = {
  SOUND: "#0091ff",
  STRUCTURE: "#10b981",
  TRANSFORMATION: "#a855f7",
  MEMORY: "#f59e0b",
  COMPOSITION: "#06b6d4",
  EMERGENCE: "#ec4899",
  SYSTEM: "#6366f1",
};

const GLYPH_METADATA: GlyphMeta[] = [
  // SOUND (Phonology & Acoustics)
  {
    name: "sound-phoneme",
    domain: "SOUND",
    title: "Phoneme Unit",
    description: "Discrete phonetic sound unit before realization in phonotactic context.",
    linguisticNotation: "/f/",
  },
  {
    name: "sound-articulation",
    domain: "SOUND",
    title: "Articulation Focal Node",
    description: "Place and manner of vocal tract constriction (bilabial, velar, coronal).",
    linguisticNotation: "[+coronal]",
  },
  {
    name: "sound-acoustic",
    domain: "SOUND",
    title: "Acoustic Wave & Harmonics",
    description: "Spectral formants, fundamental frequency (F0), and acoustic resonance.",
    linguisticNotation: "F1/F2 (Hz)",
  },
  {
    name: "sound-vowel-quad",
    domain: "SOUND",
    title: "IPA Vowel Quadrilateral",
    description: "Canonical 2D vowel space (Front/Back × High/Low) with cardinal vowel anchors.",
    linguisticNotation: "[i, u, a, ɑ]",
  },

  // STRUCTURE (Phonotactics & Syntax)
  {
    name: "struct-phonotactics",
    domain: "STRUCTURE",
    title: "Phonotactic Template",
    description: "Permissible syllable structure constraints (Onset + Nucleus + Coda / CVC).",
    linguisticNotation: ".(C)V(C).",
  },
  {
    name: "struct-syntax",
    domain: "STRUCTURE",
    title: "Syntax Parse Node",
    description: "Hierarchical phrase structure generator (Head-Initial/Final constituent trees).",
    linguisticNotation: "[S [NP] [VP]]",
  },
  {
    name: "struct-syllable",
    domain: "STRUCTURE",
    title: "Syllable Boundary (σ)",
    description: "Universal syllable weight, moraic structure, and prosodic foot segmentation.",
    linguisticNotation: "σ → μμ",
  },

  // TRANSFORMATION (Sound Shifts & Mutations)
  {
    name: "transform-shift",
    domain: "TRANSFORMATION",
    title: "Sound Shift Mutation",
    description:
      "Diachronic phonetic shift across historical eras (e.g. Grimm's Law, Great Vowel Shift).",
    linguisticNotation: "p > f / V_V",
  },
  {
    name: "transform-arrow",
    domain: "TRANSFORMATION",
    title: "Geometric Transformation Arrow",
    description:
      "Pure directional generative arrow for rules, shifts, and morphological production.",
    linguisticNotation: "A → B",
  },
  {
    name: "transform-correspond",
    domain: "TRANSFORMATION",
    title: "Cognate Correspondence",
    description:
      "Bidirectional cognate mapping between sister languages of a shared proto-ancestor.",
    linguisticNotation: "L₁ ↔ L₂",
  },
  {
    name: "transform-deletion",
    domain: "TRANSFORMATION",
    title: "Elision / Deletion (∅)",
    description: "Phonological apocope, syncope, or null morpheme zero-allomorph representation.",
    linguisticNotation: "X → ∅ / _#",
  },

  // MEMORY (Etymology & Vault)
  {
    name: "memory-etymology",
    domain: "MEMORY",
    title: "Etymological Origin Chain",
    description: "Proto-language root descent and historical word genealogy lineage.",
    linguisticNotation: "*k̂m̥tóm < PIE",
  },
  {
    name: "memory-dataset",
    domain: "MEMORY",
    title: "Corpus / Seed Dataset",
    description: "Structured naming corpus, frequency-ranked lexicon, and training n-grams.",
    linguisticNotation: "N = 10,480",
  },
  {
    name: "memory-stash",
    domain: "MEMORY",
    title: "Stash / Bounded Vault",
    description: "Pinned bookmarks, saved lexicon entries, and exported name registries.",
    linguisticNotation: "⟨VAULT⟩",
  },

  // COMPOSITION (Morphology & Lexicon)
  {
    name: "compose-morphology",
    domain: "COMPOSITION",
    title: "Morphological Composition",
    description: "Root compounding, agglutinative affixes, and morphological derivation.",
    linguisticNotation: "[Root] + [Suf]",
  },
  {
    name: "compose-lexicon",
    domain: "COMPOSITION",
    title: "Lexicon Dictionary",
    description: "Headword index, part-of-speech taxonomy, and semantic gloss mapping.",
    linguisticNotation: "{gloss, pos}",
  },
  {
    name: "compose-loanword",
    domain: "COMPOSITION",
    title: "Loanword Borrowing",
    description: "Substrate influence, language contact, and phonetic nativization path.",
    linguisticNotation: "A ⤳ B (Adapt)",
  },

  // EMERGENCE (Markov & Generation)
  {
    name: "emerge-branch",
    domain: "EMERGENCE",
    title: "Markov Probability Fork",
    description: "N-gram transition probability tree and weighted stochastic branching.",
    linguisticNotation: "P(wₙ|wₙ₋₁,wₙ₋₂)",
  },
  {
    name: "emerge-synthesis",
    domain: "EMERGENCE",
    title: "Emergence / Generation (✦)",
    description: "Deterministic linguistic generation from phonotactic constraints and seed state.",
    linguisticNotation: "Generate()",
  },
  {
    name: "emerge-engine",
    domain: "EMERGENCE",
    title: "Canonical Onoma Engine Mark",
    description: "The official Onoma tripartite engine mark: Input (◌) → Machine (●) → Output (◌).",
    linguisticNotation: "⟨ONOMA⟩",
  },

  // SYSTEM (Platform & Notation)
  {
    name: "system-pack",
    domain: "SYSTEM",
    title: "Language Pack",
    description: "Self-contained conlang archive containing phonology, rules, lexicon, and voices.",
    linguisticNotation: ".onoma-pack",
  },
  {
    name: "system-compare",
    domain: "SYSTEM",
    title: "Comparator & Delta Divergence",
    description: "Phonological contrast matrix, distance metric, and vowel formant overlap.",
    linguisticNotation: "Δ(L₁, L₂)",
  },
  {
    name: "system-writing",
    domain: "SYSTEM",
    title: "Orthography & Grapheme Script",
    description: "Phoneme-to-grapheme orthographic transliteration and writing systems.",
    linguisticNotation: "⟨grapheme⟩",
  },
  {
    name: "system-frame",
    domain: "SYSTEM",
    title: "Bounded Linguistic Object",
    description: "Chevrons indicating an official bounded linguistic entity or package.",
    linguisticNotation: "⟨...⟩",
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
  { label: "Onoma blue", value: "#0091ff" },
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
        <div className="border-separator flex flex-col justify-between gap-4 border-b pb-6 md:flex-row md:items-center">
          <div className="space-y-2">
            <div className="text-label-secondary text-footnote flex items-center gap-2 font-mono">
              <Link
                href="/labs/onoma"
                className="hover:text-label flex items-center gap-1 transition-colors"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Labs / Onoma</span>
              </Link>
              <span>/</span>
              <span className="text-label font-semibold">Glyph catalog</span>
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
              className="border-separator bg-fill-3 hover:bg-fill-3 rounded-row text-footnote inline-flex items-center gap-2 border px-4 py-2 font-semibold transition-[color,background-color,border-color,box-shadow,opacity]"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Back to Onoma workspace</span>
            </Link>
          </div>
        </div>

        <div className="border-separator bg-fill-4 rounded-card shadow-card space-y-4 border p-4 sm:p-6">
          <div className="border-separator flex items-center justify-between gap-2 border-b pb-3">
            <div className="text-label-secondary text-eyebrow flex items-center gap-2 font-mono">
              <ControlSlider className="text-tint h-4 w-4" />
              <span>Live testing controls</span>
            </div>
            <span className="text-label-secondary text-footnote font-mono">
              Showing {filteredGlyphs.length} of {GLYPH_METADATA.length} Glyphs
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
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

            <ToggleGroup
              type="single"
              variant="pill"
              size="sm"
              disallowEmpty
              aria-label="Glyph domain"
              value={selectedDomain}
              onValueChange={setSelectedDomain}
              className="scrollbar-none flex-nowrap gap-2 overflow-x-auto pb-1 md:col-span-2"
            >
              {DOMAINS.map((domain) => (
                <ToggleGroupItem key={domain} value={domain} className="shrink-0 font-mono">
                  {domain}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>

          {/* Sizing, States, Stroke & Palette Control Row */}
          <div className="border-separator grid grid-cols-1 gap-3 border-t pt-2 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <label className="text-label-secondary text-subhead font-mono">
                Scale: <span className="text-label">{selectedSize}</span>
              </label>
              <SegmentedControl
                size="sm"
                fullWidth
                scrollable={false}
                aria-label="Glyph scale"
                itemClassName="font-mono"
                value={selectedSize}
                onValueChange={setSelectedSize}
                options={(["xs", "sm", "md", "lg", "xl", "display"] as OnomaGlyphSize[]).map(
                  (sz) => ({ value: sz, label: sz })
                )}
              />
            </div>

            <div className="space-y-2">
              <label className="text-label-secondary text-subhead font-mono">
                State: <span className="text-label">{selectedState}</span>
              </label>
              <SegmentedControl
                size="sm"
                fullWidth
                aria-label="Glyph state"
                itemClassName="font-mono"
                value={selectedState}
                onValueChange={setSelectedState}
                options={(["idle", "active", "generating", "disabled"] as OnomaGlyphState[]).map(
                  (st) => ({ value: st, label: st })
                )}
              />
            </div>

            <div className="space-y-2">
              <label className="text-label-secondary text-subhead flex items-center justify-between font-mono">
                <span>Stroke:</span>
                <span className="text-label font-mono">{selectedStroke.toFixed(2)}px</span>
              </label>
              <div className="flex items-center gap-2 pt-1">
                <Slider
                  min={1}
                  max={3}
                  step={0.25}
                  value={[selectedStroke]}
                  onValueChange={([v]) => setSelectedStroke(v ?? selectedStroke)}
                  aria-label="Stroke weight"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-label-secondary text-subhead font-mono">Accent color</label>
              <ToggleGroup
                type="single"
                size="sm"
                disallowEmpty
                aria-label="Accent colour"
                value={selectedColor ?? "default"}
                onValueChange={(v) => setSelectedColor(v === "default" ? undefined : v)}
                className="bg-surface border-separator rounded-row flex-nowrap gap-0.5 border p-1"
              >
                {PALETTES.map((p) => (
                  <ToggleGroupItem
                    key={p.label}
                    value={p.value ?? "default"}
                    title={p.label}
                    aria-label={p.label}
                    className="group min-w-0 px-1"
                  >
                    <span
                      aria-hidden
                      className={cn(
                        "rounded-control-sm border-separator size-5 border opacity-75 transition-opacity group-hover:opacity-100 group-data-[state=on]:opacity-100",
                        !p.value && "bg-label"
                      )}
                      style={p.value ? { backgroundColor: p.value } : undefined}
                    />
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {filteredGlyphs.map((glyph) => {
            const jsxCode = `<OnomaGlyph name="${glyph.name}" size="${selectedSize}" />`;
            const isCopied = copiedName === glyph.name;

            return (
              <div
                key={glyph.name}
                className="group border-separator bg-fill-4 hover:border-separator hover:bg-fill-3 rounded-card shadow-card relative flex flex-col justify-between border p-5 transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-200"
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className="rounded-control-sm text-eyebrow border px-2 py-0.5 font-mono"
                    style={{
                      color: DOMAIN_COLORS[glyph.domain],
                      borderColor: `${DOMAIN_COLORS[glyph.domain]}40`,
                      backgroundColor: `${DOMAIN_COLORS[glyph.domain]}10`,
                    }}
                  >
                    {glyph.domain}
                  </span>
                  <span className="text-label-secondary bg-surface border-separator rounded-control-sm text-caption border px-2 py-0.5 font-mono">
                    {glyph.linguisticNotation}
                  </span>
                </div>

                <div className="bg-surface border-separator rounded-row my-6 flex h-24 items-center justify-center border transition-transform group-hover:scale-[1.02]">
                  <OnomaGlyph
                    name={glyph.name}
                    size={selectedSize}
                    state={selectedState}
                    strokeWidth={selectedStroke}
                    accentColor={selectedColor || DOMAIN_COLORS[glyph.domain]}
                  />
                </div>

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

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyCode(glyph.name, jsxCode)}
                    className={cn(
                      "rounded-row w-full justify-between px-3 font-mono font-normal",
                      isCopied && "border-green/30 bg-green/10 text-green-ink hover:bg-green/15"
                    )}
                  >
                    <span className="truncate">{isCopied ? "Copied to Clipboard!" : jsxCode}</span>
                    {isCopied ? (
                      <Check className="text-green ml-1 h-3 w-3 shrink-0" />
                    ) : (
                      <Copy className="ml-1 h-3 w-3 shrink-0 opacity-60 group-hover:opacity-100" />
                    )}
                  </Button>
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
              <span>Special linguistic notation variants</span>
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

        <div className="border-separator bg-fill-4 rounded-card space-y-4 border p-6">
          <div className="border-separator border-b pb-3">
            <h2 className="text-title-3 flex items-center gap-2 font-mono font-bold">
              <ViewGrid className="text-tint h-4 w-4" />
              <span>Optical scale verification matrix</span>
            </h2>
            <p className="text-label-secondary text-footnote">
              Verify stroke hierarchy and optical balance at Micro (16px), Standard (24px), and
              Display (48px).
            </p>
          </div>

          <Table className="font-mono">
            <TableHeader>
              <TableRow>
                <TableHead className="pr-4">Glyph name</TableHead>
                <TableHead className="px-4 text-center">Micro (16px)</TableHead>
                <TableHead className="px-4 text-center">Standard (24px)</TableHead>
                <TableHead className="px-4 text-center">Display (48px)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {GLYPH_METADATA.map((glyph) => (
                <TableRow key={glyph.name} className="hover:bg-fill-3">
                  <TableCell className="text-label pr-4 font-semibold">{glyph.name}</TableCell>
                  <TableCell className="px-4 text-center">
                    <div className="bg-surface border-separator rounded-control-sm inline-flex items-center justify-center border p-1">
                      <OnomaGlyph name={glyph.name} size="sm" />
                    </div>
                  </TableCell>
                  <TableCell className="px-4 text-center">
                    <div className="bg-surface border-separator rounded-control-sm inline-flex items-center justify-center border p-2">
                      <OnomaGlyph name={glyph.name} size="lg" />
                    </div>
                  </TableCell>
                  <TableCell className="px-4 text-center">
                    <div className="bg-surface border-separator rounded-control-sm inline-flex items-center justify-center border p-2">
                      <OnomaGlyph name={glyph.name} size="display" />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
