"use client";

import { useState } from "react";
import { MoreHoriz } from "iconoir-react";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { api } from "~/trpc/react";
import { BanDialog, banScopeOptions, type PlacedCategory } from "./BanDialog";
import type { ForumPost } from "./PostItem";
import { FormError, ReasonField } from "./ReasonField";
import { WarnDialog } from "./WarnDialog";

/** What a moderator's post menu needs from its thread, built once by ThreadView. */
export interface ModeratorTools {
  /** The thread's category: ban scopes are offered from it. */
  category: PlacedCategory;
  /** Saves a moderator's edit; the note goes to the moderation log with the previous text. */
  saveEdit: (postId: string, html: string, note: string) => Promise<void>;
  /** Refreshes the thread and the listings whose counts follow it. */
  refresh: () => Promise<void>;
}

type Open = "hide" | "warn" | "ban" | null;

interface ModeratorMenuProps {
  post: ForumPost;
  tools: ModeratorTools;
  /** Opens the post's edit composer in moderator mode. */
  onEdit: () => void;
}

/** A moderator's actions on one post (those the server allows): hide or unhide, edit, warn or ban its author. */
export function ModeratorMenu({ post, tools, onEdit }: ModeratorMenuProps) {
  const [open, setOpen] = useState<Open>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const utils = api.useUtils();
  const { data: context } = api.thinkpagesForumMod.context.useQuery();
  const { mutateAsync: setHidden, isPending } = api.thinkpagesForumMod.setPostHidden.useMutation();
  const hidden = post.hidden === true;
  const verb = hidden ? "Unhide" : "Hide";
  // Imported content without an IxStats author (phase 4) has nobody to warn or ban; the server says so too.
  const sanctionTarget = post.sanctionable ? post.authorUserId : null;

  const dialog = (which: Exclude<Open, null>) => ({
    open: open === which,
    onOpenChange: (next: boolean) => {
      setOpen(next ? which : null);
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
          setOpen(null);
          void tools.refresh();
        },
        (e: Error) => setError(e.message || `Could not ${verb.toLowerCase()} the post.`)
      );
  };

  return (
    <>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label="Moderate post">
            <MoreHoriz aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        {/* Only what the server allows: Hide and Edit unless a site admin wrote it (for non-admins); Warn and Ban
            unless the author is a site admin, a moderator here, or the viewer. */}
        <DropdownMenuContent align="end">
          {post.moderable ? (
            <>
              <DropdownMenuItem onSelect={() => setOpen("hide")}>{`${verb} post`}</DropdownMenuItem>
              <DropdownMenuItem onSelect={onEdit}>Edit as moderator</DropdownMenuItem>
            </>
          ) : null}
          {sanctionTarget ? (
            <>
              {post.moderable ? <DropdownMenuSeparator /> : null}
              <DropdownMenuItem onSelect={() => setOpen("warn")}>Warn author</DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onSelect={() => setOpen("ban")}>
                Ban author
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

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
