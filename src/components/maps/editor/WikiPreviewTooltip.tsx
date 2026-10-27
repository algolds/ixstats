"use client";

/**
 * WikiPreviewTooltip — Shows a small preview card when hovering over
 * a wiki-linked feature in the feature list.
 *
 * Fetches the article intro on hover (with 5-minute stale time).
 * Uses createPortal to render to body so it escapes overflow containers.
 */

import React, { useState, useRef, useCallback, useEffect } from "react";
import Link from "next/link";
import { titleToWikiOSRoute } from "~/lib/wiki-os/transformers/url-compat";
import { createPortal } from "react-dom";
import { OpenNewWindow as ExternalLink, SystemRestart as Loader2 } from "iconoir-react";
import { api } from "~/trpc/react";

interface WikiPreviewTooltipProps {
  wikiTitle: string;
  children: React.ReactNode;
}

/** Extract first N sentences from text. */
function firstSentences(text: string, n: number): string {
  // Split on sentence-ending punctuation followed by space or end
  const sentences = text.match(/[^.!?]*[.!?]+/g);
  if (!sentences) return text.slice(0, 200);
  return sentences.slice(0, n).join("").trim();
}

export function WikiPreviewTooltip({ wikiTitle, children }: WikiPreviewTooltipProps) {
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [mounted, setMounted] = useState(false);

  // Only fetch when visible (enabled flag)
  const { data: intro, isLoading } = api.wikios.getIntro.useQuery(
    { title: wikiTitle, wiki: "ixwiki" },
    { enabled: visible, staleTime: 5 * 60_000 }
  );

  useEffect(() => {
    // oxlint-disable-next-line
    setMounted(true);
    return () => setMounted(false);
  }, []);

  const showTooltip = useCallback(() => {
    hoverTimerRef.current = setTimeout(() => {
      if (triggerRef.current) {
        const rect = triggerRef.current.getBoundingClientRect();
        // Position to the left of the element, vertically centered
        setPosition({
          top: rect.top + rect.height / 2,
          left: rect.left - 8,
        });
      }
      setVisible(true);
    }, 400); // 400ms delay before showing
  }, []);

  const hideTooltip = useCallback(() => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
    }
    setVisible(false);
  }, []);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    };
  }, []);

  const tooltipContent =
    visible && mounted
      ? createPortal(
          <div
            className="z-tooltip pointer-events-none fixed"
            style={{
              top: position.top,
              left: position.left,
              transform: "translate(-100%, -50%)",
            }}
          >
            <div className="border-separator bg-surface-elevated rounded-control shadow-floating pointer-events-auto w-64 border p-3">
              <h4 className="text-label text-headline mb-1">{wikiTitle}</h4>
              {isLoading ? (
                <div className="text-label-secondary text-footnote flex items-center gap-2 py-2">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Loading...
                </div>
              ) : intro ? (
                <p className="text-label-secondary text-footnote leading-relaxed">
                  {firstSentences(
                    typeof intro === "string"
                      ? intro
                      : ((intro as { intro?: string })?.intro ?? ""),
                    2
                  )}
                </p>
              ) : (
                <p className="text-label-secondary text-footnote">No article found.</p>
              )}
              <Link
                href={titleToWikiOSRoute(wikiTitle)}
                className="text-tint text-caption mt-2 flex items-center gap-1 hover:underline"
              >
                Open on wiki
                <ExternalLink className="h-3 w-3" />
              </Link>
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <div
      ref={triggerRef}
      onMouseEnter={showTooltip}
      onMouseLeave={hideTooltip}
      className="contents"
    >
      {children}
      {tooltipContent}
    </div>
  );
}
