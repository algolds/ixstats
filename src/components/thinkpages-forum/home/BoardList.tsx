"use client";

import * as React from "react";
import Link from "next/link";
import {
  Archive,
  ChatBubble,
  Folder,
  Gamepad,
  Globe,
  Megaphone,
  NavArrowDown,
  Page,
  Search,
  ShieldCheck,
  WarningTriangle,
} from "iconoir-react";
import { motion } from "motion/react";
import { Badge } from "~/components/ui/badge";
import { Card, CardTitle } from "~/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "~/components/ui/collapsible";
import { timeAgo } from "~/lib/format/compact";
import { categoryHref, threadHref } from "~/lib/thinkpages-forum/links";
import type { RouterOutputs } from "~/trpc/react";
import { AuthorFlag } from "../AuthorMark";
import { ForumAvatar } from "../ForumAvatar";
import { IconTile, RISE_ITEM, RISE_LIST } from "../shell";

type Board = RouterOutputs["thinkpagesForum"]["categories"][number];

const BOARD_ICONS: Record<string, typeof Folder> = {
  rules: Page,
  announcements: Megaphone,
  reports: WarningTriangle,
  staff: ShieldCheck,
  "find-a-realm": Search,
  general: ChatBubble,
  "side-games": Gamepad,
};

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** A count with its unit, the figure over the unit (md and up). */
function Count({ value, one, many }: { value: number; one: string; many: string }) {
  return (
    <span className="flex min-w-14 flex-col items-end">
      <span className="text-title-3 text-label">{value}</span>
      <span className="text-footnote text-label-secondary">{value === 1 ? one : many}</span>
    </span>
  );
}

/** The board's newest thread as a pressable Well: its title, who posted last (avatar and flag), and when. */
function LatestPreview({ latest }: { latest: Board["latest"] }) {
  if (!latest) return <p className="text-callout text-label-tertiary">No threads yet</p>;
  const author = latest.author?.name ?? "Member";
  return (
    <Card variant="well" padding="none" interactive className="max-w-xl">
      <Link
        href={threadHref(latest.threadId)}
        className="flex min-w-0 items-center gap-3 px-3 py-2.5 after:absolute after:inset-0 focus-visible:outline-none"
      >
        <span className="inline-flex shrink-0 items-center gap-1.5">
          <ForumAvatar name={author} avatarUrl={latest.author?.avatarUrl} size="sm" />
          {latest.author?.flagUrl ? <AuthorFlag url={latest.author.flagUrl} /> : null}
        </span>
        <span className="min-w-0">
          <span className="text-callout text-label block truncate font-medium">
            {latest.threadTitle}
          </span>
          <span className="text-footnote text-label-secondary block truncate tabular-nums">
            {`${author} · ${timeAgo(latest.at)}`}
          </span>
        </span>
      </Link>
    </Card>
  );
}

/**
 * One board: its textured icon tile, the name (the row's link, stretched over the row), unread state, description,
 * counts, and the latest thread's preview, which sits above the row link as its own link.
 */
function BoardRow({ board }: { board: Board }) {
  const Icon = BOARD_ICONS[board.key] ?? Folder;
  const unread = board.unreadThreads > 0;
  return (
    <motion.li
      variants={RISE_ITEM}
      className="hover:bg-fill-4 relative flex gap-3.5 px-4 py-4 sm:px-5"
    >
      <IconTile>
        <Icon />
      </IconTile>
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <div className="flex min-w-0 items-start gap-4">
          <div className="min-w-0 flex-1">
            <h3 className="text-title-3 flex items-center gap-2">
              <Link
                href={categoryHref({ key: board.key })}
                className="focus-visible:outline-tint min-w-0 truncate after:absolute after:inset-0 focus-visible:outline-2"
              >
                {board.name}
              </Link>
              {unread ? (
                <>
                  <span aria-hidden className="bg-tint size-2 shrink-0 rounded-full" />
                  <Badge variant="secondary" className="text-tint shrink-0 tabular-nums">
                    {`${board.unreadThreads} new`}
                  </Badge>
                </>
              ) : null}
              {board.visibility === "staff" ? <Badge variant="outline">Staff</Badge> : null}
            </h3>
            {board.description ? (
              <p className="text-callout text-label-secondary line-clamp-1">{board.description}</p>
            ) : null}
            <p className="text-footnote text-label-secondary tabular-nums md:hidden">
              {`${plural(board.threadCount, "thread", "threads")} · ${plural(board.postCount, "post", "posts")}`}
            </p>
          </div>
          <div className="hidden shrink-0 gap-4 tabular-nums md:flex">
            <Count value={board.threadCount} one="thread" many="threads" />
            <Count value={board.postCount} one="post" many="posts" />
          </div>
        </div>
        <LatestPreview latest={board.latest} />
      </div>
    </motion.li>
  );
}

function BoardRows({ boards }: { boards: readonly Board[] }) {
  return (
    <motion.ul
      initial="hidden"
      animate="show"
      variants={RISE_LIST}
      className="divide-separator border-separator divide-y border-t"
    >
      {boards.map((board) => (
        <BoardRow key={board.key} board={board} />
      ))}
    </motion.ul>
  );
}

interface BoardListProps {
  boards: readonly Board[];
  title: string;
  /** A collapsed section: the title is its trigger and the boards show once opened. */
  collapsible?: boolean;
}

/** A pane of boards, each row linking to its board and previewing its latest thread. */
export function BoardList({ boards, title, collapsible = false }: BoardListProps) {
  if (collapsible) {
    return (
      <Collapsible asChild>
        <Card content="data" className="overflow-hidden">
          <h2 className="px-4 py-4 sm:px-5">
            <CollapsibleTrigger className="text-headline group focus-visible:outline-tint flex w-full items-center gap-2 text-left leading-none focus-visible:outline-2 pointer-coarse:min-h-11">
              <Archive aria-hidden className="text-tint size-4 shrink-0" />
              {title}
              <NavArrowDown
                aria-hidden
                className="text-label-secondary ml-auto size-4 transition-transform group-data-[state=open]:rotate-180"
              />
            </CollapsibleTrigger>
          </h2>
          <CollapsibleContent>
            <BoardRows boards={boards} />
          </CollapsibleContent>
        </Card>
      </Collapsible>
    );
  }
  return (
    <Card content="data" className="overflow-hidden">
      <div className="px-4 py-4 sm:px-5">
        <CardTitle icon={<Globe />} role="heading" aria-level={2}>
          {title}
        </CardTitle>
      </div>
      <BoardRows boards={boards} />
    </Card>
  );
}
