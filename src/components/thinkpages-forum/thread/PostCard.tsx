"use client";

import { memo, useState } from "react";
import type { ActionCardData } from "~/components/action-links";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { cn } from "~/lib/utils/cn";
import type { ForumAuthors } from "../AuthorName";
import { CanvasComposer, htmlToQuoteText, type QuoteRequest } from "../composer";
import { ForumComposer } from "../ForumComposer";
import type { ModeratorTools } from "../ModeratorMenu";
import { PostActions } from "./PostActions";
import { PostBody } from "./PostBody";
import { PostHeader } from "./PostHeader";
import type { EditBody, ForumPost, PostStyle } from "./types";

interface PostCardProps {
  post: ForumPost;
  authors: ForumAuthors;
  style: PostStyle;
  /** Classes for the post's row in the feed (the divider above all but the first). */
  className?: string;
  cards: ReadonlyMap<string, ActionCardData>;
  cardsReady: boolean;
  cardsErrored: boolean;
  /** The viewer may reply here: Reply and Quote are offered. */
  canReply: boolean;
  onReply: () => void;
  onQuote: (quote: QuoteRequest) => void;
  /** The thread takes edits and replies: not locked or archived. */
  open: boolean;
  signedIn: boolean;
  onEdit: (postId: string, body: EditBody) => Promise<{ formatting: "done" | "pending" }>;
  /** The viewer moderates this thread's category. */
  canModerate: boolean;
  tools: ModeratorTools | null;
}

/** Who is editing: the author, or a moderator (whose save needs a note for the log). */
type Editing = "author" | "moderator" | null;

interface PostEditorProps {
  post: ForumPost;
  style: PostStyle;
  asModerator: boolean;
  onSaveHtml: (html: string, note: string) => Promise<void>;
  /** Saves Canvas wikitext; resolves with whether the wiki finished formatting it. */
  onSaveWikitext: (wikitext: string) => Promise<{ formatting: "done" | "pending" }>;
  onCancel: () => void;
}

/**
 * The post's editor in place. A post written in Canvas (the author receives its wikitext) opens in Canvas; an older or
 * imported HTML post, and any moderator edit, keeps the light editor. A moderator also gives a note for the log.
 */
function PostEditor({
  post,
  style,
  asModerator,
  onSaveHtml,
  onSaveWikitext,
  onCancel,
}: PostEditorProps) {
  const [note, setNote] = useState("");
  const canvas = !asModerator && post.contentWikitext !== undefined;
  return (
    <section
      aria-label={asModerator ? "Edit post as moderator" : "Edit post"}
      className="space-y-2"
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
      {canvas ? (
        <CanvasComposer
          mode="edit"
          initialWikitext={post.contentWikitext}
          postStyle={style}
          onSubmit={onSaveWikitext}
        />
      ) : (
        <ForumComposer
          icAllowed={false}
          initialHtml={post.contentHtml}
          submitLabel="Save"
          onSubmit={async ({ html }) => {
            if (asModerator && !note.trim()) throw new Error("Add a note for the moderation log.");
            await onSaveHtml(html, note.trim());
          }}
        />
      )}
      <Button variant="ghost" size="sm" className="pointer-coarse:min-h-11" onClick={onCancel}>
        Cancel
      </Button>
    </section>
  );
}

/** The post's author as its header shows it: a persona is the persona only, an imported post the old forum's name. */
function headerAuthor(post: ForumPost, authors: ForumAuthors) {
  if (post.authorPersonaId) {
    const persona = authors.personas[post.authorPersonaId];
    // A persona whose record is gone still names nobody else: not its player, not an imported name.
    return {
      name: persona?.displayName ?? "Member",
      handle: persona?.username ?? null,
      avatarUrl: persona?.avatarUrl ?? null,
      flagUrl: null,
      personaUsername: persona?.username,
      imported: false,
    };
  }
  const user = post.authorUserId ? authors.users[post.authorUserId] : undefined;
  return {
    name: user?.name ?? post.importedAuthorName ?? "Member",
    handle: user?.handle ?? null,
    avatarUrl: user?.avatarUrl ?? null,
    flagUrl: user?.flagUrl ?? null,
    personaUsername: undefined,
    imported: post.authorUserId === null && post.importedAuthorName !== null,
  };
}

/**
 * One post in the thread's feed, anchored at `#post-<id>` for permalinks: its header, body and actions. The author
 * edits it in place; a hidden post, which only moderators receive, is badged and muted.
 */
export const PostCard = memo(function PostCard({
  post,
  authors,
  style,
  className,
  cards,
  cardsReady,
  cardsErrored,
  canReply,
  onReply,
  onQuote,
  open,
  signedIn,
  onEdit,
  canModerate,
  tools,
}: PostCardProps) {
  const [editing, setEditing] = useState<Editing>(null);
  const author = headerAuthor(post, authors);

  const saveHtml = async (html: string, note: string) => {
    await (editing === "moderator" && tools
      ? tools.saveEdit(post.id, html, note)
      : onEdit(post.id, { html }));
    setEditing(null);
  };

  const saveWikitext = async (wikitext: string) => {
    const saved = await onEdit(post.id, { wikitext });
    // A save still formatting stays open, so the author is told.
    if (saved.formatting === "done") setEditing(null);
    return saved;
  };

  const quote = () =>
    onQuote({ postId: post.id, author: author.name, text: htmlToQuoteText(post.contentHtml) });

  return (
    <article
      id={`post-${post.id}`}
      data-hidden={post.hidden ? "" : undefined}
      className={cn(
        "flex scroll-mt-24 flex-col gap-3 px-4 py-5 sm:px-6",
        post.hidden && "bg-fill-4 opacity-70",
        className
      )}
    >
      {editing ? (
        <PostEditor
          post={post}
          style={style}
          asModerator={editing === "moderator"}
          onSaveHtml={saveHtml}
          onSaveWikitext={saveWikitext}
          onCancel={() => setEditing(null)}
        />
      ) : (
        <>
          <PostHeader
            {...author}
            role={post.role}
            createdAt={post.createdAt}
            editedAt={post.editedAt}
            number={post.number}
            postId={post.id}
            hidden={post.hidden === true}
          />
          <PostBody
            html={post.contentHtml}
            style={style}
            cards={cards}
            cardsReady={cardsReady}
            cardsErrored={cardsErrored}
          />
          <PostActions
            post={post}
            canReply={canReply}
            onReply={onReply}
            onQuote={quote}
            // Authors edit their own post while the thread is open; any other member may report it.
            canEdit={post.isOwn && open}
            onEdit={() => setEditing("author")}
            canReport={signedIn && !post.byViewer && !canModerate}
            canModerate={canModerate}
            tools={tools}
            onModeratorEdit={() => setEditing("moderator")}
          />
        </>
      )}
    </article>
  );
});
