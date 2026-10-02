// src/app/labs/onoma/components/sections/writing/GlyphMapRegistry.tsx
// Onoma Lab — Glyph Map Registry & Conlang Font Catalog
// Philosophy: Apple SF Symbols × Emil Design Engineering

import React, { useState } from "react";
import { Type, Trash as Trash2, Search, BookStack as Library, Copy, Check } from "iconoir-react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { cn } from "~/lib/utils";
import type { Glyph } from "./types";
import { STARTER_SCRIPT_PACKS, type StarterScriptPack } from "./glyph-primitives";
import { Input } from "~/components/ui/input";
import { FacetCard } from "~/components/ui/facet-container";
import { Button } from "~/components/ui/button";
import { Toggle } from "~/components/ui/toggle";

interface GlyphMapRegistryProps {
  glyphs: Glyph[];
  onEditGlyph: (glyph: Glyph) => void;
  onRemoveGlyph: (id: string) => void;
  onLoadStarterPack: (pack: StarterScriptPack) => void;
  selectedGlyphId?: string | null;
}

export function GlyphMapRegistry({
  glyphs,
  onEditGlyph,
  onRemoveGlyph,
  onLoadStarterPack,
  selectedGlyphId,
}: GlyphMapRegistryProps) {
  const shouldReduceMotion = useReducedMotion();
  const [searchTerm, setSearchTerm] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showPackDrawer, setShowPackDrawer] = useState(false);

  // Filter glyphs based on search term
  const filteredGlyphs = glyphs.filter((g) => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return true;
    return (
      g.phoneme.toLowerCase().includes(term) ||
      (g.unicode && g.unicode.toLowerCase().includes(term))
    );
  });

  const handleCopySvg = async (glyph: Glyph) => {
    try {
      const svgString = `<svg viewBox="0 0 128 128" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"><path d="${glyph.svgPath}" /></svg>`;
      await navigator.clipboard.writeText(svgString);
      setCopiedId(glyph.id);
      setTimeout(() => setCopiedId(null), 1800);
    } catch (err) {
      console.error("Failed to copy SVG:", err);
    }
  };

  return (
    <FacetCard variant="inset" padding="none" className="flex h-full flex-col space-y-3 p-4">
      {/* Header Bar with Search & Starter Pack Button (Single line, aligned with Canvas header) */}
      <div className="border-separator flex items-center justify-between gap-2 border-b pb-2">
        <div className="flex items-center gap-2">
          <div className="bg-fill-3 text-label rounded-control flex h-6 w-6 items-center justify-center">
            <Type className="h-3.5 w-3.5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-label text-footnote font-semibold">Glyph Registry</h4>
              {glyphs.length > 0 && (
                <span className="text-label-secondary bg-fill-3 py-0.2 text-caption rounded-full px-2 font-mono">
                  {glyphs.length}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Starter Packs Drawer Toggle */}
        <Toggle
          variant="outline"
          size="sm"
          pressed={showPackDrawer}
          onPressedChange={setShowPackDrawer}
          className="text-caption shrink-0 gap-1"
        >
          <Library className="h-3 w-3" />
          <span>Starter Packs</span>
        </Toggle>
      </div>

      {/* Starter Packs Dropdown Drawer */}
      <AnimatePresence>
        {showPackDrawer && (
          <motion.div
            initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
            className="border-separator bg-fill-4 rounded-row overflow-hidden border p-3"
          >
            <div className="mb-2 flex items-center justify-between">
              <span className="text-label-secondary text-eyebrow">Preset Script Packs</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowPackDrawer(false)}
                className="text-label-secondary hover:text-label text-label-secondary hover:text-label"
              >
                Close
              </Button>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {STARTER_SCRIPT_PACKS.map((pack) => (
                <Button
                  key={pack.id}
                  variant="outline"
                  onClick={() => {
                    onLoadStarterPack(pack);
                    setShowPackDrawer(false);
                  }}
                  className="rounded-row hover:border-tint/40 hover:bg-tint/5 h-auto flex-col items-stretch gap-0 p-3 text-left font-normal whitespace-normal"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-label text-footnote font-semibold">{pack.name}</span>
                    <span className="text-label-secondary bg-fill-3 rounded-control-sm text-caption px-2 py-0.5 font-mono">
                      {pack.glyphs.length} glyphs
                    </span>
                  </div>
                  <p className="text-label-secondary text-caption mt-1 line-clamp-2">
                    {pack.description}
                  </p>
                </Button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Search Filter */}
      {glyphs.length > 0 && (
        <div className="relative">
          <Search className="text-label-secondary absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2" />
          <Input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search glyphs by phoneme..."
            className="text-footnote h-8 w-full pr-3 pl-8"
          />
        </div>
      )}

      {/* Glyph Grid or Clean Empty State */}
      {glyphs.length === 0 ? (
        <div className="border-separator bg-fill-4 rounded-card flex min-h-[220px] flex-1 flex-col items-center justify-center border border-dashed p-8 text-center">
          <div className="bg-fill-3 text-label-secondary rounded-card shadow-card mb-2 flex h-10 w-10 items-center justify-center">
            <Type className="h-5 w-5 opacity-40" />
          </div>
          <p className="text-label text-footnote font-semibold">No glyphs mapped yet</p>
          <p className="text-label-secondary text-caption mt-1 max-w-[220px]">
            Draw vector strokes on the canvas or load a starter pack above.
          </p>
        </div>
      ) : filteredGlyphs.length === 0 ? (
        <div className="text-label-secondary text-footnote flex min-h-[180px] flex-1 items-center justify-center italic">
          No glyphs match &quot;{searchTerm}&quot;
        </div>
      ) : (
        <div className="grid max-h-[320px] flex-1 scrollbar-thin grid-cols-3 gap-2 overflow-y-auto pr-1 sm:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4">
          <AnimatePresence mode="popLayout">
            {filteredGlyphs.map((g) => {
              const isSelected = selectedGlyphId === g.id;
              const isCopied = copiedId === g.id;

              return (
                <motion.div
                  key={g.id}
                  layout
                  initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
                  className={cn(
                    "border-separator bg-fill-4 hover:bg-fill-3 hover:border-tint/40 group rounded-row relative flex flex-col items-center justify-between border p-3 transition-[color,background-color,border-color,box-shadow,opacity,transform] select-none",
                    isSelected && "border-tint/60 bg-tint/10 shadow-card"
                  )}
                >
                  {/* Action Bar (Top Right Hover) */}
                  <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-150 group-hover:opacity-100">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => handleCopySvg(g)}
                      title="Copy SVG markup"
                      aria-label="Copy SVG markup"
                      className="text-label-secondary hover:text-label"
                    >
                      {isCopied ? (
                        <Check className="text-green h-3 w-3" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => onRemoveGlyph(g.id)}
                      title="Delete glyph"
                      aria-label="Delete glyph"
                      className="text-label-secondary hover:text-red hover:bg-red/10"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>

                  {/* SVG Vector Render */}
                  <Button
                    variant="ghost"
                    onClick={() => onEditGlyph(g)}
                    title={`Click to edit ⟨${g.phoneme}⟩ in Designer`}
                    aria-label={`Edit glyph ⟨${g.phoneme}⟩`}
                    className="size-12 p-1"
                  >
                    <svg
                      viewBox="0 0 128 128"
                      className="stroke-separator drop-shadow-2xs h-full w-full fill-none"
                      style={{
                        strokeWidth: 6,
                        strokeLinecap: "round",
                        strokeLinejoin: "round",
                      }}
                    >
                      <path d={g.svgPath} />
                    </svg>
                  </Button>

                  {/* Metadata Tag */}
                  <div
                    onClick={() => onEditGlyph(g)}
                    className="mt-2 flex w-full cursor-pointer items-center justify-between gap-1"
                  >
                    <span className="text-label bg-fill-3 rounded-control-sm text-caption flex-1 truncate px-2 py-0.5 text-center font-mono font-semibold">
                      {g.phoneme}
                    </span>
                    {g.unicode && (
                      <span className="text-label-secondary bg-surface rounded-control-sm text-caption px-1 py-0.5 font-mono">
                        {g.unicode}
                      </span>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </FacetCard>
  );
}
