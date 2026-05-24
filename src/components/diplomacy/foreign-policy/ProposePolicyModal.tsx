"use client";

import { useState } from "react";
import {
  AlertTriangle,
  Ban,
  HandshakeIcon,
  Shield,
  ShipWheel,
  ArrowDownRight,
  ArrowUpRight,
  Loader2,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
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
import { Textarea } from "~/components/ui/textarea";
import { Label } from "~/components/ui/label";
import { api } from "~/trpc/react";

interface ProposePolicyModalProps {
  countryId: string;
  onSuccess?: () => void;
}

type ActionType = "embargo" | "sanction" | "free_trade" | "military_alliance" | "blockade";
type Severity = "light" | "moderate" | "severe";

const ACTION_OPTIONS: {
  value: ActionType;
  label: string;
  icon: typeof Ban;
  description: string;
  hostile: boolean;
}[] = [
  {
    value: "embargo",
    label: "Trade Embargo",
    icon: Ban,
    description: "Block trade with target nation. Hurts both economies.",
    hostile: true,
  },
  {
    value: "sanction",
    label: "Economic Sanction",
    icon: AlertTriangle,
    description: "Restrict specific economic sectors of target nation.",
    hostile: true,
  },
  {
    value: "blockade",
    label: "Naval Blockade",
    icon: ShipWheel,
    description: "Military blockade of target ports. Severe economic damage.",
    hostile: true,
  },
  {
    value: "free_trade",
    label: "Free Trade Agreement",
    icon: HandshakeIcon,
    description: "Reduce trade barriers. Mutual GDP boost.",
    hostile: false,
  },
  {
    value: "military_alliance",
    label: "Military Alliance",
    icon: Shield,
    description: "Mutual defense pact with shared strategic benefits.",
    hostile: false,
  },
];

export function ProposePolicyModal({ countryId, onSuccess }: ProposePolicyModalProps) {
  const [open, setOpen] = useState(false);
  const [targetId, setTargetId] = useState("");
  const [actionType, setActionType] = useState<ActionType>("embargo");
  const [severity, setSeverity] = useState<Severity>("moderate");
  const [reason, setReason] = useState("");

  // Get countries for target selection
  const { data: relationships } = api.diplomatic.getRelationships.useQuery(
    { countryId },
    { enabled: open }
  );

  // Preview impact when target + action are selected
  const { data: preview, isFetching: previewLoading } =
    api.diplomatic.previewForeignPolicyImpact.useQuery(
      {
        initiatorId: countryId,
        targetId,
        actionType,
        severity,
      },
      { enabled: !!targetId && open }
    );

  const proposeMutation = api.diplomatic.proposeForeignPolicyAction.useMutation({
    onSuccess: () => {
      setOpen(false);
      setTargetId("");
      setActionType("embargo");
      setSeverity("moderate");
      setReason("");
      onSuccess?.();
    },
  });

  const selectedAction = ACTION_OPTIONS.find((a) => a.value === actionType);

  // Deduplicate target countries from relationships
  const targetCountries = relationships
    ? [
        ...new Map(
          relationships.map((r) => {
            const id = r.targetCountryId;
            return [id, { id, name: r.targetCountry ?? id }];
          })
        ).values(),
      ]
    : [];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-gradient-to-r from-cyan-500 to-blue-500 text-white">
          Propose Foreign Policy Action
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Propose Foreign Policy Action</DialogTitle>
          <DialogDescription>
            Enact diplomatic, trade, or military policy against or with another nation.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Action type */}
          <div>
            <Label>Action Type</Label>
            <Select value={actionType} onValueChange={(v) => setActionType(v as ActionType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ACTION_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    <div className="flex items-center gap-2">
                      <opt.icon className="h-4 w-4" />
                      <span>{opt.label}</span>
                      {opt.hostile && (
                        <Badge variant="destructive" className="px-1 py-0 text-[10px]">
                          Hostile
                        </Badge>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedAction && (
              <p className="text-muted-foreground mt-1 text-xs">{selectedAction.description}</p>
            )}
          </div>

          {/* Target country */}
          <div>
            <Label>Target Nation</Label>
            <Select value={targetId} onValueChange={setTargetId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a country..." />
              </SelectTrigger>
              <SelectContent>
                {targetCountries.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Severity */}
          <div>
            <Label>Severity</Label>
            <Select value={severity} onValueChange={(v) => setSeverity(v as Severity)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="light">Light — Minimal impact</SelectItem>
                <SelectItem value="moderate">Moderate — Standard impact</SelectItem>
                <SelectItem value="severe">Severe — Maximum impact</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Reason */}
          <div>
            <Label>Reason (optional)</Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explain the rationale for this action..."
              rows={2}
            />
          </div>

          {/* Impact preview */}
          {targetId && (
            <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-4">
              <h4 className="mb-2 text-sm font-semibold">Impact Preview</h4>
              {previewLoading ? (
                <div className="text-muted-foreground flex items-center gap-2 text-sm">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Calculating impact...
                </div>
              ) : preview ? (
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground mb-1 text-xs">Your economy</p>
                    <div
                      className={`flex items-center gap-1 font-medium ${
                        Number(preview.initiator.gdpImpact) < 0 ? "text-red-500" : "text-green-500"
                      }`}
                    >
                      {Number(preview.initiator.gdpImpact) < 0 ? (
                        <ArrowDownRight className="h-3 w-3" />
                      ) : (
                        <ArrowUpRight className="h-3 w-3" />
                      )}
                      {preview.initiator.gdpImpactPercent}% GDP
                    </div>
                    <p className="text-muted-foreground text-[10px]">
                      Trade exposure: {preview.initiator.tradeExposure}%
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-1 text-xs">
                      {preview.target.name}&apos;s economy
                    </p>
                    <div
                      className={`flex items-center gap-1 font-medium ${
                        Number(preview.target.gdpImpact) < 0 ? "text-red-500" : "text-green-500"
                      }`}
                    >
                      {Number(preview.target.gdpImpact) < 0 ? (
                        <ArrowDownRight className="h-3 w-3" />
                      ) : (
                        <ArrowUpRight className="h-3 w-3" />
                      )}
                      {preview.target.gdpImpactPercent}% GDP
                    </div>
                    <p className="text-muted-foreground text-[10px]">
                      Trade exposure: {preview.target.tradeExposure}%
                    </p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-muted-foreground text-xs">
                      Relationship change:{" "}
                      <span
                        className={
                          preview.relationshipDelta < 0 ? "text-red-500" : "text-green-500"
                        }
                      >
                        {preview.relationshipDelta > 0 ? "+" : ""}
                        {preview.relationshipDelta} points
                      </span>
                    </p>
                  </div>
                </div>
              ) : null}
            </div>
          )}

          {/* Error display */}
          {proposeMutation.error && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-500">
              {proposeMutation.error.message}
            </div>
          )}

          {/* Submit */}
          <Button
            onClick={() =>
              proposeMutation.mutate({
                targetId,
                actionType,
                severity,
                reason: reason || undefined,
              })
            }
            disabled={!targetId || proposeMutation.isPending}
            className="w-full"
          >
            {proposeMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Enacting...
              </>
            ) : (
              `Enact ${selectedAction?.label ?? "Policy"}`
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
