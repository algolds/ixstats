"use client";

import React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { titleToWikiOSPath } from "~/lib/wikios/url-compat";
import { cn } from "~/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "~/components/ui/collapsible";
import { RiArrowDownLine, RiArrowRightLine, RiExternalLinkLine, RiImageLine } from "react-icons/ri";
import { SECTION_ICONS } from "./constants";

const CLASSIFICATION_STYLES = {
  PUBLIC: { color: "text-green-600 dark:text-green-400" },
  RESTRICTED: { color: "text-yellow-600 dark:text-yellow-400" },
  CONFIDENTIAL: { color: "text-red-600 dark:text-red-400" },
  SECRET: { color: "text-orange-600 dark:text-orange-400" },
  TOP_SECRET: { color: "text-purple-600 dark:text-purple-400" },
} as const;
import { parseWikiContent, truncateContent } from "~/lib/wiki-intelligence-parser";
import type { WikiSection } from "~/lib/wiki-intelligence-parser";
import { resolveImageUrl } from "~/lib/unified-wiki-parser";
import { type WikiSource } from "~/lib/mediawiki-config";

/**
 * Props for WikiSectionCard component
 */
interface WikiSectionCardProps {
  /** The wiki section data to display */
  section: WikiSection;
  /** Whether the section is expanded */
  isOpen: boolean;
  /** Callback when section is toggled */
  onToggle: () => void;
  /** Callback to show full content modal */
  onShowFullContent: (section: { title: string; content: string; id: string }) => void;
  /** Callback for wiki link clicks */
  handleWikiLinkClick: (page: string) => void;
  /** Flag colors for theming */
  flagColors: { primary: string; secondary: string; accent: string };
  /** Country name for context */
  countryName: string;
  /** Resolved source for this country's intelligence profile */
  wikiSource?: WikiSource;
}

/**
 * WikiSectionCard Component
 *
 * Displays an individual wiki intelligence section with:
 * - Collapsible header with section icon and title
 * - Classification and importance badges
 * - Truncated content with wiki link parsing
 * - "See More" button for full content
 * - Media display if section has images
 * - External links to full article and media
 * - Metadata footer (word count, last updated, wiki links count)
 *
 * @component
 * @example
 * ```tsx
 * <WikiSectionCard
 *   section={economySection}
 *   isOpen={true}
 *   onToggle={() => toggleSection('economy')}
 *   onShowFullContent={(section) => setModalSection(section)}
 *   handleWikiLinkClick={(page) => navigateToPage(page)}
 *   flagColors={{ primary: '#0066cc', secondary: '#ffffff', accent: '#ffcc00' }}
 *   countryName="Urcea"
 * />
 * ```
 */
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
  // Get the appropriate icon for this section
  const SectionIcon =
    SECTION_ICONS[section.id as keyof typeof SECTION_ICONS] || SECTION_ICONS.default;

  // Calculate importance badge styling
  const getImportanceBadgeClass = (importance: string): string => {
    const importanceStyles = {
      critical: "bg-red-500/20 text-red-400",
      high: "bg-orange-500/20 text-orange-400",
      medium: "bg-blue-500/20 text-blue-400",
      low: "bg-gray-500/20 text-gray-400",
    } as const;

    return importanceStyles[importance as keyof typeof importanceStyles] || importanceStyles.low;
  };

  return (
    <Collapsible open={isOpen} onOpenChange={onToggle}>
      <Card className="glass-hierarchy-child">
        {/* Section Header */}
        <CollapsibleTrigger asChild>
          <CardHeader className="hover:bg-accent/10 cursor-pointer transition-colors">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <SectionIcon className="h-5 w-5" style={{ color: flagColors.primary }} />
                {section.title}
                <RiArrowDownLine
                  className={cn(
                    "text-muted-foreground ml-2 h-4 w-4 transition-transform",
                    isOpen && "rotate-180"
                  )}
                />
              </CardTitle>
              <div className="flex items-center gap-2">
                {/* Classification Badge */}
                <Badge
                  variant="outline"
                  className={cn(
                    "text-xs",
                    CLASSIFICATION_STYLES[
                      section.classification as keyof typeof CLASSIFICATION_STYLES
                    ]?.color || CLASSIFICATION_STYLES.PUBLIC.color
                  )}
                >
                  {section.classification}
                </Badge>
                {/* Importance Badge */}
                <Badge
                  variant="secondary"
                  className={cn(
                    "text-xs",
                    section.importance ? getImportanceBadgeClass(section.importance) : ""
                  )}
                >
                  {section.importance?.toUpperCase() ?? "MEDIUM"}
                </Badge>
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        {/* Section Content */}
        <CollapsibleContent>
          <CardContent>
            <div className="space-y-4">
              {/* Content with proper link handling and image support */}
              {(() => {
                const { truncated, isTruncated } = truncateContent(section.content);
                return (
                  <>
                    <div className="prose prose-sm prose-invert max-w-none text-sm leading-relaxed">
                      {parseWikiContent(truncated, handleWikiLinkClick)}
                    </div>
                    {isTruncated && (
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
                        className="-mt-2 text-blue-400 hover:bg-blue-500/10 hover:text-blue-300"
                      >
                        See More <RiArrowRightLine className="ml-1 h-4 w-4" />
                      </Button>
                    )}
                  </>
                );
              })()}

              {/* Display actual images if they exist */}
              {section.images && section.images.length > 0 && (
                <div className="mt-4 space-y-2">
                  <p className="text-muted-foreground mb-2 text-xs">Media from wiki source:</p>
                  <div className="flex flex-wrap gap-2">
                    {section.images.map((imageLink: string, index: number) => {
                      const fileName = imageLink.replace(/\[\[File:([^|\\]+).*\]\]/, "$1");
                      let imgBaseUrl = "https://ixwiki.com/wiki/";
                      if (wikiSource === "iiwiki") {
                        imgBaseUrl = "https://iiwiki.com/wiki/";
                      } else if (wikiSource === "althistory") {
                        imgBaseUrl = "https://althistory.fandom.com/wiki/";
                      }
                      return (
                        <img
                          key={index}
                          src={resolveImageUrl(fileName, wikiSource)}
                          alt={`Image from ${section.title}`}
                          className="border-muted-foreground/30 h-auto max-w-32 cursor-pointer rounded border"
                          onError={(e: React.SyntheticEvent<HTMLImageElement>) =>
                            (e.currentTarget.style.display = "none")
                          }
                          onClick={() => {
                            if (wikiSource === "ixwiki") {
                              router.push(titleToWikiOSPath(`File:${fileName}`));
                            } else {
                              window.open(`${imgBaseUrl}File:${fileName}`, "_blank");
                            }
                          }}
                        />
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Full Article Access */}
              <div className="border-border/30 flex gap-2 border-t pt-3">
                <Button variant="outline" size="sm" asChild className="text-xs">
                  {wikiSource === "ixwiki" ? (
                    <Link href={titleToWikiOSPath(section.sourcePage || section.title)}>
                      <RiExternalLinkLine className="mr-1 h-3.5 w-3.5" /> View Wiki Source
                    </Link>
                  ) : (
                    <a
                      href={`${wikiSource === "iiwiki" ? "https://iiwiki.com/wiki/" : "https://althistory.fandom.com/wiki/"}${encodeURIComponent(section.sourcePage || section.title)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <RiExternalLinkLine className="mr-1 h-3.5 w-3.5" /> View Wiki Source
                    </a>
                  )}
                </Button>

                {section.images && section.images.length > 0 && (
                  <Button variant="outline" size="sm" asChild>
                    {wikiSource === "ixwiki" ? (
                      <Link
                        href={titleToWikiOSPath(
                          `Category:${section.title.includes(" of ") ? section.title : `${section.title} of ${countryName}`}_images`
                        )}
                      >
                        <RiImageLine className="mr-1 h-3 w-3" />
                        {section.images.length} Media
                      </Link>
                    ) : (
                      <a
                        href={`https://ixwiki.com/wiki/Category:${encodeURIComponent(section.title.includes(" of ") ? section.title : `${section.title} of ${countryName}`)}_images`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <RiImageLine className="mr-1 h-3 w-3" />
                        {section.images.length} Media
                      </a>
                    )}
                  </Button>
                )}
              </div>

              {/* Section metadata */}
              <div className="border-border/30 text-muted-foreground mt-4 border-t pt-3 text-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <span>{section.wordCount} words</span>
                    {section.lastModified && (
                      <span>
                        Last updated: {new Date(section.lastModified).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  {section.content.includes("[") && (
                    <span className="flex items-center gap-1 text-blue-400">
                      <RiExternalLinkLine className="h-3 w-3" />
                      {section.content.match(/\[\[[^\]]*\]\]/g)?.length || 0} wiki links
                    </span>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
