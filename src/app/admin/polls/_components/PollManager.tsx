"use client";

import { useMemo } from "react";
import { api } from "~/trpc/react";
import { ALL_REALMS } from "~/lib/realms/realm-ids";
import { Button } from "~/components/ui/button";
import { Card, CardTitle, CardDescription } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Switch } from "~/components/ui/switch";
import {
  Trash as Trash2,
  Plus,
  Calendar,
  Globe,
  Group as Users,
  StatsReport as BarChart3,
  Clock,
  Send,
  SystemRestart as Loader2,
} from "iconoir-react";
import { useNotify } from "~/hooks/useNotify";
import { FacetCard } from "~/components/ui/facet-container";

interface PollManagerProps {
  onCreateNew: () => void;
}

export function PollManager({ onCreateNew }: PollManagerProps) {
  const notify = useNotify();
  const { data: polls, refetch } = api.polls.list.useQuery();
  const { data: countriesData } = api.countries.getSelectList.useQuery({
    limit: 250,
    realm: ALL_REALMS,
  });

  // Create a mapping of countryId to country name
  const countryNameMap = useMemo(() => {
    const map = new Map<string, string>();
    countriesData?.forEach((c: any) => {
      map.set(c.id, c.name);
    });
    return map;
  }, [countriesData]);

  const toggleActiveMutation = api.polls.toggleActive.useMutation({
    onSuccess: () => {
      notify.success("Poll status updated successfully");
      void refetch();
    },
    onError: (err) => {
      notify.error(err.message || "Failed to update status");
    },
  });

  const deleteMutation = api.polls.delete.useMutation({
    onSuccess: () => {
      notify.success("Poll deleted successfully");
      void refetch();
    },
    onError: (err) => {
      notify.error(err.message || "Failed to delete poll");
    },
  });

  const publishToDiscordMutation = api.polls.publishToDiscord.useMutation({
    onSuccess: () => {
      notify.success("Poll announced on Discord channel!");
    },
    onError: (err) => {
      notify.error(err.message || "Failed to publish Discord");
    },
  });

  const handleToggleActive = (id: string, currentStatus: boolean) => {
    toggleActiveMutation.mutate({ id, isActive: !currentStatus });
  };

  const handleDelete = (id: string) => {
    if (
      confirm(
        "Are you sure you want to delete this poll? The associated activity feed post will also be deleted."
      )
    ) {
      deleteMutation.mutate({ id });
    }
  };

  const handlePublishToDiscord = (id: string) => {
    publishToDiscordMutation.mutate({ id });
  };

  const activePollsCount = polls?.filter((p: any) => p.isActive).length ?? 0;
  const totalVotesCast =
    polls?.reduce((sum: number, p: any) => sum + (p._count?.votes ?? 0), 0) ?? 0;

  if (!polls || polls.length === 0) {
    return (
      <Card className="flex flex-col items-center justify-center border-dashed p-10 text-center">
        <div className="bg-poll/10 mb-4 rounded-full p-4">
          <BarChart3 className="text-poll h-8 w-8" />
        </div>
        <CardTitle className="text-title-2">No polls configured</CardTitle>
        <CardDescription className="text-label-secondary text-body mt-2 mb-6 max-w-md">
          Create a choice poll, feature priority poll, or upvoting dashboard to gather citizen
          feedback.
        </CardDescription>
        <Button onClick={onCreateNew} className="cursor-pointer gap-1.5">
          <Plus className="h-4 w-4" /> Create First Poll
        </Button>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <FacetCard className="p-3.5">
          <p className="text-label-secondary text-eyebrow">Ballots Configured</p>
          <p className="text-label text-title-2 mt-1 tabular-nums">{polls.length}</p>
        </FacetCard>

        <FacetCard className="p-3.5">
          <p className="text-label-secondary text-eyebrow">Active Ballots</p>
          <p className="text-title-2 text-green mt-1 tabular-nums">{activePollsCount}</p>
        </FacetCard>

        <FacetCard className="p-3.5">
          <p className="text-label-secondary text-eyebrow">Responses Collected</p>
          <p className="text-title-2 text-teal mt-1 tabular-nums">{totalVotesCast}</p>
        </FacetCard>
      </div>

      {/* Poll Cards List */}
      <div className="grid grid-cols-1 gap-4">
        {polls.map((poll: any) => {
          const isExpired = poll.endDate ? new Date() > new Date(poll.endDate) : false;
          const countryName = poll.countryId
            ? countryNameMap.get(poll.countryId) || "Country Targeted"
            : "Global";
          const votesCount = poll._count?.votes ?? 0;

          return (
            <FacetCard key={poll.id} className="space-y-3 p-4">
              <div className="border-separator border-b pb-3">
                <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-label text-headline">{poll.question}</h4>
                      <Badge variant="outline" className="bg-fill-3 border-separator text-eyebrow">
                        {poll.pollType === "choice"
                          ? "Choice"
                          : poll.pollType === "feature-poll"
                            ? "Feature Poll"
                            : "Upvote Board"}
                      </Badge>
                      <Badge
                        className={`text-eyebrow border ${
                          poll.isActive && !isExpired
                            ? "border-green/35 bg-green/10 text-green hover:bg-green/20"
                            : isExpired
                              ? "border-red/35 bg-red/10 text-red hover:bg-red/20"
                              : "border-separator bg-fill-3 text-label-secondary hover:bg-fill-4"
                        }`}
                      >
                        {poll.isActive && !isExpired
                          ? "Active"
                          : isExpired
                            ? "Expired"
                            : "Inactive"}
                      </Badge>
                    </div>
                    {poll.description && (
                      <CardDescription className="text-label-secondary text-footnote">
                        {poll.description}
                      </CardDescription>
                    )}
                  </div>

                  {/* Actions Panel */}
                  <div className="bg-fill-4 border-separator rounded-row flex shrink-0 items-center gap-3.5 self-start border p-2 md:self-auto">
                    <div className="flex items-center gap-2">
                      <span className="text-label-secondary text-eyebrow">Active:</span>
                      <Switch
                        checked={poll.isActive}
                        onCheckedChange={() => handleToggleActive(poll.id, poll.isActive)}
                        disabled={toggleActiveMutation.isPending}
                        className="scale-90"
                      />
                    </div>

                    <div className="bg-separator h-4 w-px" />

                    {/* Announce / Publish to Discord button */}
                    <Button
                      variant="outline"
                      onClick={() => handlePublishToDiscord(poll.id)}
                      disabled={publishToDiscordMutation.isPending}
                      className="cursor-pointer gap-1"
                      size="sm"
                    >
                      {publishToDiscordMutation.isPending ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Send className="h-3 w-3" />
                      )}
                      Discord Publish
                    </Button>

                    <div className="bg-separator h-4 w-px" />

                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(poll.id)}
                      disabled={deleteMutation.isPending}
                      className="text-destructive w-7 cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                <div className="text-label-secondary text-caption flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-2.5">
                  <div className="flex items-center gap-1">
                    {poll.countryId ? (
                      <>
                        <Users className="text-poll h-3.5 w-3.5" />
                        <span>
                          Target: <span className="text-label">{countryName}</span>
                        </span>
                      </>
                    ) : (
                      <>
                        <Globe className="text-blue h-3.5 w-3.5" />
                        <span>
                          Scope: <span className="text-label">Global (All Users)</span>
                        </span>
                      </>
                    )}
                  </div>
                  {poll.endDate && (
                    <div className="flex items-center gap-1">
                      <Clock className="text-label-secondary h-3.5 w-3.5" />
                      <span>
                        {isExpired ? "Expired: " : "Ends: "}
                        <span className="text-label">
                          {new Date(poll.endDate).toLocaleString()}
                        </span>
                      </span>
                    </div>
                  )}
                  <div className="flex items-center gap-1">
                    <Calendar className="text-label-secondary h-3.5 w-3.5" />
                    <span>
                      Created:{" "}
                      <span className="text-label">
                        {new Date(poll.createdAt).toLocaleDateString()}
                      </span>
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <h4 className="text-label-secondary text-subhead mb-3">
                  Option-by-Option Breakdown
                </h4>
                <div className="space-y-3.5">
                  {poll.options.map((opt: any) => {
                    const optVotes = opt._count?.votes ?? 0;
                    const percentage = votesCount > 0 ? (optVotes / votesCount) * 100 : 0;

                    return (
                      <div key={opt.id} className="group/opt space-y-1.5">
                        <div className="text-caption flex justify-between">
                          <span className="text-label group-hover/opt:text-poll transition-colors">
                            {opt.label}
                          </span>
                          <span className="text-label-secondary">
                            {optVotes} {optVotes === 1 ? "vote" : "votes"} ({percentage.toFixed(1)}
                            %)
                          </span>
                        </div>
                        {/* Linear Progress Bar */}
                        <div className="bg-fill-3 relative h-2 w-full overflow-hidden rounded-full">
                          <div
                            className="bg-poll h-full rounded-full transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-500"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="border-separator text-label-secondary text-eyebrow mt-4 flex justify-between border-t pt-3">
                  <span>Total Option Votes Cast: {votesCount}</span>
                  {poll.multiple && <span className="text-poll">Multiple selection enabled</span>}
                </div>
              </div>
            </FacetCard>
          );
        })}
      </div>
    </div>
  );
}
