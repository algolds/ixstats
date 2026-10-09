"use client";

import { use } from "react";
import Link from "next/link";
import { OpenBook, EditPencil } from "iconoir-react";
import { api, type RouterOutputs } from "~/trpc/react";
import { useAuth } from "~/context/auth-context";
import { usePageTitle } from "~/hooks/usePageTitle";
import { timeAgo } from "~/lib/format/compact";
import { hubHref, threadHref } from "~/lib/thinkpages-forum/links";
import { cn } from "~/lib/utils";
import { WIKI_SOURCES, parseWikiSource, wikiReaderPath } from "~/lib/wiki-os/config";
import { buttonVariants } from "~/components/ui/button";
import { useRealmInviter } from "~/components/realms/use-invite-via";
import { RealmInvitePanel } from "../_components/RealmInvitePanel";
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

type Hub = NonNullable<RouterOutputs["realms"]["getBySlug"]>;

/** How many names the Overview previews before sending the visitor to the Nations tab. */
const JOIN_PREVIEW = 9;

/** The way in for a visitor with no nation here: how many nations wait for a player, a few of them, and the list. */
function JoinRealm({ hub, base, signedIn }: { hub: Hub; base: string; signedIn: boolean }) {
  const open = [
    ...hub.countries.filter((c) => !c.claimed).map((c) => c.name),
    ...hub.nationPages.map((p) => p.title),
  ];
  if (open.length === 0) return null;
  const rest = open.length - JOIN_PREVIEW;
  return (
    <Section title={`Join ${hub.name}`}>
      <p className="text-label text-body">
        {open.length === 1
          ? "One nation is waiting for a player."
          : `${open.length.toLocaleString()} nations are waiting for a player.`}{" "}
        Claim the nation whose wiki page you wrote, or take an unclaimed one.
      </p>
      <p className="text-label-secondary text-footnote mt-3">
        {open.slice(0, JOIN_PREVIEW).join(", ")}
        {rest > 0 && `, and ${rest.toLocaleString()} more`}
      </p>
      <Link
        href={`${base}/nations`}
        className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "mt-4")}
      >
        {signedIn ? "Choose a nation" : "See the nations"}
      </Link>
    </Section>
  );
}

/** The realm's front page: factbook, the way in, latest forum threads, with the sidebar panels. */
export default function RealmOverviewPage({ params }: { params: Promise<{ realm: string }> }) {
  const { realm: slug } = use(params);
  const { data: overview } = api.realms.region.overview.useQuery({ slug });
  const { data: hub } = api.realms.getBySlug.useQuery({ slug });
  const { isSignedIn } = useAuth();
  // A valid invite brings its own Join panel (RealmInvitePanel), which takes the place of JoinRealm.
  const invite = useRealmInviter(slug);
  usePageTitle({ title: overview ? `${overview.realm.name} · Realm` : "Realm" });
  if (!overview) return null;

  const { realm, factbook, forum, viewer, stats } = overview;
  const base = `/r/${encodeURIComponent(realm.slug)}`;
  const canEditFactbook = viewer.powers.includes("appearance");
  const loreSource = hub?.loreSource ? parseWikiSource(hub.loreSource) : null;
  const lore = loreSource && hub && hub.lorePageCount > 0 && (
    <Link
      href={wikiReaderPath(`Portal:${realm.name}`, loreSource)}
      className="text-tint text-footnote inline-flex items-center gap-2 hover:underline"
    >
      <OpenBook className="size-4" aria-hidden="true" />
      Read the lore on {WIKI_SOURCES[loreSource].name} ({hub.lorePageCount.toLocaleString()} pages)
    </Link>
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="flex min-w-0 flex-col gap-6">
        <RealmInvitePanel realmSlug={realm.slug} realmName={realm.name} />
        {(factbook || canEditFactbook || lore) && (
          <Section
            title={factbook || canEditFactbook ? "Factbook" : "Lore"}
            action={
              canEditFactbook &&
              factbook && (
                <Link
                  href={`${base}/manage#factbook`}
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
            ) : canEditFactbook ? (
              <div className="flex flex-col items-start gap-3">
                <p className="text-label-secondary text-body">
                  The factbook is the first thing visitors read: what {realm.name} is, how it plays
                  and how to take part.
                </p>
                <Link
                  href={`${base}/manage#factbook`}
                  className={buttonVariants({ variant: "secondary", size: "sm" })}
                >
                  <EditPencil aria-hidden="true" />
                  Write the factbook
                </Link>
              </div>
            ) : null}
            {lore && <div className={factbook || canEditFactbook ? "mt-4" : undefined}>{lore}</div>}
          </Section>
        )}

        {hub &&
          (hub.claimsOpen ? (
            viewer.ownedNations.length === 0 &&
            !invite.inviter &&
            !invite.pending && <JoinRealm hub={hub} base={base} signedIn={!!isSignedIn} />
          ) : (
            <p className="text-label-secondary text-footnote">
              {hub.status === "archived"
                ? "This realm is archived: its nations can be read but no longer claimed."
                : "This realm is not open yet: its nations cannot be claimed."}
            </p>
          ))}

        <Section
          title="Latest on the forum"
          action={
            <Link href={hubHref(realm.slug)} className="text-tint text-footnote hover:underline">
              {viewer.ownedNations.length > 0 ? "Open the forum to post" : "Open the forum"}
            </Link>
          }
        >
          {forum.threads.length === 0 ? (
            <p className="text-label-secondary text-body">
              {viewer.ownedNations.length > 0
                ? "No threads yet. Yours can be the first."
                : `No threads yet. The forum is where the nations of ${realm.name} talk.`}
            </p>
          ) : (
            <ul className="divide-separator flex flex-col divide-y">
              {forum.threads.map((thread) => (
                <li key={thread.id} className="py-3 first:pt-0 last:pb-0">
                  <Link href={threadHref(thread.id)} className="group block">
                    <p className="text-label text-body line-clamp-2 group-hover:underline">
                      {thread.title}
                    </p>
                    <p className="text-label-secondary text-footnote mt-1">
                      {thread.replies} {thread.replies === 1 ? "reply" : "replies"} ·{" "}
                      {timeAgo(thread.lastPostAt)}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      <aside className="flex flex-col gap-4" aria-label="Realm panels">
        <CommunityPanel overview={overview} />
        <OfficersPanel overview={overview} />
        {stats.nations > 0 && <CensusPanel slug={realm.slug} />}
        <PollPanel slug={realm.slug} overview={overview} />
        <EmbassiesPanel overview={overview} />
        <HappeningsPanel slug={realm.slug} />
      </aside>
    </div>
  );
}
