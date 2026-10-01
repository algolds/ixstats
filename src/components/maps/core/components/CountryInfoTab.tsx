"use client";

import React from "react";
import Link from "next/link";
import {
  OpenBook as BookOpen,
  MediaImage as ImageIcon,
  OpenNewWindow as ExternalLink,
} from "iconoir-react";
import { titleToWikiOSPath } from "~/lib/wiki-os/transformers/url-compat";
import { sanitizeWikiContent } from "~/lib/utils";
import { WikiHtmlContent } from "~/components/wiki-os/reader/WikiLinkPreview";
import { Button } from "~/components/ui/button";
import { Eyebrow } from "~/components/ui/eyebrow";

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
        <div className="space-y-2">
          {wikiRichIntro.paragraphs.slice(0, introExpanded ? 5 : 2).map((p: string, i: number) => (
            <WikiHtmlContent
              key={i}
              as="p"
              className="text-label-secondary text-footnote leading-relaxed"
              html={sanitizeWikiContent(p)}
            />
          ))}
          {wikiRichIntro.paragraphs.length > 2 && (
            <Button
              type="button"
              variant="link"
              size="sm"
              onClick={() => setIntroExpanded((v) => !v)}
              className="text-blue h-auto px-0"
            >
              {introExpanded ? "Show less" : "Read more..."}
            </Button>
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
              <Eyebrow className="flex items-center gap-2">
                <BookOpen className="h-3 w-3" />
                Table of contents ({wikiSections.filter((s) => s.level === 2).length})
              </Eyebrow>
              <div className="mt-2 space-y-1">
                {wikiSections
                  .filter((s) => s.level <= 3)
                  .map((section, i) => {
                    const sectionUrl = `${baseWikiUrl}#${section.anchor}`;
                    if (section.level === 2) {
                      return (
                        <div
                          key={`${section.anchor}-${i}`}
                          className="border-separator rounded-control-sm border p-2"
                        >
                          {isInternal ? (
                            <Link
                              href={sectionUrl}
                              className="text-label text-caption hover:text-blue block transition-colors"
                            >
                              {section.line}
                            </Link>
                          ) : (
                            <a
                              href={sectionUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-label text-caption hover:text-blue block transition-colors"
                            >
                              {section.line}
                            </a>
                          )}
                          {"preview" in section && section.preview && (
                            <p className="text-label-secondary text-footnote mt-0.5 line-clamp-2 leading-snug">
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
                        className="text-label-secondary text-footnote hover:text-blue block truncate pl-3 transition-colors"
                      >
                        {section.line}
                      </Link>
                    ) : (
                      <a
                        key={`${section.anchor}-${i}`}
                        href={sectionUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-label-secondary text-footnote hover:text-blue block truncate pl-3 transition-colors"
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
          <Eyebrow className="flex items-center gap-2">
            <ImageIcon className="h-3 w-3" />
            Media ({wikiImages.length})
          </Eyebrow>
          <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
            {wikiImages.slice(0, 12).map((img, i) => (
              <button
                key={`${img.title}-${i}`}
                onClick={() => setLightboxSrc(img.url)}
                className="border-separator rounded-control-sm shrink-0 overflow-hidden border transition-transform hover:scale-105"
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
          <Button asChild variant="outline" size="sm" className="w-full">
            <Link href={wikiRichIntro.wikiUrl}>
              <BookOpen aria-hidden />
              Read full article on IxWiki
            </Link>
          </Button>
        ) : (
          <Button asChild variant="outline" size="sm" className="w-full">
            <a href={wikiRichIntro.wikiUrl} target="_blank" rel="noopener noreferrer">
              <BookOpen aria-hidden />
              Read full article on {wikiRichIntro.wikiUrl.includes("ixwiki") ? "IxWiki" : "IIWiki"}
              <ExternalLink aria-hidden />
            </a>
          </Button>
        ))}

      {!wikiRichIntro && !wikiSections && !wikiImages && (
        <div className="text-label-secondary text-footnote py-8 text-center">
          No wiki article found for this country.
        </div>
      )}
    </div>
  );
}
