"use client";

import { useState } from "react";
import { Link } from "iconoir-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { api } from "~/trpc/react";

/** Composer button: pick one of your nation's public actions and insert its `[ixaction=<id>]` token. */
export function ActionPicker({ onPick }: { onPick: (token: string) => void }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const { data = [] } = api.actionLinks.myActivities.useQuery(
    { search: search || undefined },
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
        <ul className="mt-2 max-h-64 overflow-y-auto">
          {data.map((a) => (
            <li key={a.id}>
              <button
                type="button"
                className="text-label hover:bg-fill-4 w-full rounded-md px-2 py-1.5 text-left text-sm"
                onClick={() => {
                  onPick(`[ixaction=${a.id}]`);
                  setOpen(false);
                }}
              >
                {a.title}
              </button>
            </li>
          ))}
          {data.length === 0 ? (
            <li className="text-label-secondary px-2 py-1.5 text-sm">No public actions yet</li>
          ) : null}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
