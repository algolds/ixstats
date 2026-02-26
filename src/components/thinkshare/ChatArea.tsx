"use client";

import React, { useEffect, useCallback, useState, useRef } from "react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Card } from "~/components/ui/card";
import { Separator } from "~/components/ui/separator";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";

// Import new sub-components
import { ChatHeader } from "./ChatHeader";
import { MessageList } from "./MessageList";
import { MessageInput } from "./MessageInput";

import type {
  ThinkShareConversation,
  ThinkShareMessage,
  ThinkShareAccount,
  ThinkShareClientState,
} from "~/types/thinkshare";

interface ChatAreaProps {
  selectedConversation: ThinkShareConversation;
  currentAccount?: ThinkShareAccount;
  conversationMessages: { messages: ThinkShareMessage[] } | undefined;
  isLoadingMessages: boolean;
  refetchMessages: () => Promise<any>;
  refetchConversations: () => Promise<any>;
  clientState: ThinkShareClientState;
  sendTypingIndicator: (
    conversationId: string,
    accountId: string | undefined,
    isTyping: boolean
  ) => void;
  markMessagesAsReadMutation: {
    mutate: (data: {
      conversationId: string;
      userId: string;
      messageIds?: string[];
    }) => Promise<void>;
    isLoading: boolean;
  };
  sidebarCollapsed?: boolean;
  onToggleSidebar?: () => void;
}

export function ChatArea({
  selectedConversation,
  currentAccount,
  conversationMessages,
  isLoadingMessages,
  refetchMessages,
  refetchConversations,
  clientState,
  sendTypingIndicator,
  markMessagesAsReadMutation,
  sidebarCollapsed,
  onToggleSidebar,
}: ChatAreaProps) {
  const notify = useNotify();
  const [replyingToMessage, setReplyingToMessage] = useState<ThinkShareMessage | null>(null);

  // Stabilize markMessagesAsRead via ref to avoid stale closure
  const markAsReadRef = useRef(markMessagesAsReadMutation.mutate);
  useEffect(() => {
    markAsReadRef.current = markMessagesAsReadMutation.mutate;
  }, [markMessagesAsReadMutation.mutate]);

  const sendMessageMutation = api.thinkpages.sendMessage.useMutation({
    onSuccess: () => {
      // Clear rich text editor
      // if (richTextEditorRef.current) {
      //   richTextEditorRef.current.clear();
      // }
      // scrollToBottom(); // Handled by MessageList
      // Force immediate refetch for better UX
      void refetchMessages();
      void refetchConversations(); // Update last message in conversation list
    },
    onError: (error: any) => {
      console.error("Send message error:", error);

      // Enhanced error handling
      let errorMessage = "Failed to send message";
      if (error.message?.includes("conversation")) {
        errorMessage = "Conversation not found or you're not a participant";
      } else if (error.message?.includes("content")) {
        errorMessage = "Message content is invalid or too long";
      } else if (error.message?.includes("permission")) {
        errorMessage = "You don't have permission to send messages in this conversation";
      }

      notify.error(errorMessage);
    },
  });

  useEffect(() => {
    if (selectedConversation && currentAccount?.id) {
      markAsReadRef.current({
        conversationId: selectedConversation.id,
        userId: currentAccount.id,
        messageIds: [],
      });
    }
  }, [selectedConversation?.id, currentAccount?.id]);

  const handleSendMessage = useCallback(
    (content?: string, plainText?: string) => {
      const finalContent = content || ""; // RichTextEditor provides content
      const finalPlainText = plainText || ""; // RichTextEditor provides plainText

      if (!finalPlainText.trim() || !selectedConversation || !currentAccount) return;

      sendMessageMutation.mutate({
        conversationId: selectedConversation.id,
        userId: currentAccount.id,
        content: finalContent,
        messageType: "text", // Use 'text' instead of 'rich_text'
      });

      setReplyingToMessage(null);
    },
    [selectedConversation, currentAccount, sendMessageMutation]
  );

  const SidebarIcon = sidebarCollapsed ? PanelLeftOpen : PanelLeftClose;

  return (
    <Card className="glass-hierarchy-child flex h-[700px] flex-col">
      {/* Chat Header with sidebar toggle */}
      <div className="flex items-center">
        {onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            className="text-muted-foreground hover:text-foreground hover:bg-muted ml-2 shrink-0 rounded-md p-2 transition-colors"
            title={sidebarCollapsed ? "Show conversations" : "Hide conversations"}
          >
            <SidebarIcon className="h-4 w-4" />
          </button>
        )}
        <div className="min-w-0 flex-1">
          <ChatHeader
            selectedConversation={selectedConversation}
            currentAccountId={currentAccount?.id}
          />
        </div>
      </div>

      <Separator />

      {/* Messages — scrollable */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <MessageList
          conversationMessages={conversationMessages}
          isLoadingMessages={isLoadingMessages}
          currentAccount={currentAccount}
          clientState={clientState}
          selectedConversation={selectedConversation}
          refetchMessages={refetchMessages}
          onReply={setReplyingToMessage}
        />
      </div>

      {/* Rich Text Message Input (includes reply preview) */}
      <MessageInput
        onSendMessage={handleSendMessage}
        onTyping={(isTyping) => {
          if (selectedConversation && clientState.connectionStatus === "connected") {
            sendTypingIndicator(selectedConversation.id, undefined, isTyping);
          }
        }}
        isSending={sendMessageMutation.isPending}
        replyingToMessage={replyingToMessage}
        setReplyingToMessage={setReplyingToMessage as any}
      />
    </Card>
  );
}
