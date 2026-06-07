// src/components/wikios/reader/ArticleRenderer.tsx
// Renders pre-transformed WikiOS article data in reader mode.
// All HTML transformation happens server-side — this component just renders.

"use client";

import { useRef, useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { History, Link2, ExternalLink, X, Trophy, Search, Calendar, Hash } from "lucide-react";
import { withBasePath } from "~/lib/base-path";
import type { TocEntry } from "~/lib/wikios/html-transformer";
import { StickyToc } from "~/components/wikios/reader/StickyToc";
import { InfoboxWithMap } from "~/components/wikios/reader/InfoboxWithMap";
import { useImageLightbox } from "~/components/wikios/reader/ImageLightbox";
import { useWikiContext } from "~/components/wikios/shared/WikiContext";
import { CategoryBreadcrumb } from "~/components/wikios/reader/CategoryBreadcrumb";
import { StashButton } from "~/components/wikios/reader/StashButton";
import { useAnnotationOverlay } from "~/components/wikios/reader/AnnotationOverlay";
import { useCiteTooltips } from "~/components/wikios/reader/useCiteTooltips";
import { api } from "~/trpc/react";
import { useUser } from "~/context/auth-context";
import { getFlagColors } from "~/lib/flag-color-extractor";
import { Badge } from "~/components/ui/badge";

interface ArticleRendererProps {
  title: string;
  contentHtml: string;
  infoboxHtml: string | null;
  noticesHtml: string | null;
  toc: TocEntry[];
  categories: string[];
  lastModified: string | null;
  wikiSource?: "ixwiki" | "iiwiki" | "althistory";
}

const WIKI_SOURCE_LABELS: Record<string, { label: string; url: string }> = {
  iiwiki: { label: "iiwiki.com", url: "https://iiwiki.com/wiki/" },
  althistory: { label: "althistory.fandom.com", url: "https://althistory.fandom.com/wiki/" },
};

function WikiOSHeader({
  title,
  categories,
  lastModified,
  wikiSource,
  countryData,
  featuredImageUrl,
  themeColors,
  onOpenHistory,
  onOpenBacklinks,
  markupToggle,
  isAuthenticated,
}: {
  title: string;
  categories: string[];
  lastModified: string | null;
  wikiSource?: string;
  countryData?: any;
  featuredImageUrl?: string | null;
  themeColors: any;
  onOpenHistory: () => void;
  onOpenBacklinks: () => void;
  markupToggle: React.ReactNode;
  isAuthenticated: boolean;
}) {
  const backdropUrl = countryData?.flagUrl || featuredImageUrl;

  return (
    <div className="relative overflow-hidden rounded-xl border border-white/5 bg-card/45 backdrop-blur-sm p-4 sm:p-5 mb-6 shadow-lg">
      {/* Backdrop — blurred flag/featured image, or a themed accent wash as fallback */}
      {backdropUrl ? (
        <div aria-hidden="true" className="absolute inset-0 z-0">
          <img
            src={backdropUrl}
            alt=""
            className="h-full w-full scale-110 object-cover opacity-20 blur-[24px] saturate-150"
            loading="eager"
          />
          <div className="from-card/95 via-card/85 to-card/65 absolute inset-0 bg-gradient-to-r" />
        </div>
      ) : (
        <div aria-hidden="true" className="absolute inset-0 z-0 bg-card">
          <div
            className="absolute inset-0 bg-gradient-to-br"
            style={{
              background: `linear-gradient(135deg, ${themeColors.primary}08 0%, transparent 100%)`,
            }}
          />
        </div>
      )}

      {/* Content */}
      <div className="relative z-10 space-y-3">
        {/* Breadcrumb Path & Search */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
            <span>WikiOS</span>
            <span>&rarr;</span>
            <CategoryBreadcrumb title={title} />
          </div>

          {/* Inline Search Button triggers global Search Modal */}
          <button
            onClick={() => {
              window.dispatchEvent(
                new KeyboardEvent("keydown", {
                  key: "k",
                  metaKey: true,
                  bubbles: true,
                })
              );
            }}
            className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] rounded-lg border border-white/10 bg-white/5 text-muted-foreground hover:text-foreground hover:bg-white/10 transition-all outline-none"
          >
            <Search size={12} />
            <span>Search...</span>
          </button>
        </div>

        {/* Title and Badge */}
        <div className="flex flex-wrap items-baseline gap-2.5">
          <h1 className="text-xl sm:text-2xl font-bold text-foreground leading-tight tracking-tight">
            {title.replace(/_/g, " ")}
          </h1>
          {wikiSource && wikiSource !== "ixwiki" && (
            <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-400 border-amber-500/20 py-0 px-1.5">
              {wikiSource}
            </Badge>
          )}
        </div>

        {/* Metadata & Actions */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-1 border-t border-white/5">
          {/* Metadata */}
          <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
            {lastModified && (
              <span className="flex items-center gap-1">
                <Calendar size={12} className="text-muted-foreground/60" />
                Updated: {new Date(lastModified).toLocaleDateString()}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Hash size={12} className="text-muted-foreground/60" />
              {categories.length} Categories
            </span>
          </div>

          {/* Action Badges */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={onOpenHistory}
              className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-semibold rounded-md border border-white/5 bg-white/[0.03] text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
              title="View revision history"
            >
              <History size={11} className="text-muted-foreground/60" />
              <span>History</span>
            </button>

            <button
              onClick={onOpenBacklinks}
              className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-semibold rounded-md border border-white/5 bg-white/[0.03] text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
              title="Pages that link here"
            >
              <Link2 size={11} className="text-muted-foreground/60" />
              <span>Links Here</span>
            </button>

            {markupToggle}
            <StashButton title={title} isAuthenticated={isAuthenticated} />
          </div>
        </div>
      </div>
    </div>
  );
}

export function ArticleRenderer({
  title,
  contentHtml,
  infoboxHtml,
  noticesHtml,
  toc,
  categories,
  lastModified,
  wikiSource,
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
  const {
    toggleButton: markupToggle,
    toolbarPortal,
    annotationPopover,
  } = useAnnotationOverlay(contentRef, title, isAuthenticated, isStashed);

  // Citation hover tooltips
  const citeTooltipPortal = useCiteTooltips(contentRef);

  // Award badge detection
  const awardQuery = api.lorewards.isAwardWinningArticle.useQuery({ title }, { staleTime: 300000 });
  const awardData = awardQuery.data;

  const slug = encodeURIComponent(title.replace(/ /g, "_"));

  const featuredImageUrl = useMemo(() => {
    if (infoboxHtml) {
      const match = infoboxHtml.match(/<img[^>]+src=["']([^"']+)["']/i);
      if (match && match[1]) return match[1];
    }
    if (contentHtml) {
      const match = contentHtml.match(/<img[^>]+src=["']([^"']+)["']/i);
      if (match && match[1]) return match[1];
    }
    return null;
  }, [infoboxHtml, contentHtml]);

  const { data: countryData } = api.countries.getByIdBasic.useQuery(
    { id: title },
    {
      enabled:
        !!title &&
        title.trim() !== "" &&
        title !== "Main Page" &&
        title !== "Main_Page" &&
        !title.includes(":"),
      retry: false,
    }
  );

  const themeColors = useMemo(() => {
    if (countryData?.name) {
      return getFlagColors(countryData.name);
    }

    // Fallback: category/namespace matching
    let hue = 217; // Default blue

    const catStr = categories.join(" ").toLowerCase();
    if (
      catStr.includes("history") ||
      catStr.includes("politics") ||
      catStr.includes("executive") ||
      catStr.includes("government")
    ) {
      hue = 38; // Gold/Amber
    } else if (
      catStr.includes("military") ||
      catStr.includes("war") ||
      catStr.includes("conflict") ||
      catStr.includes("defense")
    ) {
      hue = 0; // Red
    } else if (
      catStr.includes("diplomacy") ||
      catStr.includes("geography") ||
      catStr.includes("relation")
    ) {
      hue = 188; // Cyan
    } else if (catStr.includes("file") || catStr.includes("media") || catStr.includes("image")) {
      hue = 142; // Green
    } else if (catStr.includes("talk") || catStr.includes("discussion")) {
      hue = 262; // Purple
    } else if (title.startsWith("File:")) {
      hue = 142; // Green
    } else if (title.startsWith("Talk:")) {
      hue = 262; // Purple
    }

    return {
      primary: `hsl(${hue}, 80%, 45%)`,
      secondary: `hsl(${hue}, 60%, 60%)`,
      accent: `hsl(${hue}, 80%, 45%)`,
      rgbPrimary: { r: 59, g: 130, b: 246 },
    };
  }, [countryData, categories, title]);

  const containerStyle = {
    "--wikios-accent": themeColors.primary,
    "--wikios-accent-hover": themeColors.secondary,
    "--wikios-link": themeColors.primary,
    "--wikios-link-hover": themeColors.secondary,
  } as React.CSSProperties;

  return (
    <div className="wikios-article" style={containerStyle}>
      <div ref={titleRef} className="wikios-title-sentinel" />

      {/* Redesigned Custom WikiOSHeader */}
      <WikiOSHeader
        title={title}
        categories={categories}
        lastModified={lastModified}
        wikiSource={wikiSource}
        countryData={countryData}
        featuredImageUrl={featuredImageUrl}
        themeColors={themeColors}
        onOpenHistory={() => setActiveModal("history")}
        onOpenBacklinks={() => setActiveModal("backlinks")}
        markupToggle={markupToggle}
        isAuthenticated={isAuthenticated}
      />

      {/* External wiki source badge */}
      {wikiSource && wikiSource !== "ixwiki" && WIKI_SOURCE_LABELS[wikiSource] && (
        <div className="mb-4 flex items-center gap-1.5">
          <a
            href={`${WIKI_SOURCE_LABELS[wikiSource]!.url}${encodeURIComponent(title.replace(/ /g, "_"))}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded bg-amber-50/5 border border-amber-500/10 px-2 py-0.5 text-xs text-amber-500 hover:bg-amber-500/10 transition-colors"
          >
            <ExternalLink size={11} />
            From {WIKI_SOURCE_LABELS[wikiSource]!.label}
          </a>
        </div>
      )}

      {/* Award banner */}
      {awardData?.isAward &&
        (() => {
          const count = awardData.entries.length;
          return (
            <Link href={withBasePath("/w/special/lorewards")} className="wikios-award-banner mb-6">
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

      {/* Page-top notices (WIP, stub, hatnotes) */}
      {noticesHtml && (
        <div className="wikios-notices" dangerouslySetInnerHTML={{ __html: noticesHtml }} />
      )}

      {/* Content + sticky TOC side-by-side */}
      <div className="wikios-article-with-toc">
        <div className="wikios-article-main" ref={contentRef}>
          <div className="wikios-article-body wikios-article-content">
            {infoboxHtml && <InfoboxWithMap infoboxHtml={infoboxHtml} articleTitle={title} />}
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
      {citeTooltipPortal}

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
function QuickHistoryModal({
  title,
  slug,
  onClose,
}: {
  title: string;
  slug: string;
  onClose: () => void;
}) {
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
          <button onClick={onClose} className="wikios-quick-modal-close">
            <X size={16} />
          </button>
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
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                  <span className="wikios-quick-modal-user">{rev.user}</span>
                  <span
                    className={`wikios-quick-modal-diff ${sizeChange > 0 ? "wikios-diff-positive" : sizeChange < 0 ? "wikios-diff-negative" : ""}`}
                  >
                    {sizeChange > 0 ? "+" : ""}
                    {sizeChange.toLocaleString()}
                  </span>
                  {rev.minor && <span className="wikios-quick-modal-minor">m</span>}
                </div>
                {rev.comment && <div className="wikios-quick-modal-comment">{rev.comment}</div>}
              </div>
            );
          })}
        </div>

        <Link
          href={withBasePath(`/w/special/history/${slug}`)}
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
function QuickBacklinksModal({
  title,
  slug,
  onClose,
}: {
  title: string;
  slug: string;
  onClose: () => void;
}) {
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
          <button onClick={onClose} className="wikios-quick-modal-close">
            <X size={16} />
          </button>
        </div>

        <div className="wikios-quick-modal-body">
          {isLoading && <div className="wikios-quick-modal-loading">Loading backlinks...</div>}
          {links.length === 0 && !isLoading && (
            <div className="wikios-quick-modal-empty">No pages link to this article.</div>
          )}
          {links.map((link, i) => (
            <Link
              key={`${link.title}-${i}`}
              href={withBasePath(`/w/${encodeURIComponent(link.title.replace(/ /g, "_"))}`)}
              className="wikios-quick-modal-link"
              onClick={onClose}
            >
              {link.title.replace(/_/g, " ")}
            </Link>
          ))}
        </div>

        <Link
          href={withBasePath(`/w/special/whatlinkshere/${slug}`)}
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
const SHORT_MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

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
  return groups
    .map((g) => `${SHORT_MONTHS[g.month]} ${collapseDays(g.days)} ${g.year}`)
    .join(" \u00b7 ");
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
            year: "numeric",
            month: "long",
            day: "numeric",
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
