"use client";

import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { ChevronDown, ChevronRight, Loader2, ExternalLink } from "lucide-react";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";
import {
  classifyWikiSection,
  extractWikiSectionRawContent,
  cleanWikiSectionContent,
  getWikiSectionUrl,
} from "~/lib/wiki/integration";

/**
 * An expandable row representing a single level-2 wiki article section. Lazily
 * fetches and renders cleaned section content when expanded.
 *
 * Extracted from MyCountryTabSystem during modular decomposition.
 * Behavior preserved exactly.
 *
 * Note: this component owns its own `<AnimatePresence>` because it is a leaf
 * list item — its expand/collapse animation is self-contained and unrelated to
 * the top-level tab transition managed by the orchestrator.
 */
export const WikiSectionRow = React.memo(function WikiSectionRow({
  title,
  countryName,
  wikiUrl,
}: {
  title: string;
  countryName: string;
  wikiUrl: string;
}) {
  const [expanded, setExpanded] = React.useState(false);
  const { label, icon: Icon, color } = classifyWikiSection(title);

  const { data: sectionContent, isLoading: contentLoading } = api.wiki.getSectionContent.useQuery(
    { title: countryName, section: title, source: "ixwiki" },
    { enabled: expanded, staleTime: 10 * 60_000 }
  );

  const rawContent = extractWikiSectionRawContent(sectionContent);
  const cleanContent = cleanWikiSectionContent(rawContent);

  return (
    <div className="rounded-lg bg-white/30 transition-colors hover:bg-white/50 dark:bg-white/[0.03] dark:hover:bg-white/[0.06]">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2.5 px-3 py-2 text-left"
      >
        <Icon className={cn("h-3.5 w-3.5 shrink-0", color)} />
        <span className="text-foreground flex-1 text-xs font-medium">{title}</span>
        <span className={cn("text-[9px] font-medium tracking-wider uppercase", color)}>
          {label}
        </span>
        {expanded ? (
          <ChevronDown className="text-muted-foreground h-3 w-3" />
        ) : (
          <ChevronRight className="text-muted-foreground h-3 w-3" />
        )}
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
                  <Loader2 className="text-muted-foreground h-3 w-3 animate-spin" />
                  <span className="text-muted-foreground text-[10px]">Loading...</span>
                </div>
              )}
              {cleanContent && (
                <p className="text-foreground/70 text-[11px] leading-relaxed">
                  {cleanContent}
                  {cleanContent.length >= 600 ? "..." : ""}
                </p>
              )}
              {!contentLoading && !cleanContent && (
                <p className="text-muted-foreground py-1 text-[10px] italic">
                  No content available.
                </p>
              )}
              <a
                href={getWikiSectionUrl(wikiUrl, title)}
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
});
