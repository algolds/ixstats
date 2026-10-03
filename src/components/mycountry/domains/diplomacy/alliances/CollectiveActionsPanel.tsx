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

export function CollectiveActionsPanel({ allianceId, myRole }: CollectiveActionsPanelProps) {
  const [proposeOpen, setProposeOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [actionType, setActionType] = useState<string>("joint_statement");
  const [description, setDescription] = useState("");

  const { data: dashboard, refetch } = api.diplomaticPolicies.getAllianceDashboard.useQuery(
    { allianceId },
    { enabled: !!allianceId }
  );

  const proposeMutation = api.diplomaticPolicies.proposeAllianceAction.useMutation({
    onSuccess: () => {
      setProposeOpen(false);
      setTitle("");
      setDescription("");
      void refetch();
    },
  });

  const voteMutation = api.diplomaticPolicies.voteOnAllianceAction.useMutation({
    onSuccess: () => void refetch(),
  });

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
                  <Select value={actionType} onValueChange={setActionType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="joint_statement">Joint statement</SelectItem>
                      <SelectItem value="collective_sanction">Collective sanction</SelectItem>
                      <SelectItem value="shared_defense">Shared defense</SelectItem>
                      <SelectItem value="trade_bloc">Trade bloc</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
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
                      actionType: actionType as
                        "collective_sanction" | "shared_defense" | "trade_bloc" | "joint_statement",
                      title,
                      description: description || undefined,
                    })
                  }
                  disabled={!title || proposeMutation.isPending}
                  className="w-full"
                >
                  {proposeMutation.isPending ? "Submitting…" : "Submit Proposal"}
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
