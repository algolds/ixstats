"use client";

import React, { useState, useTransition } from "react";
import { api } from "~/trpc/react";
import { useUser } from "~/context/auth-context";
import { ChoicePoll } from "~/components/ui/choice-poll";
import { FeaturePoll } from "~/components/ui/feature-poll";
import { FeatureVoting } from "~/components/ui/feature-voting";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";
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
  const [selectedOptionIds, setSelectedOptionIds] = useState<string[]>(poll.userVotedOptionIds);
  const [isPending, startTransition] = useTransition();

  // Local state for interactive instant feedback
  const [pollState, setPollState] = useState({
    votes: poll.votes,
    totalVotes: poll.totalVotes,
    hasVoted: poll.hasVoted,
    userVotedOptionIds: poll.userVotedOptionIds,
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
      enabled: false,
    }
  );

  React.useEffect(() => {
    if (updatedData) {
      setPollState({
        votes: updatedData.votes as Record<string, number>,
        totalVotes: updatedData.totalVotes,
        hasVoted: updatedData.hasVoted,
        userVotedOptionIds: updatedData.userVotedOptionIds,
      });
      setSelectedOptionIds(updatedData.userVotedOptionIds);
    }
  }, [updatedData]);

  const isExpired = poll.endDate ? new Date() > new Date(poll.endDate) : false;
  const isDisabled = !poll.isActive || isExpired || voteMutation.isPending || isPending;

  // Handle standard choice or feature-poll submission
  const handleVoteSubmit = () => {
    if (!isSignedIn) {
      toast.error("You must sign in to vote");
      return;
    }
    if (selectedOptionIds.length === 0) return;

    startTransition(async () => {
      // Optimistic updates
      const newVotes = { ...pollState.votes };
      selectedOptionIds.forEach((id) => {
        newVotes[id] = (newVotes[id] ?? 0) + 1;
      });

      setPollState((prev) => ({
        votes: newVotes,
        totalVotes: prev.totalVotes + selectedOptionIds.length,
        hasVoted: true,
        userVotedOptionIds: selectedOptionIds,
      }));

      await voteMutation.mutateAsync({
        pollId: poll.id,
        optionIds: selectedOptionIds,
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

  // 1. Choice Poll Render
  if (poll.pollType === "choice") {
    return (
      <div className="glass-hierarchy-child/40 rounded-xl border p-4 sm:p-5 mt-4">
        <ChoicePoll.Root
          value={selectedOptionIds}
          onValueChange={(val) => {
            setSelectedOptionIds(Array.isArray(val) ? val : [val]);
          }}
          multiple={poll.multiple}
          disabled={isDisabled || !isSignedIn}
          showResults={showResults}
          votes={pollState.votes}
          hasVoted={pollState.hasVoted}
        >
          <ChoicePoll.Header>
            <ChoicePoll.Title className="text-foreground font-semibold text-base sm:text-lg">
              {poll.question}
            </ChoicePoll.Title>
            {poll.description && (
              <ChoicePoll.Description className="text-muted-foreground/80 text-xs sm:text-sm mt-1">
                {poll.description}
              </ChoicePoll.Description>
            )}
          </ChoicePoll.Header>
          <ChoicePoll.Options className="mt-3">
            {poll.options.map((opt) => (
              <ChoicePoll.Option key={opt.id} value={opt.id}>
                <ChoicePoll.Indicator />
                <ChoicePoll.Label className="text-foreground text-sm font-medium">
                  {opt.label}
                </ChoicePoll.Label>
                {showResults && (
                  <>
                    <ChoicePoll.Progress className="bg-primary/20" />
                    <ChoicePoll.Percentage className="text-foreground/80 text-xs font-semibold" />
                  </>
                )}
              </ChoicePoll.Option>
            ))}
          </ChoicePoll.Options>

          {!pollState.hasVoted && isSignedIn && (
            <div className="mt-4 flex items-center justify-between border-t border-border/40 pt-3">
              <span className="text-muted-foreground text-xs">
                {poll.multiple ? "Select multiple options" : "Select one option"}
              </span>
              <Button
                size="sm"
                disabled={selectedOptionIds.length === 0 || isDisabled}
                onClick={handleVoteSubmit}
                className="bg-purple-600 text-white hover:bg-purple-700 font-medium px-4 h-8 text-xs shrink-0 flex items-center gap-1.5"
              >
                {isDisabled ? (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin" /> Casting...
                  </>
                ) : (
                  "Submit Vote"
                )}
              </Button>
            </div>
          )}

          {!isSignedIn && (
            <p className="text-muted-foreground/60 text-[11px] text-center mt-3">
              Sign in to participate in this poll
            </p>
          )}

          <ChoicePoll.Footer className="mt-3 border-t border-border/40 pt-2.5 text-xs text-muted-foreground/60" totalVotes={pollState.totalVotes} />
        </ChoicePoll.Root>
      </div>
    );
  }

  // 2. Feature Poll Render
  if (poll.pollType === "feature-poll") {
    return (
      <div className="glass-hierarchy-child/40 rounded-xl border p-4 sm:p-5 mt-4">
        <FeaturePoll.Root
          value={selectedOptionIds}
          onValueChange={(val) => {
            setSelectedOptionIds(Array.isArray(val) ? val : [val]);
          }}
          multiple={poll.multiple}
          disabled={isDisabled || !isSignedIn}
          showResults={showResults}
          votes={pollState.votes}
          hasVoted={pollState.hasVoted}
        >
          <FeaturePoll.Header>
            <FeaturePoll.Title className="text-foreground font-semibold text-base sm:text-lg">
              {poll.question}
            </FeaturePoll.Title>
            {poll.description && (
              <FeaturePoll.Description className="text-muted-foreground/80 text-xs sm:text-sm mt-1">
                {poll.description}
              </FeaturePoll.Description>
            )}
          </FeaturePoll.Header>
          <FeaturePoll.Options className="mt-3">
            {poll.options.map((opt) => (
              <FeaturePoll.Option key={opt.id} value={opt.id}>
                <FeaturePoll.Indicator />
                <FeaturePoll.Label className="text-foreground text-sm font-medium">
                  {opt.label}
                </FeaturePoll.Label>
                {showResults && (
                  <>
                    <FeaturePoll.Progress className="bg-purple-600/15" />
                    <FeaturePoll.Percentage className="text-purple-600 dark:text-purple-400 text-xs font-semibold" />
                  </>
                )}
              </FeaturePoll.Option>
            ))}
          </FeaturePoll.Options>

          {!pollState.hasVoted && isSignedIn && (
            <div className="mt-4 flex items-center justify-between border-t border-border/40 pt-3">
              <span className="text-muted-foreground text-xs">
                {poll.multiple ? "Select multiple features" : "Select one feature"}
              </span>
              <Button
                size="sm"
                disabled={selectedOptionIds.length === 0 || isDisabled}
                onClick={handleVoteSubmit}
                className="bg-purple-600 text-white hover:bg-purple-700 font-medium px-4 h-8 text-xs shrink-0 flex items-center gap-1.5"
              >
                {isDisabled ? (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin" /> Casting...
                  </>
                ) : (
                  "Submit Vote"
                )}
              </Button>
            </div>
          )}

          {!isSignedIn && (
            <p className="text-muted-foreground/60 text-[11px] text-center mt-3">
              Sign in to participate in this feature poll
            </p>
          )}

          <FeaturePoll.Footer className="mt-3 border-t border-border/40 pt-2.5 text-xs text-muted-foreground/60" totalVotes={pollState.totalVotes} />
        </FeaturePoll.Root>
      </div>
    );
  }

  // 3. Feature Voting Render
  return (
    <div className="glass-hierarchy-child/40 rounded-xl border p-4 sm:p-5 mt-4 space-y-4">
      <div className="flex flex-col gap-1">
        <h3 className="text-foreground font-semibold text-base sm:text-lg">{poll.question}</h3>
        {poll.description && (
          <p className="text-muted-foreground/80 text-xs sm:text-sm">{poll.description}</p>
        )}
      </div>

      <FeatureVoting.Root
        value={pollState.votes}
        votedFeatures={new Set(pollState.userVotedOptionIds)}
        disabled={isDisabled || !isSignedIn}
        className="space-y-2.5 pl-0 mt-3"
      >
        {poll.options.map((opt) => {
          const hasVotedOpt = pollState.userVotedOptionIds.includes(opt.id);

          return (
            <FeatureVoting.Item
              key={opt.id}
              value={opt.id}
              className={cn(
                "flex items-center justify-between gap-4 rounded-xl border p-3 sm:p-4 text-left transition-all duration-200",
                hasVotedOpt
                  ? "border-purple-500 bg-purple-500/5 shadow-sm"
                  : "border-border/60 bg-card/40 hover:bg-muted/30"
              )}
            >
              <div className="flex-1 min-w-0">
                <FeatureVoting.Title className="font-semibold text-foreground text-sm sm:text-base block truncate">
                  {opt.label}
                </FeatureVoting.Title>
                {opt.description && (
                  <FeatureVoting.Description className="text-muted-foreground/75 text-xs mt-1 block line-clamp-2">
                    {opt.description}
                  </FeatureVoting.Description>
                )}
              </div>

              <FeatureVoting.Trigger
                onClick={() => handleFeatureToggleVote(opt.id)}
                disabled={isDisabled || !isSignedIn}
                className={cn(
                  "flex flex-col items-center justify-center rounded-lg border px-3 py-1.5 text-xs font-semibold gap-1 min-w-[3.5rem] h-12 transition-all duration-200",
                  hasVotedOpt
                    ? "border-purple-600 bg-purple-600 text-white hover:bg-purple-700"
                    : "border-border/80 bg-background hover:bg-muted text-muted-foreground hover:text-foreground"
                )}
              >
                <ArrowUp className="h-3.5 w-3.5" />
                <FeatureVoting.Count className="font-bold tabular-nums text-xs" />
              </FeatureVoting.Trigger>
            </FeatureVoting.Item>
          );
        })}
      </FeatureVoting.Root>

      {!isSignedIn && (
        <p className="text-muted-foreground/60 text-[11px] text-center mt-3">
          Sign in to upvote features
        </p>
      )}

      <div className="border-t border-border/40 pt-2.5 flex items-center justify-between text-xs text-muted-foreground/60">
        <span>Total interest: {pollState.totalVotes} upvotes</span>
        {isExpired && <span className="text-rose-500">Voting closed</span>}
      </div>
    </div>
  );
}
