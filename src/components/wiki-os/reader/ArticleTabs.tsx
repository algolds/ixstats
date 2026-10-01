"use client";

import Link from "next/link";
import { useMemo } from "react";
import { withBasePath } from "~/lib/base-path";
import { subjectPageOf, talkPageOf } from "~/lib/wiki-os/core/talk";
import { canonicalizeTitle } from "~/lib/wiki-os/core/title";
import { cn } from "~/lib/utils";

const TAB = "rounded-md px-2.5 py-1 text-xs font-semibold transition-colors";
const TAB_IDLE = "text-muted-foreground hover:text-foreground";
const TAB_ACTIVE = "bg-muted text-foreground";

/**
 * Page / Discussion tabs, as in MediaWiki: a page and its talk page (`Foo` and `Talk:Foo`, `User:Foo`
 * and `User talk:Foo`). A talk page is an ordinary wikitext page; "Add topic" opens the source
 * editor with a new `== Section ==` appended (`?action=edit&section=new`). Margin stays a separate
 * layer on the subject page. Nothing is shown for a page with no talk namespace (`Special:`).
 */
export function ArticleTabs({ title }: { title: string }) {
  const tabs = useMemo(() => {
    const canon = canonicalizeTitle(title);
    if (!canon) return null;
    const subject = subjectPageOf(canon);
    const talk = subject ? canon : talkPageOf(canon);
    const page = subject ?? canon;
    return talk ? { page, talk, isTalk: subject !== null } : null;
  }, [title]);
  if (!tabs) return null;

  const pageHref = withBasePath(`/wiki/${tabs.page.urlPath}`);
  const talkHref = withBasePath(`/wiki/${tabs.talk.urlPath}`);

  return (
    <nav aria-label="Page and discussion" className="mb-3 flex flex-wrap items-center gap-1">
      <Link
        href={pageHref}
        aria-current={tabs.isTalk ? undefined : "page"}
        className={cn(TAB, tabs.isTalk ? TAB_IDLE : TAB_ACTIVE)}
      >
        Page
      </Link>
      <Link
        href={talkHref}
        aria-current={tabs.isTalk ? "page" : undefined}
        className={cn(TAB, tabs.isTalk ? TAB_ACTIVE : TAB_IDLE)}
        prefetch={false}
      >
        Discussion
      </Link>
      {tabs.isTalk && (
        <Link
          href={`${talkHref}?action=edit&section=new`}
          className={cn(TAB, TAB_IDLE, "ml-auto")}
          prefetch={false}
        >
          Add topic
        </Link>
      )}
    </nav>
  );
}
