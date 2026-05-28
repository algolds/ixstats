"use client";

import { useMemo } from "react";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Switch } from "~/components/ui/switch";
import {
  Trash2,
  Plus,
  Calendar,
  Globe,
  Users,
  BarChart3,
  CheckCircle2,
  XCircle,
  Clock,
} from "lucide-react";
import { toast } from "sonner";

interface PollManagerProps {
  onCreateNew: () => void;
}

export function PollManager({ onCreateNew }: PollManagerProps) {
  const { data: polls, refetch } = api.polls.list.useQuery();
  const { data: countriesData } = api.countries.getSelectList.useQuery({ limit: 250 });

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
      toast.success("Poll status updated");
      refetch();
    },
    onError: (err) => {
      toast.error(err.message || "Failed to update status");
    },
  });

  const deleteMutation = api.polls.delete.useMutation({
    onSuccess: () => {
      toast.success("Poll deleted successfully");
      refetch();
    },
    onError: (err) => {
      toast.error(err.message || "Failed to delete poll");
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

  const activePollsCount = polls?.filter((p: any) => p.isActive).length ?? 0;
  const totalVotesCast =
    polls?.reduce((sum: number, p: any) => sum + (p._count?.votes ?? 0), 0) ?? 0;

  if (!polls || polls.length === 0) {
    return (
      <Card className="border-border/60 bg-card/20 flex flex-col items-center justify-center border border-dashed p-10 text-center backdrop-blur-md">
        <div className="mb-4 rounded-full bg-purple-500/10 p-4">
          <BarChart3 className="h-8 w-8 text-purple-500" />
        </div>
        <CardTitle className="text-xl font-bold">No polls configured</CardTitle>
        <CardDescription className="text-muted-foreground mt-2 mb-6 max-w-md text-sm">
          Create a choice poll, feature priority poll, or upvoting dashboard to gather citizen
          feedback.
        </CardDescription>
        <Button
          onClick={onCreateNew}
          className="gap-1.5 bg-purple-600 font-semibold text-white hover:bg-purple-700"
        >
          <Plus className="h-4 w-4" /> Create First Poll
        </Button>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="border-border/40 bg-card/30 border backdrop-blur-md">
          <CardContent className="flex items-center justify-between p-5">
            <div className="space-y-1">
              <span className="text-muted-foreground block text-xs font-semibold tracking-wider uppercase">
                Total Polls
              </span>
              <span className="text-2xl font-black">{polls.length}</span>
            </div>
            <div className="rounded-xl bg-purple-500/10 p-3">
              <BarChart3 className="h-5 w-5 text-purple-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/40 bg-card/30 border backdrop-blur-md">
          <CardContent className="flex items-center justify-between p-5">
            <div className="space-y-1">
              <span className="text-muted-foreground block text-xs font-semibold tracking-wider uppercase">
                Active Polls
              </span>
              <span className="text-2xl font-black text-emerald-500">{activePollsCount}</span>
            </div>
            <div className="rounded-xl bg-emerald-500/10 p-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/40 bg-card/30 border backdrop-blur-md">
          <CardContent className="flex items-center justify-between p-5">
            <div className="space-y-1">
              <span className="text-muted-foreground block text-xs font-semibold tracking-wider uppercase">
                Total Votes Logged
              </span>
              <span className="text-2xl font-black text-purple-500">{totalVotesCast}</span>
            </div>
            <div className="rounded-xl bg-purple-500/10 p-3">
              <Users className="h-5 w-5 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Poll Cards List */}
      <div className="grid grid-cols-1 gap-6">
        {polls.map((poll: any) => {
          const isExpired = poll.endDate ? new Date() > new Date(poll.endDate) : false;
          const countryName = poll.countryId
            ? countryNameMap.get(poll.countryId) || "Country Targeted"
            : "Global";
          const votesCount = poll._count?.votes ?? 0;

          return (
            <Card
              key={poll.id}
              className="border-border/40 bg-card/30 overflow-hidden border backdrop-blur-md"
            >
              <CardHeader className="border-border/20 border-b pb-3">
                <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <CardTitle className="text-base font-bold sm:text-lg">
                        {poll.question}
                      </CardTitle>
                      <Badge
                        variant="outline"
                        className="bg-background/40 text-[10px] font-bold tracking-wider uppercase"
                      >
                        {poll.pollType === "choice"
                          ? "Choice"
                          : poll.pollType === "feature-poll"
                            ? "Feature Poll"
                            : "Upvote Board"}
                      </Badge>
                      <Badge
                        className={`text-[10px] font-bold tracking-wider uppercase ${
                          poll.isActive && !isExpired
                            ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/25"
                            : isExpired
                              ? "border-rose-500/20 bg-rose-500/10 text-rose-500 hover:bg-rose-500/25"
                              : "border-zinc-500/20 bg-zinc-500/10 text-zinc-500 hover:bg-zinc-500/25"
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
                      <CardDescription className="text-sm">{poll.description}</CardDescription>
                    )}
                  </div>

                  {/* Actions Panel */}
                  <div className="bg-background/25 border-border/20 flex shrink-0 items-center gap-4 self-start rounded-xl border p-2 md:self-auto">
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground text-xs font-semibold">Active:</span>
                      <Switch
                        checked={poll.isActive}
                        onCheckedChange={() => handleToggleActive(poll.id, poll.isActive)}
                        disabled={toggleActiveMutation.isPending}
                      />
                    </div>
                    <div className="bg-border/40 h-4 w-px" />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(poll.id)}
                      disabled={deleteMutation.isPending}
                      className="h-8 w-8 text-rose-500 hover:bg-rose-500/10 hover:text-rose-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="text-muted-foreground/80 flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-2 text-xs font-medium">
                  <div className="flex items-center gap-1">
                    {poll.countryId ? (
                      <>
                        <Users className="h-3.5 w-3.5 text-purple-400" />
                        <span>
                          Target: <span className="text-foreground">{countryName}</span>
                        </span>
                      </>
                    ) : (
                      <>
                        <Globe className="h-3.5 w-3.5 text-sky-400" />
                        <span>
                          Scope: <span className="text-foreground">Global (All Users)</span>
                        </span>
                      </>
                    )}
                  </div>
                  {poll.endDate && (
                    <div className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      <span>
                        {isExpired ? "Expired: " : "Ends: "}
                        <span className="text-foreground">
                          {new Date(poll.endDate).toLocaleString()}
                        </span>
                      </span>
                    </div>
                  )}
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" />
                    <span>
                      Created:{" "}
                      <span className="text-foreground">
                        {new Date(poll.createdAt).toLocaleDateString()}
                      </span>
                    </span>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-4 sm:p-5">
                <h4 className="text-muted-foreground/80 mb-3 text-xs font-bold tracking-wider uppercase">
                  Option-by-Option Breakdown
                </h4>
                <div className="space-y-3">
                  {poll.options.map((opt: any) => {
                    const optVotes = opt._count?.votes ?? 0;
                    const percentage = votesCount > 0 ? (optVotes / votesCount) * 100 : 0;

                    return (
                      <div key={opt.id} className="space-y-1">
                        <div className="flex justify-between text-sm font-semibold">
                          <span className="text-foreground">{opt.label}</span>
                          <span className="text-muted-foreground">
                            {optVotes} {optVotes === 1 ? "vote" : "votes"} ({percentage.toFixed(1)}
                            %)
                          </span>
                        </div>
                        {/* Progress Bar */}
                        <div className="bg-background/55 border-border/20 h-2 w-full overflow-hidden rounded-full border">
                          <div
                            className="h-full rounded-full bg-purple-600 transition-all duration-500"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="border-border/20 text-muted-foreground mt-4 flex justify-between border-t pt-3 text-xs font-semibold">
                  <span>Total Option Votes Cast: {votesCount}</span>
                  {poll.multiple && (
                    <span className="text-purple-400">Multiple selection enabled</span>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
