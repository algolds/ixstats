"use client";

/**
 * WikiLoreWidget — Reusable sidebar widget that surfaces wiki articles
 * relevant to the current MyCountry section.
 *
 * Used in Executive (historical precedent), Defense (military heritage),
 * Politics (government lore), etc. Each instance searches for section-specific
 * wiki content to contextualize the live gameplay data.
 */

import { memo, useState } from "react";
import { BookOpen, ChevronDown, ExternalLink, Loader2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { api } from "~/trpc/react";

interface WikiLoreWidgetProps {
  /** Country name to search wiki for */
  countryName: string;
  /** Search queries to find relevant wiki articles (tried in order) */
  searchQueries: string[];
  /** Widget title */
  title: string;
  /** Widget icon */
  icon: LucideIcon;
  /** Theme color class (e.g. "amber", "red", "indigo") */
  themeColor: string;
  /** Maximum articles to show */
  maxResults?: number;
}

// Color mapping for dynamic Tailwind classes
const THEME_COLORS: Record<string, { bg: string; text: string; border: string; iconBg: string }> = {
  amber: { bg: "from-amber-50/50 to-orange-50/30 dark:from-amber-950/20 dark:to-orange-950/10", text: "text-amber-600", border: "border-amber-200/30 dark:border-amber-800/20", iconBg: "bg-amber-100 dark:bg-amber-900/30" },
  red: { bg: "from-red-50/50 to-rose-50/30 dark:from-red-950/20 dark:to-rose-950/10", text: "text-red-600", border: "border-red-200/30 dark:border-red-800/20", iconBg: "bg-red-100 dark:bg-red-900/30" },
  indigo: { bg: "from-indigo-50/50 to-violet-50/30 dark:from-indigo-950/20 dark:to-violet-950/10", text: "text-indigo-600", border: "border-indigo-200/30 dark:border-indigo-800/20", iconBg: "bg-indigo-100 dark:bg-indigo-900/30" },
  cyan: { bg: "from-cyan-50/50 to-sky-50/30 dark:from-cyan-950/20 dark:to-sky-950/10", text: "text-cyan-600", border: "border-cyan-200/30 dark:border-cyan-800/20", iconBg: "bg-cyan-100 dark:bg-cyan-900/30" },
  blue: { bg: "from-blue-50/50 to-sky-50/30 dark:from-blue-950/20 dark:to-sky-950/10", text: "text-blue-600", border: "border-blue-200/30 dark:border-blue-800/20", iconBg: "bg-blue-100 dark:bg-blue-900/30" },
};

export const WikiLoreWidget = memo(function WikiLoreWidget({
  countryName,
  searchQueries,
  title,
  icon: Icon,
  themeColor,
  maxResults = 4,
}: WikiLoreWidgetProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const colors = THEME_COLORS[themeColor] ?? THEME_COLORS.amber;

  // Search wiki for relevant articles using first query
  const primaryQuery = searchQueries[0] ?? countryName;
  const { data: results, isLoading } = api.wiki.searchPages.useQuery(
    { query: primaryQuery, limit: maxResults },
    { staleTime: 10 * 60_000, enabled: !!countryName }
  );

  // Get intros for found articles
  const topTitle = results?.[0]?.title;
  const { data: introText } = api.wiki.getIntro.useQuery(
    { title: topTitle ?? "" },
    { staleTime: 10 * 60_000, enabled: !!topTitle }
  );

  if (!isLoading && (!results || results.length === 0)) return null;

  return (
    <div className={`rounded-xl border ${colors.border} bg-gradient-to-br ${colors.bg} p-3`}>
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center gap-2"
      >
        <div className={`flex h-6 w-6 items-center justify-center rounded-lg ${colors.iconBg}`}>
          <Icon className={`h-3.5 w-3.5 ${colors.text}`} />
        </div>
        <h4 className="flex-1 text-left text-xs font-semibold text-foreground">{title}</h4>
        <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${isExpanded ? "" : "-rotate-90"}`} />
      </button>

      {isExpanded && (
        <div className="mt-2 space-y-2">
          {isLoading ? (
            <div className="flex items-center gap-2 py-2">
              <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
              <span className="text-[10px] text-muted-foreground">Searching wiki...</span>
            </div>
          ) : (
            <>
              {/* Lead article intro */}
              {introText && (
                <p className="line-clamp-3 text-[11px] leading-relaxed text-foreground/70">
                  {introText}
                </p>
              )}

              {/* Article list */}
              <div className="space-y-1">
                {results?.map((article: { title: string; pageId?: number }, i: number) => {
                  const wikiUrl = `https://ixwiki.com/wiki/${encodeURIComponent(article.title.replace(/ /g, "_"))}`;
                  return (
                    <a
                      key={i}
                      href={wikiUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] text-foreground/80 transition-colors hover:bg-black/5 dark:hover:bg-white/5"
                    >
                      <BookOpen className={`h-3 w-3 flex-shrink-0 ${colors.text}`} />
                      <span className="truncate">{article.title.replace(/_/g, " ")}</span>
                      <ExternalLink className="ml-auto h-2.5 w-2.5 flex-shrink-0 text-muted-foreground/50" />
                    </a>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
});
