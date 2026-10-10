"use client";

import Link from "next/link";
import { Tabs, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { articleTabHrefs, type ArticleTab } from "~/lib/wiki-os/article-route";

interface WikiArticleTabsProps {
  /** The canonical title of the page shown (a page, or its talk page). */
  title: string;
  active: ArticleTab;
  /** Edit is for signed-in readers only. */
  canEdit: boolean;
}

/**
 * The views of one page, as in MediaWiki: Read (the subject page), Edit, History and Talk (`Foo` and
 * `Talk:Foo`, `User:Foo` and `User talk:Foo`), at MediaWiki's own URLs (`?action=edit|history`). On a
 * talk page, "Add topic" opens the source editor with a new `== Section ==`. Each tab is a real link
 * (so it opens in a new tab and navigates on Enter); the Tabs root only carries which one is current.
 */
export function WikiArticleTabs({ title, active, canEdit }: WikiArticleTabsProps) {
  const hrefs = articleTabHrefs(title);
  if (!hrefs) return null;

  const tabs: Array<{ tab: ArticleTab | "add-topic"; label: string; href: string | null }> = [
    { tab: "read", label: "Read", href: hrefs.read },
    { tab: "edit", label: "Edit", href: canEdit ? hrefs.edit : null },
    { tab: "history", label: "History", href: hrefs.history },
    { tab: "talk", label: "Talk", href: hrefs.talk },
    { tab: "add-topic", label: "Add topic", href: canEdit ? hrefs.addTopic : null },
  ];

  return (
    <Tabs value={active} className="w-auto">
      <TabsList aria-label="Page views" className="gap-1">
        {tabs.map(({ tab, label, href }) =>
          href ? (
            <TabsTrigger key={tab} value={tab} asChild>
              <Link href={href} prefetch={tab === "read"}>
                {label}
              </Link>
            </TabsTrigger>
          ) : null
        )}
      </TabsList>
    </Tabs>
  );
}
