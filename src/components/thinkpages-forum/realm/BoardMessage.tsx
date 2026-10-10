"use client";

import { memo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Reply as ReplyIcon, Quote } from "iconoir-react";
import type { ActionCardData } from "~/components/action-links";
import { PersonaAuthorCard } from "~/components/thinkpages/PersonaAuthorCard";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { timeAgo } from "~/lib/format/compact";
import { realmBoardHref, threadHref } from "~/lib/thinkpages-forum/links";
import { cn } from "~/lib/utils/cn";
import { ForumAvatar } from "../ForumAvatar";
import type { ModeratorTools } from "../ModeratorMenu";
import { PostBody } from "../thread/PostBody";
import type { PostStyle } from "../thread/types";
import { MessageEditor } from "./MessageEditor";
import { MessageMenu } from "./MessageMenu";
import type { BoardAccess, BoardMessageData, BoardRealm } from "./types";

interface BoardMessageProps {
  message: BoardMessageData;
  realm: BoardRealm;
  access: BoardAccess;
  signedIn: boolean;
  /** Cards for the page of messages this one is on (see useThreadActionCards). */
  cards: ReadonlyMap<string, ActionCardData>;
  cardsReady: boolean;
  cardsErrored: boolean;
  tools: ModeratorTools | null;
  className?: string;
  onReply: (message: BoardMessageData) => void;
  onQuote: (message: BoardMessageData) => void;
  /** An edit, a moderation action or a continue changed the message: refresh the board. */
  onChanged: () => void;
}

/** Who edits it now: its author, or a moderator (whose save needs a note for the log). */
type Editing = "author" | "moderator" | null;

/** Board messages read as compact prose, out of character. */
const BOARD_STYLE: PostStyle = "ooc";

const ROLE_LABEL = { staff: "Staff", officer: "Officer" } as const;

const repliesOf = (count: number) => (count === 1 ? "1 reply" : `${count} replies`);

function AuthorLine({ message }: { message: BoardMessageData }) {
  const { author, role, isVisitor, visitorRealm, createdAt, editedAt } = message;
  const name = <span className="text-headline text-label min-w-0 truncate">{author.name}</span>;
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
      {author.persona && author.handle ? (
        <PersonaAuthorCard username={author.handle}>{name}</PersonaAuthorCard>
      ) : (
        name
      )}
      {author.persona && author.handle ? (
        <span className="text-footnote text-label-secondary">@{author.handle}</span>
      ) : null}
      {author.flagUrl ? (
        <img
          src={author.flagUrl}
          alt=""
          width={18}
          height={12}
          className="rounded-control-sm h-3 w-[18px] shrink-0 object-cover"
        />
      ) : null}
      {role === "staff" || role === "officer" ? (
        <Badge variant="secondary">{ROLE_LABEL[role]}</Badge>
      ) : null}
      {isVisitor ? (
        <Badge variant="outline">
          {visitorRealm ? `Visitor · ${visitorRealm.name}` : "Visitor"}
        </Badge>
      ) : null}
      {message.hidden === true ? <Badge variant="warning">Hidden</Badge> : null}
      <time
        dateTime={createdAt.toISOString()}
        className="text-footnote text-label-secondary tabular-nums"
      >
        {timeAgo(createdAt, { suffix: false })}
      </time>
      {editedAt ? <span className="text-footnote text-label-secondary">edited</span> : null}
    </div>
  );
}

function ContinuedLine({ continued }: { continued: NonNullable<BoardMessageData["continued"]> }) {
  const replies = continued.replies === null ? "" : ` · ${repliesOf(continued.replies)}`;
  if (!continued.threadId) {
    return <p className="text-footnote text-label-secondary">{continued.title}</p>;
  }
  return (
    <Link
      href={threadHref(continued.threadId)}
      className="text-footnote text-tint inline-flex items-center gap-1.5 hover:underline pointer-coarse:min-h-11"
    >
      <ArrowRight aria-hidden className="size-3.5 shrink-0" />
      {`Continued in a thread: ${continued.title}${replies}`}
    </Link>
  );
}

const ACTION = "text-label-secondary hover:text-label pointer-coarse:min-h-11";

/**
 * One message in the realm board's feed, anchored at `#post-<id>` for permalinks: a compact row with the author
 * (persona-first, as the server sent it), the message, the message it answers, where it continued, and its actions.
 * A message continued in a thread is only a link to it.
 */
export const BoardMessage = memo(function BoardMessage({
  message,
  realm,
  access,
  signedIn,
  cards,
  cardsReady,
  cardsErrored,
  tools,
  className,
  onReply,
  onQuote,
  onChanged,
}: BoardMessageProps) {
  const [editing, setEditing] = useState<Editing>(null);
  const { author, replyTo, continued } = message;
  const placeholder = continued !== null;

  return (
    <article
      id={`post-${message.id}`}
      aria-label={`Message from ${author.name}, ${timeAgo(message.createdAt)}`}
      data-hidden={message.hidden ? "" : undefined}
      className={cn(
        "flex scroll-mt-24 gap-3.5 px-4 py-4 sm:px-5",
        message.hidden && "bg-fill-4 opacity-70",
        className
      )}
    >
      <ForumAvatar name={author.name} avatarUrl={author.avatarUrl} size="md" className="mt-0.5" />
      {editing ? (
        <MessageEditor
          message={message}
          asModerator={editing === "moderator"}
          tools={tools}
          onSaved={() => {
            setEditing(null);
            onChanged();
          }}
          onCancel={() => setEditing(null)}
        />
      ) : (
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <AuthorLine message={message} />
          {replyTo ? (
            <Link
              href={realmBoardHref(realm.slug, replyTo.postId)}
              className="text-footnote text-label-secondary hover:text-label flex min-w-0 items-center gap-1.5"
            >
              <ReplyIcon aria-hidden className="size-3.5 shrink-0" />
              <span className="min-w-0 truncate">
                Replying to <span className="text-label">{replyTo.authorName}</span>
                {`: "${replyTo.excerpt}"`}
              </span>
            </Link>
          ) : null}
          {placeholder ? null : (
            <PostBody
              html={message.contentHtml}
              style={BOARD_STYLE}
              cards={cards}
              cardsReady={cardsReady}
              cardsErrored={cardsErrored}
            />
          )}
          {continued ? <ContinuedLine continued={continued} /> : null}
          {placeholder ? null : (
            <div className="flex flex-wrap items-center gap-1">
              {access.canPost ? (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={ACTION}
                    onClick={() => onReply(message)}
                  >
                    <ReplyIcon aria-hidden />
                    Reply
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={ACTION}
                    onClick={() => onQuote(message)}
                  >
                    <Quote aria-hidden />
                    Quote
                  </Button>
                </>
              ) : null}
              <span className="flex-1" />
              <MessageMenu
                message={message}
                access={access}
                signedIn={signedIn}
                tools={tools}
                onEdit={(asModerator) => setEditing(asModerator ? "moderator" : "author")}
                onChanged={onChanged}
              />
            </div>
          )}
        </div>
      )}
    </article>
  );
});
