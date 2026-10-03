// src/app/labs/onoma/components/sections/writing/OrthographySandbox.tsx
// Onoma Lab — Orthography Render Sandbox & Typographic Typesetting Studio
// Philosophy: Apple Typography × Emil Design Engineering

import React, { useState, useMemo } from "react";
import { Eye, AlignLeft, AlignRight, ArrowDown, Copy, Check, Download } from "iconoir-react";
import { motion, useReducedMotion } from "motion/react";
import { cn } from "~/lib/utils";
import type { Glyph, ScriptDirection, RenderToken } from "./types";
import { useNameBank } from "~/hooks/useNameBank";
import { CorpusSelector } from "../../shared/CorpusSelector";
import { resolveCorpusWords } from "~/lib/onoma/data-bridge";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { SegmentedControl } from "~/components/ui/segmented-control";
import { Slider } from "~/components/ui/slider";
import { Card } from "~/components/ui/card";

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
    <Card variant="inset" padding="none" className="flex flex-col space-y-4 p-4">
      {/* Header Bar with Direction Segmented Control */}
      <div className="border-separator flex flex-wrap items-center justify-between gap-3 border-b pb-3">
        <div className="flex items-center gap-2">
          <div className="bg-tint/10 text-tint rounded-row flex h-7 w-7 items-center justify-center">
            <Eye className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-label text-subhead">Orthography Render Sandbox</h3>
            <p className="text-label-secondary text-caption">
              Typesetting preview, dynamic font metrics & token inspector
            </p>
          </div>
        </div>

        {/* Direction Segmented Switcher (Apple Style) */}
        <SegmentedControl
          size="sm"
          aria-label="Script layout"
          value={direction}
          onValueChange={onDirectionChange}
          options={[
            {
              value: "ltr",
              label: "LTR",
              icon: <AlignLeft />,
              "aria-label": "Left-to-right script layout",
            },
            {
              value: "rtl",
              label: "RTL",
              icon: <AlignRight />,
              "aria-label": "Right-to-left script layout",
            },
            {
              value: "ttb",
              label: "Vertical",
              icon: <ArrowDown />,
              "aria-label": "Top-to-bottom vertical script layout",
            },
          ]}
        />
      </div>

      {/* Input Field & Preset Phrases */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Input
            type="text"
            value={testText}
            onChange={(e) => setTestText(e.target.value)}
            placeholder="Type phonetic text (e.g. kaelen voss sha tur)..."
            className="text-body flex-1 font-mono"
          />

          {/* Export & Copy Suite */}
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              type="button"
              onClick={handleCopySvg}
              title="Copy Rendered SVG Markup"
            >
              {copiedSvg ? (
                <Check className="text-green h-3.5 w-3.5" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              <span className="hidden sm:inline">Copy SVG</span>
            </Button>

            <Button
              variant="outline"
              size="default"
              type="button"
              onClick={handleDownloadSvg}
              title="Download SVG Vector File"
              className="w-9 justify-center"
            >
              <Download className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Quick Sample Presets & Cross-System Corpus Ingestion */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-label-secondary text-caption font-medium">Quick Phrases:</span>
            {SAMPLE_PHRASES.map((sample) => (
              <Button
                variant="outline"
                size="sm"
                key={sample.label}
                type="button"
                onClick={() => setTestText(sample.text)}
                className="font-mono"
              >
                {sample.label}
              </Button>
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
      <div className="bg-surface-secondary rounded-row relative min-h-[140px] overflow-x-auto p-6 select-none">
        {glyphs.length === 0 ? (
          <div className="text-label-secondary text-footnote flex h-24 flex-col items-center justify-center text-center italic">
            <span>Add glyphs above to begin rendering constructed language text.</span>
          </div>
        ) : testText.trim().length === 0 ? (
          <div className="text-label-secondary text-footnote flex h-24 items-center justify-center italic">
            Enter words or phrases above to preview script typography.
          </div>
        ) : (
          <div
            className={cn(
              "flex flex-wrap items-center transition-[color,background-color,border-color,box-shadow,opacity,transform]",
              direction === "rtl" && "flex-row-reverse",
              direction === "ttb" && "max-h-[320px] flex-col items-start overflow-y-auto"
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
                      "border-separator bg-fill-4 hover:border-tint/50 hover:bg-tint/10 group rounded-row relative flex shrink-0 cursor-pointer items-center justify-center border transition-colors",
                      selectedToken?.id === tok.id && "border-tint ring-tint/30 bg-tint/15 ring-2"
                    )}
                    style={{
                      width: glyphSize,
                      height: glyphSize,
                    }}
                  >
                    <svg
                      viewBox="0 0 128 128"
                      className="stroke-separator group-hover:stroke-tint drop-shadow-2xs h-full w-full fill-none transition-colors"
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
                  className="border-separator hover:border-tint/60 hover:bg-tint/10 text-label-secondary hover:text-tint rounded-row text-footnote flex shrink-0 cursor-pointer items-center justify-center border border-dashed font-mono font-semibold transition-[color,background-color,border-color,box-shadow,opacity]"
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
          <span className="text-label-secondary text-eyebrow">
            Phonetic Token Stream ({tokens.filter((t) => !t.isSpace && !t.isNewline).length} tokens)
          </span>
          <span className="text-label-secondary text-caption">
            Click unmapped tokens to design instant glyphs
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          {tokens.map((tok) => {
            if (tok.isSpace || tok.isNewline) return null;
            return (
              <Button
                key={`chip-${tok.id}`}
                variant="secondary"
                size="sm"
                onClick={() => {
                  setSelectedToken(tok);
                  if (tok.glyph && onSelectGlyphToEdit) {
                    onSelectGlyphToEdit(tok.glyph);
                  } else if (!tok.glyph && onForgeMissing) {
                    onForgeMissing(tok.charOrPhoneme);
                  }
                }}
                className={cn(
                  "gap-2 font-mono",
                  !tok.glyph && "border-tint/40 bg-tint/5 border border-dashed"
                )}
              >
                <span>{tok.charOrPhoneme}</span>
                <span className="text-caption opacity-70">{tok.glyph ? "✓" : "+ Add"}</span>
              </Button>
            );
          })}
        </div>
      </div>

      {/* Typesetting Sliders with Tactile Numerical Badges */}
      <div className="bg-surface-secondary rounded-row grid grid-cols-2 gap-3 p-4 sm:grid-cols-4">
        {/* Glyph Size Slider */}
        <div className="space-y-2">
          <div className="text-caption flex items-center justify-between">
            <span className="text-label-secondary font-medium">Glyph Size</span>
            <span className="text-label bg-fill-3 py-0.2 rounded-control-sm px-1 font-mono font-semibold">
              {glyphSize}px
            </span>
          </div>
          <Slider
            min={24}
            max={96}
            step={2}
            value={[Number(glyphSize)]}
            onValueChange={([v = 24]) => onGlyphSizeChange(v)}
          />
        </div>

        {/* Letter Spacing Slider */}
        <div className="space-y-2">
          <div className="text-caption flex items-center justify-between">
            <span className="text-label-secondary font-medium">Tracking</span>
            <span className="text-label bg-fill-3 py-0.2 rounded-control-sm px-1 font-mono font-semibold">
              {letterSpacing}px
            </span>
          </div>
          <Slider
            min={-4}
            max={24}
            step={1}
            value={[Number(letterSpacing)]}
            onValueChange={([v = -4]) => setLetterSpacing(v)}
          />
        </div>

        {/* Word Spacing Slider */}
        <div className="space-y-2">
          <div className="text-caption flex items-center justify-between">
            <span className="text-label-secondary font-medium">Word Gap</span>
            <span className="text-label bg-fill-3 py-0.2 rounded-control-sm px-1 font-mono font-semibold">
              {wordSpacing}px
            </span>
          </div>
          <Slider
            min={4}
            max={36}
            step={2}
            value={[Number(wordSpacing)]}
            onValueChange={([v = 4]) => setWordSpacing(v)}
          />
        </div>

        {/* Baseline Shift Slider */}
        <div className="space-y-2">
          <div className="text-caption flex items-center justify-between">
            <span className="text-label-secondary font-medium">Baseline Shift</span>
            <span className="text-label bg-fill-3 py-0.2 rounded-control-sm px-1 font-mono font-semibold">
              {baselineOffset > 0 ? `+${baselineOffset}` : baselineOffset}px
            </span>
          </div>
          <Slider
            min={-20}
            max={20}
            step={1}
            value={[Number(baselineOffset)]}
            onValueChange={([v = -20]) => onBaselineOffsetChange(v)}
          />
        </div>
      </div>
    </Card>
  );
}
