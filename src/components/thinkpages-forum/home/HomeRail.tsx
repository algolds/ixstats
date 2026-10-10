import Link from "next/link";
import { GraphUp, StatsReport } from "iconoir-react";
import { threadHref } from "~/lib/thinkpages-forum/links";
import type { RouterOutputs } from "~/trpc/react";
import { RailPanel } from "../shell";

type Trending = RouterOutputs["thinkpagesForum"]["trending"];
type Stats = RouterOutputs["thinkpagesForum"]["forumStats"];

/** The most active threads of the last day, ranked. The caller leaves the panel out when none is active. */
export function TrendingPanel({ threads }: { threads: Trending }) {
  return (
    <RailPanel title="Trending threads" icon={<GraphUp />}>
      <ol className="-mx-2">
        {threads.map((thread, index) => (
          <li key={thread.threadId}>
            <Link
              href={threadHref(thread.threadId)}
              className="hover:bg-fill-4 focus-visible:outline-tint rounded-control-sm flex items-center gap-3 px-2 py-2 focus-visible:outline-2 pointer-coarse:min-h-11"
            >
              <span className="text-callout text-label-tertiary w-4 shrink-0 tabular-nums">
                {index + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="text-callout block truncate">{thread.title}</span>
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

const count = (n: number) => n.toLocaleString("en-US");

/** Threads, posts and members across the public forum. */
export function StatsPanel({ stats }: { stats: Stats }) {
  const figures = [
    { label: "Threads", value: stats.threads },
    { label: "Posts", value: stats.posts },
    { label: "Members", value: stats.members },
  ];
  return (
    <RailPanel title="Forum statistics" icon={<StatsReport />}>
      <dl className="grid grid-cols-3 gap-3">
        {figures.map(({ label, value }) => (
          <div key={label} className="flex flex-col-reverse gap-1">
            <dt className="text-footnote text-label-secondary">{label}</dt>
            <dd className="text-title-2 text-tint tabular-nums">{count(value)}</dd>
          </div>
        ))}
      </dl>
    </RailPanel>
  );
}
