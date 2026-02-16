"use client";

import { useState } from "react";
import {
  ThumbsUp,
  ThumbsDown,
  MinusCircle,
  Plus,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
} from "lucide-react";
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
  proposed: { icon: Clock, color: "text-yellow-500" },
  approved: { icon: CheckCircle2, color: "text-blue-500" },
  active: { icon: CheckCircle2, color: "text-green-500" },
  rejected: { icon: XCircle, color: "text-red-500" },
  expired: { icon: MinusCircle, color: "text-gray-500" },
};

export function CollectiveActionsPanel({ allianceId, countryId, myRole }: CollectiveActionsPanelProps) {
  const [proposeOpen, setProposeOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [actionType, setActionType] = useState<string>("joint_statement");
  const [description, setDescription] = useState("");

  const { data: dashboard, refetch } = api.diplomatic.getAllianceDashboard.useQuery(
    { allianceId },
    { enabled: !!allianceId }
  );

  const proposeMutation = api.diplomatic.proposeAllianceAction.useMutation({
    onSuccess: () => {
      setProposeOpen(false);
      setTitle("");
      setDescription("");
      void refetch();
    },
  });

  const voteMutation = api.diplomatic.voteOnAllianceAction.useMutation({
    onSuccess: () => void refetch(),
  });

  const actions = dashboard?.actions ?? [];
  const canPropose = myRole !== "observer";

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold">Alliance Actions</h4>
        {canPropose && (
          <Dialog open={proposeOpen} onOpenChange={setProposeOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Plus className="mr-1 h-3 w-3" />
                Propose
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Propose Alliance Action</DialogTitle>
                <DialogDescription>
                  Create a proposal for the alliance to vote on.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Action Type</Label>
                  <Select value={actionType} onValueChange={setActionType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="joint_statement">Joint Statement</SelectItem>
                      <SelectItem value="collective_sanction">Collective Sanction</SelectItem>
                      <SelectItem value="shared_defense">Shared Defense</SelectItem>
                      <SelectItem value="trade_bloc">Trade Bloc</SelectItem>
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
                      actionType: actionType as "collective_sanction" | "shared_defense" | "trade_bloc" | "joint_statement",
                      title,
                      description: description || undefined,
                    })
                  }
                  disabled={!title || proposeMutation.isPending}
                  className="w-full"
                >
                  {proposeMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  Submit Proposal
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {actions.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-4">
          No proposals yet. Members can propose collective actions for a vote.
        </p>
      ) : (
        <div className="space-y-2">
          {actions.slice(0, 5).map((action) => {
            const statusCfg = STATUS_CONFIG[action.status] ?? STATUS_CONFIG.proposed!;
            const StatusIcon = statusCfg.icon;
            const isPending = action.status === "proposed";

            return (
              <div key={action.id} className="rounded-lg border p-3 text-sm">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <StatusIcon className={`h-3 w-3 ${statusCfg.color}`} />
                      <span className="font-medium">{action.title}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-[10px]">
                        {action.actionType.replace("_", " ")}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        Votes: {action.votesFor} for / {action.votesAgainst} against
                        (need {action.requiredVotes})
                      </span>
                    </div>
                  </div>

                  {isPending && canPropose && (
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-green-500 hover:text-green-600"
                        onClick={() =>
                          voteMutation.mutate({ actionId: action.id, vote: "for" })
                        }
                        disabled={voteMutation.isPending}
                      >
                        <ThumbsUp className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-red-500 hover:text-red-600"
                        onClick={() =>
                          voteMutation.mutate({ actionId: action.id, vote: "against" })
                        }
                        disabled={voteMutation.isPending}
                      >
                        <ThumbsDown className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-gray-500 hover:text-gray-600"
                        onClick={() =>
                          voteMutation.mutate({ actionId: action.id, vote: "abstain" })
                        }
                        disabled={voteMutation.isPending}
                      >
                        <MinusCircle className="h-3 w-3" />
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
