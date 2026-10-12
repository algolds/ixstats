"use client";

import Link from "next/link";
import { OpenBook } from "iconoir-react";
import { timeAgo } from "~/lib/format/compact";
import { api } from "~/trpc/react";
import { Pane, PaneBody } from "./Pane";

const EDITS_SHOWN = 3;

const articlePath = (title: string) => `/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`;

/** The wiki's featured article, then its newest edits. */
export function WikiPane() {
  const query = api.wikios.getMainPage.useQuery();
  const featured = query.data?.featured ?? null;
  // Several edits to one article read as a repeat; keep its newest.
  const edits = (query.data?.recentChanges ?? [])
    .filter((edit, i, all) => all.findIndex((other) => other.title === edit.title) === i)
    .slice(0, EDITS_SHOWN);
  return (
    <Pane app="wiki" icon={<OpenBook />} title="Wiki" link={{ href: "/wiki", label: "Main page" }}>
      <PaneBody
        query={query}
        what="the wiki"
        empty={!featured && edits.length === 0 ? "Nothing on the wiki yet." : null}
      >
        {featured && (
          <Link
            href={`/wiki/${featured.slug}`}
            className="focus-visible:outline-tint rounded-row hover:bg-fill-4 -mx-2 flex gap-3 p-2 focus-visible:outline-2"
          >
            {featured.image && (
              <img
                src={featured.image}
                alt=""
                className="rounded-row size-16 shrink-0 object-cover"
              />
            )}
            <span className="min-w-0">
              <span className="text-body text-label block font-medium">{featured.title}</span>
              <span className="text-callout text-label-secondary line-clamp-2">
                {featured.excerpt}
              </span>
            </span>
          </Link>
        )}
        <ul data-content="feed" className="mt-2 [&>li]:py-2">
          {edits.map((edit) => (
            <li key={`${edit.title}-${edit.timestamp}`} className="text-callout">
              <Link href={articlePath(edit.title)} className="text-label hover:underline">
                {edit.title}
              </Link>
              <span className="text-label-secondary tabular-nums">{` · ${edit.user} · ${timeAgo(edit.timestamp)}`}</span>
            </li>
          ))}
        </ul>
      </PaneBody>
    </Pane>
  );
}
