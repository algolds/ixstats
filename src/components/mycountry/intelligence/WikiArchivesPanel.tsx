"use client";

/**
 * WikiArchivesPanel — Surfaces wiki article sections as intelligence reports.
 *
 * This is where wiki lore becomes actionable context for the Intelligence section.
 * Pulls the country's wiki article sections, classifies them by type (History,
 * Economy, Military, etc.), and displays them as expandable intelligence reports.
 */

import { memo, useState } from "react";
import Link from "next/link";
import { titleToWikiOSPath } from "~/lib/wiki-os/transformers/url-compat";
import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Clock,
  Shield,
  Landmark,
  Globe2,
  Scroll,
  Users,
  Loader2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { api } from "~/trpc/react";

interface WikiArchivesPanelProps {
  countryId: string;
  countryName: string;
}

// Section type classification based on heading keywords
const SECTION_TYPES: Array<{ pattern: RegExp; label: string; icon: LucideIcon; color: string }> = [
  {
    pattern: /^history|^early|^medieval|^modern|^ancient|^prehistory|^contemporary|^classical/i,
    label: "History",
    icon: Clock,
    color: "text-amber-600",
  },
  {
    pattern: /^military|^army|^navy|^defense|^armed/i,
    label: "Military",
    icon: Shield,
    color: "text-red-600",
  },
  {
    pattern: /^government|^politics|^executive|^legislature|^judicial|^constitution/i,
    label: "Government",
    icon: Landmark,
    color: "text-indigo-600",
  },
  {
    pattern: /^economy|^trade|^industry|^agriculture|^energy|^currency|^labor/i,
    label: "Economy",
    icon: Globe2,
    color: "text-emerald-600",
  },
  {
    pattern: /^culture|^cuisine|^music|^art|^sport|^education|^language|^religion|^ethnic/i,
    label: "Culture",
    icon: Scroll,
    color: "text-purple-600",
  },
  {
    pattern: /^demograph|^population|^society|^social|^health/i,
    label: "Society",
    icon: Users,
    color: "text-blue-600",
  },
  {
    pattern: /^geography|^climate|^environment|^natural|^transport/i,
    label: "Geography",
    icon: Globe2,
    color: "text-teal-600",
  },
];

function classifySection(title: string): { label: string; icon: LucideIcon; color: string } {
  for (const type of SECTION_TYPES) {
    if (type.pattern.test(title)) return type;
  }
  return { label: "General", icon: BookOpen, color: "text-gray-500" };
}

// ─── Section Card (expandable) ───────────────────────────────────────────────

function SectionCard({
  title,
  level,
  countryName,
}: {
  title: string;
  level: number;
  countryName: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [contentLoaded, setContentLoaded] = useState(false);
  const { label, icon: Icon, color } = classifySection(title);

  // Lazy-load section content only when expanded
  const { data: sectionContent, isLoading: contentLoading } =
    api.wikios.getSectionContent.useQuery(
      { title: countryName, section: title, source: "ixwiki" },
      { enabled: expanded && !contentLoaded, staleTime: 10 * 60_000 }
    );

  // Mark content as loaded once fetched
  if (sectionContent && !contentLoaded) {
    setContentLoaded(true);
  }

  const isSubsection = level > 2;

  return (
    <div
      className={`border-border/30 bg-card/50 hover:bg-card/80 rounded-lg border transition-colors ${isSubsection ? "ml-4" : ""}`}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left"
      >
        <Icon className={`h-4 w-4 shrink-0 ${color}`} />
        <div className="min-w-0 flex-1">
          <span className="text-foreground text-xs font-medium">{title}</span>
          <span className={`ml-2 text-[9px] font-medium tracking-wider uppercase ${color}`}>
            {label}
          </span>
        </div>
        {expanded ? (
          <ChevronDown className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
        ) : (
          <ChevronRight className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
        )}
      </button>

      {expanded && (
        <div className="border-border/20 border-t px-3 py-2.5">
          {contentLoading ? (
            <div className="flex items-center gap-2 py-2">
              <Loader2 className="text-muted-foreground h-3 w-3 animate-spin" />
              <span className="text-muted-foreground text-[10px]">Loading section content...</span>
            </div>
          ) : sectionContent?.content ? (
            <div className="space-y-2">
              <p className="text-foreground/70 line-clamp-8 text-[11px] leading-relaxed whitespace-pre-wrap">
                {/* Strip wiki markup for display */}
                {sectionContent.content
                  .replace(/\[\[([^|\]]+\|)?([^\]]+)\]\]/g, "$2") // [[Link|text]] → text
                  .replace(/'{2,3}/g, "") // bold/italic markup
                  .replace(/\{\{[^}]+\}\}/g, "") // templates
                  .replace(/<[^>]+>/g, "") // HTML tags
                  .replace(/\n{3,}/g, "\n\n") // collapse newlines
                  .trim()
                  .slice(0, 1000)}
                {(sectionContent.content?.length ?? 0) > 1000 ? "..." : ""}
              </p>
              <Link
                href={`${titleToWikiOSPath(countryName)}#${encodeURIComponent(title.replace(/ /g, "_"))}`}
                className="inline-flex items-center gap-1 text-[10px] font-medium text-blue-600 hover:underline"
              >
                Read full section on IxWiki <ExternalLink className="h-2.5 w-2.5" />
              </Link>
            </div>
          ) : (
            <p className="text-muted-foreground text-[10px]">
              No content available for this section.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Panel ──────────────────────────────────────────────────────────────

export const WikiArchivesPanel = memo(function WikiArchivesPanel({
  countryId,
  countryName,
}: WikiArchivesPanelProps) {
  const [filter, setFilter] = useState<string | null>(null);

  // Fetch wiki sections
  const { data: sections, isLoading } = api.countries.getWikiSections.useQuery(
    { countryName },
    { staleTime: 10 * 60_000, enabled: !!countryName }
  );

  const wikiUrl = titleToWikiOSPath(countryName);

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="bg-muted h-5 w-5 animate-pulse rounded" />
          <div className="bg-muted h-4 w-40 animate-pulse rounded" />
        </div>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-muted h-12 animate-pulse rounded-lg" />
        ))}
      </div>
    );
  }

  if (!sections || !Array.isArray(sections) || sections.length === 0) {
    return (
      <div className="border-border/50 rounded-xl border border-dashed p-6 text-center">
        <BookOpen className="text-muted-foreground/40 mx-auto h-8 w-8" />
        <p className="text-muted-foreground mt-2 text-sm font-medium">No Wiki Archives</p>
        <p className="text-muted-foreground/70 mt-1 text-xs">
          This country doesn&apos;t have a linked IxWiki article yet.
        </p>
        <Link
          href={titleToWikiOSPath(countryName)}
          className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline"
        >
          Create article in WikiOS <ExternalLink className="h-3 w-3" />
        </Link>
      </div>
    );
  }

  // Classify and optionally filter sections
  const classified = sections.map((s) => {
    const title = (s as any).line ?? (s as any).title ?? "";
    return {
      ...s,
      title,
      type: classifySection(title),
    };
  });

  const filtered = filter ? classified.filter((s) => s.type.label === filter) : classified;

  // Get unique type labels for filter buttons
  const typeLabels = [...new Set(classified.map((s) => s.type.label))];

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-blue-600" />
          <h3 className="text-foreground text-sm font-semibold">Wiki Archives</h3>
          <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-[9px] font-bold text-blue-600 dark:bg-blue-900/30">
            {sections.length} sections
          </span>
        </div>
        <Link
          href={wikiUrl}
          className="flex items-center gap-1 text-[10px] font-medium text-blue-600 hover:underline"
        >
          Full article <ExternalLink className="h-2.5 w-2.5" />
        </Link>
      </div>

      {/* Type filter chips */}
      <div className="flex flex-wrap gap-1">
        <button
          onClick={() => setFilter(null)}
          className={`rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors ${
            filter === null
              ? "bg-blue-100 text-blue-600 dark:bg-blue-900/30"
              : "bg-muted text-muted-foreground hover:text-foreground"
          }`}
        >
          All
        </button>
        {typeLabels.map((label) => (
          <button
            key={label}
            onClick={() => setFilter(filter === label ? null : label)}
            className={`rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors ${
              filter === label
                ? "bg-blue-100 text-blue-600 dark:bg-blue-900/30"
                : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            {label} ({classified.filter((s) => s.type.label === label).length})
          </button>
        ))}
      </div>

      {/* Section list */}
      <div className="space-y-1.5">
        {filtered.map((section, i) => (
          <SectionCard
            key={`${section.title}-${i}`}
            title={section.title}
            level={section.level}
            countryName={countryName}
          />
        ))}
      </div>
    </div>
  );
});
