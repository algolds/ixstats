"use client";

import React from "react";
import { motion } from "framer-motion";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Badge } from "~/components/ui/badge";
import { MessageTimestamp } from "./MessageTimestamp"; // Assuming this will be a separate component
import { Users, MessageSquare } from "lucide-react";
import type { ThinkShareConversation, ThinkShareClientState } from "~/types/thinkshare";

interface ConversationCardProps {
  conversation: ThinkShareConversation;
  isSelected: boolean;
  onClick: () => void;
  currentAccountId: string;
  getAccountTypeIcon: (type: string) => React.ReactNode;
  clientState: ThinkShareClientState;
}

export function ConversationCard({
  conversation,
  isSelected,
  onClick,
  currentAccountId,
  getAccountTypeIcon,
  clientState,
}: ConversationCardProps) {
  const otherParticipant = conversation.otherParticipants[0];
  const lastMessage = conversation.lastMessage;
  const hasUnread = conversation.unreadCount > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`cursor-pointer rounded-lg p-3 transition-colors ${
        isSelected ? "bg-primary/10 border-primary/20 border" : "hover:bg-muted/50"
      }`}
      onClick={onClick}
    >
      <div className="flex items-start gap-3">
        {conversation.type === "direct" && otherParticipant ? (
          <div className="relative">
            <Avatar className="h-12 w-12">
              {otherParticipant.accountId === currentAccountId ? (
                <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 font-semibold text-white">
                  <MessageSquare className="h-6 w-6" />
                </AvatarFallback>
              ) : (
                <>
                  <AvatarImage src={otherParticipant.account?.profileImageUrl || undefined} />
                  <AvatarFallback className="bg-gradient-to-br from-green-500 to-emerald-600 font-semibold text-white">
                    {(otherParticipant.account?.displayName || "??")
                      .split(" ")
                      .map((n: string) => n[0])
                      .join("")}
                  </AvatarFallback>
                </>
              )}
            </Avatar>
            {/* Online indicator - enhanced with presence status */}
            {otherParticipant.accountId !== currentAccountId && (
              <div
                className={`border-background absolute -right-1 -bottom-1 h-4 w-4 rounded-full border-2 ${
                  clientState.presenceStatus === "online"
                    ? "animate-pulse bg-green-500"
                    : clientState.presenceStatus === "away"
                      ? "bg-yellow-500"
                      : clientState.presenceStatus === "busy"
                        ? "bg-red-500"
                        : "bg-gray-400"
                }`}
                title={
                  clientState.presenceStatus === "online"
                    ? "Online"
                    : clientState.presenceStatus === "away"
                      ? "Away"
                      : clientState.presenceStatus === "busy"
                        ? "Busy"
                        : "Offline"
                }
              />
            )}
          </div>
        ) : (
          <Avatar className="h-12 w-12">
            <AvatarImage src={conversation.avatar || undefined} />
            <AvatarFallback className="bg-gradient-to-br from-green-500 to-emerald-600 font-semibold text-white">
              <Users className="h-6 w-6" />
            </AvatarFallback>
          </Avatar>
        )}

        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <h4 className="truncate text-sm font-medium">
                {conversation.type === "direct" && otherParticipant
                  ? otherParticipant.accountId === currentAccountId
                    ? `${otherParticipant.account?.displayName || "You"} (You)`
                    : otherParticipant.account?.displayName || "Unknown"
                  : conversation.name || "Group Chat"}
              </h4>
              {conversation.type === "direct" &&
                otherParticipant &&
                getAccountTypeIcon(otherParticipant.account?.accountType || "country")}
            </div>
            <div className="flex flex-shrink-0 items-center gap-1">
              {lastMessage && (
                <MessageTimestamp
                  timestamp={lastMessage.createdAt || lastMessage.ixTimeTimestamp}
                />
              )}
              {hasUnread && (
                <Badge
                  variant="secondary"
                  className="bg-primary text-primary-foreground h-5 min-w-[20px] px-1.5 text-xs"
                >
                  {conversation.unreadCount}
                </Badge>
              )}
            </div>
          </div>

          {lastMessage && (
            <p className="text-muted-foreground line-clamp-2 text-xs">
              {lastMessage.accountId === currentAccountId ? "You: " : ""}
              {lastMessage.content}
            </p>
          )}
        </div>
      </div>
    </motion.div>
  );
}
