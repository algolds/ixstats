"use client";

import Link from "next/link";
import { Tabs, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { withBasePath } from "~/lib/base-path";
import type { ArticleTab } from "~/lib/wiki-os/article-route";

const TABS: ReadonlyArray<{ tab: ArticleTab; label: string; href: (slug: string) => string }> = [
  { tab: "read", label: "Read", href: (slug) => `/wiki/${slug}` },
  { tab: "edit", label: "Edit", href: (slug) => `/wiki/${slug}/edit` },
  { tab: "history", label: "History", href: (slug) => `/util/history/${slug}` },
  { tab: "talk", label: "Talk", href: (slug) => `/wiki/${slug}/talk` },
];

interface WikiArticleTabsProps {
  /** The article's path segment as it appears in the URL (already percent-encoded). */
  slug: string;
  active: ArticleTab;
  /** Edit is for signed-in readers only. */
  canEdit: boolean;
}

/**
 * The views of one article. Each tab is a real link (so it opens in a new tab and navigates on
 * Enter); the Tabs root only carries which one is current.
 */
export function WikiArticleTabs({ slug, active, canEdit }: WikiArticleTabsProps) {
  return (
    <Tabs value={active} className="w-auto">
      <TabsList aria-label="Article views" className="gap-1">
        {TABS.filter(({ tab }) => tab !== "edit" || canEdit).map(({ tab, label, href }) => (
          <TabsTrigger key={tab} value={tab} asChild>
            <Link href={withBasePath(href(slug))}>{label}</Link>
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
