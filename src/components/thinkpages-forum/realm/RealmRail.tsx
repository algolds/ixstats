"use client";

import Link from "next/link";
import { Activity, Group, List } from "iconoir-react";
import { Stat } from "~/components/ui/stat";
import { timeAgo } from "~/lib/format/compact";
import { categoryHref } from "~/lib/thinkpages-forum/links";
import type { RouterOutputs } from "~/trpc/react";
import { RailPanel } from "../shell";
import { BoardSettingsPanel } from "./BoardSettingsPanel";
import type { BoardData } from "./types";

export type RailBoard = RouterOutputs["thinkpagesForum"]["realmSection"]["categories"][number];
export type RailAction = RouterOutputs["realms"]["region"]["happenings"]["items"][number];

/** The recent actions panel shows this many, newest first. */
export const RECENT_ACTIONS_SHOWN = 5;

interface RailContent {
  boards: readonly RailBoard[];
  online: number | null;
  actions: readonly RailAction[];
  canManageSettings: boolean;
}

/** Whether any panel has something to show; a rail with none is not passed to the page at all. */
export function railHasContent({ boards, online, actions, canManageSettings }: RailContent) {
  return boards.length > 0 || online !== null || actions.length > 0 || canManageSettings;
}

/** The realm's other boards, each with its latest thread and how long ago. The realm's live board is the page itself. */
export function BoardsPanel({ slug, boards }: { slug: string; boards: readonly RailBoard[] }) {
  if (boards.length === 0) return null;
  return (
    <RailPanel title="Boards" icon={<List />}>
      <ul className="-mx-2">
        {boards.map((board) => (
          <li key={board.key}>
            <Link
              href={categoryHref({ key: board.key, realm: { slug } })}
              className="hover:bg-fill-4 focus-visible:outline-tint rounded-control-sm block px-2 py-2 focus-visible:outline-2 pointer-coarse:min-h-11"
            >
              <span className="text-body text-label block truncate font-medium">{board.name}</span>
              <span className="text-footnote text-label-secondary flex min-w-0 gap-2">
                <span className="min-w-0 flex-1 truncate">
                  {board.latest ? board.latest.threadTitle : "No threads yet"}
                </span>
                {board.latest ? (
                  <span className="shrink-0 tabular-nums">{timeAgo(board.latest.at)}</span>
                ) : null}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </RailPanel>
  );
}

/**
 * How many are in the room now. The server counts distinct users per room, not who they are, so this is a number
 * and not the mockup's chips; those need a per-user presence feature. Left out while the count is unknown.
 */
export function OnlinePanel({ online }: { online: number | null }) {
  if (online === null) return null;
  return (
    <RailPanel title="Online now" icon={<Group />}>
      <Stat
        value={online.toLocaleString("en-US")}
        label={online === 1 ? "person in the room" : "people in the room"}
      />
    </RailPanel>
  );
}

/** The latest public game events of the realm's nations. */
export function RecentActionsPanel({
  realmName,
  actions,
}: {
  realmName: string;
  actions: readonly RailAction[];
}) {
  if (actions.length === 0) return null;
  return (
    <RailPanel title={`Recent actions in ${realmName}`} icon={<Activity />}>
      <ul className="divide-separator divide-y">
        {actions.slice(0, RECENT_ACTIONS_SHOWN).map((action) => (
          <li
            key={action.id}
            className="flex min-w-0 items-baseline gap-2 py-2 first:pt-0 last:pb-0"
          >
            <span className="text-body min-w-0 flex-1 break-words">{action.text}</span>
            <span className="text-footnote text-label-secondary shrink-0 tabular-nums">
              {timeAgo(action.at)}
            </span>
          </li>
        ))}
      </ul>
    </RailPanel>
  );
}

interface RealmRailProps extends RailContent {
  realm: BoardData["realm"];
}

/** The realm landing's rail: Boards, Online now, Recent actions, and the board settings for those who may change them. */
export function RealmRail({ realm, boards, online, actions, canManageSettings }: RealmRailProps) {
  return (
    <>
      <BoardsPanel slug={realm.slug} boards={boards} />
      <OnlinePanel online={online} />
      <RecentActionsPanel realmName={realm.name} actions={actions} />
      {canManageSettings ? (
        <BoardSettingsPanel realmId={realm.id} slug={realm.slug} settings={realm.settings} />
      ) : null}
    </>
  );
}
