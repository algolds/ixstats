"use client";

import {
  InfoCircle as Info,
  Group as Users,
  Calendar,
  Shield,
  WarningCircle as AlertCircle,
} from "iconoir-react";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "~/components/ui/dialog";

interface Participant {
  accountId: string;
  account: {
    id: string;
    username: string;
    displayName: string;
    profileImageUrl: string | null;
  };
}

interface MessagesViewDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  conversation: {
    id: string;
    type: string;
    name: string | null;
    source: string;
    conversationType?: string | null;
    diplomaticClassification?: string | null;
    createdAt: Date;
    otherParticipants: Participant[];
  };
  currentUser: {
    id: string;
    username?: string;
    displayName?: string;
    profileImageUrl?: string | null;
  } | null;
  displayNamePreference: "account" | "country";
}

export function MessagesViewDetailsModal({
  isOpen,
  onClose,
  conversation,
  currentUser,
  displayNamePreference,
}: MessagesViewDetailsModalProps) {
  // Format dates nicely
  const createdDate = new Date(conversation.createdAt).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // Capitalize helpers
  const formatType = (type: string) => {
    return type.charAt(0).toUpperCase() + type.slice(1);
  };

  const getDisplayName = (account: { username: string; displayName: string }) => {
    return displayNamePreference === "account" ? `@${account.username}` : account.displayName;
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="bg-background/80 border-border/50 text-card-foreground backdrop-blur-md sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-semibold">
            <Info className="text-primary h-5 w-5" />
            Conversation Details
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Metadata Cards */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="bg-muted/40 border-border/20 flex flex-col gap-1 rounded-xl border p-3">
              <span className="text-muted-foreground flex items-center gap-1 text-xs font-medium">
                <Users className="h-3.5 w-3.5" /> Type
              </span>
              <span className="text-foreground font-semibold">
                {conversation.source === "thinktank" || conversation.type === "group"
                  ? "ThinkTank Group"
                  : `${formatType(conversation.type)} Chat`}
              </span>
            </div>
            <div className="bg-muted/40 border-border/20 flex flex-col gap-1 rounded-xl border p-3">
              <span className="text-muted-foreground flex items-center gap-1 text-xs font-medium">
                <Calendar className="h-3.5 w-3.5" /> Created
              </span>
              <span className="text-foreground font-semibold">{createdDate}</span>
            </div>
            {conversation.conversationType && (
              <div className="bg-muted/40 border-border/20 flex flex-col gap-1 rounded-xl border p-3">
                <span className="text-muted-foreground flex items-center gap-1 text-xs font-medium">
                  <Shield className="h-3.5 w-3.5" /> Category
                </span>
                <span className="text-foreground font-semibold">
                  {formatType(conversation.conversationType)}
                </span>
              </div>
            )}
            {conversation.diplomaticClassification && (
              <div className="bg-muted/40 border-border/20 flex flex-col gap-1 rounded-xl border p-3">
                <span className="text-muted-foreground flex items-center gap-1 text-xs font-medium">
                  <AlertCircle className="h-3.5 w-3.5" /> Classification
                </span>
                <span className="text-foreground font-mono text-xs font-semibold tracking-wider text-rose-500">
                  {conversation.diplomaticClassification}
                </span>
              </div>
            )}
          </div>

          {/* Participant List */}
          <div className="space-y-3">
            <h4 className="text-foreground/80 flex items-center gap-1.5 px-1 text-sm font-semibold">
              <Users className="text-muted-foreground h-4 w-4" />
              Participants ({conversation.otherParticipants.length + 1})
            </h4>

            <div className="max-h-60 space-y-2 overflow-y-auto pr-1">
              {/* Current User */}
              {currentUser && (
                <div className="bg-muted/20 border-border/10 flex items-center gap-3 rounded-lg border p-2">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={currentUser.profileImageUrl ?? undefined} />
                    <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-purple-600 text-xs font-semibold text-white">
                      {(currentUser.displayName ?? currentUser.username ?? "Me")
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .substring(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {displayNamePreference === "account"
                        ? currentUser.username
                          ? `@${currentUser.username}`
                          : "Me"
                        : (currentUser.displayName ?? "Me")}{" "}
                      <span className="text-muted-foreground text-xs font-normal italic">
                        (You)
                      </span>
                    </p>
                    {currentUser.username && (
                      <p className="text-muted-foreground truncate text-xs">
                        @{currentUser.username}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Other Participants */}
              {conversation.otherParticipants.map((participant) => (
                <div
                  key={participant.accountId}
                  className="bg-muted/10 border-border/10 flex items-center gap-3 rounded-lg border p-2"
                >
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={participant.account.profileImageUrl ?? undefined} />
                    <AvatarFallback className="bg-gradient-to-br from-emerald-500 to-teal-600 text-xs font-semibold text-white">
                      {participant.account.displayName
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .substring(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {getDisplayName(participant.account)}
                    </p>
                    <p className="text-muted-foreground truncate text-xs">
                      @{participant.account.username}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
