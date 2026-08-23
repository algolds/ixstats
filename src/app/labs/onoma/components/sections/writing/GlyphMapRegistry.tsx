// src/app/labs/onoma/components/sections/writing/GlyphMapRegistry.tsx
// Onoma Lab — Glyph Map Registry & Conlang Font Catalog
// Philosophy: Apple SF Symbols × Emil Design Engineering

import React, { useState } from "react";
import { Type, Trash as Trash2, Search, BookStack as Library, Copy, Check } from "iconoir-react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { FacetMaterial } from "~/components/ui/facet";
import { cn } from "~/lib/utils";
import type { Glyph } from "./types";
import { STARTER_SCRIPT_PACKS, type StarterScriptPack } from "./glyph-primitives";

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
    <FacetMaterial
      material="satin"
      className="border-border/30 flex h-full flex-col space-y-3 rounded-2xl border p-4 shadow-sm"
    >
      {/* Header Bar with Search & Starter Pack Button (Single line, aligned with Canvas header) */}
      <div className="flex items-center justify-between gap-2 border-b border-border/40 pb-2.5">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-secondary/40 text-foreground">
            <Type className="h-3.5 w-3.5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h4 className="text-foreground text-xs font-semibold tracking-tight">
                Glyph Registry
              </h4>
              {glyphs.length > 0 && (
                <span className="text-muted-foreground bg-secondary/50 rounded-full px-1.5 py-0.2 text-[9px] font-mono">
                  {glyphs.length}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Starter Packs Drawer Toggle */}
        <button
          type="button"
          onClick={() => setShowPackDrawer(!showPackDrawer)}
          className={cn(
            "flex h-6.5 items-center gap-1 rounded-lg border px-2 text-[10px] font-medium transition-all cursor-pointer active:scale-95 shrink-0",
            showPackDrawer
              ? "border-onoma-primary/40 bg-onoma-primary/10 text-onoma-primary"
              : "border-border/40 bg-secondary/20 text-muted-foreground hover:text-foreground"
          )}
        >
          <Library className="h-3 w-3" />
          <span>Starter Packs</span>
        </button>
      </div>

      {/* Starter Packs Dropdown Drawer */}
      <AnimatePresence>
        {showPackDrawer && (
          <motion.div
            initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
            className="border-border/30 bg-secondary/15 overflow-hidden rounded-xl border p-3"
          >
            <div className="mb-2 flex items-center justify-between">
              <span className="text-muted-foreground text-[9px] font-semibold uppercase tracking-wider">
                Preset Script Packs
              </span>
              <button
                type="button"
                onClick={() => setShowPackDrawer(false)}
                className="text-muted-foreground hover:text-foreground text-[9px]"
              >
                Close
              </button>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {STARTER_SCRIPT_PACKS.map((pack) => (
                <button
                  key={pack.id}
                  type="button"
                  onClick={() => {
                    onLoadStarterPack(pack);
                    setShowPackDrawer(false);
                  }}
                  className="border-border/30 bg-background/60 hover:border-onoma-primary/40 hover:bg-onoma-primary/5 flex flex-col rounded-xl border p-2.5 text-left transition-all cursor-pointer active:scale-[0.97]"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-foreground text-xs font-bold">{pack.name}</span>
                    <span className="text-muted-foreground bg-secondary/40 rounded px-1.5 py-0.5 text-[9px] font-mono">
                      {pack.glyphs.length} glyphs
                    </span>
                  </div>
                  <p className="text-muted-foreground mt-1 line-clamp-2 text-[10px]">
                    {pack.description}
                  </p>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Search Filter */}
      {glyphs.length > 0 && (
        <div className="relative">
          <Search className="text-muted-foreground absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search glyphs by phoneme..."
            className="bg-background/80 border-border/40 text-foreground placeholder:text-muted-foreground/50 focus:border-onoma-primary/50 focus:ring-2 focus:ring-onoma-primary/15 h-8 w-full rounded-xl border pr-3 pl-8 text-xs transition-all outline-none"
          />
        </div>
      )}

      {/* Glyph Grid or Clean Empty State */}
      {glyphs.length === 0 ? (
        <div className="border-border/20 bg-secondary/5 flex flex-1 flex-col items-center justify-center rounded-2xl border border-dashed p-8 text-center min-h-[220px]">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-secondary/30 text-muted-foreground mb-2 shadow-2xs">
            <Type className="h-5 w-5 opacity-40" />
          </div>
          <p className="text-foreground text-xs font-semibold">No glyphs mapped yet</p>
          <p className="text-muted-foreground mt-1 max-w-[220px] text-[11px]">
            Draw vector strokes on the canvas or load a starter pack above.
          </p>
        </div>
      ) : filteredGlyphs.length === 0 ? (
        <div className="text-muted-foreground flex flex-1 items-center justify-center text-xs italic min-h-[180px]">
          No glyphs match &quot;{searchTerm}&quot;
        </div>
      ) : (
        <div className="grid max-h-[320px] flex-1 grid-cols-3 gap-2 overflow-y-auto pr-1 sm:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4 scrollbar-thin">
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
                    "border-border/30 bg-secondary/15 hover:bg-secondary/25 hover:border-onoma-primary/40 group relative flex flex-col items-center justify-between rounded-xl border p-2.5 transition-all select-none",
                    isSelected && "border-onoma-primary/60 bg-onoma-primary/10 shadow-xs"
                  )}
                >
                  {/* Action Bar (Top Right Hover) */}
                  <div className="absolute top-1.5 right-1.5 flex items-center gap-1 opacity-0 transition-all duration-150 group-hover:opacity-100">
                    <button
                      type="button"
                      onClick={() => handleCopySvg(g)}
                      title="Copy SVG markup"
                      className="hover:bg-secondary/60 text-muted-foreground hover:text-foreground rounded p-1 transition-colors cursor-pointer active:scale-90"
                    >
                      {isCopied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => onRemoveGlyph(g.id)}
                      title="Delete glyph"
                      className="text-muted-foreground hover:bg-red-500/10 hover:text-red-400 rounded p-1 transition-colors cursor-pointer active:scale-90"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>

                  {/* SVG Vector Render */}
                  <div
                    onClick={() => onEditGlyph(g)}
                    title={`Click to edit ⟨${g.phoneme}⟩ in Designer`}
                    className="flex h-12 w-12 cursor-pointer items-center justify-center p-1 transition-transform active:scale-95"
                  >
                    <svg
                      viewBox="0 0 128 128"
                      className="stroke-foreground h-full w-full fill-none drop-shadow-2xs"
                      style={{
                        strokeWidth: 6,
                        strokeLinecap: "round",
                        strokeLinejoin: "round",
                      }}
                    >
                      <path d={g.svgPath} />
                    </svg>
                  </div>

                  {/* Metadata Tag */}
                  <div
                    onClick={() => onEditGlyph(g)}
                    className="mt-1.5 flex w-full cursor-pointer items-center justify-between gap-1"
                  >
                    <span className="text-foreground bg-secondary/40 flex-1 truncate rounded px-1.5 py-0.5 text-center font-mono text-[10px] font-bold">
                      {g.phoneme}
                    </span>
                    {g.unicode && (
                      <span className="text-muted-foreground bg-background/60 rounded px-1 py-0.5 font-mono text-[9px]">
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
    </FacetMaterial>
  );
}
