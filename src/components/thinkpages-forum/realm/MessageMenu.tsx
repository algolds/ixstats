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

/** What the moderator menu needs of a board message. The board reads carry no per-author verdicts; the server decides. */
function moderatable(message: BoardMessageData): ModeratablePost {
  return {
    id: message.id,
    hidden: message.hidden,
    moderable: true,
    sanctionable: !message.byViewer && message.authorUserId !== null,
    authorUserId: message.authorUserId,
  };
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
  const moderating = access.isModerator && tools !== null;
  const canContinue =
    message.hidden !== true && ((message.byViewer && !access.isVisitor) || access.isModerator);
  const canReport = signedIn && !message.byViewer && !access.isModerator;
  const canEdit = message.canEdit;
  if (!canContinue && !canReport && !canEdit && !moderating) return null;

  const post = moderatable(message);
  const moderatorOpen = open === "report" || open === "continue" ? null : open;
  const first = canContinue || canReport || canEdit;

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
          {canContinue ? (
            <DropdownMenuItem onSelect={() => setOpen("continue")}>
              Continue in a thread
            </DropdownMenuItem>
          ) : null}
          {canReport ? (
            <DropdownMenuItem onSelect={() => setOpen("report")}>Report</DropdownMenuItem>
          ) : null}
          {canEdit ? (
            <DropdownMenuItem onSelect={() => onEdit(false)}>Edit</DropdownMenuItem>
          ) : null}
          {moderating ? (
            <>
              {first ? <DropdownMenuSeparator /> : null}
              <ModeratorMenuItems post={post} onOpen={setOpen} onEdit={() => onEdit(true)} />
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
      {/* Mounted while open only: a closed message costs no hooks and a reopened form starts empty. */}
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
