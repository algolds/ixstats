"use client";

import React, { useRef, useEffect, useCallback, useState } from 'react';
import { Card } from '~/components/ui/card';
import { Separator } from '~/components/ui/separator';
import { api } from '~/trpc/react';
import { toast } from 'sonner';

// Import new sub-components
import { ChatHeader } from './ChatHeader';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';
import { ReplyPreview } from './ReplyPreview';

interface ThinkshareConversation {
  id: string;
  type: string;
  name?: string | null;
  avatar?: string | null;
  isActive: boolean;
  lastActivity: Date;
  otherParticipants: {
    id: string;
    accountId: string;
    account: {
      id: string;
      username: string;
      displayName: string;
      profileImageUrl?: string | null;
      accountType: string;
    };
    isActive: boolean;
  }[];
  lastMessage?: {
    id: string;
    accountId: string;
    content: string;
    ixTimeTimestamp: Date;
    createdAt?: Date;
    account: {
      id: string;
      username: string;
      displayName: string;
    };
  };
  lastReadAt?: Date;
  unreadCount: number;
}

interface ThinkshareMessage {
  id: string;
  conversationId: string;
  accountId: string;
  account: {
    id: string;
    username: string;
    displayName: string;
    profileImageUrl?: string | null;
    accountType: string;
  };
  content: string;
  messageType: string;
  ixTimeTimestamp: Date;
  createdAt?: Date;
  reactions?: any;
  mentions?: any;
  attachments?: any;
  replyTo?: any;
  readReceipts?: any[];
  isSystem?: boolean;
}

interface Account {
  id: string;
  username: string;
  displayName: string;
  profileImageUrl?: string | null;
  accountType: string;
}

interface ChatAreaProps {
  selectedConversation: ThinkshareConversation;
  currentAccount?: Account; // Made optional
  conversationMessages: { messages: ThinkshareMessage[] } | undefined;
  isLoadingMessages: boolean;
  refetchMessages: () => Promise<any>;
  refetchConversations: () => Promise<any>;
  clientState: {
    isTyping?: boolean;
    lastSeen?: string;
    connectionStatus?: 'connected' | 'disconnected' | 'connecting';
  };
  sendTypingIndicator: (conversationId: string, accountId: string | undefined, isTyping: boolean) => void;
  markMessagesAsReadMutation: {
    mutate: (data: { conversationId: string; messageIds: string[] }) => Promise<void>;
    isLoading: boolean;
  };
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
}: ChatAreaProps) {
  const [replyingToMessage, setReplyingToMessage] = useState<ThinkshareMessage | null>(null);

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
      console.error('Send message error:', error);
      
      // Enhanced error handling
      let errorMessage = 'Failed to send message';
      if (error.message?.includes('conversation')) {
        errorMessage = 'Conversation not found or you\'re not a participant';
      } else if (error.message?.includes('content')) {
        errorMessage = 'Message content is invalid or too long';
      } else if (error.message?.includes('permission')) {
        errorMessage = 'You don\'t have permission to send messages in this conversation';
      }
      
      toast.error(errorMessage);
    }
  });

  useEffect(() => {
    if (selectedConversation && currentAccount) {
      markMessagesAsReadMutation.mutate({
        conversationId: selectedConversation.id,
        userId: currentAccount.id
      });
    }
  }, [selectedConversation?.id, currentAccount?.id]); // Removed markMessagesAsReadMutation from deps!

  const handleSendMessage = useCallback((content?: string, plainText?: string) => {
    const finalContent = content || ''; // RichTextEditor provides content
    const finalPlainText = plainText || ''; // RichTextEditor provides plainText
    
    if (!finalPlainText.trim() || !selectedConversation || !currentAccount) return;

    sendMessageMutation.mutate({
      conversationId: selectedConversation.id,
      accountId: currentAccount.id,
      content: finalContent,
      messageType: 'text' // Use 'text' instead of 'rich_text'
    });

    setReplyingToMessage(null);
  }, [selectedConversation, currentAccount, sendMessageMutation]);

  return (
    <Card className="glass-hierarchy-child h-[700px] flex flex-col">
      {/* Chat Header */}
      <ChatHeader selectedConversation={selectedConversation} currentAccountId={currentAccount?.id} />

      <Separator />

      {/* Messages */}
      <MessageList
        conversationMessages={conversationMessages}
        isLoadingMessages={isLoadingMessages}
        currentAccount={currentAccount}
        clientState={clientState}
        selectedConversation={selectedConversation}
        refetchMessages={refetchMessages}
        onReply={setReplyingToMessage}
      />

      <Separator />

      {/* Reply Preview */}
      <ReplyPreview
        replyingToMessage={replyingToMessage}
        setReplyingToMessage={setReplyingToMessage}
      />

      {/* Rich Text Message Input */}
      <MessageInput
        onSendMessage={handleSendMessage}
        onTyping={(isTyping) => {
          if (selectedConversation && clientState.connectionStatus === 'connected') {
            sendTypingIndicator(selectedConversation.id, undefined, isTyping);
          }
        }}
        isSending={sendMessageMutation.isPending}
        replyingToMessage={replyingToMessage}
        setReplyingToMessage={setReplyingToMessage}
      />
    </Card>
  );
}

