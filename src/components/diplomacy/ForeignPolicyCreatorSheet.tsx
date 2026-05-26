"use client";

import { useState } from "react";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { useLocalActions } from "~/hooks/useLocalActions";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "~/components/ui/sheet";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Textarea } from "~/components/ui/textarea";
import { Label } from "~/components/ui/label";
import { Separator } from "~/components/ui/separator";
import { UnifiedCountryFlag } from "~/components/UnifiedCountryFlag";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  Scale,
  Ban,
  AlertTriangle,
  HandshakeIcon,
  Shield,
  ShipWheel,
  ArrowDownRight,
  ArrowUpRight,
  Loader2,
} from "lucide-react";

interface ForeignPolicyCreatorSheetProps {
  countryId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
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

export function ForeignPolicyCreatorSheet({
  countryId,
  open,
  onOpenChange,
  onCreated,
}: ForeignPolicyCreatorSheetProps) {
  const notify = useNotify();
  const [targetId, setTargetId] = useState("");
  const [actionType, setActionType] = useState<ActionType>("embargo");
  const [severity, setSeverity] = useState<Severity>("moderate");
  const [reason, setReason] = useState("");
  const { saveAction } = useLocalActions(countryId);

  const { data: relationships } = api.diplomaticCore.getRelationships.useQuery(
    { countryId },
    { enabled: open }
  );

  const { data: preview, isFetching: previewLoading } =
    api.diplomaticPolicies.previewForeignPolicyImpact.useQuery(
      { initiatorId: countryId, targetId, actionType, severity },
      { enabled: !!targetId && open }
    );

  const selectedAction = ACTION_OPTIONS.find((a) => a.value === actionType);

  const targetCountries = relationships
    ? [
        ...new Map(
          relationships.map((r) => {
            const id = r.targetCountryId;
            return [id, { id, name: r.targetCountryName ?? id, flag: r.targetCountryFlag ?? null }];
          })
        ).values(),
      ]
    : [];

  const handleEnact = () => {
    const targetName = targetCountries.find((c) => c.id === targetId)?.name ?? targetId;
    saveAction("foreign_policy", {
      targetId,
      targetName,
      actionType,
      severity,
      reason: reason || undefined,
      previewEffects: preview ?? null,
    });
    notify.success("Policy enacted locally!");
    onOpenChange(false);
    resetForm();
    onCreated?.();
  };

  const resetForm = () => {
    setTargetId("");
    setActionType("embargo");
    setSeverity("moderate");
    setReason("");
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex flex-col p-0 sm:max-w-lg">
        <SheetHeader className="px-6 pt-6 pb-0">
          <SheetTitle className="flex items-center gap-2">
            <Scale className="h-5 w-5 shrink-0 text-cyan-500" />
            Propose Foreign Policy
          </SheetTitle>
          <p className="text-muted-foreground text-sm">
            Enact diplomatic, trade, or military policy against or with another nation.
          </p>
        </SheetHeader>

        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
          {/* Action Type */}
          <div>
            <Label className="mb-1.5 block text-xs font-medium">Action Type</Label>
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

          {/* Target */}
          <div>
            <Label className="mb-1.5 block text-xs font-medium">Target Nation</Label>
            <Select value={targetId} onValueChange={setTargetId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a country..." />
              </SelectTrigger>
              <SelectContent>
                {targetCountries.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    <span className="flex items-center gap-1.5">
                      <UnifiedCountryFlag
                        countryName={c.name}
                        flagUrl={c.flag}
                        size="xs"
                        showTooltip={false}
                      />
                      {c.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Severity */}
          <div>
            <Label className="mb-1.5 block text-xs font-medium">Severity</Label>
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
            <Label className="mb-1.5 block text-xs font-medium">Reason (optional)</Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explain the rationale for this action..."
              rows={2}
            />
          </div>

          {/* Impact Preview */}
          {targetId && (
            <>
              <Separator />
              <div>
                <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold">
                  <Scale className="h-3.5 w-3.5 text-cyan-500" />
                  Impact Preview
                </h4>
                {previewLoading ? (
                  <div className="text-muted-foreground flex items-center gap-2 py-3 text-sm">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Calculating impact...
                  </div>
                ) : preview ? (
                  <div className="border-border bg-muted/30 rounded-md border p-3">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground mb-1 text-xs">Your economy</p>
                        <div
                          className={`flex items-center gap-1 font-medium ${Number(preview.initiator.gdpImpact) < 0 ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"}`}
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
                          className={`flex items-center gap-1 font-medium ${Number(preview.target.gdpImpact) < 0 ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"}`}
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
                              preview.relationshipDelta < 0
                                ? "text-red-600 dark:text-red-400"
                                : "text-green-600 dark:text-green-400"
                            }
                          >
                            {preview.relationshipDelta > 0 ? "+" : ""}
                            {preview.relationshipDelta} points
                          </span>
                        </p>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            </>
          )}
        </div>

        <SheetFooter className="border-border/50 border-t px-6 py-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              onOpenChange(false);
              resetForm();
            }}
          >
            Cancel
          </Button>
          <Button size="sm" className="gap-1.5" onClick={handleEnact} disabled={!targetId}>
            Enact {selectedAction?.label ?? "Policy"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
