"use client";
// src/app/labs/onoma/components/nav/OnomaFooter.tsx
// ⟨ONOMA⟩ footer: an opaque FacetCard with a corner symbol watermark, sitemap and legal links.

import React from "react";
import Link from "next/link";
import { ArrowUp } from "iconoir-react";
import { OnomaBrandLogo } from "../shared/OnomaBrandLogo";
import { OnomaGlyph } from "../glyphs/OnomaGlyph";
import type { OnomaSection, StudioSubTab, ExploreSubTab } from "~/lib/onoma/types";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { FacetCard } from "~/components/ui/facet-container";

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
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const SITEMAP_PAGES = [
    {
      id: "generator",
      label: "Quick generator",
      glyph: "emerge-synthesis" as const,
      isPro: false,
      onClick: () => onNavigate("overview"),
    },
    {
      id: "packs",
      label: "Language packs",
      glyph: "compose-morphology" as const,
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
      isPro: false,
      onClick: () => {
        if (onNavigateExplore) onNavigateExplore("phonology");
        else onNavigate("explore");
      },
    },
    {
      id: "studio",
      label: "Language studio",
      glyph: "emerge-branch" as const,
      isPro: true,
      onClick: () => {
        if (onNavigateStudio) onNavigateStudio("workshop");
        else onNavigate("studio");
      },
    },
  ];

  return (
    <footer>
      <FacetCard padding="lg" className="relative space-y-5 overflow-hidden">
        {/* Identity watermark: a small corner Onoma symbol behind the content (no image wash). */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-10 -bottom-12 size-56 opacity-[0.06] select-none print:hidden"
        >
          <OnomaBrandLogo
            variant="symbol"
            size="xl"
            tone="default"
            className="text-tint h-full w-full object-contain"
          />
        </div>

        {/* Lockup and manifesto */}
        <div className="border-separator relative flex flex-col justify-between gap-4 border-b pb-4 lg:flex-row lg:items-center">
          <div className="max-w-2xl space-y-2">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                onClick={() => {
                  onNavigate("overview");
                  scrollToTop();
                }}
                className="group/brand h-auto gap-2 px-1 py-1 hover:bg-transparent"
                title="Onoma — Overview"
                aria-label="Onoma overview"
              >
                <OnomaBrandLogo
                  variant="wordmark"
                  className="text-label group-hover/brand:text-tint h-7 w-auto transition-colors"
                />
              </Button>
              <span className="text-label-secondary text-footnote font-mono">/ˈɒnəmə/</span>
            </div>

            <div className="space-y-1">
              <p className="text-headline text-label">
                Linguistic engine <span className="text-label-tertiary font-normal">·</span>{" "}
                <span className="text-label-secondary font-normal">
                  Build the language behind your world.
                </span>
              </p>
              <p className="text-callout text-label-secondary max-w-xl">
                A deterministic linguistic engine for worldbuilders, conlangers, and novelists.
                Model phonology, diachronic sound shifts, syntax trees, and morphology.
              </p>
            </div>
          </div>

          <Button
            variant="secondary"
            size="sm"
            onClick={scrollToTop}
            title="Scroll back to top"
            className="self-start lg:self-auto"
          >
            <ArrowUp />
            <span>Top</span>
          </Button>
        </div>

        {/* Sitemap */}
        <nav aria-label="Onoma" className="relative flex flex-wrap items-center gap-2">
          {SITEMAP_PAGES.map((page) => (
            <Button
              key={page.id}
              variant="secondary"
              size="sm"
              onClick={() => {
                page.onClick();
                scrollToTop();
              }}
            >
              <OnomaGlyph name={page.glyph} size="xs" />
              <span>{page.label}</span>
              {page.isPro && <Badge variant="caution">Premium</Badge>}
            </Button>
          ))}
        </nav>

        {/* Copyright, attribution and legal */}
        <div className="border-separator text-label-secondary text-footnote relative flex flex-col justify-between gap-2 border-t pt-4 sm:flex-row sm:items-center">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-label font-mono font-semibold">⟨ONOMA⟩</span>
            <span aria-hidden="true">·</span>
            <span>© {new Date().getFullYear()} IxLabs Research</span>
            <span className="text-label-tertiary" aria-hidden="true">
              ·
            </span>
            <span className="text-label-secondary">
              Originally forked from and inspired by{" "}
              <a
                href="https://github.com/alxgiraud/fantasygen"
                target="_blank"
                rel="noopener noreferrer"
                className="text-tint underline-offset-2 hover:underline"
              >
                fantasygen
              </a>
            </span>
          </div>

          <div className="flex items-center gap-4">
            <Link href="/privacy" className="hover:text-label underline-offset-4 hover:underline">
              Privacy policy
            </Link>
            <span className="text-label-tertiary" aria-hidden="true">
              ·
            </span>
            <Link href="/terms" className="hover:text-label underline-offset-4 hover:underline">
              Terms of service
            </Link>
          </div>
        </div>
      </FacetCard>
    </footer>
  );
}

export default OnomaFooter;
