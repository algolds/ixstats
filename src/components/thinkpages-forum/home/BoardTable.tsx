"use client";

import * as React from "react";
import Link from "next/link";
import {
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
import { Avatar, AvatarFallback } from "~/components/ui/avatar";
import { Badge } from "~/components/ui/badge";
import { Card, CardTitle } from "~/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "~/components/ui/collapsible";
import { timeAgo } from "~/lib/format/compact";
import { categoryHref } from "~/lib/thinkpages-forum/links";
import { cn } from "~/lib/utils/cn";
import type { RouterOutputs } from "~/trpc/react";
import { initialsOf } from "../AuthorMark";

type Board = RouterOutputs["thinkpagesForum"]["categories"][number];

/** Name, Threads, Posts, Latest from md up; below md each row is two lines (see `BoardRow`). */
const COLUMNS = "md:grid-cols-[minmax(0,1fr)_5rem_5rem_15rem]";

const BOARD_ICONS: Record<string, typeof Folder> = {
  rules: Page,
  announcements: Megaphone,
  reports: WarningTriangle,
  staff: ShieldCheck,
  "find-a-realm": Search,
  general: ChatBubble,
  "side-games": Gamepad,
};

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

/** An empty value: a dash to the eye, "None" to a screen reader. */
function None({ className }: { className?: string }) {
  return (
    <span className={className}>
      <span aria-hidden>–</span>
      <span className="sr-only">None</span>
    </span>
  );
}

/** A count, or a dash for none; below md it carries its unit so the stacked counts read on their own. */
function Count({ value, one, many }: { value: number; one: string; many: string }) {
  if (value === 0) return <None className="text-label-tertiary" />;
  return (
    <>
      <span>{value}</span>
      <span className="text-label-secondary md:hidden">{` ${plural(value, one, many)}`}</span>
    </>
  );
}

function LatestCell({ latest }: { latest: Board["latest"] }) {
  if (!latest) return <None className="text-callout text-label-tertiary" />;
  const author = latest.author?.name ?? "Member";
  return (
    <span className="flex min-w-0 items-center gap-2">
      <Avatar className="hidden size-7 md:flex">
        <AvatarFallback className="text-caption text-label-secondary">
          {initialsOf(author)}
        </AvatarFallback>
      </Avatar>
      <span className="min-w-0">
        <span className="text-callout block truncate">{latest.threadTitle}</span>
        <span className="text-footnote text-label-secondary block truncate tabular-nums">
          {`${author} · ${timeAgo(latest.at)}`}
        </span>
      </span>
    </span>
  );
}

/**
 * One board: the name is the row's link, stretched over the whole row; Threads, Posts and Latest are cells under
 * their headers. Below md the same cells lay out as two lines.
 */
function BoardRow({ board }: { board: Board }) {
  const Icon = BOARD_ICONS[board.key] ?? Folder;
  const empty = board.threadCount === 0;
  return (
    <li
      role="row"
      className={cn(
        "hover:bg-fill-4 relative grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 px-5 py-3 pointer-coarse:min-h-11",
        COLUMNS
      )}
    >
      <div role="cell" className="col-start-1 row-start-1 flex min-w-0 items-center gap-3">
        <span
          aria-hidden
          className={cn(
            "rounded-control-sm flex size-9 shrink-0 items-center justify-center [&_svg]:size-5",
            empty ? "bg-fill-3 text-label-secondary" : "bg-tint-fill text-tint"
          )}
        >
          <Icon />
        </span>
        <span className="min-w-0">
          <span className="text-headline flex items-center gap-2">
            <Link
              href={categoryHref({ key: board.key })}
              className="focus-visible:outline-tint min-w-0 truncate after:absolute after:inset-0 focus-visible:outline-2"
            >
              {board.name}
            </Link>
            {board.visibility === "staff" ? <Badge variant="outline">Staff</Badge> : null}
          </span>
          {board.description ? (
            <span className="text-footnote text-label-secondary hidden truncate md:block">
              {board.description}
            </span>
          ) : null}
        </span>
      </div>
      <div
        role="cell"
        className="text-callout col-start-2 row-start-1 text-right tabular-nums md:col-start-2"
      >
        <Count value={board.threadCount} one="thread" many="threads" />
      </div>
      <div
        role="cell"
        className="text-callout col-start-2 row-start-2 text-right tabular-nums md:col-start-3 md:row-start-1"
      >
        <Count value={board.postCount} one="post" many="posts" />
      </div>
      <div role="cell" className="col-start-1 row-start-2 min-w-0 md:col-start-4 md:row-start-1">
        <LatestCell latest={board.latest} />
      </div>
    </li>
  );
}

function BoardRows({ boards }: { boards: readonly Board[] }) {
  return (
    <div role="table" aria-label="Boards">
      <div
        role="row"
        className="text-footnote text-label-secondary border-separator grid grid-cols-[minmax(0,1fr)_5rem_5rem_15rem] items-center gap-x-3 border-b px-5 pb-2 max-md:sr-only"
      >
        <span role="columnheader">Board</span>
        <span role="columnheader" className="text-right">
          Threads
        </span>
        <span role="columnheader" className="text-right">
          Posts
        </span>
        <span role="columnheader">Latest</span>
      </div>
      <ul role="rowgroup" className="divide-separator divide-y">
        {boards.map((board) => (
          <BoardRow key={board.key} board={board} />
        ))}
      </ul>
    </div>
  );
}

interface BoardTableProps {
  boards: readonly Board[];
  title: string;
  /** A collapsed section: the title is its trigger and the boards show once opened. */
  collapsible?: boolean;
}

/** A pane of boards: Board / Threads / Posts / Latest, each row linking to its board. */
export function BoardTable({ boards, title, collapsible = false }: BoardTableProps) {
  if (collapsible) {
    return (
      <Collapsible asChild>
        <Card content="data" className="overflow-hidden">
          <h2 className="px-5 py-4">
            <CollapsibleTrigger className="text-headline group focus-visible:outline-tint flex w-full items-center gap-2 text-left leading-none focus-visible:outline-2 pointer-coarse:min-h-11">
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
    <Card content="data" className="overflow-hidden pb-1">
      <div className="px-5 pt-5 pb-3">
        <CardTitle icon={<Globe />} role="heading" aria-level={2}>
          {title}
        </CardTitle>
      </div>
      <BoardRows boards={boards} />
    </Card>
  );
}
