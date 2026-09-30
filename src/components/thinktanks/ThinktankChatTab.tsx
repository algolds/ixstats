"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { OpenNewWindow, Send } from "iconoir-react";
import { Button } from "~/components/ui/button";
import { Textarea } from "~/components/ui/textarea";
import { api } from "~/trpc/react";
import { cn } from "~/lib/utils";
import { soundEffects } from "~/lib/sound/cuelume";
import { useNotify } from "~/hooks/useNotify";

interface ThinktankChatTabProps {
  /** The group's linked ThinkShare group conversation (members only). */
  conversationId?: string | null;
  groupName: string;
  currentUserId: string;
}

interface ChatMessage {
  id: string;
  accountId: string;
  content: string;
  isSystem?: boolean;
  createdAt: number | string | Date;
  account?: { displayName?: string | null; username?: string | null };
}

/** Group chat for a ThinkTank, backed by its ThinkShare group conversation. */
export function ThinktankChatTab({
  conversationId,
  groupName,
  currentUserId,
}: ThinktankChatTabProps) {
  const notify = useNotify();
  const utils = api.useUtils();
  const [draft, setDraft] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const queryInput = { conversationId: conversationId ?? "", userId: currentUserId };
  const { data, isLoading, error } = api.messages.getConversationMessages.useQuery(queryInput, {
    enabled: Boolean(conversationId),
    refetchInterval: 15000,
    refetchOnWindowFocus: false,
  });

  const sendMutation = api.messages.sendMessage.useMutation({
    onSuccess: () => {
      soundEffects.success();
      setDraft("");
      void utils.messages.getConversationMessages.invalidate(queryInput);
    },
    onError: (err) => {
      soundEffects.error();
      notify.error(err.message || "Failed to send message");
    },
  });

  // Messages arrive newest-first or oldest-first depending on the service; sort ascending.
  const messages = ([...((data?.messages as ChatMessage[] | undefined) ?? [])] as ChatMessage[])
    .filter((m) => !m.isSystem)
    .sort((a, b) => Number(new Date(a.createdAt)) - Number(new Date(b.createdAt)));

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    const content = draft.trim();
    if (!content || !conversationId) return;
    soundEffects.press();
    sendMutation.mutate({ conversationId, userId: currentUserId, content });
  };

  if (!conversationId) {
    return (
      <div className="text-label-secondary text-footnote flex h-full items-center justify-center p-8">
        Group chat is not available for this group yet.
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-[320px] flex-col">
      <div className="border-separator flex items-center justify-between border-b px-4 py-2 md:px-5">
        <span className="text-subhead text-label">{groupName} chat</span>
        <Link
          href={`/messages?conversation=${encodeURIComponent(conversationId)}`}
          className="text-label-secondary hover:text-label text-footnote flex items-center gap-1"
        >
          Open in Messages
          <OpenNewWindow className="h-3 w-3" />
        </Link>
      </div>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 py-3 md:px-5">
        {isLoading && <p className="text-label-secondary text-footnote">Loading chat...</p>}
        {error && (
          <p className="text-footnote text-destructive">
            {error.message || "Could not load the chat."}
          </p>
        )}
        {!isLoading && !error && messages.length === 0 && (
          <p className="text-label-secondary text-footnote">No messages yet. Say hello.</p>
        )}
        {messages.map((m) => {
          const own = m.accountId === currentUserId;
          return (
            <div key={m.id} className={cn("flex", own ? "justify-end" : "justify-start")}>
              <div
                className={cn(
                  "text-body rounded-card max-w-[80%] px-3 py-2",
                  own ? "bg-tint text-on-tint" : "bg-fill-3 text-label"
                )}
              >
                {!own && (
                  <div className="text-caption text-label-secondary mb-0.5">
                    {m.account?.displayName || m.account?.username || "Member"}
                  </div>
                )}
                <div className="break-words whitespace-pre-wrap">{m.content}</div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={handleSend}
        className="border-separator flex items-end gap-2 border-t px-4 py-3 md:px-5"
      >
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend(e);
            }
          }}
          placeholder="Message the group"
          className="min-h-[36px] flex-1 resize-none"
          rows={1}
          maxLength={2000}
        />
        <Button type="submit" size="sm" disabled={sendMutation.isPending || !draft.trim()}>
          <Send />
          Send
        </Button>
      </form>
    </div>
  );
}
