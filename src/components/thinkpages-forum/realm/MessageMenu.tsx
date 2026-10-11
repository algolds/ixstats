"use client";

import { useState } from "react";
import { MoreHoriz } from "iconoir-react";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import {
  hasModeratorActions,
  ModeratorDialogs,
  ModeratorMenuItems,
  type ModeratablePost,
  type ModeratorDialogName,
  type ModeratorTools,
} from "../ModeratorMenu";
import { ReportDialog } from "../ReportDialog";
import { ContinueDialog } from "./ContinueDialog";
import type { BoardAccess, BoardMessageData } from "./types";

interface MessageMenuProps {
  message: BoardMessageData;
  access: BoardAccess;
  signedIn: boolean;
  tools: ModeratorTools | null;
  /** Opens the editor in place: the author's, or the moderator's. */
  onEdit: (asModerator: boolean) => void;
  /** A moderation action or a continue changed the board. */
  onChanged: () => void;
}

type Open = ModeratorDialogName | "report" | "continue" | null;

/** What the moderator menu needs of a board message: the server's verdicts, which only moderators receive. */
function moderatable(message: BoardMessageData): ModeratablePost {
  return {
    id: message.id,
    hidden: message.hidden,
    moderable: message.moderable === true,
    sanctionable: message.sanctionable === true,
    authorUserId: message.authorUserId,
  };
}

/** Which items the viewer may use on a message; the server asks again on every action. */
function abilitiesOf(
  message: BoardMessageData,
  access: BoardAccess,
  signedIn: boolean,
  tools: ModeratorTools | null,
  post: ModeratablePost
) {
  const continuable =
    (message.byViewer && !access.isVisitor) || (access.isModerator && message.moderable === true);
  return {
    canContinue: message.hidden !== true && continuable,
    canReport: signedIn && !message.byViewer && !access.isModerator,
    canEdit: message.canEdit,
    moderating: access.isModerator && tools !== null && hasModeratorActions(post),
  };
}

type Abilities = ReturnType<typeof abilitiesOf>;

interface MenuItemsProps {
  abilities: Abilities;
  post: ModeratablePost;
  setOpen: (next: Open) => void;
  onEdit: (asModerator: boolean) => void;
}

function MenuItems({ abilities, post, setOpen, onEdit }: MenuItemsProps) {
  const { canContinue, canReport, canEdit, moderating } = abilities;
  const first = canContinue || canReport || canEdit;
  return (
    <>
      {canContinue ? (
        <DropdownMenuItem onSelect={() => setOpen("continue")}>
          Continue in a thread
        </DropdownMenuItem>
      ) : null}
      {canReport ? (
        <DropdownMenuItem onSelect={() => setOpen("report")}>Report</DropdownMenuItem>
      ) : null}
      {canEdit ? <DropdownMenuItem onSelect={() => onEdit(false)}>Edit</DropdownMenuItem> : null}
      {moderating ? (
        <>
          {first ? <DropdownMenuSeparator /> : null}
          <ModeratorMenuItems post={post} onOpen={setOpen} onEdit={() => onEdit(true)} />
        </>
      ) : null}
    </>
  );
}

interface MenuDialogsProps {
  message: BoardMessageData;
  post: ModeratablePost;
  tools: ModeratorTools | null;
  moderating: boolean;
  open: Open;
  setOpen: (next: Open) => void;
  onChanged: () => void;
}

/** Mounted while open only: a closed message costs no hooks and a reopened form starts empty. */
function MenuDialogs({
  message,
  post,
  tools,
  moderating,
  open,
  setOpen,
  onChanged,
}: MenuDialogsProps) {
  const moderatorOpen = open === "report" || open === "continue" ? null : open;
  return (
    <>
      {open === "report" ? (
        <ReportDialog
          targetType="post"
          targetId={message.id}
          control={{ open: true, onOpenChange: (next) => setOpen(next ? "report" : null) }}
        />
      ) : null}
      {open === "continue" ? (
        <ContinueDialog
          message={message}
          open
          onOpenChange={(next) => setOpen(next ? "continue" : null)}
          onDone={onChanged}
        />
      ) : null}
      {moderating && tools ? (
        <ModeratorDialogs post={post} tools={tools} open={moderatorOpen} onOpenChange={setOpen} />
      ) : null}
    </>
  );
}

/**
 * A board message's "More actions" menu: Continue in a thread, Report, Edit, and a moderator's hide or unhide, edit,
 * warn and ban. Each item appears only when the viewer may use it (the server asks again); the menu is left out when
 * it would be empty.
 */
export function MessageMenu({
  message,
  access,
  signedIn,
  tools,
  onEdit,
  onChanged,
}: MessageMenuProps) {
  const [open, setOpen] = useState<Open>(null);
  const post = moderatable(message);
  const abilities = abilitiesOf(message, access, signedIn, tools, post);
  const { canContinue, canReport, canEdit, moderating } = abilities;
  if (!canContinue && !canReport && !canEdit && !moderating) return null;

  return (
    <>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="More actions"
            className="text-label-secondary hover:text-label pointer-coarse:min-h-11 pointer-coarse:min-w-11"
          >
            <MoreHoriz aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <MenuItems abilities={abilities} post={post} setOpen={setOpen} onEdit={onEdit} />
        </DropdownMenuContent>
      </DropdownMenu>
      <MenuDialogs
        message={message}
        post={post}
        tools={tools}
        moderating={moderating}
        open={open}
        setOpen={setOpen}
        onChanged={onChanged}
      />
    </>
  );
}
