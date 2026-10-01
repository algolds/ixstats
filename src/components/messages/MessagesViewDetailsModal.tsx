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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-title-3 flex items-center gap-2">
            <Info className="text-tint size-5" aria-hidden="true" />
            Conversation Details
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Metadata Cards */}
          <div className="text-body grid grid-cols-2 gap-3">
            <div className="bg-surface-secondary rounded-row flex flex-col gap-1 p-3">
              <span className="text-footnote text-label-secondary flex items-center gap-1">
                <Users className="size-3.5" aria-hidden="true" /> Type
              </span>
              <span className="text-headline text-label">
                {conversation.source === "thinktank" || conversation.type === "group"
                  ? "ThinkTank Group"
                  : `${formatType(conversation.type)} Chat`}
              </span>
            </div>
            <div className="bg-surface-secondary rounded-row flex flex-col gap-1 p-3">
              <span className="text-footnote text-label-secondary flex items-center gap-1">
                <Calendar className="size-3.5" aria-hidden="true" /> Created
              </span>
              <span className="text-headline text-label">{createdDate}</span>
            </div>
            {conversation.conversationType && (
              <div className="bg-surface-secondary rounded-row flex flex-col gap-1 p-3">
                <span className="text-footnote text-label-secondary flex items-center gap-1">
                  <Shield className="size-3.5" aria-hidden="true" /> Category
                </span>
                <span className="text-headline text-label">
                  {formatType(conversation.conversationType)}
                </span>
              </div>
            )}
            {conversation.diplomaticClassification && (
              <div className="bg-surface-secondary rounded-row flex flex-col gap-1 p-3">
                <span className="text-footnote text-label-secondary flex items-center gap-1">
                  <AlertCircle className="size-3.5" aria-hidden="true" /> Classification
                </span>
                <span className="text-headline text-destructive font-mono">
                  {conversation.diplomaticClassification}
                </span>
              </div>
            )}
          </div>

          {/* Participant List */}
          <div className="space-y-3">
            <h4 className="text-headline text-label flex items-center gap-2 px-1">
              <Users className="text-label-secondary size-4" aria-hidden="true" />
              Participants ({conversation.otherParticipants.length + 1})
            </h4>

            <div className="max-h-60 space-y-2 overflow-y-auto pr-1">
              {/* Current User */}
              {currentUser && (
                <div className="bg-surface-secondary rounded-control flex items-center gap-3 p-2">
                  <Avatar className="size-8">
                    <AvatarImage src={currentUser.profileImageUrl ?? undefined} />
                    <AvatarFallback className="bg-tint-fill text-caption text-tint">
                      {(currentUser.displayName ?? currentUser.username ?? "Me")
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .substring(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="text-headline text-label truncate">
                      {displayNamePreference === "account"
                        ? currentUser.username
                          ? `@${currentUser.username}`
                          : "Me"
                        : (currentUser.displayName ?? "Me")}{" "}
                      <span className="text-label-secondary text-footnote font-normal italic">
                        (You)
                      </span>
                    </p>
                    {currentUser.username && (
                      <p className="text-label-secondary text-footnote truncate">
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
                  className="bg-surface-secondary rounded-control flex items-center gap-3 p-2"
                >
                  <Avatar className="size-8">
                    <AvatarImage src={participant.account.profileImageUrl ?? undefined} />
                    <AvatarFallback className="bg-fill-3 text-caption text-label-secondary">
                      {participant.account.displayName
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .substring(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="text-headline text-label truncate">
                      {getDisplayName(participant.account)}
                    </p>
                    <p className="text-label-secondary text-footnote truncate">
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
