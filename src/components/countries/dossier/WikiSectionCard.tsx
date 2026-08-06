"use client";

import React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { titleToWikiOSPath } from "~/lib/wiki-os/url-compat";
import { cn } from "~/lib/utils";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "~/components/ui/collapsible";
import { FacetCard } from "~/components/ui/facet-container";
import {
  ChevronDown,
  ArrowRight,
  ExternalLink,
  Image as ImageIcon,
  Sparkles,
  Maximize2,
  FileText,
} from "lucide-react";
import { SECTION_ICONS } from "./constants";
import { parseWikiContent, truncateContent } from "~/lib/dossier-parser";
import type { WikiSection } from "~/lib/dossier-parser";
import { resolveImageUrl } from "~/lib/unified-wiki-parser";
import { type WikiSource } from "~/lib/mediawiki-config";

const CLASSIFICATION_STYLES = {
  PUBLIC: { color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
  RESTRICTED: { color: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
  CONFIDENTIAL: { color: "bg-red-500/15 text-red-400 border-red-500/30" },
  SECRET: { color: "bg-orange-500/15 text-orange-400 border-orange-500/30" },
  TOP_SECRET: { color: "bg-purple-500/15 text-purple-400 border-purple-500/30" },
} as const;

interface WikiSectionCardProps {
  section: WikiSection;
  isOpen: boolean;
  onToggle: () => void;
  onShowFullContent: (section: { title: string; content: string; id: string }) => void;
  handleWikiLinkClick: (page: string) => void;
  flagColors: { primary: string; secondary: string; accent: string };
  countryName: string;
  wikiSource?: WikiSource;
}

export function WikiSectionCard({
  section,
  isOpen,
  onToggle,
  onShowFullContent,
  handleWikiLinkClick,
  flagColors,
  countryName,
  wikiSource = "ixwiki",
}: WikiSectionCardProps): React.ReactElement {
  const router = useRouter();

  const SectionIcon =
    SECTION_ICONS[section.id as keyof typeof SECTION_ICONS] || SECTION_ICONS.default;

  const getImportanceBadgeClass = (importance: string): string => {
    const importanceStyles = {
      critical: "bg-red-500/15 text-red-400 border-red-500/30",
      high: "bg-orange-500/15 text-orange-400 border-orange-500/30",
      medium: "bg-blue-500/15 text-blue-400 border-blue-500/30",
      low: "bg-gray-500/15 text-gray-400 border-gray-500/30",
    } as const;

    return importanceStyles[importance as keyof typeof importanceStyles] || importanceStyles.low;
  };

  const { truncated, isTruncated } = truncateContent(section.content);

  return (
    <Collapsible open={isOpen} onOpenChange={onToggle} id={section.id}>
      <FacetCard
        depth={1}
        interactive="none"
        className="overflow-hidden rounded-2xl border border-white/10 bg-card/30 backdrop-blur-xl shadow-sm transition-all hover:border-white/20"
      >
        {/* Section Header Accordion Trigger */}
        <CollapsibleTrigger asChild>
          <div className="flex items-center justify-between p-4 sm:p-5 cursor-pointer hover:bg-white/[0.03] active:scale-[0.995] transition-all border-b border-white/5">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/15 border border-blue-500/25 text-blue-400 shadow-sm">
                <SectionIcon className="h-5 w-5" />
              </div>

              <div className="min-w-0">
                <h3 className="text-base font-extrabold text-foreground tracking-tight truncate flex items-center gap-2">
                  {section.title}
                </h3>
                <p className="text-[11px] text-muted-foreground truncate">
                  {section.wordCount} words • {section.images?.length || 0} media assets
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {/* Classification Badge */}
              <span
                className={cn(
                  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wider",
                  CLASSIFICATION_STYLES[
                    section.classification as keyof typeof CLASSIFICATION_STYLES
                  ]?.color || CLASSIFICATION_STYLES.PUBLIC.color
                )}
              >
                {section.classification}
              </span>

              {/* Importance Badge */}
              <span
                className={cn(
                  "hidden sm:inline-flex items-center rounded-full border px-2.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wider",
                  section.importance ? getImportanceBadgeClass(section.importance) : ""
                )}
              >
                {section.importance?.toUpperCase() ?? "MEDIUM"}
              </span>

              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.04] text-muted-foreground transition-transform">
                <ChevronDown
                  className={cn("h-4 w-4 transition-transform duration-200", isOpen && "rotate-180")}
                />
              </div>
            </div>
          </div>
        </CollapsibleTrigger>

        {/* Section Content */}
        <CollapsibleContent>
          <div className="p-4 sm:p-6 space-y-5">
            {/* Parsed Wiki Body Content */}
            <div className="prose prose-sm prose-invert max-w-none text-xs sm:text-sm leading-relaxed text-muted-foreground/90 font-normal">
              {parseWikiContent(truncated, handleWikiLinkClick)}
            </div>

            {/* Read Full Section Button */}
            {isTruncated && (
              <div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    section.id &&
                    onShowFullContent({
                      title: section.title,
                      content: section.content,
                      id: section.id,
                    })
                  }
                  className="rounded-xl border border-blue-500/30 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 hover:text-blue-300 font-bold text-xs gap-1.5 active:scale-[0.98] transition-all"
                >
                  Read Full Section <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}

            {/* Immersive Apple Media Gallery */}
            {section.images && section.images.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-white/5">
                <div className="flex items-center justify-between text-[11px] text-muted-foreground font-extrabold uppercase tracking-wider">
                  <span className="flex items-center gap-1.5">
                    <ImageIcon className="h-3.5 w-3.5 text-blue-400" />
                    Section Media ({section.images.length})
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                  {section.images.map((imageLink: string, index: number) => {
                    const fileName = imageLink.replace(/\[\[File:([^|\\]+).*\]\]/, "$1");
                    let imgBaseUrl = "https://ixwiki.com/wiki/";
                    if (wikiSource === "iiwiki") {
                      imgBaseUrl = "https://iiwiki.com/wiki/";
                    } else if (wikiSource === "althistory") {
                      imgBaseUrl = "https://althistory.fandom.com/wiki/";
                    }
                    const resolvedSrc = resolveImageUrl(fileName, wikiSource);

                    return (
                      <div
                        key={index}
                        onClick={() => {
                          if (wikiSource === "ixwiki") {
                            router.push(titleToWikiOSPath(`File:${fileName}`));
                          } else {
                            window.open(`${imgBaseUrl}File:${fileName}`, "_blank");
                          }
                        }}
                        className="group relative aspect-video overflow-hidden rounded-xl border border-white/10 bg-black/40 shadow-sm cursor-pointer hover:border-white/30 hover:shadow-lg transition-all"
                      >
                        <img
                          src={resolvedSrc}
                          alt={`Media asset from ${section.title}`}
                          className="h-full w-full object-cover object-center transition-transform duration-300 group-hover:scale-105"
                          onError={(e: React.SyntheticEvent<HTMLImageElement>) =>
                            (e.currentTarget.style.display = "none")
                          }
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-between p-2">
                          <span className="text-[9px] font-mono text-white truncate max-w-[80%]">
                            {fileName}
                          </span>
                          <Maximize2 className="h-3 w-3 text-white shrink-0" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Apple Action Toolbar & External Links */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-white/5">
              <div className="flex items-center gap-2">
                {wikiSource === "ixwiki" ? (
                  <Button
                    variant="outline"
                    size="sm"
                    asChild
                    className="h-8 rounded-xl border border-white/10 bg-white/[0.03] text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-white/[0.06] active:scale-[0.98] transition-all gap-1.5"
                  >
                    <Link href={titleToWikiOSPath(section.sourcePage || section.title)}>
                      <ExternalLink className="h-3.5 w-3.5" /> View WikiOS Source
                    </Link>
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    asChild
                    className="h-8 rounded-xl border border-white/10 bg-white/[0.03] text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-white/[0.06] active:scale-[0.98] transition-all gap-1.5"
                  >
                    <a
                      href={`${wikiSource === "iiwiki" ? "https://iiwiki.com/wiki/" : "https://althistory.fandom.com/wiki/"}${encodeURIComponent(section.sourcePage || section.title)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="h-3.5 w-3.5" /> View External Wiki Source
                    </a>
                  </Button>
                )}
              </div>

              {/* Section Metadata Footer */}
              <div className="flex items-center gap-4 text-[10px] font-mono text-muted-foreground/80">
                <span>{section.wordCount} words</span>
                {section.lastModified && (
                  <span>Updated {new Date(section.lastModified).toLocaleDateString()}</span>
                )}
                {section.content.includes("[") && (
                  <span className="text-blue-400 font-bold">
                    {section.content.match(/\[\[[^\]]*\]\]/g)?.length || 0} wiki links
                  </span>
                )}
              </div>
            </div>
          </div>
        </CollapsibleContent>
      </FacetCard>
    </Collapsible>
  );
}
