// src/components/wikios/reader/ArticleRenderer.tsx
// Renders pre-transformed WikiOS article data in reader mode.
// All HTML transformation happens server-side — this component just renders.

"use client";

import { useRef, useEffect, useState } from "react";
import Link from "next/link";
import { History, Link2, ExternalLink, X, Trophy } from "lucide-react";
import { withBasePath } from "~/lib/base-path";
import type { TocEntry } from "~/lib/wikios/html-transformer";
import { StickyToc } from "~/components/wikios/reader/StickyToc";
import { InfoboxWithMap } from "~/components/wikios/reader/InfoboxWithMap";
import { useImageLightbox } from "~/components/wikios/reader/ImageLightbox";
import { useWikiContext } from "~/components/wikios/shared/WikiContext";
import { CategoryBreadcrumb } from "~/components/wikios/reader/CategoryBreadcrumb";
import { StashButton } from "~/components/wikios/reader/StashButton";
import { useAnnotationOverlay } from "~/components/wikios/reader/AnnotationOverlay";
import { api } from "~/trpc/react";
import { useUser } from "~/context/auth-context";

interface ArticleRendererProps {
  title: string;
  contentHtml: string;
  infoboxHtml: string | null;
  noticesHtml: string | null;
  toc: TocEntry[];
  categories: string[];
  lastModified: string | null;
}

export function ArticleRenderer({
  title,
  contentHtml,
  infoboxHtml,
  noticesHtml,
  toc,
  categories,
  lastModified,
}: ArticleRendererProps) {
  const titleRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const { setWikiPage } = useWikiContext();
  const { user } = useUser();
  const isAuthenticated = !!user;

  // Modal state for quick actions
  const [activeModal, setActiveModal] = useState<"history" | "backlinks" | null>(null);

  // Feed TOC data to WikiContext for Dynamic Island wiki mode
  useEffect(() => {
    setWikiPage(title, toc);
    return () => setWikiPage(null, []);
  }, [title, toc, setWikiPage]);

  // Make navbox titles clickable to toggle collapse
  useEffect(() => {
    const container = contentRef.current;
    if (!container) return;

    const handleClick = (e: Event) => {
      const target = e.target as HTMLElement;
      const navTitle = target.closest(".navbox-title");
      if (!navTitle) return;
      if (target.closest("a")) return;

      e.stopPropagation();
      e.preventDefault();

      const navbox = navTitle.closest("div.navbox, [role='navigation'].navbox");
      if (navbox) {
        navbox.classList.toggle("wikios-navbox-expanded");
      }
    };

    container.addEventListener("click", handleClick, true);
    return () => container.removeEventListener("click", handleClick, true);
  }, [contentHtml]);

  // Image lightbox
  const lightboxPortal = useImageLightbox(contentRef);

  // Check stash status for annotation overlay
  const stashQuery = api.wikios.isStashed.useQuery(
    { pageTitle: title },
    { enabled: isAuthenticated, retry: false }
  );
  const isStashed = stashQuery.data?.stashed ?? false;

  // Annotation overlay — highlights + selection toolbar
  const { toggleButton: markupToggle, toolbarPortal, annotationPopover } =
    useAnnotationOverlay(contentRef, title, isAuthenticated, isStashed);

  // Award badge detection
  const awardQuery = api.lorewards.isAwardWinningArticle.useQuery(
    { title },
    { staleTime: 300000 }
  );
  const awardData = awardQuery.data;

  const slug = encodeURIComponent(title.replace(/ /g, "_"));

  return (
    <div className="wikios-article">
      <div ref={titleRef} className="wikios-title-sentinel" />

      {/* Category breadcrumbs */}
      <CategoryBreadcrumb title={title} />

      {/* Award banner */}
      {awardData?.isAward && (() => {
        const count = awardData.entries.length;
        return (
          <Link
            href={withBasePath("/wiki-special/lorewards")}
            className="wikios-award-banner"
          >
            <Trophy size={15} />
            <span className="wikios-award-banner-text">
              {count > 1 ? `${count}x Award-winning article` : "Award-winning article"}
            </span>
            <span className="wikios-award-banner-detail">
              {formatAwardDates(awardData.entries)}
            </span>
          </Link>
        );
      })()}

      {/* Article toolbar — quick actions */}
      <div className="wikios-article-toolbar">
        <div className="wikios-toolbar-actions">
          <button
            onClick={() => setActiveModal("history")}
            className="wikios-toolbar-action"
            title="Quick view history"
          >
            <History size={13} />
            <span>History</span>
          </button>
          <button
            onClick={() => setActiveModal("backlinks")}
            className="wikios-toolbar-action"
            title="Quick view backlinks"
          >
            <Link2 size={13} />
            <span>Links Here</span>
          </button>
          {markupToggle}
          <StashButton title={title} isAuthenticated={isAuthenticated} />
        </div>
      </div>

      {/* Page-top notices (WIP, stub, hatnotes) */}
      {noticesHtml && (
        <div
          className="wikios-notices"
          dangerouslySetInnerHTML={{ __html: noticesHtml }}
        />
      )}

      {/* Content + sticky TOC side-by-side */}
      <div className="wikios-article-with-toc">
        <div className="wikios-article-main" ref={contentRef}>
          <div className="wikios-article-body wikios-article-content">
            {infoboxHtml && (
              <InfoboxWithMap infoboxHtml={infoboxHtml} articleTitle={title} />
            )}
            <div dangerouslySetInnerHTML={{ __html: contentHtml }} />
          </div>

          {categories.length > 0 && <CategoriesBar categories={categories} />}
          <ArticleFooter title={title} lastModified={lastModified} />
        </div>

        {toc.length > 3 && <StickyToc entries={toc} contentRef={contentRef} />}
      </div>

      {lightboxPortal}
      {toolbarPortal}
      {annotationPopover}

      {/* Quick action modals */}
      {activeModal === "history" && (
        <QuickHistoryModal title={title} slug={slug} onClose={() => setActiveModal(null)} />
      )}
      {activeModal === "backlinks" && (
        <QuickBacklinksModal title={title} slug={slug} onClose={() => setActiveModal(null)} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Quick History Modal
// ---------------------------------------------------------------------------
function QuickHistoryModal({ title, slug, onClose }: { title: string; slug: string; onClose: () => void }) {
  const { data, isLoading } = api.wikios.getHistory.useQuery(
    { title, limit: 10 },
    { staleTime: 30_000 }
  );

  const revisions = data?.revisions ?? [];

  return (
    <div className="wikios-modal-backdrop" onClick={onClose}>
      <div className="wikios-quick-modal" onClick={(e) => e.stopPropagation()}>
        <div className="wikios-quick-modal-header">
          <div className="wikios-quick-modal-title">
            <History size={16} />
            <span>Recent History</span>
          </div>
          <button onClick={onClose} className="wikios-quick-modal-close"><X size={16} /></button>
        </div>

        <div className="wikios-quick-modal-body">
          {isLoading && <div className="wikios-quick-modal-loading">Loading history...</div>}
          {revisions.map((rev, idx) => {
            const prevRev = revisions[idx + 1];
            const sizeChange = prevRev ? rev.size - prevRev.size : rev.size;
            return (
              <div key={rev.revid} className="wikios-quick-modal-row">
                <div className="wikios-quick-modal-row-main">
                  <span className="wikios-quick-modal-date">
                    {new Date(rev.timestamp).toLocaleDateString("en-US", {
                      month: "short", day: "numeric",
                    })}
                  </span>
                  <span className="wikios-quick-modal-user">{rev.user}</span>
                  <span className={`wikios-quick-modal-diff ${sizeChange > 0 ? "wikios-diff-positive" : sizeChange < 0 ? "wikios-diff-negative" : ""}`}>
                    {sizeChange > 0 ? "+" : ""}{sizeChange.toLocaleString()}
                  </span>
                  {rev.minor && <span className="wikios-quick-modal-minor">m</span>}
                </div>
                {rev.comment && (
                  <div className="wikios-quick-modal-comment">{rev.comment}</div>
                )}
              </div>
            );
          })}
        </div>

        <Link
          href={withBasePath(`/wiki-special/history/${slug}`)}
          className="wikios-quick-modal-fullpage"
          onClick={onClose}
        >
          <ExternalLink size={12} />
          View full history
        </Link>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Quick Backlinks Modal
// ---------------------------------------------------------------------------
function QuickBacklinksModal({ title, slug, onClose }: { title: string; slug: string; onClose: () => void }) {
  const { data, isLoading } = api.wikios.getBacklinks.useQuery(
    { title, limit: 20 },
    { staleTime: 60_000 }
  );

  const links = data?.links ?? [];

  return (
    <div className="wikios-modal-backdrop" onClick={onClose}>
      <div className="wikios-quick-modal" onClick={(e) => e.stopPropagation()}>
        <div className="wikios-quick-modal-header">
          <div className="wikios-quick-modal-title">
            <Link2 size={16} />
            <span>What Links Here</span>
          </div>
          <button onClick={onClose} className="wikios-quick-modal-close"><X size={16} /></button>
        </div>

        <div className="wikios-quick-modal-body">
          {isLoading && <div className="wikios-quick-modal-loading">Loading backlinks...</div>}
          {links.length === 0 && !isLoading && (
            <div className="wikios-quick-modal-empty">No pages link to this article.</div>
          )}
          {links.map((link) => (
            <Link
              key={link.title}
              href={withBasePath(`/w/${encodeURIComponent(link.title.replace(/ /g, "_"))}`)}
              className="wikios-quick-modal-link"
              onClick={onClose}
            >
              {link.title.replace(/_/g, " ")}
            </Link>
          ))}
        </div>

        <Link
          href={withBasePath(`/wiki-special/whatlinkshere/${slug}`)}
          className="wikios-quick-modal-fullpage"
          onClick={onClose}
        >
          <ExternalLink size={12} />
          View all backlinks
        </Link>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Award date formatting — groups intelligently by year/month
// ---------------------------------------------------------------------------
const SHORT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatAwardDates(entries: Array<{ date: string; type: string }>): string {
  if (entries.length === 1) {
    const e = entries[0]!;
    const d = new Date(e.date);
    return `${e.type} winner \u00b7 ${SHORT_MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
  }

  // Sort oldest → newest
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));

  // Group by year, then by month (preserving chronological order)
  const groups: Array<{ year: number; month: number; days: number[] }> = [];
  for (const e of sorted) {
    const d = new Date(e.date);
    const y = d.getFullYear();
    const m = d.getMonth();
    const last = groups[groups.length - 1];
    if (last && last.year === y && last.month === m) {
      last.days.push(d.getDate());
    } else {
      groups.push({ year: y, month: m, days: [d.getDate()] });
    }
  }

  // Build display with consecutive day ranges collapsed: "Mar 19-23, 26 2026"
  return groups.map((g) =>
    `${SHORT_MONTHS[g.month]} ${collapseDays(g.days)} ${g.year}`
  ).join(" \u00b7 ");
}

/** Collapse consecutive days into ranges: [19,20,21,23,26] → "19-21, 23, 26" */
function collapseDays(days: number[]): string {
  if (days.length <= 1) return days.join("");
  const sorted = [...days].sort((a, b) => a - b);
  const parts: string[] = [];
  let start = sorted[0]!;
  let end = start;

  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === end + 1) {
      end = sorted[i]!;
    } else {
      parts.push(start === end ? `${start}` : `${start}-${end}`);
      start = sorted[i]!;
      end = start;
    }
  }
  parts.push(start === end ? `${start}` : `${start}-${end}`);
  return parts.join(", ");
}

// ---------------------------------------------------------------------------
function CategoriesBar({ categories }: { categories: string[] }) {
  const visible = categories.filter(
    (cat) =>
      !cat.startsWith("Pages_") &&
      !cat.startsWith("Articles_") &&
      !cat.includes("_with_") &&
      !cat.startsWith("IXWB")
  );
  if (visible.length === 0) return null;

  return (
    <footer className="wikios-categories">
      <span className="wikios-categories-label">Categories:</span>
      <ul className="wikios-categories-list">
        {visible.map((cat) => (
          <li key={cat}>
            <Link
              href={withBasePath(`/w/Category:${encodeURIComponent(cat.replace(/ /g, "_"))}`)}
              className="wikios-category-link"
            >
              {cat.replace(/_/g, " ")}
            </Link>
          </li>
        ))}
      </ul>
    </footer>
  );
}

// ---------------------------------------------------------------------------
function ArticleFooter({ title, lastModified }: { title: string; lastModified: string | null }) {
  const mwUrl = `/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`;

  return (
    <div className="wikios-article-footer">
      {lastModified && (
        <p className="wikios-last-modified">
          Last modified:{" "}
          {new Date(lastModified).toLocaleDateString("en-US", {
            year: "numeric", month: "long", day: "numeric",
          })}
        </p>
      )}
      <div className="wikios-footer-links">
        <a href={mwUrl} className="wikios-footer-link" target="_blank" rel="noopener">
          View on MediaWiki
        </a>
      </div>
    </div>
  );
}
