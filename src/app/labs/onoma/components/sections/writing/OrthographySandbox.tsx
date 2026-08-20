// src/app/labs/onoma/components/sections/writing/OrthographySandbox.tsx
// Onoma Lab — Orthography Render Sandbox & Typographic Typesetting Studio
// Philosophy: Apple Typography × Emil Design Engineering

import React, { useState, useMemo } from "react";
import {
  Eye,
  AlignLeft,
  AlignRight,
  ArrowDown,
  Copy,
  Check,
  Download,
} from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { FacetMaterial } from "~/components/ui/facet";
import { cn } from "~/lib/utils";
import type { Glyph, ScriptDirection, RenderToken } from "./types";
import { useNameBank } from "~/hooks/useNameBank";
import { CorpusSelector } from "../../shared/CorpusSelector";
import { resolveCorpusWords } from "~/lib/onoma/data-bridge";

interface OrthographySandboxProps {
  glyphs: Glyph[];
  direction: ScriptDirection;
  onDirectionChange: (dir: ScriptDirection) => void;
  glyphSize: number;
  onGlyphSizeChange: (size: number) => void;
  baselineOffset: number;
  onBaselineOffsetChange: (offset: number) => void;
  onSelectGlyphToEdit?: (glyph: Glyph) => void;
  onForgeMissing?: (charOrPhoneme: string) => void;
  studioWords?: string[];
}

const SAMPLE_PHRASES = [
  { label: "Classic", text: "aba kala voran" },
  { label: "Pangram", text: "the quick brown fox" },
  { label: "Conlang Imperial", text: "kaelen voss sha tur" },
  { label: "Celestial Runes", text: "sol luna ast aether" },
  { label: "Syllables", text: "ba be bi bo bu" },
];

export function OrthographySandbox({
  glyphs,
  direction,
  onDirectionChange,
  glyphSize,
  onGlyphSizeChange,
  baselineOffset,
  onBaselineOffsetChange,
  onSelectGlyphToEdit,
  onForgeMissing,
  studioWords = [],
}: OrthographySandboxProps) {
  const shouldReduceMotion = useReducedMotion();
  const bank = useNameBank();
  const customDicts = useMemo(() => {
    return bank.nameBank?.filter((d) => d.type === "dictionary" && d.values?.length > 0) || [];
  }, [bank.nameBank]);

  // Test String Input
  const [testText, setTestText] = useState("kaelen voss sha tur");

  // Advanced Typesetting States
  const [letterSpacing, setLetterSpacing] = useState(4);
  const [wordSpacing, setWordSpacing] = useState(16);
  const [strokeWeight] = useState(5);
  const [selectedToken, setSelectedToken] = useState<RenderToken | null>(null);

  // Copy / Export feedback
  const [copiedSvg, setCopiedSvg] = useState(false);

  // Greedy Phonetic Tokenizer
  const tokens = useMemo<RenderToken[]>(() => {
    if (!testText) return [];

    const sortedGlyphs = [...glyphs].sort((a, b) => b.phoneme.length - a.phoneme.length);

    let remaining = testText.toLowerCase();
    const result: RenderToken[] = [];
    let tokenIndex = 0;

    while (remaining.length > 0) {
      if (remaining.startsWith(" ")) {
        result.push({
          id: `space-${tokenIndex++}`,
          charOrPhoneme: " ",
          isMatched: true,
          isSpace: true,
          isNewline: false,
        });
        remaining = remaining.slice(1);
        continue;
      }

      if (remaining.startsWith("\n")) {
        result.push({
          id: `nl-${tokenIndex++}`,
          charOrPhoneme: "\n",
          isMatched: true,
          isSpace: false,
          isNewline: true,
        });
        remaining = remaining.slice(1);
        continue;
      }

      let matchedGlyph: Glyph | null = null;
      for (const g of sortedGlyphs) {
        if (remaining.startsWith(g.phoneme.toLowerCase())) {
          matchedGlyph = g;
          break;
        }
      }

      if (matchedGlyph) {
        result.push({
          id: `token-${tokenIndex++}`,
          charOrPhoneme: matchedGlyph.phoneme,
          glyph: matchedGlyph,
          isMatched: true,
          isSpace: false,
          isNewline: false,
        });
        remaining = remaining.slice(matchedGlyph.phoneme.length);
      } else {
        result.push({
          id: `fallback-${tokenIndex++}`,
          charOrPhoneme: remaining[0],
          isMatched: false,
          isSpace: false,
          isNewline: false,
        });
        remaining = remaining.slice(1);
      }
    }

    return result;
  }, [testText, glyphs]);

  // Generate SVG Export Markup
  const generateExportSvg = (): string => {
    const activeTokens = tokens.filter((t) => !t.isNewline);
    const totalWidth = activeTokens.reduce((acc, t) => {
      if (t.isSpace) return acc + wordSpacing;
      return acc + glyphSize + letterSpacing;
    }, 40);

    const height = glyphSize + 40;

    let currentX = 20;
    const pathsMarkup: string[] = [];

    activeTokens.forEach((t) => {
      if (t.isSpace) {
        currentX += wordSpacing;
        return;
      }

      if (t.glyph) {
        const scale = glyphSize / 128;
        pathsMarkup.push(
          `<g transform="translate(${currentX.toFixed(1)}, ${(20 + baselineOffset).toFixed(1)}) scale(${scale.toFixed(3)})">` +
            `<path d="${t.glyph.svgPath}" fill="none" stroke="currentColor" stroke-width="${strokeWeight}" stroke-linecap="round" stroke-linejoin="round" />` +
            `</g>`
        );
      } else {
        pathsMarkup.push(
          `<text x="${(currentX + glyphSize / 2).toFixed(1)}" y="${(20 + glyphSize / 2 + baselineOffset).toFixed(1)}" text-anchor="middle" font-family="monospace" font-size="${(glyphSize * 0.5).toFixed(1)}" fill="currentColor" opacity="0.6">${t.charOrPhoneme}</text>`
        );
      }

      currentX += glyphSize + letterSpacing;
    });

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${Math.max(200, totalWidth)} ${height}" width="${Math.max(200, totalWidth)}" height="${height}">\n  ${pathsMarkup.join("\n  ")}\n</svg>`;
  };

  const handleCopySvg = async () => {
    try {
      const svg = generateExportSvg();
      await navigator.clipboard.writeText(svg);
      setCopiedSvg(true);
      setTimeout(() => setCopiedSvg(false), 1800);
    } catch (err) {
      console.error("Failed to copy SVG:", err);
    }
  };

  const handleDownloadSvg = () => {
    const svg = generateExportSvg();
    const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `orthography-${Date.now()}.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <FacetMaterial
      material="satin"
      className="border-border/30 flex flex-col space-y-4 rounded-2xl border p-4 shadow-sm"
    >
      {/* Header Bar with Direction Segmented Control */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/40 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-[#0091ff]/10 text-[#0091ff] dark:bg-[#0091ff]/15">
            <Eye className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-foreground text-xs font-bold tracking-wider uppercase">
              Orthography Render Sandbox
            </h3>
            <p className="text-muted-foreground text-[10px]">
              Typesetting preview, dynamic font metrics & token inspector
            </p>
          </div>
        </div>

        {/* Direction Segmented Switcher (Apple Style) */}
        <div className="flex items-center gap-0.5 rounded-xl border border-border/40 bg-secondary/20 p-0.5">
          <button
            type="button"
            onClick={() => onDirectionChange("ltr")}
            title="Left-to-Right script layout"
            className={cn(
              "flex h-7 items-center gap-1.5 rounded-lg px-2.5 text-[10px] font-semibold transition-all cursor-pointer active:scale-95",
              direction === "ltr"
                ? "bg-background text-foreground shadow-2xs font-bold"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <AlignLeft className="h-3 w-3" />
            <span>LTR</span>
          </button>

          <button
            type="button"
            onClick={() => onDirectionChange("rtl")}
            title="Right-to-Left script layout"
            className={cn(
              "flex h-7 items-center gap-1.5 rounded-lg px-2.5 text-[10px] font-semibold transition-all cursor-pointer active:scale-95",
              direction === "rtl"
                ? "bg-background text-foreground shadow-2xs font-bold"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <AlignRight className="h-3 w-3" />
            <span>RTL</span>
          </button>

          <button
            type="button"
            onClick={() => onDirectionChange("ttb")}
            title="Top-to-Bottom vertical script layout"
            className={cn(
              "flex h-7 items-center gap-1.5 rounded-lg px-2.5 text-[10px] font-semibold transition-all cursor-pointer active:scale-95",
              direction === "ttb"
                ? "bg-background text-foreground shadow-2xs font-bold"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <ArrowDown className="h-3 w-3" />
            <span>Vertical</span>
          </button>
        </div>
      </div>

      {/* Input Field & Preset Phrases */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={testText}
            onChange={(e) => setTestText(e.target.value)}
            placeholder="Type phonetic text (e.g. kaelen voss sha tur)..."
            className="bg-background/80 border-border/40 text-foreground placeholder:text-muted-foreground/60 focus:border-[#0091ff]/60 focus:ring-2 focus:ring-[#0091ff]/20 flex-1 rounded-xl border px-3.5 py-2 text-sm font-mono transition-all outline-none"
          />

          {/* Export & Copy Suite */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleCopySvg}
              title="Copy Rendered SVG Markup"
              className="hover:border-[#0091ff]/40 hover:bg-secondary/40 border-border/40 bg-secondary/20 flex h-9 items-center gap-1.5 rounded-xl border px-3 text-xs font-semibold text-foreground transition-all cursor-pointer active:scale-[0.97]"
            >
              {copiedSvg ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
              <span className="hidden sm:inline">Copy SVG</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadSvg}
              title="Download SVG Vector File"
              className="hover:border-[#0091ff]/40 hover:bg-secondary/40 border-border/40 bg-secondary/20 flex h-9 w-9 items-center justify-center rounded-xl border text-foreground transition-all cursor-pointer active:scale-[0.97]"
            >
              <Download className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Quick Sample Presets & Cross-System Corpus Ingestion */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-muted-foreground text-[10px] font-medium">Quick Phrases:</span>
            {SAMPLE_PHRASES.map((sample) => (
              <button
                key={sample.label}
                type="button"
                onClick={() => setTestText(sample.text)}
                className="border-border/30 bg-background/60 hover:border-[#0091ff]/40 hover:bg-[#0091ff]/10 text-muted-foreground hover:text-foreground rounded-lg border px-2.5 py-1 text-[10px] font-mono transition-colors cursor-pointer active:scale-[0.96]"
              >
                {sample.label}
              </button>
            ))}
          </div>

          <div className="w-44">
            <CorpusSelector
              value=""
              onChange={(val) => {
                const resolved = resolveCorpusWords(val, customDicts, studioWords);
                if (resolved.words?.length > 0) {
                  setTestText(resolved.words.slice(0, 6).join(" "));
                }
              }}
              studioWords={studioWords}
            />
          </div>
        </div>
      </div>

      {/* Main Typographic Render Canvas Slate */}
      <div className="border-border/40 bg-card/60 relative min-h-[140px] overflow-x-auto rounded-2xl border p-6 shadow-inner select-none">
        {glyphs.length === 0 ? (
          <div className="text-muted-foreground flex h-24 flex-col items-center justify-center text-center text-xs italic">
            <span>Add glyphs above to begin rendering constructed language text.</span>
          </div>
        ) : testText.trim().length === 0 ? (
          <div className="text-muted-foreground flex h-24 items-center justify-center text-xs italic">
            Enter words or phrases above to preview script typography.
          </div>
        ) : (
          <div
            className={cn(
              "flex flex-wrap items-center transition-all",
              direction === "rtl" && "flex-row-reverse",
              direction === "ttb" && "flex-col items-start overflow-y-auto max-h-[320px]"
            )}
            style={{
              gap: `${letterSpacing}px`,
            }}
          >
            {tokens.map((tok) => {
              if (tok.isSpace) {
                return (
                  <div
                    key={tok.id}
                    style={{
                      width: direction === "ttb" ? glyphSize : wordSpacing,
                      height: direction === "ttb" ? wordSpacing : glyphSize,
                    }}
                    className="shrink-0"
                  />
                );
              }

              if (tok.glyph) {
                return (
                  <motion.div
                    key={tok.id}
                    layout
                    whileHover={shouldReduceMotion ? {} : { scale: 1.05, y: -2 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setSelectedToken(tok)}
                    title={`⟨${tok.charOrPhoneme}⟩ — Click to inspect`}
                    className={cn(
                      "border-border/10 bg-secondary/10 hover:border-[#0091ff]/50 hover:bg-[#0091ff]/10 group relative flex shrink-0 cursor-pointer items-center justify-center rounded-xl border transition-colors",
                      selectedToken?.id === tok.id && "border-[#0091ff] ring-2 ring-[#0091ff]/30 bg-[#0091ff]/15"
                    )}
                    style={{
                      width: glyphSize,
                      height: glyphSize,
                    }}
                  >
                    <svg
                      viewBox="0 0 128 128"
                      className="stroke-foreground group-hover:stroke-[#0091ff] h-full w-full fill-none drop-shadow-2xs transition-colors"
                      style={{
                        strokeWidth: strokeWeight,
                        strokeLinecap: "round",
                        strokeLinejoin: "round",
                        transform: `translateY(${baselineOffset}px)`,
                      }}
                    >
                      <path d={tok.glyph.svgPath} />
                    </svg>
                  </motion.div>
                );
              }

              // Fallback for unmapped letters
              return (
                <div
                  key={tok.id}
                  onClick={() => {
                    setSelectedToken(tok);
                    onForgeMissing?.(tok.charOrPhoneme);
                  }}
                  title={`Unmapped phoneme: '${tok.charOrPhoneme}' (Click to design)`}
                  className="border-border/40 hover:border-[#0091ff]/60 hover:bg-[#0091ff]/10 text-muted-foreground hover:text-[#0091ff] flex shrink-0 cursor-pointer items-center justify-center rounded-xl border border-dashed font-mono text-xs font-bold transition-all active:scale-95"
                  style={{
                    width: glyphSize,
                    height: glyphSize,
                    transform: `translateY(${baselineOffset}px)`,
                  }}
                >
                  {tok.charOrPhoneme}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Phonetic Token Breakdown Stream */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
            Phonetic Token Stream ({tokens.filter((t) => !t.isSpace && !t.isNewline).length} tokens)
          </span>
          <span className="text-muted-foreground text-[9px]">
            Click unmapped tokens to design instant glyphs
          </span>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {tokens.map((tok) => {
            if (tok.isSpace || tok.isNewline) return null;
            return (
              <button
                key={`chip-${tok.id}`}
                type="button"
                onClick={() => {
                  setSelectedToken(tok);
                  if (tok.glyph && onSelectGlyphToEdit) {
                    onSelectGlyphToEdit(tok.glyph);
                  } else if (!tok.glyph && onForgeMissing) {
                    onForgeMissing(tok.charOrPhoneme);
                  }
                }}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[10px] font-mono transition-all cursor-pointer active:scale-[0.96]",
                  tok.glyph
                    ? "border-[#0091ff]/30 bg-[#0091ff]/10 text-[#0091ff] font-semibold shadow-2xs"
                    : "border-[#0091ff]/40 bg-[#0091ff]/5 text-[#0091ff] border-dashed font-bold hover:bg-[#0091ff]/15"
                )}
              >
                <span>{tok.charOrPhoneme}</span>
                <span className="text-[9px] opacity-70">
                  {tok.glyph ? "✓" : "+ Add"}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Typesetting Sliders with Tactile Numerical Badges */}
      <div className="border-border/30 bg-secondary/10 grid grid-cols-2 gap-3 rounded-2xl border p-3.5 sm:grid-cols-4">
        {/* Glyph Size Slider */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-muted-foreground font-medium">Glyph Size</span>
            <span className="text-foreground bg-secondary/40 rounded px-1 py-0.2 font-mono font-bold">
              {glyphSize}px
            </span>
          </div>
          <input
            type="range"
            min={24}
            max={96}
            step={2}
            value={glyphSize}
            onChange={(e) => onGlyphSizeChange(Number(e.target.value))}
            className="accent-[#0091ff] h-1.5 w-full cursor-pointer rounded-lg bg-secondary/40"
          />
        </div>

        {/* Letter Spacing Slider */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-muted-foreground font-medium">Tracking</span>
            <span className="text-foreground bg-secondary/40 rounded px-1 py-0.2 font-mono font-bold">
              {letterSpacing}px
            </span>
          </div>
          <input
            type="range"
            min={-4}
            max={24}
            step={1}
            value={letterSpacing}
            onChange={(e) => setLetterSpacing(Number(e.target.value))}
            className="accent-[#0091ff] h-1.5 w-full cursor-pointer rounded-lg bg-secondary/40"
          />
        </div>

        {/* Word Spacing Slider */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-muted-foreground font-medium">Word Gap</span>
            <span className="text-foreground bg-secondary/40 rounded px-1 py-0.2 font-mono font-bold">
              {wordSpacing}px
            </span>
          </div>
          <input
            type="range"
            min={4}
            max={36}
            step={2}
            value={wordSpacing}
            onChange={(e) => setWordSpacing(Number(e.target.value))}
            className="accent-[#0091ff] h-1.5 w-full cursor-pointer rounded-lg bg-secondary/40"
          />
        </div>

        {/* Baseline Shift Slider */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-muted-foreground font-medium">Baseline Shift</span>
            <span className="text-foreground bg-secondary/40 rounded px-1 py-0.2 font-mono font-bold">
              {baselineOffset > 0 ? `+${baselineOffset}` : baselineOffset}px
            </span>
          </div>
          <input
            type="range"
            min={-20}
            max={20}
            step={1}
            value={baselineOffset}
            onChange={(e) => onBaselineOffsetChange(Number(e.target.value))}
            className="accent-[#0091ff] h-1.5 w-full cursor-pointer rounded-lg bg-secondary/40"
          />
        </div>
      </div>
    </FacetMaterial>
  );
}
