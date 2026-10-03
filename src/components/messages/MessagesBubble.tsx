"use client";

import React, { useState, useRef, useEffect } from "react";
import { isToday } from "date-fns";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Reply,
  EditPencil as Edit,
  Trash as Trash2,
  Check,
  CheckCircle as CheckCheck,
  Shield,
  Emoji as Smile,
} from "iconoir-react";
import { cn } from "~/lib/utils";
import { sanitizeUserContent } from "~/lib/utils/sanitize-html";
import { usePretextWithSegments, useShrinkwrap } from "~/lib/pretext/use-pretext";
import { soundEffects } from "~/lib/sound/cuelume";
import type { MessagesSettings } from "./MessagesFolderNav";

interface MessageAccount {
  id: string;
  username: string;
  displayName: string;
  profileImageUrl?: string | null;
  accountType?: string;
  country?: {
    id?: string;
    name?: string;
    flag?: string | null;
  } | null;
}

interface Message {
  id: string;
  conversationId: string;
  accountId: string;
  account?: MessageAccount;
  content: string;
  messageType: string;
  ixTimeTimestamp: Date;
  createdAt?: Date;
  reactions?: Record<string, number>;
  readReceipts?: { id: string; accountId: string; readAt: Date }[];
  editedAt?: Date;
  deletedAt?: Date;
  replyTo?: Message;
  classification?: string | null;
  priority?: string | null;
  source?: string;
}

export interface MessageActions {
  onAddReaction: (messageId: string, reaction: string) => void;
  onRemoveReaction: (messageId: string, reaction: string) => void;
  onEditMessage: (messageId: string, content: string) => void;
  onDeleteMessage: (messageId: string) => void;
}

interface MessagesBubbleProps {
  message: Message;
  currentUserId: string;
  isConsecutive: boolean;
  onReply: (message: Message) => void;
  actions: MessageActions;
  settings?: MessagesSettings;
  searchQuery?: string;
}

const QUICK_REACTIONS = ["❤️", "👍", "👎", "😂", "😮", "😢", "🔥"];

// Pretext shrinkwrap constants
const BUBBLE_PADDING_X = 24; // px-3 = 12px * 2
const MAX_BUBBLE_WIDTH = 480; // max bubble content width in px
const BUBBLE_FONT = "13.5px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

const DATE_TIME_FORMAT: Intl.DateTimeFormatOptions = {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
};

export function formatTimestamp(date: Date | string): string {
  const d = new Date(date);
  return d.toLocaleString(
    undefined,
    isToday(d) ? { hour: "numeric", minute: "2-digit" } : DATE_TIME_FORMAT
  );
}

const stripTags = (html: string) => html.replace(/<[^>]*>/g, "");

/** Wraps search matches in <mark>, leaving HTML tags untouched. */
function highlightMatches(content: string, query?: string): string {
  if (!query?.trim()) return content;
  const regex = new RegExp(`(${query.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")})`, "gi");
  return content
    .split(/(<[^>]+>)/g)
    .map((part) =>
      part.startsWith("<") && part.endsWith(">")
        ? part
        : part.replace(regex, '<mark class="bg-yellow/40 text-label rounded-xs px-0.5">$1</mark>')
    )
    .join("");
}

const ACTION_BUTTON_CLASS = "text-label-secondary hover:text-label rounded-full";

function ActionButton({
  label,
  icon,
  onClick,
  className = ACTION_BUTTON_CLASS,
}: {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  className?: string;
}) {
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      type="button"
      className={className}
      title={label}
      onClick={() => {
        soundEffects.press();
        onClick();
      }}
      aria-label={label}
    >
      {icon}
    </Button>
  );
}

function ReactionBadges({
  reactions,
  isOwn,
  onRemove,
}: {
  reactions: Record<string, number>;
  isOwn: boolean;
  onRemove: (emoji: string) => void;
}) {
  return (
    <div
      className={cn("absolute -bottom-2 z-10 flex flex-wrap gap-1", isOwn ? "right-2" : "left-2")}
    >
      {Object.entries(reactions).map(([emoji, count]) => (
        <button
          key={emoji}
          type="button"
          className="border-separator bg-surface-elevated text-caption text-label shadow-card flex items-center gap-1 rounded-full border px-2 motion-safe:hover:scale-105"
          onClick={() => onRemove(emoji)}
          title="Remove reaction"
          aria-label={`Remove ${emoji} reaction (${count})`}
        >
          <span>{emoji}</span>
          <span className="text-label-secondary tabular-nums">{count}</span>
        </button>
      ))}
    </div>
  );
}

const POPOVER_CLASS =
  "bg-surface-elevated border-separator shadow-floating absolute bottom-full z-30 mb-2";

interface HoverActionsProps {
  message: Message;
  isOwn: boolean;
  actions: MessageActions;
  onReply: (message: Message) => void;
  onEdit: () => void;
}

function HoverActions({ message, isOwn, actions, onReply, onEdit }: HoverActionsProps) {
  const [showReactions, setShowReactions] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const side = isOwn ? "right-0" : "left-0";

  return (
    <div
      className={cn(
        // Shown on hover and whenever focus is inside the message, so keyboard users reach
        // the actions too; invisible but still in the tab order otherwise.
        "material-thick shadow-floating duration-fast pointer-events-none absolute -top-4 z-20 flex items-center gap-0.5 rounded-full px-1 py-0.5 opacity-0 transition-opacity group-focus-within/bubble:pointer-events-auto group-focus-within/bubble:opacity-100 group-hover/bubble:pointer-events-auto group-hover/bubble:opacity-100 focus-within:pointer-events-auto focus-within:opacity-100",
        showReactions && "pointer-events-auto opacity-100",
        isOwn ? "right-1" : "left-1"
      )}
    >
      <div className="relative">
        <ActionButton
          label="React"
          icon={<Smile aria-hidden />}
          onClick={() => setShowReactions(!showReactions)}
        />
        {showReactions && (
          <div
            className={cn(POPOVER_CLASS, "flex items-center gap-1 rounded-full border p-1", side)}
          >
            {QUICK_REACTIONS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                aria-label={`React with ${emoji}`}
                className="text-body flex size-7 items-center justify-center rounded-full motion-safe:hover:scale-125"
                onClick={() => {
                  soundEffects.success();
                  actions.onAddReaction(message.id, emoji);
                  setShowReactions(false);
                }}
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
      </div>

      <ActionButton label="Reply" icon={<Reply aria-hidden />} onClick={() => onReply(message)} />

      {isOwn && (
        <>
          <ActionButton label="Edit" icon={<Edit aria-hidden />} onClick={onEdit} />

          <div className="relative">
            <ActionButton
              label="Delete"
              icon={<Trash2 aria-hidden />}
              className="text-label-secondary hover:bg-destructive/15 hover:text-destructive rounded-full"
              onClick={() => setShowDeleteConfirm(!showDeleteConfirm)}
            />

            {showDeleteConfirm && (
              <div
                className={cn(POPOVER_CLASS, "rounded-row flex flex-col gap-2 border p-2", side)}
              >
                <span className="text-headline text-label whitespace-nowrap">Delete message?</span>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setShowDeleteConfirm(false)}>
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => {
                      setShowDeleteConfirm(false);
                      actions.onDeleteMessage(message.id);
                    }}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function resolveAccount(message: Message, isOwn: boolean): MessageAccount {
  const shortId = message.accountId?.slice(-6);
  return (
    message.account || {
      id: message.accountId,
      username: `user_${shortId || "guest"}`,
      displayName: isOwn ? "You" : `User ${shortId || "Guest"}`,
      profileImageUrl: null,
      accountType: "citizen",
    }
  );
}

const displayNameOf = (
  acc: { username?: string; displayName: string },
  settings?: MessagesSettings
) =>
  settings?.displayNamePreference === "account" && acc.username
    ? `@${acc.username}`
    : acc.displayName;

function MessageEditor({
  message,
  onSave,
  onCancel,
}: {
  message: Message;
  onSave: (content: string) => void;
  onCancel: () => void;
}) {
  const [content, setContent] = useState(() => stripTags(message.content));
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(timer);
  }, []);

  const save = () => {
    if (content.trim() && content !== message.content) onSave(content.trim());
    onCancel();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      save();
    } else if (e.key === "Escape") {
      onCancel();
    }
  };

  return (
    <div className="bg-surface border-tint rounded-card w-full min-w-[280px] border p-3">
      <textarea
        ref={inputRef}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onKeyDown={handleKeyDown}
        rows={2}
        aria-label="Edit message"
        className="text-body text-label w-full resize-none bg-transparent outline-none"
      />
      <div className="border-separator mt-2 flex items-center justify-end gap-2 border-t pt-2">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button size="sm" onClick={save}>
          Save
        </Button>
      </div>
    </div>
  );
}

function MessageBody({
  message,
  isOwn,
  searchQuery,
}: {
  message: Message;
  isOwn: boolean;
  searchQuery?: string;
}) {
  // Only apply Pretext shrinkwrap to plain-text messages.
  const hasHtml = /<[a-z][\s\S]*>/i.test(message.content);
  const prepared = usePretextWithSegments(hasHtml ? "" : message.content, BUBBLE_FONT);
  const shrinkwrappedWidth = useShrinkwrap(prepared, MAX_BUBBLE_WIDTH - BUBBLE_PADDING_X);
  const bubbleWidth =
    !hasHtml && shrinkwrappedWidth > 0
      ? Math.min(MAX_BUBBLE_WIDTH, shrinkwrappedWidth + BUBBLE_PADDING_X)
      : undefined;

  return (
    <div
      className={cn(
        "text-callout relative overflow-hidden px-4 py-2 break-words transition-[color,background-color,border-color,box-shadow,opacity,transform]",
        isOwn
          ? "rounded-card rounded-br-control-sm bg-tint text-on-tint selection:bg-on-tint selection:text-tint"
          : "border-separator bg-surface-secondary text-label rounded-card rounded-bl-control-sm border",
        message.replyTo && "rounded-t-none"
      )}
      style={{ maxWidth: MAX_BUBBLE_WIDTH, ...(bubbleWidth ? { width: bubbleWidth } : {}) }}
    >
      {message.classification && (
        <div className="mb-1 flex items-center gap-1">
          <Badge variant="warning">
            <Shield aria-hidden="true" />
            {message.classification}
          </Badge>
        </div>
      )}

      <div
        className="[&>p]:mb-0"
        dangerouslySetInnerHTML={{
          __html: sanitizeUserContent(highlightMatches(message.content, searchQuery)),
        }}
      />

      <div
        className={cn(
          "text-caption mt-1 flex items-center gap-2 tabular-nums select-none",
          isOwn ? "text-on-tint/70 justify-end" : "text-label-secondary justify-start"
        )}
      >
        <span>{formatTimestamp(message.createdAt ?? message.ixTimeTimestamp)}</span>
        {message.editedAt && <span>· edited</span>}
        {isOwn && message.readReceipts && (
          <span className="inline-flex items-center">
            {message.readReceipts.length > 0 ? (
              <CheckCheck className="text-on-tint size-3.5" aria-label="Read" />
            ) : (
              <Check className="text-on-tint/70 size-3.5" aria-label="Sent" />
            )}
          </span>
        )}
      </div>
    </div>
  );
}

export const MessagesBubble = React.memo(function MessagesBubble({
  message,
  currentUserId,
  isConsecutive,
  onReply,
  actions,
  settings,
  searchQuery,
}: MessagesBubbleProps) {
  const [isEditing, setIsEditing] = useState(false);

  const isOwn = message.accountId === currentUserId;
  const account = resolveAccount(message, isOwn);

  const resolvedDisplayName = displayNameOf(account, settings);
  const initials = resolvedDisplayName
    .replace(/^@/, "")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .substring(0, 2);

  const { reactions, replyTo } = message;

  return (
    <div
      className={cn(
        "group relative flex w-full gap-2 px-3 py-0.5 transition-colors md:px-4",
        isOwn ? "flex-row-reverse" : "flex-row",
        !isConsecutive && "mt-3 pt-0.5"
      )}
    >
      <div className={cn("w-8 shrink-0", isOwn && "hidden")}>
        {!isConsecutive ? (
          <Avatar className="border-separator size-8 rounded-full border">
            <AvatarImage src={account.profileImageUrl ?? undefined} />
            <AvatarFallback className="bg-tint-fill text-caption text-tint">
              {account.country?.flag ? account.country.flag : initials}
            </AvatarFallback>
          </Avatar>
        ) : (
          <div className="size-8" />
        )}
      </div>

      <div
        className={cn(
          "relative flex max-w-[85%] flex-col sm:max-w-[75%]",
          isOwn ? "items-end" : "items-start"
        )}
      >
        {!isConsecutive && !isOwn && (
          <div className="mb-1 ml-1 flex items-baseline gap-2">
            <span className="text-caption text-label">{resolvedDisplayName}</span>
            {account.country?.name && (
              <span className="text-label-secondary text-footnote">· {account.country.name}</span>
            )}
          </div>
        )}

        <div className="group/bubble relative">
          {replyTo && (
            <div
              className={cn(
                "rounded-t-row text-footnote mb-0.5 flex items-center gap-2 px-3 py-1",
                isOwn
                  ? "bg-tint-hover text-on-tint"
                  : "bg-fill-4 text-label-secondary border-separator border border-b-0"
              )}
            >
              <Reply className="size-3.5 shrink-0" aria-hidden="true" />
              <span className="max-w-[160px] truncate font-medium">
                {replyTo.account ? displayNameOf(replyTo.account, settings) : "User"}:{" "}
                {stripTags(replyTo.content).substring(0, 32)}
              </span>
            </div>
          )}

          {isEditing ? (
            <MessageEditor
              message={message}
              onSave={(content) => actions.onEditMessage(message.id, content)}
              onCancel={() => setIsEditing(false)}
            />
          ) : (
            <MessageBody message={message} isOwn={isOwn} searchQuery={searchQuery} />
          )}

          {reactions && Object.keys(reactions).length > 0 && (
            <ReactionBadges
              reactions={reactions}
              isOwn={isOwn}
              onRemove={(emoji) => actions.onRemoveReaction(message.id, emoji)}
            />
          )}

          {!isEditing && (
            <HoverActions
              message={message}
              isOwn={isOwn}
              actions={actions}
              onReply={onReply}
              onEdit={() => setIsEditing(true)}
            />
          )}
        </div>
      </div>
    </div>
  );
});
