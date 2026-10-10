"use client";

import React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { titleToWikiOSRoute } from "~/lib/wiki-os/transformers/url-compat";
import { cn } from "~/lib/utils";
import { Button, focusRing } from "~/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "~/components/ui/collapsible";
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
import { publicArticleUrl, type WikiSource } from "~/lib/wiki-os/config";
import { FACET_PROSE } from "~/components/maps/shared/facet-prose";
import { Card } from "~/components/ui/card";

/** Classification is a sensitivity scale, so it keeps a status colour (text only). */
const CLASSIFICATION_STYLES = {
  PUBLIC: { color: "text-label-secondary" },
  RESTRICTED: { color: "text-label" },
  CONFIDENTIAL: { color: "text-yellow" },
  SECRET: { color: "text-yellow" },
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
      high: "text-yellow",
      medium: "text-label",
      low: "text-label-secondary",
    } as const;

    return importanceStyles[importance as keyof typeof importanceStyles] || importanceStyles.low;
  };

  const { truncated, isTruncated } = truncateContent(section.content);

  return (
    <Collapsible open={isOpen} onOpenChange={onToggle} id={section.id}>
      <Card className="rounded-card overflow-hidden">
        {/* Section Header Accordion Trigger */}
        <CollapsibleTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-auto min-h-(--control-height-sm) w-full justify-between justify-start py-2 text-left whitespace-normal"
          >
            <div className="flex min-w-0 items-center gap-4">
              <SectionIcon className="text-label-secondary h-5 w-5 shrink-0" />

              <div className="min-w-0">
                <span className="text-label text-title-3 block truncate">{section.title}</span>
                <span className="text-label-secondary text-footnote block truncate">
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

              <div className="text-label-secondary flex h-8 w-8 items-center justify-center">
                <ChevronDown
                  className={cn(
                    "h-4 w-4 transition-transform duration-200",
                    isOpen && "rotate-180"
                  )}
                />
              </div>
            </div>
          </Button>
        </CollapsibleTrigger>

        {/* Section Content */}
        <CollapsibleContent>
          <div className="space-y-5 p-4 sm:p-6">
            {/* Parsed Wiki Body Content */}
            <div
              className={cn(
                FACET_PROSE,
                "prose-sm text-footnote sm:text-body leading-relaxed font-normal"
              )}
            >
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
                  className="text-footnote gap-2"
                >
                  Read full section <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}

            {/* Immersive Apple Media Gallery */}
            {section.images && section.images.length > 0 && (
              <div className="border-separator space-y-2 border-t pt-2">
                <Eyebrow className="flex items-center gap-2">
                  <ImageIcon aria-hidden="true" className="h-3.5 w-3.5" />
                  Section media ({section.images.length})
                </Eyebrow>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                  {section.images.map((imageLink: string, index: number) => {
                    const fileName = imageLink.replace(/\[\[File:([^|\\]+).*\]\]/, "$1");
                    const resolvedSrc = resolveImageUrl(fileName, wikiSource);

                    return (
                      <button
                        type="button"
                        key={index}
                        aria-label={`Open ${fileName}`}
                        onClick={() => {
                          if (wikiSource === "ixwiki") {
                            router.push(titleToWikiOSRoute(`File:${fileName}`));
                          } else {
                            window.open(publicArticleUrl(`File:${fileName}`, wikiSource), "_blank");
                          }
                        }}
                        className={cn(
                          "group border-separator bg-fill-3 hover:border-ring/40 rounded-row shadow-card facet-press facet-press-subtle relative block aspect-video w-full cursor-pointer overflow-hidden border text-left",
                          focusRing
                        )}
                      >
                        <img
                          src={resolvedSrc}
                          alt=""
                          className="h-full w-full object-cover object-center"
                          onError={(e: React.SyntheticEvent<HTMLImageElement>) =>
                            (e.currentTarget.style.display = "none")
                          }
                        />
                        <div className="absolute inset-0 flex items-end justify-between bg-gradient-to-t from-black/80 via-transparent to-transparent p-2 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                          <span className="text-footnote max-w-[80%] truncate text-white tabular-nums">
                            {fileName}
                          </span>
                          <Maximize2 aria-hidden="true" className="h-3 w-3 shrink-0 text-white" />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Apple Action Toolbar & External Links */}
            <div className="border-separator flex flex-wrap items-center justify-between gap-3 border-t pt-3">
              <div className="flex items-center gap-2">
                {wikiSource === "ixwiki" ? (
                  <Button
                    variant="outline"
                    size="sm"
                    asChild
                    className="text-label-secondary hover:text-label border-separator bg-fill-3 hover:bg-fill-3 rounded-row text-caption h-8 gap-2 border font-semibold transition-[background-color,border-color,transform] duration-150"
                  >
                    <Link href={titleToWikiOSRoute(section.sourcePage || section.title)}>
                      <ExternalLink className="h-3.5 w-3.5" /> View WikiOS source
                    </Link>
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    asChild
                    className="text-label-secondary hover:text-label border-separator bg-fill-3 hover:bg-fill-3 rounded-row text-caption h-8 gap-2 border font-semibold transition-[background-color,border-color,transform] duration-150"
                  >
                    <a
                      href={`${wikiSource === "iiwiki" ? "https://iiwiki.com/wiki/" : "https://althistory.fandom.com/wiki/"}${encodeURIComponent(section.sourcePage || section.title)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="h-3.5 w-3.5" /> View external wiki source
                    </a>
                  </Button>
                )}
              </div>

              {/* Section Metadata Footer */}
              <div className="text-label-secondary text-footnote flex items-center gap-4 tabular-nums">
                <span>{section.wordCount} words</span>
                {section.lastModified && (
                  <span>Updated {new Date(section.lastModified).toLocaleDateString()}</span>
                )}
                {section.content.includes("[") && (
                  <span className="text-tint font-semibold">
                    {section.content.match(/\[\[[^\]]*\]\]/g)?.length || 0} wiki links
                  </span>
                )}
              </div>
            </div>
          </div>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
