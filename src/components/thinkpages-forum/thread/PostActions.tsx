"use client";

import { useState } from "react";
import { MoreHoriz, Reply, ShareIos, Quote } from "iconoir-react";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { useNotify } from "~/hooks/useNotify";
import { postHref } from "~/lib/thinkpages-forum/links";
import { createUrl } from "~/lib/utils/url-utils";
import {
  hasModeratorActions,
  ModeratorDialogs,
  ModeratorMenuItems,
  type ModeratorDialogName,
  type ModeratorTools,
} from "../ModeratorMenu";
import { ReportDialog } from "../ReportDialog";
import type { ForumPost } from "./types";

interface PostActionsProps {
  post: ForumPost;
  /** The viewer may reply here: Reply and Quote are offered. */
  canReply: boolean;
  /** Takes the reader to the composer. */
  onReply: () => void;
  /** Quotes the post in the composer. */
  onQuote: (postId: string) => void;
  /** The viewer may edit this post (their own, in an open thread). */
  canEdit: boolean;
  onEdit: () => void;
  /** A signed-in viewer may report this post (another member's). */
  canReport: boolean;
  /** The viewer moderates this thread's category: the server's per-post flags decide what the menu offers. */
  canModerate: boolean;
  tools: ModeratorTools | null;
  /** Moderator edits open the composer in moderator mode. */
  onModeratorEdit: () => void;
}

type Open = ModeratorDialogName | "report" | null;

const ACTION = "text-label-secondary hover:text-label pointer-coarse:min-h-11";

/** The absolute permalink of a post, under the deployment's base path. */
const permalinkOf = (postId: string) => `${window.location.origin}${createUrl(postHref(postId))}`;

/**
 * A post's actions: Reply, Quote and Share in the row, and a "More actions" menu holding Report, Edit and the
 * moderator tools. Share copies the permalink; the menu is left out when it would be empty.
 */
export function PostActions({
  post,
  canReply,
  onReply,
  onQuote,
  canEdit,
  onEdit,
  canReport,
  canModerate,
  tools,
  onModeratorEdit,
}: PostActionsProps) {
  const notify = useNotify();
  const [open, setOpen] = useState<Open>(null);
  const moderating = canModerate && tools !== null && hasModeratorActions(post);

  const share = async () => {
    try {
      await navigator.clipboard.writeText(permalinkOf(post.id));
      notify.success("Link copied");
    } catch {
      notify.error("Could not copy the link");
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-1">
      {canReply ? (
        <>
          <Button variant="ghost" size="sm" className={ACTION} onClick={onReply}>
            <Reply aria-hidden />
            Reply
          </Button>
          <Button variant="ghost" size="sm" className={ACTION} onClick={() => onQuote(post.id)}>
            <Quote aria-hidden />
            Quote
          </Button>
        </>
      ) : null}
      <Button variant="ghost" size="sm" className={ACTION} onClick={() => void share()}>
        <ShareIos aria-hidden />
        Share
      </Button>
      <span className="flex-1" />
      {canReport || canEdit || moderating ? (
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label="More actions" className={ACTION}>
              <MoreHoriz aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {canReport ? (
              <DropdownMenuItem onSelect={() => setOpen("report")}>Report</DropdownMenuItem>
            ) : null}
            {canEdit ? <DropdownMenuItem onSelect={onEdit}>Edit</DropdownMenuItem> : null}
            {moderating ? (
              <>
                {canReport || canEdit ? <DropdownMenuSeparator /> : null}
                <ModeratorMenuItems post={post} onOpen={setOpen} onEdit={onModeratorEdit} />
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
      {/* The report dialog is mounted while open only, so a closed post costs no hooks and a reopened form starts empty.
          The moderator dialogs stay mounted for a moderator's posts and open and close themselves. */}
      {open === "report" ? (
        <ReportDialog
          targetType="post"
          targetId={post.id}
          control={{ open: true, onOpenChange: (next) => setOpen(next ? "report" : null) }}
        />
      ) : null}
      {moderating && tools ? (
        <ModeratorDialogs
          post={post}
          tools={tools}
          open={open === "report" ? null : open}
          onOpenChange={setOpen}
        />
      ) : null}
    </div>
  );
}
