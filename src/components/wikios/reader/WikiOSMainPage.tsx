// src/components/wikios/reader/WikiOSMainPage.tsx
// Custom WikiOS main page — inspired by live IxWiki but with
// IxStats/IxWorld/IxTime integration and modern glass-physics design.
// No separate WikiOS header — uses the IxStats navigation bar.

"use client";

import { useMemo } from "react";
import Link from "next/link";
import { api } from "~/trpc/react";
import { withBasePath } from "~/lib/base-path";
import { formatMWTimeAgo } from "~/lib/wikios/mediawiki-timestamp";

// ---------------------------------------------------------------------------
// Category definitions (matches live IxWiki navigation grid)
// ---------------------------------------------------------------------------

const CATEGORIES = [
  { name: "Countries", color: "#3b82f6" },
  { name: "Companies", color: "#f97316" },
  { name: "Culture", color: "#a855f7" },
  { name: "Economy", color: "#22c55e" },
  { name: "Geography", color: "#14b8a6" },
  { name: "Government", color: "#6366f1" },
  { name: "History", color: "#eab308" },
  { name: "Military", color: "#ef4444" },
  { name: "Nature", color: "#10b981" },
  { name: "People", color: "#ec4899" },
  { name: "Politics", color: "#8b5cf6" },
  { name: "Technology", color: "#06b6d4" },
] as const;

// ---------------------------------------------------------------------------
// Main Page Component
// ---------------------------------------------------------------------------

export function WikiOSMainPage() {

  // Fetch Main_Page HTML to extract the featured article from it
  const { data: mainPageData } = api.wikios.getArticleHtml.useQuery(
    { title: "Main Page" },
    { staleTime: 10 * 60 * 1000 }
  );

  // Fetch recent changes
  const { data: recentChanges } = api.wikios.getRecentChanges.useQuery(
    { limit: 6 },
    { staleTime: 30_000 }
  );

  // Fetch countries for "Explore the World"
  const { data: countries } = api.countries.getSelectList.useQuery(
    { limit: 50 },
    { staleTime: 10 * 60 * 1000 }
  );

  // Fetch site stats
  const { data: siteStats } = api.wikios.getSiteStats.useQuery(
    undefined,
    { staleTime: 5 * 60 * 1000 }
  );

  // Fetch blurb count
  const { data: blurbCount } = api.blurbs.getBlurbCount.useQuery(
    undefined,
    { staleTime: 5 * 60 * 1000 }
  );

  // Extract featured article from Main_Page contentHtml (server-transformed)
  const featuredArticleHtml = useMemo(() => {
    if (!mainPageData?.contentHtml) return null;
    return extractFeaturedArticle(mainPageData.contentHtml);
  }, [mainPageData?.contentHtml]);

  // Pick 12 random countries for "Explore the World"
  const randomCountries = useMemo(() => {
    if (!countries || countries.length === 0) return [];
    const shuffled = [...countries].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, 12);
  }, [countries]);

  return (
    <div className="wikios-main">
      {/* Hero Header */}
      <header className="wikios-main-hero">
        <div className="wikios-main-hero-inner">
          <div className="wikios-main-pretitle">Welcome to</div>
          <h1 className="wikios-main-title">
            <img
              src="https://ixwiki.com/data/IxWiki_4.svg"
              alt="IxWiki"
              className="wikios-main-logo"
            />
            IXWIKI
          </h1>
          <p className="wikios-main-tagline">
            The <em>bespoke</em> two-decades old geopolitical worldbuilding community & fictional encyclopedia
          </p>
        </div>
      </header>

      {/* Quick Stats Bar */}
      <section className="wikios-main-stats">
        <div className="wikios-main-stat">
          <span className="wikios-main-stat-value">
            {siteStats?.articles?.toLocaleString() ?? "..."}
          </span>
          <span className="wikios-main-stat-label">Articles</span>
        </div>
        <div className="wikios-main-stat">
          <span className="wikios-main-stat-value">
            {siteStats?.edits?.toLocaleString() ?? "..."}
          </span>
          <span className="wikios-main-stat-label">Edits</span>
        </div>
        <div className="wikios-main-stat">
          <span className="wikios-main-stat-value">
            {siteStats?.users?.toLocaleString() ?? "..."}
          </span>
          <span className="wikios-main-stat-label">Users</span>
        </div>
        <div className="wikios-main-stat">
          <span className="wikios-main-stat-value wikios-main-stat-ixtime">
            {blurbCount?.toLocaleString() ?? "..."}
          </span>
          <span className="wikios-main-stat-label">Blurbs</span>
        </div>
      </section>

      <div className="wikios-main-content">
        {/* Featured Article */}
        {featuredArticleHtml && (
          <section className="wikios-main-featured glass-hierarchy-child">
            <div className="wikios-main-featured-badge">Featured Article</div>
            <div
              className="wikios-main-featured-content wikios-article-content"
              dangerouslySetInnerHTML={{ __html: featuredArticleHtml }}
            />
          </section>
        )}

        {/* Two-column grid: Categories + Recent Changes */}
        <div className="wikios-main-grid">
          {/* Category Navigation */}
          <section className="wikios-main-section">
            <h2 className="wikios-main-section-title">Browse by topic</h2>
            <div className="wikios-main-categories">
              {CATEGORIES.map((cat) => (
                <Link
                  key={cat.name}
                  href={withBasePath(`/wiki-special/categories/${encodeURIComponent(cat.name)}`)}
                  className="wikios-main-cat-pill"
                  style={{ "--cat-color": cat.color } as React.CSSProperties}
                >
                  <span className="wikios-main-cat-name">{cat.name}</span>
                </Link>
              ))}
            </div>
          </section>

          {/* Recent Changes */}
          <section className="wikios-main-section">
            <h2 className="wikios-main-section-title">
              Recent activity
              <Link href={withBasePath("/wiki-special/recent-changes")} className="wikios-main-section-more">
                View all →
              </Link>
            </h2>
            {recentChanges && recentChanges.length > 0 ? (
              <ul className="wikios-main-recent">
                {recentChanges.map((rc, idx) => (
                  <li key={idx} className="wikios-main-recent-item">
                    <Link
                      href={withBasePath(`/w/${encodeURIComponent((rc.title ?? "").replace(/ /g, "_"))}`)}
                      className="wikios-main-recent-title"
                    >
                      {rc.title}
                    </Link>
                    <span className="wikios-main-recent-meta">
                      {rc.user} · {formatMWTimeAgo(rc.timestamp)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-zinc-500 text-sm">Loading recent changes...</p>
            )}
          </section>
        </div>

        {/* Explore the World — random country cards */}
        {randomCountries.length > 0 && (
          <section className="wikios-main-section">
            <h2 className="wikios-main-section-title">
              Explore the world
              <Link href={withBasePath("/countries")} className="wikios-main-section-more">
                All countries →
              </Link>
            </h2>
            <div className="wikios-main-world">
              {randomCountries.map((c) => (
                <Link
                  key={c.id}
                  href={withBasePath(`/w/${encodeURIComponent((c.name ?? "").replace(/ /g, "_"))}`)}
                  className="wikios-main-world-card glass-hierarchy-child"
                >
                  {c.flagUrl && (
                    <img
                      src={c.flagUrl}
                      alt=""
                      className="wikios-main-world-flag"
                      loading="lazy"
                    />
                  )}
                  <div className="wikios-main-world-info">
                    <span className="wikios-main-world-name">{c.name}</span>
                    {c.economicTier && (
                      <span className="wikios-main-world-tier">{c.economicTier}</span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Extract featured article from Main_Page HTML
// ---------------------------------------------------------------------------

function extractFeaturedArticle(html: string): string | null {
  // The featured article card has id="featured&#95;article" (HTML-encoded underscore)
  // Find the start of the card div, then extract it using balanced tag counting

  const startIdx = html.search(/<div[^>]*id="featured(?:_|&#95;)article"/i);
  if (startIdx === -1) return null;

  // Balanced extraction — count <div> opens and </div> closes
  let depth = 0;
  let pos = startIdx;
  const openTag = "<div";
  const closeTag = "</div>";

  while (pos < html.length) {
    const nextOpen = html.indexOf(openTag, pos + (depth === 0 ? 0 : 1));
    const nextClose = html.indexOf(closeTag, pos);

    if (nextClose === -1) break;

    if (nextOpen !== -1 && nextOpen < nextClose) {
      depth++;
      pos = nextOpen + openTag.length;
    } else {
      if (depth <= 1) {
        const endPos = nextClose + closeTag.length;
        return transformFeaturedContent(html.slice(startIdx, endPos));
      }
      depth--;
      pos = nextClose + closeTag.length;
    }
  }

  return null;
}

function transformFeaturedContent(cardHtml: string): string {
  // Content is already server-transformed (links, images).
  // Just restyle the card classes for WikiOS layout.
  return cardHtml
    .replace(/class="card[^"]*"/i, 'class="wikios-fa-card"')
    .replace(/class="card-image[^"]*"/gi, 'class="wikios-fa-image"')
    .replace(/class="card-text"/gi, 'class="wikios-fa-text"')
    .replace(/class="byline"/gi, 'class="wikios-fa-byline"')
    .replace(/href="\/w\/Special:MyLanguage\//g, 'href="/w/');
}
