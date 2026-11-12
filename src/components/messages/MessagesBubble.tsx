"use client";

import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import { ContextMenu, ContextMenuContent, ContextMenuTrigger } from "~/components/ui/context-menu";
import { cn } from "~/lib/utils";
import { displayNameOf, formatTimestamp, initialsOf } from "~/lib/messages/format";
import { isTempMessageId, type ThreadAccount, type ThreadMessage } from "~/lib/messages/thread";
import type { MessagesSettings } from "./MessagesFolderNav";
import { MessageContent, ReplyQuote } from "./MessageContent";
import { MessageEditor } from "./MessageEditor";
import { MessageMenuItems, MessageMoreActions } from "./MessageMenuItems";
import { ReactionPicker, ReactionPills } from "./MessageReactions";

export interface MessageActions {
  onAddReaction: (messageId: string, reaction: string) => void;
  onRemoveReaction: (messageId: string, reaction: string) => void;
  onEditMessage: (messageId: string, content: string) => void;
  onDeleteMessage: (messageId: string) => void;
}

interface MessagesBubbleProps {
  message: ThreadMessage;
  currentUserId: string;
  /** First of a run from the same sender: shows the sender's name. */
  startsCluster: boolean;
  /** Last of the run: shows the avatar, the tail and the time. */
  endsCluster: boolean;
  /** The other person has read up to and including this message. */
  seen?: boolean;
  onReply: (message: ThreadMessage) => void;
  actions: MessageActions;
  settings?: MessagesSettings;
  searchQuery?: string;
}

function resolveAccount(message: ThreadMessage, isOwn: boolean): ThreadAccount {
  const shortId = message.accountId?.slice(-6);
  return (
    message.account ?? {
      id: message.accountId,
      username: `user_${shortId || "guest"}`,
      displayName: isOwn ? "You" : `User ${shortId || "Guest"}`,
      profileImageUrl: null,
      accountType: "citizen",
    }
  );
}

function SenderAvatar({ account, name }: { account: ThreadAccount; name: string }) {
  const picture = account.profileImageUrl ?? account.country?.flag ?? account.countryFlag;
  return (
    <Avatar className="border-separator size-8 rounded-full border">
      <AvatarImage src={picture ?? undefined} alt="" className="object-cover" />
      <AvatarFallback className="bg-tint-fill text-caption text-tint-ink">
        {initialsOf(name)}
      </AvatarFallback>
    </Avatar>
  );
}

function MessageMeta({
  message,
  showTime,
  seen,
  pending,
  isOwn,
}: {
  message: ThreadMessage;
  showTime: boolean;
  seen: boolean;
  pending: boolean;
  isOwn: boolean;
}) {
  const parts = [
    showTime && formatTimestamp(message.createdAt ?? message.ixTimeTimestamp),
    message.editedAt && "Edited",
    pending && "Sending…",
    seen && "Seen",
  ].filter(Boolean);
  if (parts.length === 0) return null;
  return (
    <p
      className={cn(
        "text-caption text-label-secondary mt-0.5 px-1 tabular-nums",
        isOwn ? "text-right" : "text-left"
      )}
    >
      {parts.join(" · ")}
    </p>
  );
}

export function MessagesBubble({
  message,
  currentUserId,
  startsCluster,
  endsCluster,
  seen = false,
  onReply,
  actions,
  settings,
  searchQuery,
}: MessagesBubbleProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const isOwn = message.accountId === currentUserId;
  const account = resolveAccount(message, isOwn);
  const name = displayNameOf(account, settings?.displayNamePreference);
  const pending = isTempMessageId(message.id);
  const deleted = !!message.deletedAt;
  const interactive = !pending && !deleted;
  const mine = message.myReactions ?? [];

  const menu = {
    isOwn,
    onReply: () => onReply(message),
    onEdit: () => setIsEditing(true),
    onDelete: () => setConfirmingDelete(true),
  };
  const toggleReaction = (emoji: string, own: boolean) =>
    own ? actions.onRemoveReaction(message.id, emoji) : actions.onAddReaction(message.id, emoji);

  const bubble = isEditing ? (
    <MessageEditor
      initial={message.content}
      onSave={(content) => actions.onEditMessage(message.id, content)}
      onCancel={() => setIsEditing(false)}
    />
  ) : (
    <MessageContent
      message={message}
      isOwn={isOwn}
      hasTail={endsCluster}
      hasReply={!!message.replyTo}
      pending={pending}
      searchQuery={searchQuery}
    />
  );

  const stack = (
    <div className="flex min-w-0 flex-col" data-message-id={message.id}>
      {message.replyTo && (
        <ReplyQuote
          replyTo={message.replyTo}
          isOwn={isOwn}
          preference={settings?.displayNamePreference}
        />
      )}
      {bubble}
    </div>
  );

  return (
    <div
      className={cn(
        "flex w-full items-end gap-2 px-3 py-0.5 md:px-4",
        isOwn && "flex-row-reverse",
        startsCluster && "mt-3"
      )}
    >
      <div className={cn("size-8 shrink-0", isOwn && "hidden")}>
        {endsCluster && <SenderAvatar account={account} name={name} />}
      </div>

      <div
        className={cn(
          "flex max-w-[85%] min-w-0 flex-col sm:max-w-[75%]",
          isOwn ? "items-end" : "items-start"
        )}
      >
        {startsCluster && !isOwn && (
          <p className="text-caption text-label mb-1 ml-1">
            {name}
            {account.country?.name && (
              <span className="text-footnote text-label-secondary"> · {account.country.name}</span>
            )}
          </p>
        )}

        <div
          className={cn(
            "group/bubble flex max-w-full items-center gap-1",
            isOwn && "flex-row-reverse"
          )}
        >
          {interactive && !isEditing ? (
            <ContextMenu>
              <ContextMenuTrigger asChild>{stack}</ContextMenuTrigger>
              <ContextMenuContent className="w-44">
                <MessageMenuItems {...menu} />
              </ContextMenuContent>
            </ContextMenu>
          ) : (
            stack
          )}
          {interactive && !isEditing && (
            <div className={cn("flex shrink-0 items-center", isOwn && "flex-row-reverse")}>
              <ReactionPicker mine={mine} isOwn={isOwn} onToggle={toggleReaction} />
              <MessageMoreActions {...menu} />
            </div>
          )}
        </div>

        {!deleted && (
          <ReactionPills
            reactions={message.reactions ?? {}}
            mine={mine}
            isOwn={isOwn}
            onToggle={toggleReaction}
          />
        )}
        <MessageMeta
          message={message}
          showTime={endsCluster}
          seen={seen}
          pending={pending}
          isOwn={isOwn}
        />
      </div>

      <AlertDialog open={confirmingDelete} onOpenChange={setConfirmingDelete}>
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this message?</AlertDialogTitle>
            <AlertDialogDescription>
              It is removed for everyone in the conversation.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => actions.onDeleteMessage(message.id)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
