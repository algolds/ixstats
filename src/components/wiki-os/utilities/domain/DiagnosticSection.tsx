"use client";

import { Activity, WarningTriangle, LinkSlash, EyeClosed, Page } from "iconoir-react";
import { api } from "~/trpc/react";
import {
  InspectorEmpty,
  InspectorList,
  InspectorLoading,
  InspectorPageLink,
  InspectorRow,
  InspectorSection,
  type InspectorTool,
} from "./InspectorSection";

interface DiagnosticItem {
  id?: string;
  slug?: string;
  title: string;
  length?: number;
  wordCount?: number;
  readingTime?: number;
  targetSlug?: string;
}

interface DiagnosticView {
  loadingText: string;
  /** Shown instead of an empty list; absent for the short/long lists. */
  emptyText?: string;
  keyPrefix: string;
  /** Broken redirects have no page to link to. */
  plainTitle?: boolean;
  value: (item: DiagnosticItem) => string;
  valueClass: string;
}

const BYTE_COUNT = {
  valueClass: "text-label-secondary",
  value: (i: DiagnosticItem) => `${i.length} bytes`,
};
const WORDS = (i: DiagnosticItem) => `${i.wordCount} words (${i.readingTime}m read)`;

const VIEWS: Record<string, DiagnosticView> = {
  orphans: {
    ...BYTE_COUNT,
    loadingText: "Scanning orphan articles...",
    emptyText: "No orphan pages found.",
    keyPrefix: "orphan",
  },
  deadEnds: {
    ...BYTE_COUNT,
    loadingText: "Scanning dead-end pages...",
    emptyText: "Every article has outbound wikilinks.",
    keyPrefix: "deadend",
  },
  brokenRedirects: {
    loadingText: "Inspecting redirects...",
    emptyText: "No broken redirects found.",
    keyPrefix: "broken",
    plainTitle: true,
    valueClass: "text-red",
    value: (i) => `Target missing: [[${i.targetSlug}]]`,
  },
  short: {
    loadingText: "Loading short articles...",
    keyPrefix: "short",
    valueClass: "text-label-secondary",
    value: WORDS,
  },
  long: {
    loadingText: "Loading flagship articles...",
    keyPrefix: "long",
    valueClass: "text-green",
    value: WORDS,
  },
};

const TOOLS: Omit<InspectorTool, "badge">[] = [
  {
    id: "orphans",
    title: "Orphan pages scanner",
    description: "Pages with 0 incoming links from other lore documents.",
    legacyAlias: "Special:LonelyPages",
    icon: EyeClosed,
    color: "border-yellow/20 bg-yellow/10 text-yellow",
  },
  {
    id: "deadEnds",
    title: "Dead-End Pages Scanner",
    description: "Pages with 0 outgoing wikilinks or citations.",
    legacyAlias: "Special:DeadendPages",
    icon: LinkSlash,
    color: "border-indigo/20 bg-indigo/10 text-indigo",
  },
  {
    id: "brokenRedirects",
    title: "Broken redirects detector",
    description: "Redirect aliases pointing to non-existent or archived targets.",
    legacyAlias: "Special:BrokenRedirects",
    icon: WarningTriangle,
    color: "border-red/20 bg-red/10 text-red",
  },
  {
    id: "short",
    title: "Short & stub articles",
    description: "Articles with minimal word counts requiring expansion.",
    legacyAlias: "Special:ShortPages",
    icon: Page,
    color: "border-blue/20 bg-blue/10 text-blue",
  },
  {
    id: "long",
    title: "Long articles",
    description: "Major flagship lore documents with extensive word counts.",
    legacyAlias: "Special:LongPages",
    icon: Page,
    color: "border-green/20 bg-green/10 text-green",
  },
];

export function DiagnosticSection({ searchFilter }: { searchFilter: string }) {
  const results: Record<string, { data?: DiagnosticItem[]; isLoading: boolean }> = {
    orphans: api.wikios.getOrphanArticles.useQuery({ limit: 50 }),
    deadEnds: api.wikios.getDeadEndArticles.useQuery({ limit: 50 }),
    brokenRedirects: api.wikios.getBrokenRedirects.useQuery({ limit: 50 }),
    short: api.wikios.getShortestArticles.useQuery({ limit: 25 }),
    long: api.wikios.getLongestArticles.useQuery({ limit: 25 }),
  };

  const tools = TOOLS.map((tool) => ({ ...tool, badge: results[tool.id]?.data?.length ?? 0 }));

  const renderPanel = (id: string) => {
    const view = VIEWS[id]!;
    const { data, isLoading } = results[id]!;
    if (isLoading) return <InspectorLoading>{view.loadingText}</InspectorLoading>;
    if (view.emptyText && !data?.length) return <InspectorEmpty>{view.emptyText}</InspectorEmpty>;

    return (
      <InspectorList>
        {data?.map((item, idx) => (
          <InspectorRow key={item.id || item.slug || `${view.keyPrefix}-${idx}`}>
            {view.plainTitle ? (
              <span className="text-label font-medium">{item.title}</span>
            ) : (
              <InspectorPageLink slug={item.slug} title={item.title} />
            )}
            <span className={`text-footnote tabular-nums ${view.valueClass}`}>
              {view.value(item)}
            </span>
          </InspectorRow>
        ))}
      </InspectorList>
    );
  };

  return (
    <InspectorSection
      searchFilter={searchFilter}
      heading="Health & Link Integrity Diagnostics"
      headingIcon={<Activity className="text-green h-4 w-4" />}
      ariaLabel="Diagnostics"
      tools={tools}
      gridClass="sm:grid-cols-2 lg:grid-cols-5"
      panelLabel="Live Inspector"
      panelCaption="Showing top results from PostgreSQL index"
      closeLabel="Close inspector"
      panelTitle={(id) => TOOLS.find((t) => t.id === id)?.title ?? ""}
      renderPanel={renderPanel}
    />
  );
}
