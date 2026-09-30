"use client";

import React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { titleToWikiOSPath } from "~/lib/wiki-os/transformers/url-compat";
import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "~/components/ui/collapsible";
import { FacetCard } from "~/components/ui/facet-container";
import { Badge } from "~/components/ui/badge";
import { Eyebrow } from "~/components/ui/eyebrow";
import {
  NavArrowDown as ChevronDown,
  ArrowRight,
  OpenNewWindow as ExternalLink,
  MediaImage as ImageIcon,
  Expand as Maximize2,
} from "iconoir-react";
import { SECTION_ICONS } from "./constants";
import { parseWikiContent, truncateContent } from "~/lib/builder";
import type { WikiSection } from "~/lib/builder";
import { resolveImageUrl } from "~/lib/wiki-os/adapters/ixstates/unified-parser";
import { type WikiSource } from "~/lib/wiki-os/config";

/** Classification is a sensitivity scale, so it keeps a status colour (text only). */
const CLASSIFICATION_STYLES = {
  PUBLIC: { color: "text-muted-foreground" },
  RESTRICTED: { color: "text-foreground" },
  CONFIDENTIAL: { color: "text-amber-500" },
  SECRET: { color: "text-amber-500" },
  TOP_SECRET: { color: "text-destructive" },
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
  wikiSource = "ixwiki",
}: WikiSectionCardProps): React.ReactElement {
  const router = useRouter();

  const SectionIcon =
    SECTION_ICONS[section.id as keyof typeof SECTION_ICONS] || SECTION_ICONS.default;

  const getImportanceBadgeClass = (importance: string): string => {
    const importanceStyles = {
      critical: "text-destructive",
      high: "text-amber-500",
      medium: "text-foreground",
      low: "text-muted-foreground",
    } as const;

    return importanceStyles[importance as keyof typeof importanceStyles] || importanceStyles.low;
  };

  const { truncated, isTruncated } = truncateContent(section.content);

  return (
    <Collapsible open={isOpen} onOpenChange={onToggle} id={section.id}>
      <FacetCard depth={1} interactive="none" className="overflow-hidden rounded-2xl">
        {/* Section Header Accordion Trigger */}
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="border-border hover:bg-accent/50 focus-visible:ring-ring flex w-full cursor-pointer items-center justify-between border-b p-4 text-left transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-inset sm:p-5"
          >
            <div className="flex min-w-0 items-center gap-3.5">
              <SectionIcon className="text-muted-foreground h-5 w-5 shrink-0" />

              <div className="min-w-0">
                <span className="text-foreground block truncate text-base font-semibold">
                  {section.title}
                </span>
                <span className="text-muted-foreground block truncate text-xs">
                  {section.wordCount} words • {section.images?.length || 0} media assets
                </span>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              {/* Classification Badge */}
              <Badge
                variant="outline"
                className={
                  CLASSIFICATION_STYLES[
                    section.classification as keyof typeof CLASSIFICATION_STYLES
                  ]?.color || CLASSIFICATION_STYLES.PUBLIC.color
                }
              >
                {section.classification}
              </Badge>

              {/* Importance Badge */}
              <Badge
                variant="outline"
                className={cn(
                  "hidden capitalize sm:inline-flex",
                  section.importance ? getImportanceBadgeClass(section.importance) : ""
                )}
              >
                {section.importance ?? "medium"}
              </Badge>

              <div className="text-muted-foreground flex h-8 w-8 items-center justify-center">
                <ChevronDown
                  className={cn(
                    "h-4 w-4 transition-transform duration-200",
                    isOpen && "rotate-180"
                  )}
                />
              </div>
            </div>
          </button>
        </CollapsibleTrigger>

        {/* Section Content */}
        <CollapsibleContent>
          <div className="space-y-5 p-4 sm:p-6">
            {/* Parsed Wiki Body Content */}
            <div className="prose prose-sm prose-invert text-muted-foreground/90 max-w-none text-xs leading-relaxed font-normal sm:text-sm">
              {parseWikiContent(truncated, handleWikiLinkClick)}
            </div>

            {/* Read Full Section Button */}
            {isTruncated && (
              <div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    section.id &&
                    onShowFullContent({
                      title: section.title,
                      content: section.content,
                      id: section.id,
                    })
                  }
                  className="gap-1.5 text-xs"
                >
                  Read Full Section <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}

            {/* Immersive Apple Media Gallery */}
            {section.images && section.images.length > 0 && (
              <div className="border-border space-y-2 border-t pt-2">
                <Eyebrow className="flex items-center gap-1.5">
                  <ImageIcon className="h-3.5 w-3.5" />
                  Section media ({section.images.length})
                </Eyebrow>

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
                        className="group border-border bg-muted hover:border-ring/40 relative aspect-video cursor-pointer overflow-hidden rounded-xl border shadow-sm transition-[background-color,border-color,transform] duration-150"
                      >
                        <img
                          src={resolvedSrc}
                          alt={`Media asset from ${section.title}`}
                          className="h-full w-full object-cover object-center"
                          onError={(e: React.SyntheticEvent<HTMLImageElement>) =>
                            (e.currentTarget.style.display = "none")
                          }
                        />
                        <div className="absolute inset-0 flex items-end justify-between bg-gradient-to-t from-black/80 via-transparent to-transparent p-2 opacity-0 transition-opacity group-hover:opacity-100">
                          <span className="max-w-[80%] truncate font-mono text-xs text-white">
                            {fileName}
                          </span>
                          <Maximize2 className="h-3 w-3 shrink-0 text-white" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Apple Action Toolbar & External Links */}
            <div className="border-border flex flex-wrap items-center justify-between gap-3 border-t pt-3">
              <div className="flex items-center gap-2">
                {wikiSource === "ixwiki" ? (
                  <Button
                    variant="outline"
                    size="sm"
                    asChild
                    className="text-muted-foreground hover:text-foreground border-border bg-muted/50 hover:bg-accent/50 h-8 gap-1.5 rounded-xl border text-xs font-bold transition-[background-color,border-color,transform] duration-150 active:scale-[0.98]"
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
                    className="text-muted-foreground hover:text-foreground border-border bg-muted/50 hover:bg-accent/50 h-8 gap-1.5 rounded-xl border text-xs font-bold transition-[background-color,border-color,transform] duration-150 active:scale-[0.98]"
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
              <div className="text-muted-foreground/80 flex items-center gap-4 font-mono text-xs">
                <span>{section.wordCount} words</span>
                {section.lastModified && (
                  <span>Updated {new Date(section.lastModified).toLocaleDateString()}</span>
                )}
                {section.content.includes("[") && (
                  <span className="text-primary font-semibold">
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
