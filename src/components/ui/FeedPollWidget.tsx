"use client";

import React, { useState, useTransition } from "react";
import { api } from "~/trpc/react";
import { useUser } from "~/context/auth-context";
import { PollWidget } from "~/components/ui/poll-widget";
import { FeatureVoting } from "~/components/ui/feature-voting";
// eslint-disable-next-line unused-imports/no-unused-imports
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";
// eslint-disable-next-line unused-imports/no-unused-imports
import { ArrowUp, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface PollOptionData {
  id: string;
  label: string;
  description: string | null;
}

interface PollData {
  id: string;
  question: string;
  description: string | null;
  pollType: string;
  multiple: boolean;
  isActive: boolean;
  endDate: Date | string | null;
  options: PollOptionData[];
  votes: Record<string, number>;
  totalVotes: number;
  hasVoted: boolean;
  userVotedOptionIds: string[];
}

interface FeedPollWidgetProps {
  poll: PollData;
}

export function FeedPollWidget({ poll }: FeedPollWidgetProps) {
  const { isSignedIn, user } = useUser();
  const [selectedOptionIds, setSelectedOptionIds] = useState<string[]>(
    poll.userVotedOptionIds || []
  );
  const [isPending, startTransition] = useTransition();

  // Local state for interactive instant feedback
  const [pollState, setPollState] = useState({
    votes: poll.votes || {},
    totalVotes: poll.totalVotes || 0,
    hasVoted: poll.hasVoted || false,
    userVotedOptionIds: poll.userVotedOptionIds || [],
  });

  // tRPC mutation to cast a vote
  const voteMutation = api.polls.vote.useMutation({
    onSuccess: (data) => {
      // Sync state with server response (which triggered db update)
      // Refetch details to get precise real-time synchronization
      refetchDetails();
    },
    onError: (err) => {
      // Revert optimistic updates
      setPollState({
        votes: poll.votes,
        totalVotes: poll.totalVotes,
        hasVoted: poll.hasVoted,
        userVotedOptionIds: poll.userVotedOptionIds,
      });
      toast.error(err.message || "Failed to submit your vote");
    },
  });

  // Query to get refreshed details
  const { data: updatedData, refetch: refetchDetails } = api.polls.getPollDetails.useQuery(
    { pollId: poll.id },
    {
      enabled: isSignedIn,
    }
  );

  React.useEffect(() => {
    if (updatedData) {
      setPollState({
        votes: (updatedData.votes || {}) as Record<string, number>,
        totalVotes: updatedData.totalVotes || 0,
        hasVoted: updatedData.hasVoted || false,
        userVotedOptionIds: updatedData.userVotedOptionIds || [],
      });
      setSelectedOptionIds(updatedData.userVotedOptionIds || []);
    }
  }, [updatedData]);

  const isExpired = poll.endDate ? new Date() > new Date(poll.endDate) : false;
  const isDisabled = !poll.isActive || isExpired || voteMutation.isPending || isPending;

  // Handle standard choice or feature-poll submission
  const handleVoteSubmit = (ids?: string[]) => {
    if (!isSignedIn) {
      toast.error("You must sign in to vote");
      return;
    }
    const targetIds = ids || selectedOptionIds;
    if (!targetIds || targetIds.length === 0) return;

    startTransition(async () => {
      // Optimistic updates
      const newVotes = { ...pollState.votes };
      targetIds.forEach((id) => {
        newVotes[id] = (newVotes[id] ?? 0) + 1;
      });

      setPollState((prev) => ({
        votes: newVotes,
        totalVotes: prev.totalVotes + targetIds.length,
        hasVoted: true,
        userVotedOptionIds: targetIds,
      }));

      await voteMutation.mutateAsync({
        pollId: poll.id,
        optionIds: targetIds,
      });
      toast.success("Vote recorded!");
    });
  };

  // Handle toggle feature request upvote/unvote
  const handleFeatureToggleVote = (optionId: string) => {
    if (!isSignedIn) {
      toast.error("You must sign in to vote");
      return;
    }

    startTransition(async () => {
      const hasVotedOpt = pollState.userVotedOptionIds.includes(optionId);
      let newVotedOptionIds: string[];
      const newVotes = { ...pollState.votes };
      let voteChange = 0;

      if (hasVotedOpt) {
        // Optimistic unvote
        newVotedOptionIds = pollState.userVotedOptionIds.filter((id) => id !== optionId);
        newVotes[optionId] = Math.max((newVotes[optionId] ?? 0) - 1, 0);
        voteChange = -1;
      } else {
        // Optimistic vote
        newVotedOptionIds = [...pollState.userVotedOptionIds, optionId];
        newVotes[optionId] = (newVotes[optionId] ?? 0) + 1;
        voteChange = 1;
      }

      setPollState((prev) => ({
        votes: newVotes,
        totalVotes: prev.totalVotes + voteChange,
        hasVoted: newVotedOptionIds.length > 0,
        userVotedOptionIds: newVotedOptionIds,
      }));

      await voteMutation.mutateAsync({
        pollId: poll.id,
        optionIds: [optionId],
      });
    });
  };

  const showResults = pollState.hasVoted || isExpired;

  // 1. Choice Poll or Feature Poll Render
  if (poll.pollType === "choice" || poll.pollType === "feature-poll") {
    const pollOptions = poll.options.map((opt) => ({
      id: opt.id,
      label: opt.label,
      description: opt.description || undefined,
    }));

    return (
      <div className="glass-hierarchy-child/40 mt-4 rounded-xl border p-4 sm:p-5">
        <PollWidget
          question={poll.question}
          description={poll.description || undefined}
          options={pollOptions}
          value={selectedOptionIds}
          onValueChange={(val) => {
            setSelectedOptionIds(Array.isArray(val) ? val : [val]);
          }}
          multiple={poll.multiple}
          disabled={isDisabled || !isSignedIn}
          votes={pollState.votes}
          hasVoted={pollState.hasVoted}
          onVote={(ids) => handleVoteSubmit(ids)}
          mode="inline"
        >
          <PollWidget.Content>
            <PollWidget.Question />
            <PollWidget.Options className="mt-3">
              {pollOptions.map((opt) => (
                <PollWidget.Option key={opt.id} value={opt.id} />
              ))}
            </PollWidget.Options>

            {isSignedIn && !pollState.hasVoted && (
              <PollWidget.Submit className="animate-in fade-in zoom-in-95 mt-4 duration-200" />
            )}

            {!isSignedIn && (
              <p className="text-muted-foreground/60 mt-3 text-center text-[11px]">
                Sign in to participate in this poll
              </p>
            )}

            <PollWidget.Results className="border-border/40 text-muted-foreground/60 mt-3 border-t pt-2.5 text-xs" />
          </PollWidget.Content>
        </PollWidget>
      </div>
    );
  }

  // 3. Feature Voting Render
  return (
    <div className="glass-hierarchy-child/40 mt-4 space-y-4 rounded-xl border p-4 sm:p-5">
      <div className="flex flex-col gap-1">
        <h3 className="text-foreground text-base font-semibold sm:text-lg">{poll.question}</h3>
        {poll.description && (
          <p className="text-muted-foreground/80 text-xs sm:text-sm">{poll.description}</p>
        )}
      </div>

      <FeatureVoting.Root
        value={pollState.votes}
        votedFeatures={new Set(pollState.userVotedOptionIds)}
        disabled={isDisabled || !isSignedIn}
        className="mt-3 space-y-2.5 pl-0"
      >
        {poll.options.map((opt) => {
          const hasVotedOpt = pollState.userVotedOptionIds.includes(opt.id);

          return (
            <FeatureVoting.Item
              key={opt.id}
              value={opt.id}
              className={cn(
                "flex items-center justify-between gap-4 rounded-xl border p-3 text-left transition-all duration-200 sm:p-4",
                hasVotedOpt
                  ? "border-[#ff8a65]/40 bg-[#ff8a65]/5 shadow-sm"
                  : "border-border/60 bg-card/40 hover:bg-muted/30"
              )}
            >
              <div className="min-w-0 flex-1">
                <FeatureVoting.Title className="text-foreground block truncate text-sm font-semibold sm:text-base">
                  {opt.label}
                </FeatureVoting.Title>
                {opt.description && (
                  <FeatureVoting.Description className="text-muted-foreground/75 mt-1 line-clamp-2 block text-xs">
                    {opt.description}
                  </FeatureVoting.Description>
                )}
              </div>

              <FeatureVoting.Trigger
                onClick={() => handleFeatureToggleVote(opt.id)}
                disabled={isDisabled || !isSignedIn}
                className={cn(
                  "flex h-12 min-w-[3.5rem] flex-col items-center justify-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all duration-200",
                  hasVotedOpt
                    ? "border-[#ff8a65] bg-[#ff8a65] text-white hover:bg-[#ff8a65]/90"
                    : "border-border/80 bg-background hover:bg-muted text-muted-foreground hover:text-foreground"
                )}
              >
                <ArrowUp className="h-3.5 w-3.5" />
                <FeatureVoting.Count className="text-xs font-bold tabular-nums" />
              </FeatureVoting.Trigger>
            </FeatureVoting.Item>
          );
        })}
      </FeatureVoting.Root>

      {!isSignedIn && (
        <p className="text-muted-foreground/60 mt-3 text-center text-[11px]">
          Sign in to upvote features
        </p>
      )}

      <div className="border-border/40 text-muted-foreground/60 flex items-center justify-between border-t pt-2.5 text-xs">
        <span>Total interest: {pollState.totalVotes} upvotes</span>
        {isExpired && <span className="text-rose-500">Voting closed</span>}
      </div>
    </div>
  );
}
