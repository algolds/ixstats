"use client";

import { EditPencil, MoreHoriz, Reply, Trash } from "iconoir-react";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { cn } from "~/lib/utils";

interface MessageMenuProps {
  isOwn: boolean;
  onReply: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

/** The message's actions. Rendered in the right-click and long-press menu and in the visible "More actions" menu. */
export function MessageMenuItems({ isOwn, onReply, onEdit, onDelete }: MessageMenuProps) {
  return (
    <>
      <DropdownMenuItem onSelect={onReply}>
        <Reply aria-hidden="true" />
        Reply
      </DropdownMenuItem>
      {isOwn && (
        <>
          <DropdownMenuItem onSelect={onEdit}>
            <EditPencil aria-hidden="true" />
            Edit
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={onDelete}>
            <Trash aria-hidden="true" />
            Delete message
          </DropdownMenuItem>
        </>
      )}
    </>
  );
}

/** Shown beside the bubble on hover or focus, and always on touch screens. */
export const BUBBLE_CONTROL_CLASS =
  "text-label-secondary hover:text-label rounded-full opacity-0 transition-opacity duration-fast group-hover/bubble:opacity-100 group-focus-within/bubble:opacity-100 data-[state=open]:opacity-100 pointer-coarse:size-11 pointer-coarse:opacity-100";

export function MessageMoreActions(props: MessageMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="More actions"
          className={cn(BUBBLE_CONTROL_CLASS)}
        >
          <MoreHoriz aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={props.isOwn ? "end" : "start"} className="w-44">
        <MessageMenuItems {...props} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
