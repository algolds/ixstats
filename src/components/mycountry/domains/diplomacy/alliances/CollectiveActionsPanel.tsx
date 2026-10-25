"use client";

import { useState } from "react";
import {
  ThumbsUp,
  ThumbsDown,
  MinusCircle,
  Plus,
  CheckCircle as CheckCircle2,
  XmarkCircle as XCircle,
  Clock,
} from "iconoir-react";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { Label } from "~/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { CountrySearchSelect } from "../CountrySearchSelect";

interface CollectiveActionsPanelProps {
  allianceId: string;
  countryId: string;
  myRole: string;
}

const STATUS_CONFIG: Record<string, { icon: typeof Clock; color: string }> = {
  proposed: { icon: Clock, color: "text-yellow" },
  approved: { icon: CheckCircle2, color: "text-label" },
  active: { icon: CheckCircle2, color: "text-green" },
  rejected: { icon: XCircle, color: "text-destructive" },
  expired: { icon: MinusCircle, color: "text-label-secondary" },
};

type AllianceActionType = "collective_sanction" | "shared_defense" | "trade_bloc" | "joint_statement";

const ACTION_TYPES: ReadonlyArray<{ value: AllianceActionType; label: string }> = [
  { value: "joint_statement", label: "Joint statement" },
  { value: "collective_sanction", label: "Collective sanction" },
  { value: "shared_defense", label: "Shared defense" },
  { value: "trade_bloc", label: "Trade bloc" },
];

/** What a targeted action does once the alliance approves it. */
const TARGET_HELP: Partial<Record<AllianceActionType, string>> = {
  collective_sanction:
    "Once approved, every voting member sanctions the target at once, with the same economic effects as a sanction of their own.",
  trade_bloc:
    "Once approved, every voting member offers the target free trade. Each offer takes effect when the target accepts it.",
};

const isAllianceActionType = (value: string): value is AllianceActionType =>
  ACTION_TYPES.some((t) => t.value === value);

export function CollectiveActionsPanel({ allianceId, myRole }: CollectiveActionsPanelProps) {
  const notify = useNotify();
  const [proposeOpen, setProposeOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [actionType, setActionType] = useState<AllianceActionType>("joint_statement");
  const [targetId, setTargetId] = useState("");
  const [description, setDescription] = useState("");
  const targetHelp = TARGET_HELP[actionType];

  const { data: dashboard, refetch } = api.diplomaticPolicies.getAllianceDashboard.useQuery(
    { allianceId },
    { enabled: !!allianceId }
  );

  const proposeMutation = api.diplomaticPolicies.proposeAllianceAction.useMutation({
    onSuccess: () => {
      setProposeOpen(false);
      setTitle("");
      setDescription("");
      setTargetId("");
      void refetch();
    },
    onError: (error) => notify.error("Could not propose the action", error.message),
  });

  const voteMutation = api.diplomaticPolicies.voteOnAllianceAction.useMutation({
    onSuccess: () => void refetch(),
    onError: (error) => notify.error("Could not record the vote", error.message),
  });
  const memberIds = (dashboard?.members ?? []).map((m) => m.countryId);

  const actions = dashboard?.actions ?? [];
  const canPropose = myRole !== "observer";

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-label text-headline">Alliance actions</h4>
        {canPropose && (
          <Dialog open={proposeOpen} onOpenChange={setProposeOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Plus className="h-3.5 w-3.5" />
                Propose
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Propose alliance action</DialogTitle>
                <DialogDescription>
                  Create a proposal for the alliance to vote on.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Action type</Label>
                  <Select
                    value={actionType}
                    onValueChange={(v) => isAllianceActionType(v) && setActionType(v)}
                  >
                    <SelectTrigger aria-label="Action type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ACTION_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {targetHelp && (
                  <div>
                    <Label>Target nation</Label>
                    <CountrySearchSelect
                      value={targetId}
                      onSelect={(id) => setTargetId(id)}
                      excludeIds={memberIds}
                      label="Target nation"
                    />
                    <p className="text-label-secondary text-footnote mt-1">{targetHelp}</p>
                  </div>
                )}
                <div>
                  <Label>Title</Label>
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Condemn aggression against..."
                  />
                </div>
                <div>
                  <Label>Description</Label>
                  <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Details of the proposed action..."
                    rows={3}
                  />
                </div>
                <Button
                  onClick={() =>
                    proposeMutation.mutate({
                      allianceId,
                      actionType,
                      targetId: targetHelp ? targetId : undefined,
                      title,
                      description: description || undefined,
                    })
                  }
                  disabled={!title || (!!targetHelp && !targetId) || proposeMutation.isPending}
                  className="w-full"
                >
                  {proposeMutation.isPending ? "Submitting…" : "Submit proposal"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {actions.length === 0 ? (
        <p className="text-label-secondary text-footnote py-4 text-center">
          No proposals yet. Members can propose collective actions for a vote.
        </p>
      ) : (
        <div className="space-y-2">
          {actions.slice(0, 5).map((action) => {
            const statusCfg = STATUS_CONFIG[action.status] ?? STATUS_CONFIG.proposed!;
            const StatusIcon = statusCfg.icon;
            const isPending = action.status === "proposed";

            return (
              <div
                key={action.id}
                className="border-separator bg-surface rounded-row text-body border p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <StatusIcon className={`h-3 w-3 ${statusCfg.color}`} />
                      <span className="text-label font-medium">{action.title}</span>
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <Badge variant="outline" className="capitalize">
                        {action.actionType.replace("_", " ")}
                      </Badge>
                      <span className="text-label-secondary text-footnote">
                        Votes: {action.votesFor} for / {action.votesAgainst} against (need{" "}
                        {action.requiredVotes})
                      </span>
                    </div>
                  </div>

                  {isPending && canPropose && (
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-green hover:text-green h-8 w-8"
                        aria-label="Vote for"
                        onClick={() => voteMutation.mutate({ actionId: action.id, vote: "for" })}
                        disabled={voteMutation.isPending}
                      >
                        <ThumbsUp className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive h-8 w-8"
                        aria-label="Vote against"
                        onClick={() =>
                          voteMutation.mutate({ actionId: action.id, vote: "against" })
                        }
                        disabled={voteMutation.isPending}
                      >
                        <ThumbsDown className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-label-secondary h-8 w-8"
                        aria-label="Abstain"
                        onClick={() =>
                          voteMutation.mutate({ actionId: action.id, vote: "abstain" })
                        }
                        disabled={voteMutation.isPending}
                      >
                        <MinusCircle className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
