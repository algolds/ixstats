"use client";

import React from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  NavArrowDown as ChevronDown,
  NavArrowRight as ChevronRight,
  OpenNewWindow as ExternalLink,
} from "iconoir-react";
import { cn } from "~/lib/utils";
import { Eyebrow } from "~/components/ui/eyebrow";
import { Skeleton } from "~/components/ui/skeleton";
import { api } from "~/trpc/react";
import {
  classifyWikiSection,
  extractWikiSectionRawContent,
  cleanWikiSectionContent,
  getWikiSectionUrl,
} from "~/lib/wiki-os/adapters/ixstates/integration";

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

  const { data: sectionContent, isLoading: contentLoading } = api.wikios.getSectionContent.useQuery(
    { title: countryName, section: title, source: "ixwiki" },
    { enabled: expanded, staleTime: 10 * 60_000 }
  );

  const rawContent = extractWikiSectionRawContent(sectionContent);
  const cleanContent = cleanWikiSectionContent(rawContent);

  return (
    <div className="hover:bg-accent/50 rounded-lg transition-colors">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
        className="focus-visible:ring-ring flex min-h-9 w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left outline-none focus-visible:ring-2"
      >
        <Icon className={cn("h-3.5 w-3.5 shrink-0", color)} />
        <span className="text-foreground flex-1 text-xs font-medium">{title}</span>
        <Eyebrow className={color}>{label}</Eyebrow>
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
                <div className="space-y-1.5 py-2" role="status" aria-label="Loading section">
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-3/4" />
                </div>
              )}
              {cleanContent && (
                <p className="text-foreground/70 text-xs leading-relaxed">
                  {cleanContent}
                  {cleanContent.length >= 600 ? "..." : ""}
                </p>
              )}
              {!contentLoading && !cleanContent && (
                <p className="text-muted-foreground py-1 text-xs italic">No content available.</p>
              )}
              <a
                href={getWikiSectionUrl(wikiUrl, title)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-wiki hover:text-wiki-hover mt-1 inline-flex items-center gap-1 text-xs hover:underline"
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
