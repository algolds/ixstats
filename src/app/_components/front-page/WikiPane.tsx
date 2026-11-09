"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { NavArrowRight, Search, Shuffle } from "iconoir-react";
import { Button } from "~/components/ui/button";
import { HelpIcon } from "~/components/ui/help-icon";
import { WikiOSLogomark } from "~/components/wiki-os/shared/WikiOSLogomark";
import { timeAgo } from "~/lib/format/compact";
import { api } from "~/trpc/react";
import { MonogramBackdrop, Pane, PaneBody } from "./Pane";

const EDITS_SHOWN = 4;

const articlePath = (title: string) => `/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`;

function readAuthorName(
  field:
    { username: string; timestamp?: string; avatar?: string | null } | string | null | undefined
): string | null {
  if (!field) return null;
  if (typeof field === "string") return field;
  return field.username || null;
}

/**
 * The WikiOS discovery pane in the right rail, scoped to `data-app="wiki"`:
 * - WikiOS logomark + help tooltip
 * - Inline encyclopedia search bar + Random article jump
 * - The featured article (the daily almanac only when there is none)
 * - Recent article edits stream
 */
export function WikiPane() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");

  const query = api.wikios.getMainPage.useQuery();
  const featured = query.data?.featured ?? null;
  const almanac = query.data?.almanac ?? null;

  const almanacSpotlight = almanac
    ? {
        title: almanac.title,
        slug: almanac.slug,
        excerpt:
          almanac.excerpt ||
          `Official comparative statistical catalog of the Bureau of International Statistics for ${almanac.title}.`,
        image: almanac.thumbnail,
        kicker: almanac.category,
      }
    : null;

  const featuredSpotlight = featured
    ? {
        title: featured.title,
        slug: featured.slug,
        excerpt: featured.excerpt,
        image: featured.image,
        kicker: "Featured article",
      }
    : null;

  const activeSpotlight = featuredSpotlight ?? almanacSpotlight;

  const { data: authorInfo } = api.wikios.getArticleAuthors.useQuery(
    { title: activeSpotlight?.title ?? "" },
    {
      enabled: Boolean(activeSpotlight?.title && activeSpotlight.title !== "Featured Article"),
      staleTime: 5 * 60 * 1000,
    }
  );

  const creatorName = readAuthorName(authorInfo?.creator);
  const lastEditorName = readAuthorName(authorInfo?.lastEditor);
  const attribution = creatorName
    ? `By ${creatorName}`
    : lastEditorName
      ? `Edited by ${lastEditorName}`
      : activeSpotlight?.kicker;

  // Several edits to one article read as a repeat; keep its newest.
  const edits = (query.data?.recentChanges ?? [])
    .filter((edit, i, all) => all.findIndex((other) => other.title === edit.title) === i)
    .slice(0, EDITS_SHOWN);

  const handleSearchSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmed = searchQuery.trim();
    router.push(trimmed ? `/util/search?q=${encodeURIComponent(trimmed)}` : "/util/search");
  };

  return (
    <MonogramBackdrop app="wiki">
      <Pane
        icon={<WikiOSLogomark className="text-tint size-4" />}
        title={
          <span className="inline-flex items-center gap-1.5">
            <span>Wiki</span>
            <HelpIcon
              title="WikiOS Encyclopedia"
              content="Explore community-written articles, national histories, and statistical almanacs across shared realms."
              side="top"
            />
          </span>
        }
        link={{ href: "/wiki", label: "Main page" }}
      >
        <div className="mb-3 flex items-center gap-1.5">
          <form onSubmit={handleSearchSubmit} className="relative min-w-0 flex-1">
            <Search
              aria-hidden
              className="text-label-tertiary pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2"
            />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search encyclopedia..."
              aria-label="Search encyclopedia"
              className="bg-surface-secondary border-separator text-footnote text-label placeholder:text-label-tertiary focus-visible:outline-tint rounded-control h-8 w-full border pr-2.5 pl-8 focus-visible:outline-2"
            />
          </form>
          <Button
            asChild
            variant="secondary"
            size="sm"
            className="h-8 shrink-0 px-2.5"
            title="Open a random wiki article"
          >
            <Link href="/util/random">
              <Shuffle aria-hidden className="size-3.5" />
              <span>Random</span>
            </Link>
          </Button>
        </div>

        <PaneBody
          query={query}
          what="the wiki"
          empty={!activeSpotlight && edits.length === 0 ? "Nothing on the wiki yet." : null}
        >
          {activeSpotlight && (
            <div className="border-separator rounded-row border p-3">
              <Link
                href={`/wiki/${activeSpotlight.slug}`}
                className="focus-visible:outline-tint rounded-control-sm group block focus-visible:outline-2"
              >
                {activeSpotlight.image && (
                  <span className="border-separator bg-surface-primary rounded-control-sm mb-2.5 block overflow-hidden border">
                    <img src={activeSpotlight.image} alt="" className="h-32 w-full object-cover" />
                  </span>
                )}
                <span className="text-caption text-tint-ink mb-0.5 block font-medium">
                  {activeSpotlight.kicker}
                </span>
                <span className="text-headline text-label block group-hover:underline">
                  {activeSpotlight.title}
                </span>
                <span className="text-callout text-label-secondary mt-1 line-clamp-4 block">
                  {activeSpotlight.excerpt}
                </span>
                <span className="border-separator mt-2.5 flex items-center justify-between gap-2 border-t pt-2">
                  <span className="text-caption text-label-secondary min-w-0 truncate">
                    {attribution}
                  </span>
                  <span className="text-caption text-tint-ink inline-flex shrink-0 items-center gap-1 font-medium">
                    <span>Read article</span>
                    <NavArrowRight aria-hidden className="size-3.5" />
                  </span>
                </span>
              </Link>
            </div>
          )}

          {edits.length > 0 && (
            <ul
              data-content="feed"
              className={activeSpotlight ? "mt-2 [&>li]:py-2" : "[&>li]:py-2"}
            >
              {edits.map((edit) => (
                <li key={`${edit.title}-${edit.timestamp}`} className="text-callout">
                  <Link
                    href={articlePath(edit.title)}
                    className="text-label font-medium hover:underline"
                  >
                    {edit.title}
                  </Link>
                  <span className="text-label-secondary tabular-nums">{` · ${edit.user} · ${timeAgo(edit.timestamp)}`}</span>
                </li>
              ))}
            </ul>
          )}
        </PaneBody>
      </Pane>
    </MonogramBackdrop>
  );
}
