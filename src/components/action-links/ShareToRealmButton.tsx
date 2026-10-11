"use client";

import Link from "next/link";
import { ChatBubble } from "iconoir-react";
import { useForumNavFlags } from "~/components/shell/use-forum-nav-flags";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { REALM_HUB_KEY } from "~/lib/thinkpages-forum/categories";
import { newThreadAttachHref, realmBoardAttachHref } from "~/lib/thinkpages-forum/links";
import { cn } from "~/lib/utils/cn";

/**
 * From a declared directive, open the viewer's realm board or a new Hub thread with the action already attached.
 * It uses the realm the sidebar lists as "Your realm" and renders nothing without one. The composer, not this
 * button, verifies the action: only the primary nation's actions attach. It is an outline (secondary) action beside
 * the card's primary. MyCountry is signed-in only, so the flags query is the one the shell already holds in cache.
 */
export function ShareToRealmButton({
  activityId,
  className,
}: {
  activityId: string;
  className?: string;
}) {
  const { realm } = useForumNavFlags(true);
  if (!realm) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" size="sm" className={cn("h-11 sm:h-8", className)}>
          <ChatBubble aria-hidden="true" />
          Discuss in the forum
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild className="pointer-coarse:min-h-11">
          <Link href={realmBoardAttachHref(realm.slug, activityId)}>
            Post on the {realm.name} board
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="pointer-coarse:min-h-11">
          <Link
            href={newThreadAttachHref(
              { key: REALM_HUB_KEY, realm: { slug: realm.slug } },
              activityId
            )}
          >
            Start a thread in {realm.name} Hub
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
