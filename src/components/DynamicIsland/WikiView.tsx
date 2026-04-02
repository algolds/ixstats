// src/components/DynamicIsland/WikiView.tsx
// Wiki mode for the Dynamic Island — search, collapsible TOC, map, quick actions.

"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { useRouter, usePathname } from "next/navigation";
import dynamic from "next/dynamic";
import {
  BookOpen, Search, X, FileEdit, History, Shuffle, Home,
  ChevronDown, ChevronRight, Map, Link2, Globe, Clock,
  ExternalLink, Users,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import { useWikiContext } from "~/components/wikios/shared/WikiContext";
import { api } from "~/trpc/react";
import { withBasePath } from "~/lib/base-path";
import { formatMWTimeAgo } from "~/lib/wikios/mediawiki-timestamp";

const CountryMapEmbed = dynamic(
  () => import("~/components/maps/widgets/CountryMapEmbed").then((m) => ({ default: m.CountryMapEmbed })),
  { ssr: false, loading: () => null }
);

interface WikiViewProps {
  onClose: () => void;
}

export function WikiView({ onClose }: WikiViewProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const { articleTitle, tocEntries, activeSectionId, navigateToSection } = useWikiContext();
  const [searchQuery, setSearchQuery] = useState("");
  const [sectionsOpen, setSectionsOpen] = useState(false);
  const [mapOpen, setMapOpen] = useState(true);
  const [recentOpen, setRecentOpen] = useState(false);

  const isMainPage = pathname?.includes("/w/Main_Page") || pathname?.includes("/w/Main%20Page") || false;

  useEffect(() => {
    setTimeout(() => searchInputRef.current?.focus(), 50);
  }, []);

  const { data: searchData, isFetching: isSearching } = api.wikios.advancedSearch.useQuery(
    { query: searchQuery, limit: 8 },
    { enabled: searchQuery.length >= 2, staleTime: 30_000 }
  );
  const searchResults = searchData?.results ?? [];

  // Country match for map
  const { data: countries } = api.countries.getSelectList.useQuery(
    { search: articleTitle ?? "", limit: 5 },
    { enabled: !!articleTitle && !isMainPage, staleTime: 10 * 60 * 1000 }
  );

  const matchedCountry = useMemo(() => {
    if (!countries || !articleTitle) return null;
    return countries.find(
      (c) => c.name?.toLowerCase() === articleTitle.toLowerCase()
    ) ?? null;
  }, [countries, articleTitle]);

  // Recent changes for the feed
  const { data: recentChanges } = api.wikios.getRecentChanges.useQuery(
    { limit: 5 },
    { staleTime: 60_000 }
  );

  const visibleToc = useMemo(
    () => tocEntries.filter((e) => e.level <= 3),
    [tocEntries]
  );

  const handleNavigateToArticle = useCallback(
    (title: string) => {
      onClose();
      router.push(withBasePath(`/w/${encodeURIComponent(title.replace(/ /g, "_"))}`));
    },
    [router, onClose]
  );

  const handleSectionClick = useCallback(
    (id: string) => {
      navigateToSection(id);
      onClose();
    },
    [navigateToSection, onClose]
  );

  const slug = articleTitle ? encodeURIComponent(articleTitle.replace(/ /g, "_")) : null;

  return (
    <div className="p-4">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="text-foreground flex items-center gap-2 text-lg font-bold">
          <BookOpen className="h-5 w-5 text-blue-400" />
          <span>Wiki</span>
          {articleTitle && (
            <span className="text-muted-foreground ml-1 text-sm font-normal truncate max-w-[200px]">
              — {articleTitle}
            </span>
          )}
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground hover:bg-accent/10 px-2 py-2"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Search */}
      <div className="mb-3">
        <div className="border-border bg-accent/5 flex items-center gap-2 rounded-lg border px-3">
          <Search className="text-muted-foreground h-4 w-4 flex-shrink-0" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search wiki articles..."
            className="text-foreground placeholder:text-muted-foreground w-full bg-transparent py-2 text-sm outline-none"
            data-command-palette-search="true"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} className="text-muted-foreground hover:text-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Search Results — full-text with snippets */}
      {searchQuery.length >= 2 && (
        <div className="border-border mb-3 border-b pb-3">
          <div className="text-muted-foreground mb-1 flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider">
            <span>Results{searchData?.totalHits ? ` (${searchData.totalHits})` : ""}</span>
            {isSearching && (
              <span className="text-muted-foreground/50 animate-pulse">searching...</span>
            )}
          </div>
          {searchResults.length > 0 ? (
            searchResults.map((result) => (
              <button
                key={result.title}
                onClick={() => handleNavigateToArticle(result.title)}
                className="text-foreground/70 hover:bg-accent/10 hover:text-foreground flex w-full flex-col rounded-md px-2 py-1.5 text-left transition-colors"
              >
                <span className="flex items-center gap-2 text-sm">
                  <BookOpen className="text-muted-foreground h-3.5 w-3.5 flex-shrink-0" />
                  <span className="truncate font-medium">{result.title}</span>
                </span>
                {result.snippet && (
                  <span
                    className="text-muted-foreground mt-0.5 line-clamp-1 pl-[22px] text-[11px] [&_.searchmatch]:text-foreground [&_.searchmatch]:font-semibold"
                    dangerouslySetInnerHTML={{ __html: result.snippet }}
                  />
                )}
              </button>
            ))
          ) : !isSearching ? (
            <p className="text-muted-foreground/50 px-2 py-1 text-xs">No results</p>
          ) : null}
        </div>
      )}

      {!searchQuery && (
        <>
          {/* Sections — collapsible */}
          {articleTitle && visibleToc.length > 0 && (
            <CollapsibleSection
              label="Sections"
              count={visibleToc.length}
              open={sectionsOpen}
              onToggle={() => setSectionsOpen(!sectionsOpen)}
            >
              <div className="max-h-[30vh] overflow-y-auto">
                {visibleToc.map((entry) => (
                  <button
                    key={entry.id}
                    onClick={() => handleSectionClick(entry.id)}
                    className={`flex w-full items-center rounded-md px-2 py-1 text-left text-[13px] transition-colors ${
                      activeSectionId === entry.id
                        ? "bg-blue-500/10 font-medium text-blue-400"
                        : "text-foreground/60 hover:bg-accent/10 hover:text-foreground/90"
                    }`}
                    style={{ paddingLeft: `${8 + (entry.level - 2) * 14}px` }}
                  >
                    {entry.level > 2 && (
                      <span className="text-muted-foreground/40 mr-1.5 text-[10px]">›</span>
                    )}
                    <span className="truncate">{entry.text}</span>
                  </button>
                ))}
              </div>
            </CollapsibleSection>
          )}

          {/* Map — only for country pages */}
          {matchedCountry && (
            <CollapsibleSection
              label="Map"
              icon={<Map className="h-3 w-3" />}
              open={mapOpen}
              onToggle={() => setMapOpen(!mapOpen)}
            >
              <div className="overflow-hidden rounded-lg border border-white/5" style={{ height: 180 }}>
                <CountryMapEmbed
                  countryId={matchedCountry.id}
                  height="h-[180px]"
                  showNeighbors
                  showCities
                  interactive
                />
              </div>
            </CollapsibleSection>
          )}

          {/* Recent Activity — collapsible feed */}
          <CollapsibleSection
            label="Recent Activity"
            icon={<Clock className="h-3 w-3" />}
            open={recentOpen}
            onToggle={() => setRecentOpen(!recentOpen)}
          >
            {recentChanges && recentChanges.length > 0 ? (
              <div className="space-y-0.5">
                {recentChanges.map((rc, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleNavigateToArticle(rc.title ?? "")}
                    className="text-foreground/60 hover:bg-accent/10 hover:text-foreground/90 flex w-full flex-col rounded-md px-2 py-1 text-left transition-colors"
                  >
                    <span className="text-[13px] truncate">{rc.title}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {rc.user} · {formatMWTimeAgo(rc.timestamp)}
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-xs px-2">Loading...</p>
            )}
          </CollapsibleSection>

          {/* Page Actions — contextual to current article */}
          {articleTitle && !isMainPage && (
            <div className="border-border mb-3 border-b pb-3">
              <SectionHeader label="This Page" />
              <div className="space-y-0.5">
                <QuickAction icon={<FileEdit />} label="Edit" shortcut="Tab Tab" onClick={() => {
                  onClose();
                  router.push(withBasePath(`/w/${slug}/edit`));
                }} />
                <QuickAction icon={<History />} label="History" onClick={() => {
                  onClose();
                  router.push(withBasePath(`/w/special/history/${slug}`));
                }} />
                <QuickAction icon={<Link2 />} label="What links here" onClick={() => {
                  onClose();
                  router.push(withBasePath(`/w/special/whatlinkshere/${slug}`));
                }} />
                <QuickAction icon={<ExternalLink />} label="View on MediaWiki" onClick={() => {
                  window.open(`https://ixwiki.com/wiki/${slug}`, "_blank");
                }} />
              </div>
            </div>
          )}

          {/* Navigate */}
          <div>
            <SectionHeader label="Navigate" />
            <div className="space-y-0.5">
              <QuickAction icon={<Home />} label="Main Page" onClick={() => handleNavigateToArticle("Main Page")} />
              <QuickAction icon={<Shuffle />} label="Random Article" onClick={() => {
                onClose();
                router.push(withBasePath("/w/special/random"));
              }} />
              <QuickAction icon={<Globe />} label="All Countries" onClick={() => {
                onClose();
                router.push(withBasePath("/countries"));
              }} />
              <QuickAction icon={<Users />} label="ThinkPages" onClick={() => {
                onClose();
                router.push(withBasePath("/dashboard"));
              }} />
              <QuickAction icon={<Map />} label="World Map" onClick={() => {
                onClose();
                router.push(withBasePath("/maps"));
              }} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SectionHeader({ label }: { label: string }) {
  return (
    <div className="text-muted-foreground mb-1.5 text-[10px] font-semibold uppercase tracking-wider">
      {label}
    </div>
  );
}

function CollapsibleSection({
  label,
  icon,
  count,
  open,
  onToggle,
  children,
}: {
  label: string;
  icon?: React.ReactNode;
  count?: number;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="border-border mb-3 border-b pb-3">
      <button
        onClick={onToggle}
        className="text-muted-foreground hover:text-foreground mb-1 flex w-full items-center justify-between text-[10px] font-semibold uppercase tracking-wider"
      >
        <span className="flex items-center gap-1">
          {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          {icon}
          {label}
        </span>
        {count !== undefined && (
          <span className="text-muted-foreground/50">{count}</span>
        )}
      </button>
      {open && children}
    </div>
  );
}

function QuickAction({
  icon,
  label,
  shortcut,
  onClick,
}: {
  icon: React.ReactElement;
  label: string;
  shortcut?: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="text-foreground/60 hover:bg-accent/10 hover:text-foreground/90 flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm transition-colors"
    >
      <span className="flex items-center gap-2">
        <span className="text-muted-foreground [&>svg]:h-3.5 [&>svg]:w-3.5">{icon}</span>
        <span>{label}</span>
      </span>
      {shortcut && (
        <kbd className="border-border bg-accent/10 text-muted-foreground rounded border px-1.5 py-0.5 text-[10px]">
          {shortcut}
        </kbd>
      )}
    </button>
  );
}
