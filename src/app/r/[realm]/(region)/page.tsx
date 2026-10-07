"use client";

import { use } from "react";
import Link from "next/link";
import { OpenBook, EditPencil } from "iconoir-react";
import { api } from "~/trpc/react";
import { usePageTitle } from "~/hooks/usePageTitle";
import { createUrl } from "~/lib/utils";
import { timeAgo } from "~/lib/format/compact";
import { parseWikiSource, wikiReaderPath } from "~/lib/wiki-os/config";
import { buttonVariants } from "~/components/ui/button";
import { ClaimableNations } from "../_components/ClaimableNations";
import {
  CensusPanel,
  CommunityPanel,
  EmbassiesPanel,
  HappeningsPanel,
  OfficersPanel,
  PollPanel,
} from "../_components/RealmSidebar";

function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="border-separator bg-surface rounded-card border p-4 md:p-6">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-label text-headline">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

/** The realm's front page: factbook, latest board posts and claimable nations, with the sidebar panels. */
export default function RealmOverviewPage({ params }: { params: Promise<{ realm: string }> }) {
  const { realm: slug } = use(params);
  const { data: overview } = api.realms.region.overview.useQuery({ slug });
  const { data: hub } = api.realms.getBySlug.useQuery({ slug });
  usePageTitle({ title: overview ? `${overview.realm.name} · Realm` : "Realm" });
  if (!overview) return null;

  const { realm, factbook, board, viewer } = overview;
  const base = `/r/${encodeURIComponent(realm.slug)}`;
  const canEditFactbook = viewer.powers.includes("appearance");
  const portal = `Portal:${realm.name}`;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="flex min-w-0 flex-col gap-6">
        <Section
          title="Factbook"
          action={
            canEditFactbook && (
              <Link
                href={createUrl(`${base}/manage#factbook`)}
                className={buttonVariants({ variant: "ghost", size: "sm" })}
              >
                <EditPencil aria-hidden="true" />
                Edit
              </Link>
            )
          }
        >
          {factbook ? (
            <div
              className="text-label text-body [&_a]:text-tint [&_h2]:text-title-3 [&_h3]:text-headline [&_h4]:text-headline space-y-3 leading-relaxed [&_a]:underline [&_h2]:mt-4 [&_h3]:mt-3 [&_h4]:mt-4 [&_li]:ml-5 [&_ol]:list-decimal [&_ul]:list-disc"
              // Rendered from wikitext and sanitized on save (updateRealmFactbook).
              dangerouslySetInnerHTML={{ __html: factbook.html }}
            />
          ) : (
            <p className="text-label-secondary text-body">
              {realm.description ?? "This realm has no factbook yet."}
            </p>
          )}
          {hub?.loreSource && hub.lorePageCount > 0 && (
            <Link
              href={createUrl(wikiReaderPath(portal, parseWikiSource(hub.loreSource)))}
              className="text-tint text-footnote mt-4 inline-flex items-center gap-2 hover:underline"
            >
              <OpenBook className="size-4" aria-hidden="true" />
              Read the lore ({hub.lorePageCount.toLocaleString()} pages)
            </Link>
          )}
        </Section>

        <Section
          title="Latest on the board"
          action={
            <Link
              href={createUrl(`${base}/board`)}
              className="text-tint text-footnote hover:underline"
            >
              {viewer.ownedNations.length > 0 ? "Open the board to post" : "Open the board"}
            </Link>
          }
        >
          {board.posts.length === 0 ? (
            <p className="text-label-secondary text-body">No posts yet.</p>
          ) : (
            <ul className="divide-separator flex flex-col divide-y">
              {board.posts.map((post) => (
                <li key={post.id} className="py-3 first:pt-0 last:pb-0">
                  <p className="text-footnote">
                    <span className="text-label font-medium">{post.author.name}</span>
                    {post.author.country && (
                      <span className="text-label-secondary"> · {post.author.country.name}</span>
                    )}
                    <span className="text-label-secondary"> · {timeAgo(post.createdAt)}</span>
                  </p>
                  <p className="text-label text-body mt-1 line-clamp-3 whitespace-pre-wrap">
                    {post.content}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Section>

        {hub &&
          (hub.claimsOpen ? (
            hub.nationPages.length > 0 && (
              <ClaimableNations
                realmSlug={hub.slug}
                pages={hub.nationPages}
                rules={overview.rules}
              />
            )
          ) : (
            <p className="text-label-secondary text-footnote">
              {hub.status === "archived"
                ? "This realm is archived: its nations can be read but no longer claimed."
                : "This realm is not open yet: its nations cannot be claimed."}
            </p>
          ))}
      </div>

      <aside className="flex flex-col gap-4" aria-label="Realm panels">
        <CommunityPanel overview={overview} />
        <OfficersPanel overview={overview} />
        <CensusPanel slug={realm.slug} />
        <PollPanel slug={realm.slug} overview={overview} />
        <EmbassiesPanel overview={overview} />
        <HappeningsPanel slug={realm.slug} />
      </aside>
    </div>
  );
}
