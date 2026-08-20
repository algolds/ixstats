// src/app/labs/onoma/components/nav/OnomaFooter.tsx
// ⟨ONOMA⟩ Unified Minimalist Footer Component with Cinematic Watermark Wash
// Philosophy: Apple SF Symbols × IxStates National Flag Wash × Linguistic Notation

"use client";

import React from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowUp } from "iconoir-react";
import { OnomaBrandLogo } from "../shared/OnomaBrandLogo";
import { OnomaGlyph } from "../glyphs/OnomaGlyph";
import type { OnomaSection, StudioSubTab, ExploreSubTab } from "~/lib/onoma/types";
import { cn } from "~/lib/utils";

interface OnomaFooterProps {
  onNavigate: (section: OnomaSection) => void;
  onNavigateStudio?: (tab: StudioSubTab) => void;
  onNavigateExplore?: (tab: ExploreSubTab) => void;
  onOpenHelp?: () => void;
}

export function OnomaFooter({
  onNavigate,
  onNavigateStudio,
  onNavigateExplore,
  onOpenHelp: _onOpenHelp,
}: OnomaFooterProps) {
  const shouldReduceMotion = useReducedMotion();

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const SITEMAP_PAGES = [
    {
      id: "generator",
      label: "Quick Generator",
      glyph: "emerge-synthesis" as const,
      color: "hover:text-[#0091ff] hover:border-[#0091ff]/30 hover:bg-[#0091ff]/10",
      accent: "#0091ff",
      isPro: false,
      onClick: () => onNavigate("overview"),
    },
    {
      id: "packs",
      label: "Language Packs",
      glyph: "compose-morphology" as const,
      color: "hover:text-cyan-500 hover:border-cyan-500/30 hover:bg-cyan-500/10",
      accent: "#06b6d4",
      isPro: false,
      onClick: () => {
        if (onNavigateExplore) onNavigateExplore("packs");
        else onNavigate("explore");
      },
    },
    {
      id: "phonology",
      label: "Acoustics & IPA",
      glyph: "sound-acoustic" as const,
      color: "hover:text-violet-500 hover:border-violet-500/30 hover:bg-violet-500/10",
      accent: "#8b5cf6",
      isPro: false,
      onClick: () => {
        if (onNavigateExplore) onNavigateExplore("phonology");
        else onNavigate("explore");
      },
    },
    {
      id: "studio",
      label: "Language Studio",
      glyph: "emerge-branch" as const,
      color: "hover:text-pink-500 hover:border-pink-500/30 hover:bg-pink-500/10",
      accent: "#ec4899",
      isPro: true,
      onClick: () => {
        if (onNavigateStudio) onNavigateStudio("workshop");
        else onNavigate("studio");
      },
    },
  ];

  return (
    <footer
      className="group/footer border-border/35 bg-gradient-to-b from-secondary/10 via-secondary/20 to-secondary/35 relative space-y-5 overflow-hidden rounded-3xl border p-5 shadow-xs backdrop-blur-2xl transition-all duration-300 sm:p-7 lg:p-8"
    >
      {/* Top Ambient Subtle Hairline Glow */}
      <div className="pointer-events-none absolute -top-px inset-x-16 h-px bg-gradient-to-r from-transparent via-border/60 to-transparent" />

      {/* Cinematic Background Onoma Logo Watermark Scrim (IxStates Flag Wash Style) */}
      <div className="pointer-events-none absolute -bottom-14 -right-12 h-72 w-72 overflow-hidden opacity-[0.10] transition-all duration-700 select-none group-hover/footer:scale-105 group-hover/footer:rotate-3 group-hover/footer:opacity-[0.22] dark:opacity-[0.12] dark:group-hover/footer:opacity-[0.25]">
        <OnomaBrandLogo
          variant="symbol"
          size="xl"
          tone="default"
          className="h-full w-full object-contain text-[#0091ff]"
        />
        <div className="via-background/50 to-background absolute inset-0 bg-gradient-to-l from-transparent" />
      </div>

      {/* Top Lockup & Brand Manifesto Row */}
      <div className="relative z-10 flex flex-col justify-between gap-4 border-b border-border/35 pb-4.5 lg:flex-row lg:items-center">
        <div className="max-w-2xl space-y-1.5">
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                onNavigate("overview");
                scrollToTop();
              }}
              className="group/brand inline-flex cursor-pointer select-none items-center gap-2 transition-transform duration-150 active:scale-[0.98] focus:outline-none"
              title="⟨ONOMA⟩ — Overview"
            >
              <OnomaBrandLogo
                variant="wordmark"
                className="h-6.5 w-auto text-foreground transition-colors group-hover/brand:text-[#0091ff] sm:h-7"
              />
            </button>
            <span className="text-muted-foreground/60 font-mono text-xs">/ˈɒnəmə/</span>
          </div>

          <div className="space-y-0.5">
            <p className="text-foreground text-sm font-semibold tracking-tight">
              Linguistic Engine <span className="text-muted-foreground/50 font-normal">·</span>{" "}
              <span className="text-muted-foreground font-normal">Build the language behind your world.</span>
            </p>
            <p className="text-muted-foreground/80 max-w-xl text-xs leading-relaxed">
              A deterministic linguistic engine for worldbuilders, conlangers, and novelists. Model phonology, diachronic sound shifts, syntax trees, and morphology.
            </p>
          </div>
        </div>

        {/* Scroll To Top Button */}
        <div className="flex items-center gap-2 self-start lg:self-auto">
          <button
            onClick={scrollToTop}
            className="border-border/50 bg-background/60 text-muted-foreground hover:text-foreground hover:bg-background inline-flex cursor-pointer items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold shadow-2xs transition-all active:scale-95"
            title="Scroll back to top"
          >
            <ArrowUp className="h-3.5 w-3.5" />
            <span>Top</span>
          </button>
        </div>
      </div>

      {/* Condensed 5-Page Navigation Sitemap */}
      <div className="relative z-10 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div className="flex flex-wrap items-center gap-2">
          {SITEMAP_PAGES.map((page) => (
            <button
              key={page.id}
              onClick={() => {
                page.onClick();
                scrollToTop();
              }}
              className={cn(
                "border-border/40 bg-background/40 text-muted-foreground inline-flex cursor-pointer select-none items-center gap-2 rounded-xl border px-3 py-1.5 text-xs shadow-2xs transition-all duration-150 active:scale-95",
                page.color
              )}
            >
              <OnomaGlyph name={page.glyph} size="xs" accentColor={page.accent} />
              <span className="font-medium">{page.label}</span>
              {page.isPro && (
                <span className="border-amber-500/35 bg-gradient-to-r from-amber-500/15 via-amber-500/10 to-amber-500/5 text-amber-600 dark:text-amber-300 inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold shadow-2xs">
                  <span className="whitespace-nowrap tracking-tight">Premium</span>
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Bottom Bar: Copyright, Lineage/Attribution, Onoma Seal & Legal Policies */}
      <div className="relative z-10 border-border/30 text-muted-foreground/70 flex flex-col justify-between gap-2.5 border-t pt-3.5 text-[11px] sm:flex-row sm:items-center">
        <div className="flex flex-wrap items-center gap-2 font-mono">
          <span className="text-foreground font-bold">⟨ONOMA⟩</span>
          <span>·</span>
          <span>© {new Date().getFullYear()} IxLabs Research</span>
          <span className="text-border/60">·</span>
          <span className="font-sans text-[11px] text-muted-foreground/60">
            Originally forked from and inspired by{" "}
            <a
              href="https://github.com/alxgiraud/fantasygen"
              target="_blank"
              rel="noopener noreferrer"
              className="text-foreground/80 hover:text-[#0091ff] hover:decoration-[#0091ff] underline decoration-muted-foreground/40 underline-offset-2 transition-colors"
            >
              fantasygen
            </a>
          </span>
        </div>

        <div className="flex items-center gap-4 font-sans">
          <Link
            href="/privacy"
            className="hover:text-foreground underline-offset-4 transition-colors hover:underline"
          >
            Privacy Policy
          </Link>
          <span className="text-border/60">·</span>
          <Link
            href="/terms"
            className="hover:text-foreground underline-offset-4 transition-colors hover:underline"
          >
            Terms of Service
          </Link>
        </div>
      </div>
    </footer>
  );
}

export default OnomaFooter;
