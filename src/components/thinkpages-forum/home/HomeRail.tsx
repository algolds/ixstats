import Link from "next/link";
import { Clock, GraphUp, LightBulbOn, NavArrowRight, Search } from "iconoir-react";
import { timeAgo } from "~/lib/format/compact";
import { categoryHref, postHref, threadHref } from "~/lib/thinkpages-forum/links";
import { cn } from "~/lib/utils/cn";
import type { RouterOutputs } from "~/trpc/react";
import { AdvertMark } from "../advert";
import { AuthorFlag } from "../AuthorMark";
import { ForumAvatar } from "../ForumAvatar";
import { RailPanel } from "../shell";

type Trending = RouterOutputs["thinkpagesForum"]["trending"];
type Activity = RouterOutputs["thinkpagesForum"]["latestActivity"];
type AdvertThread = RouterOutputs["thinkpagesForum"]["category"]["threads"][number];
type Thinktank = RouterOutputs["thinkpages"]["getThinktanks"][number];

const ROW =
  "hover:bg-fill-4 focus-visible:outline-tint rounded-control-sm flex items-center gap-3 px-2 py-2 focus-visible:outline-2 pointer-coarse:min-h-11";

/** A panel's way to the full list, under its rows. */
function SeeAll({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="text-callout text-tint focus-visible:outline-tint rounded-control-sm mt-2 inline-flex items-center gap-1 font-medium focus-visible:outline-2 pointer-coarse:min-h-11"
    >
      {label}
      <NavArrowRight aria-hidden className="size-4" />
    </Link>
  );
}

/** The newest posts across the boards, joined by a line down their avatars. */
export function LatestActivityPanel({ items }: { items: Readonly<Activity> }) {
  return (
    <RailPanel title="Latest activity" icon={<Clock />}>
      <ol className="relative -mx-2">
        <span aria-hidden className="bg-separator absolute top-5 bottom-5 left-5 w-px" />
        {items.map((item) => {
          const name = item.author?.name ?? "Member";
          return (
            <li key={item.postId}>
              <Link href={postHref(item.postId)} className={cn(ROW, "relative items-start")}>
                <span className="inline-flex shrink-0 items-center gap-1.5 pt-0.5">
                  <ForumAvatar name={name} avatarUrl={item.author?.avatarUrl} size="xs" />
                  {item.author?.flagUrl ? <AuthorFlag url={item.author.flagUrl} /> : null}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="text-callout text-label-secondary line-clamp-2">
                    <span className="text-label font-medium">{name}</span>
                    {item.isFirstPost ? " started " : " replied in "}
                    <span className="text-label">{item.threadTitle}</span>
                  </span>
                  <span className="text-footnote text-label-secondary block truncate tabular-nums">
                    {`${item.categoryName} · ${timeAgo(item.at)}`}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </RailPanel>
  );
}

/** The most active threads of the last day, ranked. The caller leaves the panel out when none is active. */
export function TrendingPanel({ threads }: { threads: Readonly<Trending> }) {
  return (
    <RailPanel title="Trending threads" icon={<GraphUp />}>
      <ol className="-mx-2">
        {threads.map((thread, index) => (
          <li key={thread.threadId}>
            <Link href={threadHref(thread.threadId)} className={ROW}>
              <span className="text-callout text-tint w-4 shrink-0 font-medium tabular-nums">
                {index + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="text-body text-label block truncate font-medium">
                  {thread.title}
                </span>
                <span className="text-footnote text-label-secondary block truncate tabular-nums">
                  {`${thread.categoryName} · ${thread.repliesToday} ${thread.repliesToday === 1 ? "reply" : "replies"} today`}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </RailPanel>
  );
}

/** Realms recruiting now: open adverts from Find a Realm (the caller passes advert threads only). */
export function FindARealmPanel({ adverts }: { adverts: readonly AdvertThread[] }) {
  return (
    <RailPanel title="Find a Realm" icon={<Search />}>
      <ul className="-mx-2">
        {adverts.map((thread) => (
          <li key={thread.id}>
            <Link href={threadHref(thread.id)} className={ROW}>
              {thread.advert ? <AdvertMark advert={thread.advert} /> : null}
              <span className="min-w-0 flex-1">
                <span className="text-body text-label block truncate font-medium">
                  {thread.advert?.realmName ?? thread.title}
                </span>
                <span className="text-footnote text-label-secondary block truncate">
                  {thread.title}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <SeeAll href={categoryHref({ key: "find-a-realm" })} label="All realms recruiting" />
    </RailPanel>
  );
}

/** The member's ThinkTanks, or the most recently active ones for anyone else. */
export function ThinkTanksPanel({
  thinktanks,
  joined,
}: {
  thinktanks: readonly Thinktank[];
  joined: boolean;
}) {
  return (
    <RailPanel title={joined ? "Your ThinkTanks" : "ThinkTanks"} icon={<LightBulbOn />}>
      <ul className="-mx-2">
        {thinktanks.map((tank) => (
          <li key={tank.id}>
            <Link href={`/thinktanks/${tank.id}`} className={ROW}>
              <ForumAvatar name={tank.name} avatarUrl={tank.avatar} size="md" />
              <span className="min-w-0 flex-1">
                <span className="text-body text-label block truncate font-medium">{tank.name}</span>
                <span className="text-footnote text-label-secondary block truncate tabular-nums">
                  {`${tank._count.members} ${tank._count.members === 1 ? "member" : "members"} · ${timeAgo(tank.lastActivity)}`}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <SeeAll href="/thinktanks" label="All ThinkTanks" />
    </RailPanel>
  );
}
