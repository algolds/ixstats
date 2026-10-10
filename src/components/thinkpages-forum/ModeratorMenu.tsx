"use client";

import { useState } from "react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import { Button } from "~/components/ui/button";
import { DropdownMenuItem, DropdownMenuSeparator } from "~/components/ui/dropdown-menu";
import { api } from "~/trpc/react";
import { BanDialog, banScopeOptions, type PlacedCategory } from "./BanDialog";
import type { ForumPost } from "./thread/types";
import { FormError, ReasonField } from "./ReasonField";
import { WarnDialog } from "./WarnDialog";

/** What a moderator's post menu needs from its thread, built once by ThreadPage. */
export interface ModeratorTools {
  /** The thread's category: ban scopes are offered from it. */
  category: PlacedCategory;
  /** Saves a moderator's edit; the note goes to the moderation log with the previous text. */
  saveEdit: (postId: string, html: string, note: string) => Promise<void>;
  /** Refreshes the thread and the listings whose counts follow it. */
  refresh: () => Promise<void>;
}

/**
 * What the moderator menu and dialogs need of a post: a thread post, or a board message the caller describes in these
 * terms (the board reads carry no per-author verdicts, so the caller derives them and the server still decides).
 */
export type ModeratablePost = Pick<
  ForumPost,
  "id" | "hidden" | "moderable" | "sanctionable" | "authorUserId"
>;

/** The moderator dialogs a post's menu opens. */
export type ModeratorDialogName = "hide" | "warn" | "ban";

interface ModeratorMenuItemsProps {
  post: ModeratablePost;
  /** Opens one of the dialogs (rendered by `ModeratorDialogs`). */
  onOpen: (dialog: ModeratorDialogName) => void;
  /** Opens the post's edit composer in moderator mode. */
  onEdit: () => void;
}

/** Whether the server allows the viewer any moderator action on this post. */
export function hasModeratorActions(post: ModeratablePost): boolean {
  return Boolean(post.moderable || post.sanctionable);
}

/**
 * A moderator's actions on one post (those the server allows) as items of the post's menu: hide or unhide, edit, warn
 * or ban its author. Only what the server allows: Hide and Edit unless a site admin wrote it (for non-admins); Warn
 * and Ban unless the author is a site admin, a moderator here, or the viewer.
 */
export function ModeratorMenuItems({ post, onOpen, onEdit }: ModeratorMenuItemsProps) {
  const verb = post.hidden === true ? "Unhide" : "Hide";
  // Imported content without an IxStats author (phase 4) has nobody to warn or ban; the server says so too.
  const sanctionable = post.sanctionable && post.authorUserId !== null;
  return (
    <>
      {post.moderable ? (
        <>
          <DropdownMenuItem onSelect={() => onOpen("hide")}>{`${verb} post`}</DropdownMenuItem>
          <DropdownMenuItem onSelect={onEdit}>Edit as moderator</DropdownMenuItem>
        </>
      ) : null}
      {sanctionable ? (
        <>
          {post.moderable ? <DropdownMenuSeparator /> : null}
          <DropdownMenuItem onSelect={() => onOpen("warn")}>Warn author</DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onSelect={() => onOpen("ban")}>
            Ban author
          </DropdownMenuItem>
        </>
      ) : null}
    </>
  );
}

interface ModeratorDialogsProps {
  post: ModeratablePost;
  tools: ModeratorTools;
  /** The dialog that is open, if any. */
  open: ModeratorDialogName | null;
  onOpenChange: (open: ModeratorDialogName | null) => void;
}

/** The dialogs behind a post's moderator items: hide or unhide (with a note), warn and ban. */
export function ModeratorDialogs({ post, tools, open, onOpenChange }: ModeratorDialogsProps) {
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const utils = api.useUtils();
  const { data: context } = api.thinkpagesForumMod.context.useQuery();
  const { mutateAsync: setHidden, isPending } = api.thinkpagesForumMod.setPostHidden.useMutation();
  const hidden = post.hidden === true;
  const verb = hidden ? "Unhide" : "Hide";
  const sanctionTarget = post.sanctionable ? post.authorUserId : null;

  const dialog = (which: ModeratorDialogName) => ({
    open: open === which,
    onOpenChange: (next: boolean) => {
      onOpenChange(next ? which : null);
      if (next) return;
      setError(null);
      setNote("");
    },
  });

  // A sanction changes the thread's view and the console's Warnings, Bans and Log lists.
  const sanctioned = () => {
    void tools.refresh();
    void utils.thinkpagesForumMod.invalidate();
  };

  const toggleHidden = () => {
    const trimmed = note.trim();
    setError(null);
    setHidden({ postId: post.id, hidden: !hidden, ...(trimmed ? { note: trimmed } : {}) })
      // A failed refresh is not a failed action: only the mutation's refusal is shown.
      .then(
        () => {
          setNote("");
          onOpenChange(null);
          void tools.refresh();
        },
        (e: Error) => setError(e.message || `Could not ${verb.toLowerCase()} the post.`)
      );
  };

  return (
    <>
      <AlertDialog {...dialog("hide")}>
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>{`${verb} this post?`}</AlertDialogTitle>
            <AlertDialogDescription>
              {hidden
                ? "Members see it again."
                : "Members no longer see it. Moderators still do, marked Hidden."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <ReasonField
            label="Note for the moderation log (optional)"
            value={note}
            onChange={setNote}
            max={1000}
            disabled={isPending}
          />
          <FormError message={error} />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button
              variant={hidden ? "default" : "destructive"}
              onClick={toggleHidden}
              disabled={isPending}
            >
              {`${verb} post`}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Mounted while open only: each post's closed dialogs cost no hooks, and a reopened form starts empty. */}
      {open === "warn" && sanctionTarget ? (
        <WarnDialog
          userId={sanctionTarget}
          target={{ type: "post", id: post.id }}
          onDone={sanctioned}
          {...dialog("warn")}
        />
      ) : null}
      {open === "ban" && sanctionTarget ? (
        <BanDialog
          userId={sanctionTarget}
          scopes={banScopeOptions(tools.category, context)}
          onDone={sanctioned}
          {...dialog("ban")}
        />
      ) : null}
    </>
  );
}
