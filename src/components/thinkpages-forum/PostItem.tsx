"use client";

import { memo, useState } from "react";
import type { ActionCardData } from "~/components/action-links";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { timeAgo } from "~/lib/format/compact";
import type { RouterOutputs } from "~/trpc/react";
import { AuthorName, type ForumAuthors } from "./AuthorName";
import { ForumComposer } from "./ForumComposer";
import { PostBody } from "./PostBody";

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
}

/** One post, anchored at `#post-<id>` for permalinks; the author edits it in place. */
export const PostItem = memo(function PostItem({
  post,
  authors,
  cards,
  cardsReady,
  cardsErrored,
  canEdit,
  onEdit,
}: PostItemProps) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    // The composer is chrome; outside the post's pane so glass never sits on glass.
    return (
      <section id={`post-${post.id}`} aria-label="Edit post" className="scroll-mt-24 space-y-2">
        <ForumComposer
          icAllowed={false}
          initialHtml={post.contentHtml}
          submitLabel="Save"
          onSubmit={async ({ html }) => {
            await onEdit(post.id, html);
            setEditing(false);
          }}
        />
        <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
          Cancel
        </Button>
      </section>
    );
  }

  return (
    <Card id={`post-${post.id}`} content="prose" padding="md" className="scroll-mt-24">
      <header className="mb-1 flex items-center gap-2">
        <p className="text-subhead flex min-w-0 flex-1 gap-1">
          <AuthorName
            authors={authors}
            userId={post.authorUserId}
            personaId={post.authorPersonaId}
          />
        </p>
        <p className="text-footnote text-label-secondary shrink-0 tabular-nums">
          {timeAgo(post.createdAt)}
          {post.editedAt ? " (edited)" : null}
        </p>
        {canEdit ? (
          <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
            Edit
          </Button>
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
