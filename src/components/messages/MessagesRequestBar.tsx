"use client";

import { Check, Xmark } from "iconoir-react";
import { Button } from "~/components/ui/button";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";

/**
 * Message requests (SL-4). The recipient of a request sees Accept and Decline in place of the
 * input bar: accepting moves the conversation to Messages, declining removes it and refuses
 * further messages in it. Settings → Privacy & Security → Message requests.
 */
export function MessagesRequestBar({
  conversationId,
  senderName,
  onDeclined,
}: {
  conversationId: string;
  senderName: string;
  onDeclined: () => void;
}) {
  const notify = useNotify();
  const utils = api.useUtils();
  const respond = api.messages.respondToRequest.useMutation({
    onSuccess: (result) => {
      notify.success(result.accepted ? "Request accepted" : "Request declined");
      void utils.messages.getConversationsByFolder.invalidate();
      void utils.messages.getFolderCounts.invalidate();
      void utils.messages.getConversation.invalidate({ conversationId });
      if (!result.accepted) onDeclined();
    },
    onError: (err) => notify.error(err.message || "Failed to answer the request"),
  });

  return (
    <div className="border-separator flex shrink-0 flex-col gap-3 border-t px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-footnote text-label-secondary">
        {senderName} is not in your direct-message audience. Accept to move this conversation to
        Messages and reply.
      </p>
      <div className="flex shrink-0 items-center gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={respond.isPending}
          onClick={() => respond.mutate({ conversationId, accept: false })}
        >
          <Xmark aria-hidden="true" />
          Decline
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={respond.isPending}
          onClick={() => respond.mutate({ conversationId, accept: true })}
        >
          <Check aria-hidden="true" />
          Accept
        </Button>
      </div>
    </div>
  );
}

/** The sender's note while the other person has not answered their message request. */
export function MessagesAwaitingNote({ recipientName }: { recipientName: string }) {
  return (
    <p className="text-footnote text-label-secondary px-4 pb-2 text-center">
      Your messages are waiting in {recipientName}&apos;s Requests until they accept.
    </p>
  );
}
