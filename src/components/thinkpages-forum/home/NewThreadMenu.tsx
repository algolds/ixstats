"use client";

import Link from "next/link";
import { EditPencil } from "iconoir-react";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { newThreadHref } from "~/lib/thinkpages-forum/links";

interface Startable {
  key: string;
  name: string;
  canStart: boolean;
}

/** New thread from the home: the boards the viewer may start one in. Nothing when there are none. */
export function NewThreadMenu({ boards }: { boards: ReadonlyArray<Startable> }) {
  const startable = boards.filter((b) => b.canStart);
  if (startable.length === 0) return null;
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button size="sm">
          <EditPencil aria-hidden />
          New thread
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {startable.map((b) => (
          <DropdownMenuItem key={b.key} asChild>
            <Link href={newThreadHref({ key: b.key })}>{b.name}</Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
