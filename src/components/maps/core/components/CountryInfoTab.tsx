"use client";

import React from "react";
import Link from "next/link";
import { OpenBook as BookOpen, MediaImage as ImageIcon, OpenNewWindow as ExternalLink } from "iconoir-react";
import { titleToWikiOSPath } from "~/lib/wiki-os/transformers/url-compat";
import { sanitizeWikiContent } from "~/lib/utils";
import { WikiHtmlContent } from "~/components/wiki-os/reader/WikiLinkPreview";

interface CountryInfoTabProps {
  wikiRichIntro: any;
  wikiSections: any[];
  wikiImages: any[];
  displayName: string;
  introExpanded: boolean;
  setIntroExpanded: React.Dispatch<React.SetStateAction<boolean>>;
  setLightboxSrc: (src: string | null) => void;
}

export function CountryInfoTab({
  wikiRichIntro,
  wikiSections,
  wikiImages,
  displayName,
  introExpanded,
  setIntroExpanded,
  setLightboxSrc,
}: CountryInfoTabProps) {
  return (
    <div className="space-y-3">
      {/* Wiki intro */}
      {wikiRichIntro?.paragraphs && wikiRichIntro.paragraphs.length > 0 && (
        <div className="space-y-1.5">
          {wikiRichIntro.paragraphs.slice(0, introExpanded ? 5 : 2).map((p: string, i: number) => (
            <WikiHtmlContent
              key={i}
              as="p"
              className="text-foreground/80 text-xs leading-relaxed"
              html={sanitizeWikiContent(p)}
            />
          ))}
          {wikiRichIntro.paragraphs.length > 2 && (
            <button
              onClick={() => setIntroExpanded((v) => !v)}
              className="text-[10px] font-medium text-blue-600 transition-colors hover:text-blue-500"
            >
              {introExpanded ? "Show less" : "Read more..."}
            </button>
          )}
        </div>
      )}

      {/* Wiki sections (TOC) */}
      {wikiSections &&
        wikiSections.length > 0 &&
        (() => {
          const baseWikiUrl = wikiRichIntro?.wikiUrl ?? titleToWikiOSPath(displayName);
          const isInternal = baseWikiUrl.startsWith("/") || baseWikiUrl.includes("/wiki/");
          return (
            <div>
              <div className="text-muted-foreground flex items-center gap-1.5 text-[10px] font-semibold tracking-wider uppercase">
                <BookOpen className="h-3 w-3" />
                Table of Contents ({wikiSections.filter((s) => s.level === 2).length})
              </div>
              <div className="mt-1.5 space-y-1">
                {wikiSections
                  .filter((s) => s.level <= 3)
                  .map((section, i) => {
                    const sectionUrl = `${baseWikiUrl}#${section.anchor}`;
                    if (section.level === 2) {
                      return (
                        <div
                          key={`${section.anchor}-${i}`}
                          className="border-border/30 rounded-md border p-2"
                        >
                          {isInternal ? (
                            <Link
                              href={sectionUrl}
                              className="text-foreground/90 block text-xs font-medium transition-colors hover:text-blue-600"
                            >
                              {section.line}
                            </Link>
                          ) : (
                            <a
                              href={sectionUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-foreground/90 block text-xs font-medium transition-colors hover:text-blue-600"
                            >
                              {section.line}
                            </a>
                          )}
                          {"preview" in section && section.preview && (
                            <p className="text-muted-foreground mt-0.5 line-clamp-2 text-[10px] leading-snug">
                              {section.preview as string}
                            </p>
                          )}
                        </div>
                      );
                    }
                    return isInternal ? (
                      <Link
                        key={`${section.anchor}-${i}`}
                        href={sectionUrl}
                        className="text-foreground/50 block truncate pl-3 text-[10px] transition-colors hover:text-blue-600"
                      >
                        {section.line}
                      </Link>
                    ) : (
                      <a
                        key={`${section.anchor}-${i}`}
                        href={sectionUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-foreground/50 block truncate pl-3 text-[10px] transition-colors hover:text-blue-600"
                      >
                        {section.line}
                      </a>
                    );
                  })}
              </div>
            </div>
          );
        })()}

      {/* Media Gallery */}
      {wikiImages && wikiImages.length > 0 && (
        <div>
          <div className="text-muted-foreground flex items-center gap-1.5 text-[10px] font-semibold tracking-wider uppercase">
            <ImageIcon className="h-3 w-3" />
            Media ({wikiImages.length})
          </div>
          <div className="mt-1.5 flex gap-1.5 overflow-x-auto pb-1">
            {wikiImages.slice(0, 12).map((img, i) => (
              <button
                key={`${img.title}-${i}`}
                onClick={() => setLightboxSrc(img.url)}
                className="border-border shrink-0 overflow-hidden rounded-md border transition-transform hover:scale-105"
              >
                <img
                  src={img.thumbUrl}
                  alt={img.title.replace(/^File:/, "").replace(/_/g, " ")}
                  className="h-16 w-auto object-cover"
                  loading="lazy"
                />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Wiki link */}
      {wikiRichIntro?.wikiUrl &&
        (wikiRichIntro.wikiUrl.startsWith("/") || wikiRichIntro.wikiUrl.includes("/wiki/") ? (
          <Link
            href={wikiRichIntro.wikiUrl}
            className="flex items-center justify-center gap-1.5 rounded-lg bg-amber-50 py-2 text-xs font-medium text-amber-700 transition-colors hover:bg-amber-100 dark:bg-amber-900/20 dark:text-amber-400 dark:hover:bg-amber-900/30"
          >
            <BookOpen className="h-3 w-3" />
            Read full article on IxWiki
          </Link>
        ) : (
          <a
            href={wikiRichIntro.wikiUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1.5 rounded-lg bg-amber-50 py-2 text-xs font-medium text-amber-700 transition-colors hover:bg-amber-100 dark:bg-amber-900/20 dark:text-amber-400 dark:hover:bg-amber-900/30"
          >
            <BookOpen className="h-3 w-3" />
            Read full article on {wikiRichIntro.wikiUrl.includes("ixwiki") ? "IxWiki" : "IIWiki"}
            <ExternalLink className="h-3 w-3" />
          </a>
        ))}

      {!wikiRichIntro && !wikiSections && !wikiImages && (
        <div className="text-muted-foreground py-8 text-center text-xs">
          No wiki article found for this country.
        </div>
      )}
    </div>
  );
}
