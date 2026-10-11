"use client";

import { useState, type ComponentType } from "react";
import { Bank, Globe, Group, Link, RssFeed, StatUp, Trophy } from "iconoir-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { actionToken, actionTypeLabel } from "~/lib/action-links";
import { IxTime } from "~/lib/ixtime";
import { api, type RouterOutputs } from "~/trpc/react";

type PickRow = RouterOutputs["actionLinks"]["myActivities"][number];

const TYPE_ICON: Record<string, ComponentType<{ className?: string }>> = {
  directive: Bank,
  diplomatic: Globe,
  economic: StatUp,
  achievement: Trophy,
  social: Group,
};

function ActionRow({ row, onPick }: { row: PickRow; onPick: () => void }) {
  const Icon = TYPE_ICON[row.type] ?? RssFeed;
  const when = IxTime.formatIxTime(IxTime.convertToIxTime(new Date(row.createdAt).getTime()));
  return (
    <li>
      <button
        type="button"
        className="text-label hover:bg-fill-4 flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-sm pointer-coarse:min-h-11"
        onClick={onPick}
      >
        <Icon aria-hidden className="text-label-secondary mt-0.5 size-4 shrink-0" />
        <span className="min-w-0">
          <span className="block truncate">{row.title}</span>
          <span className="text-label-secondary text-footnote block">
            {`${actionTypeLabel(row.type)} · ${when}`}
          </span>
        </span>
      </button>
    </li>
  );
}

/**
 * Composer button: pick one of your nation's public actions and insert its `[ixaction=<id>]` token. It opens on the 10
 * most recent actions; typing searches up to 30. Rows that are not actions a player takes (name generation, nation
 * founded, tier changes, achievement unlocks) are not offered.
 */
export function ActionPicker({ onPick }: { onPick: (token: string) => void }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const term = search.trim();
  const { data = [] } = api.actionLinks.myActivities.useQuery(
    { search: term || undefined },
    { enabled: open }
  );
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="ghost" size="sm">
          <Link className="size-4" /> Attach action
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-2">
        <Input
          placeholder="Search your actions"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          autoFocus
        />
        <p className="text-label-secondary text-footnote px-2 pt-2 pb-1">
          {term ? "Matching actions" : "Recent actions"}
        </p>
        <ul className="max-h-64 overflow-y-auto">
          {data.map((row) => (
            <ActionRow
              key={row.id}
              row={row}
              onPick={() => {
                onPick(actionToken(row.id));
                setOpen(false);
              }}
            />
          ))}
          {data.length === 0 ? (
            <li className="text-label-secondary px-2 py-1.5 text-sm">No public actions yet</li>
          ) : null}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
