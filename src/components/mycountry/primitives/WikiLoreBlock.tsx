"use client";

/**
 * WikiLoreBlock — Reusable collapsible wiki lore section.
 *
 * Drops into any MyCountry tab or Enhanced*Content section to show
 * contextually relevant wiki content alongside stats. Uses useWikiSectionMap
 * for automatic section matching and useWikiPreferences to respect user settings.
 */

import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  Clock,
  ExternalLink,
  Globe2,
  Landmark,
  Loader2,
  Scroll,
  Shield,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";
import { useWikiSectionMap } from "~/hooks/useWikiSectionMap";
import { useWikiPreferences } from "~/hooks/useWikiPreferences";
import { useCountryData } from "./CountryDataProvider";

// ─── Theme colors ────────────────────────────────────────────────────

const THEME_COLORS: Record<string, { border: string; icon: string; iconBg: string; link: string }> = {
  emerald: { border: "border-emerald-200/30 dark:border-emerald-800/20", icon: "text-emerald-600 dark:text-emerald-400", iconBg: "bg-emerald-100 dark:bg-emerald-900/30", link: "text-emerald-600 dark:text-emerald-400" },
  blue: { border: "border-blue-200/30 dark:border-blue-800/20", icon: "text-blue-600 dark:text-blue-400", iconBg: "bg-blue-100 dark:bg-blue-900/30", link: "text-blue-600 dark:text-blue-400" },
  amber: { border: "border-amber-200/30 dark:border-amber-800/20", icon: "text-amber-600 dark:text-amber-400", iconBg: "bg-amber-100 dark:bg-amber-900/30", link: "text-amber-600 dark:text-amber-400" },
  red: { border: "border-red-200/30 dark:border-red-800/20", icon: "text-red-600 dark:text-red-400", iconBg: "bg-red-100 dark:bg-red-900/30", link: "text-red-600 dark:text-red-400" },
  purple: { border: "border-purple-200/30 dark:border-purple-800/20", icon: "text-purple-600 dark:text-purple-400", iconBg: "bg-purple-100 dark:bg-purple-900/30", link: "text-purple-600 dark:text-purple-400" },
  indigo: { border: "border-indigo-200/30 dark:border-indigo-800/20", icon: "text-indigo-600 dark:text-indigo-400", iconBg: "bg-indigo-100 dark:bg-indigo-900/30", link: "text-indigo-600 dark:text-indigo-400" },
  cyan: { border: "border-cyan-200/30 dark:border-cyan-800/20", icon: "text-cyan-600 dark:text-cyan-400", iconBg: "bg-cyan-100 dark:bg-cyan-900/30", link: "text-cyan-600 dark:text-cyan-400" },
};

// ─── Wiki section classification (shared pattern from overview) ──────

const WIKI_SECTION_TYPES: Array<{ pattern: RegExp; label: string; icon: LucideIcon; color: string }> = [
  { pattern: /^history|^early|^medieval|^modern|^ancient|^prehistory|^contemporary|^classical/i, label: "History", icon: Clock, color: "text-amber-600" },
  { pattern: /^military|^army|^navy|^defense|^armed/i, label: "Military", icon: Shield, color: "text-red-600" },
  { pattern: /^government|^politics|^executive|^legislature|^judicial|^constitution/i, label: "Government", icon: Landmark, color: "text-indigo-600" },
  { pattern: /^economy|^trade|^industry|^agriculture|^energy|^currency|^labor/i, label: "Economy", icon: Globe2, color: "text-emerald-600" },
  { pattern: /^culture|^cuisine|^music|^art|^sport|^education|^language|^religion|^ethnic/i, label: "Culture", icon: Scroll, color: "text-purple-600" },
  { pattern: /^demograph|^population|^society|^social|^health/i, label: "Society", icon: Users, color: "text-blue-600" },
  { pattern: /^geography|^climate|^environment|^natural|^transport/i, label: "Geography", icon: Globe2, color: "text-teal-600" },
];

function classifyWikiSection(title: string): { label: string; icon: LucideIcon; color: string } {
  for (const type of WIKI_SECTION_TYPES) {
    if (type.pattern.test(title)) return type;
  }
  return { label: "General", icon: BookOpen, color: "text-muted-foreground" };
}

// ─── WikiSectionRow (expandable, with lazy content loading) ──────────

function WikiSectionRow({ title, countryName, wikiUrl }: { title: string; countryName: string; wikiUrl: string }) {
  const [expanded, setExpanded] = useState(false);
  const { label, icon: Icon, color } = classifyWikiSection(title);

  const { data: sectionContent, isLoading: contentLoading } = api.wiki.getSectionContent.useQuery(
    { title: countryName, section: title, source: "ixwiki" },
    { enabled: expanded, staleTime: 10 * 60_000 }
  );

  const rawContent = sectionContent
    ? (typeof sectionContent === "object" && "content" in sectionContent
        ? (sectionContent as { content: string }).content
        : String(sectionContent))
    : null;
  const cleanContent = rawContent
    ? rawContent
        .replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, "$1")
        .replace(/\{\{[^}]*\}\}/g, "")
        .replace(/<[^>]*>/g, "")
        .replace(/'{2,3}/g, "")
        .trim()
        .slice(0, 600)
    : null;

  return (
    <div className="rounded-lg bg-white/30 dark:bg-white/[0.03] transition-colors hover:bg-white/50 dark:hover:bg-white/[0.06]">
      <button onClick={() => setExpanded(!expanded)} className="flex w-full items-center gap-2.5 px-3 py-2 text-left">
        <Icon className={cn("h-3.5 w-3.5 flex-shrink-0", color)} />
        <span className="flex-1 text-xs font-medium text-foreground">{title}</span>
        <span className={cn("text-[9px] font-medium uppercase tracking-wider", color)}>{label}</span>
        {expanded ? <ChevronDown className="h-3 w-3 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 text-muted-foreground" />}
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-2.5">
              {contentLoading && (
                <div className="flex items-center gap-2 py-2">
                  <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                  <span className="text-[10px] text-muted-foreground">Loading...</span>
                </div>
              )}
              {cleanContent && (
                <p className="text-[11px] leading-relaxed text-foreground/70">
                  {cleanContent}{cleanContent.length >= 600 ? "..." : ""}
                </p>
              )}
              {!contentLoading && !cleanContent && (
                <p className="py-1 text-[10px] italic text-muted-foreground">No content available.</p>
              )}
              <a
                href={`${wikiUrl}#${encodeURIComponent(title.replace(/ /g, "_"))}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-flex items-center gap-1 text-[10px] text-purple-500 hover:underline"
              >
                Read more <ExternalLink className="h-2.5 w-2.5" />
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────

interface WikiLoreBlockProps {
  /** Tab/section context for auto-matching (e.g., "economy", "defense") */
  context: string;
  /** Theme accent color */
  themeColor?: keyof typeof THEME_COLORS;
  /** Title for the block */
  title?: string;
  /** Whether to start expanded */
  defaultOpen?: boolean;
  /** Max sections to show */
  maxSections?: number;
}

export const WikiLoreBlock = React.memo(function WikiLoreBlock({
  context,
  themeColor = "purple",
  title = "Wiki Lore",
  defaultOpen = false,
  maxSections = 10,
}: WikiLoreBlockProps) {
  const { country } = useCountryData();
  const { autoScan, displayMode } = useWikiPreferences();
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const { sections, isLoading, wikiUrl, sectionCount } = useWikiSectionMap(
    country?.name,
    context
  );

  const colors = THEME_COLORS[themeColor] ?? THEME_COLORS.purple;

  // Respect user preferences
  if (!autoScan || displayMode === "hidden") return null;

  // Nothing to show
  if (!isLoading && sectionCount === 0) return null;

  const visibleSections = sections.slice(0, maxSections);

  return (
    <div className={cn("rounded-xl border", colors.border, "mt-4")}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center gap-2 px-4 py-3 text-left"
      >
        <div className={cn("flex h-6 w-6 items-center justify-center rounded-lg", colors.iconBg)}>
          <BookOpen className={cn("h-3.5 w-3.5", colors.icon)} />
        </div>
        <span className="text-xs font-semibold text-foreground">{title}</span>
        {!isLoading && (
          <span className="text-[10px] text-muted-foreground">{sectionCount} section{sectionCount !== 1 ? "s" : ""}</span>
        )}
        {wikiUrl && (
          <a
            href={wikiUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={cn("ml-auto mr-1 flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-medium hover:opacity-80", colors.link)}
            onClick={(e) => e.stopPropagation()}
            style={{ background: "currentColor", color: "transparent" }}
          >
            <span className={colors.link}>Wiki</span>
            <ExternalLink className={cn("h-2.5 w-2.5", colors.link)} />
          </a>
        )}
        <ChevronDown className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform flex-shrink-0", !isOpen && "-rotate-90")} />
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-3 space-y-1">
              {isLoading ? (
                <div className="flex items-center gap-2 py-3">
                  <Loader2 className={cn("h-3.5 w-3.5 animate-spin", colors.icon)} />
                  <span className="text-xs text-muted-foreground">Loading wiki sections...</span>
                </div>
              ) : (
                <>
                  {visibleSections.map((section) => (
                    <WikiSectionRow
                      key={section.key}
                      title={section.title}
                      countryName={country?.name ?? ""}
                      wikiUrl={wikiUrl}
                    />
                  ))}
                  {sectionCount > maxSections && (
                    <p className="text-center text-[10px] text-muted-foreground py-1">
                      +{sectionCount - maxSections} more sections
                    </p>
                  )}
                  <a
                    href={wikiUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn("mt-1 flex items-center justify-center gap-1 text-xs font-medium hover:underline", colors.link)}
                  >
                    Read full article on IxWiki <ExternalLink className="h-3 w-3" />
                  </a>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});
