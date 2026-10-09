"use client";

import { memo, useState } from "react";
import type { ActionCardData } from "~/components/action-links";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { timeAgo } from "~/lib/format/compact";
import { cn } from "~/lib/utils/cn";
import type { RouterOutputs } from "~/trpc/react";
import { AuthorName, type ForumAuthors } from "./AuthorName";
import { ForumComposer } from "./ForumComposer";
import { ModeratorMenu, type ModeratorTools } from "./ModeratorMenu";
import { PostBody } from "./PostBody";
import { ReportDialog } from "./ReportDialog";

export type ForumPost = RouterOutputs["thinkpagesForum"]["thread"]["posts"][number];

interface PostItemProps {
  post: ForumPost;
  authors: ForumAuthors;
  cards: ReadonlyMap<string, ActionCardData>;
  cardsReady: boolean;
  cardsErrored: boolean;
  /** The viewer may edit this post (their own, in an open thread). */
  canEdit: boolean;
  onEdit: (postId: string, html: string) => Promise<void>;
  /** A signed-in viewer may report this post (another member's). */
  canReport: boolean;
  /** The viewer moderates this thread's category: the post menu, with `tools`, when it has any action. */
  canModerate: boolean;
  tools: ModeratorTools | null;
}

/** Who is editing: the author, or a moderator (whose save needs a note for the log). */
type Editing = "author" | "moderator" | null;

interface PostEditorProps {
  post: ForumPost;
  asModerator: boolean;
  onSave: (html: string, note: string) => Promise<void>;
  onCancel: () => void;
}

/** The post's edit composer in place; a moderator also gives a note for the moderation log. */
function PostEditor({ post, asModerator, onSave, onCancel }: PostEditorProps) {
  const [note, setNote] = useState("");
  return (
    // The composer is chrome; outside the post's pane so glass never sits on glass.
    <section
      id={`post-${post.id}`}
      aria-label={asModerator ? "Edit post as moderator" : "Edit post"}
      className="scroll-mt-24 space-y-2"
    >
      {asModerator ? (
        <Input
          aria-label="Note for the moderation log"
          placeholder="Why you are editing this post (required)"
          value={note}
          maxLength={1000}
          onChange={(e) => setNote(e.target.value)}
        />
      ) : null}
      <ForumComposer
        icAllowed={false}
        initialHtml={post.contentHtml}
        submitLabel="Save"
        onSubmit={async ({ html }) => {
          if (asModerator && !note.trim()) throw new Error("Add a note for the moderation log.");
          await onSave(html, note.trim());
        }}
      />
      <Button variant="ghost" size="sm" onClick={onCancel}>
        Cancel
      </Button>
    </section>
  );
}

/**
 * One post, anchored at `#post-<id>` for permalinks; the author edits it in place, other members may report it and
 * the category's moderators get its menu (a hidden post, which only they receive, is badged and muted).
 */
export const PostItem = memo(function PostItem({
  post,
  authors,
  cards,
  cardsReady,
  cardsErrored,
  canEdit,
  onEdit,
  canReport,
  canModerate,
  tools,
}: PostItemProps) {
  const [editing, setEditing] = useState<Editing>(null);

  if (editing) {
    const asModerator = editing === "moderator";
    return (
      <PostEditor
        post={post}
        asModerator={asModerator}
        onCancel={() => setEditing(null)}
        onSave={async (html, note) => {
          await (asModerator && tools
            ? tools.saveEdit(post.id, html, note)
            : onEdit(post.id, html));
          setEditing(null);
        }}
      />
    );
  }

  return (
    // The thread column already bounds the measure; lift prose's 70ch child cap so the header and body span the card.
    <Card
      id={`post-${post.id}`}
      content="prose"
      padding="md"
      data-hidden={post.hidden ? "" : undefined}
      className={cn("scroll-mt-24 [&>*]:max-w-none", post.hidden && "bg-fill-4 opacity-70")}
    >
      <header className="mb-1 flex items-center gap-2">
        <p className="text-subhead flex min-w-0 flex-1 gap-1">
          <AuthorName
            authors={authors}
            userId={post.authorUserId}
            personaId={post.authorPersonaId}
          />
        </p>
        {post.hidden ? <Badge variant="warning">Hidden</Badge> : null}
        <p className="text-footnote text-label-secondary shrink-0 tabular-nums">
          {timeAgo(post.createdAt)}
          {post.editedAt ? " (edited)" : null}
        </p>
        {canEdit ? (
          <Button variant="ghost" size="sm" onClick={() => setEditing("author")}>
            Edit
          </Button>
        ) : null}
        {canReport ? <ReportDialog targetType="post" targetId={post.id} /> : null}
        {canModerate && tools && (post.moderable || post.sanctionable) ? (
          <ModeratorMenu post={post} tools={tools} onEdit={() => setEditing("moderator")} />
        ) : null}
      </header>
      <PostBody
        html={post.contentHtml}
        cards={cards}
        cardsReady={cardsReady}
        cardsErrored={cardsErrored}
      />
    </Card>
  );
});
