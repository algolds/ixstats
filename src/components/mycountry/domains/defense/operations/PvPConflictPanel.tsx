"use client";

import { useState } from "react";
import {
  Tournament as Swords,
  Check,
  Xmark as X,
  Trophy,
  Community as HandshakeIcon,
} from "iconoir-react";
import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Textarea } from "~/components/ui/textarea";
import { Label } from "~/components/ui/label";
import { Eyebrow } from "~/components/ui/eyebrow";
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
import { api, type RouterOutputs } from "~/trpc/react";
import { Card } from "~/components/ui/card";

interface PvPConflictPanelProps {
  countryId: string;
}

function Alert({ message }: { message?: string }) {
  return message ? (
    <div role="alert" className="text-destructive text-body">
      {message}
    </div>
  ) : null;
}

interface TargetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger: string;
  title: string;
  description: string;
  targetLabel: string;
  placeholder: string;
  reasonPlaceholder: string;
  options: { id: string; name: string }[];
  targetId: string;
  onTargetChange: (id: string) => void;
  reason: string;
  onReasonChange: (reason: string) => void;
  notices?: React.ReactNode;
  submitLabel: string;
  pendingLabel: string;
  pending: boolean;
  onSubmit: () => void;
}

function TargetDialog(p: TargetDialogProps) {
  return (
    <Dialog open={p.open} onOpenChange={p.onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          {p.trigger}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{p.title}</DialogTitle>
          <DialogDescription>{p.description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>{p.targetLabel}</Label>
            <Select value={p.targetId} onValueChange={p.onTargetChange}>
              <SelectTrigger>
                <SelectValue placeholder={p.placeholder} />
              </SelectTrigger>
              <SelectContent>
                {p.options.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Reason</Label>
            <Textarea
              value={p.reason}
              onChange={(e) => p.onReasonChange(e.target.value)}
              placeholder={p.reasonPlaceholder}
              rows={2}
            />
          </div>
          {p.notices}
          <Button onClick={p.onSubmit} disabled={!p.targetId || p.pending} className="w-full">
            {p.pending ? p.pendingLabel : p.submitLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

type Conflict = NonNullable<RouterOutputs["security"]["getConflicts"]>[number];

const opponentOf = (c: Conflict, countryId: string) =>
  c.initiatorId === countryId ? c.defender : c.initiator;

/** Result badge/icon for a resolved conflict from `countryId`'s point of view. */
function conflictOutcome(c: Conflict, countryId: string) {
  if (c.winner === "draw" || c.winner === "declined") {
    return {
      icon: <HandshakeIcon aria-hidden="true" className="text-label-secondary h-3.5 w-3.5" />,
      variant: "default" as const,
      label: c.winner === "declined" ? "Declined" : "Draw",
    };
  }
  return c.winner === countryId
    ? {
        icon: <Trophy aria-hidden="true" className="text-green h-3.5 w-3.5" />,
        variant: "success" as const,
        label: "Victory",
      }
    : {
        icon: <X aria-hidden="true" className="text-destructive h-3.5 w-3.5" />,
        variant: "destructive" as const,
        label: "Defeat",
      };
}

function ConflictGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Eyebrow className="block">{title}</Eyebrow>
      {children}
    </div>
  );
}

function PastConflictRow({ conflict: c, countryId }: { conflict: Conflict; countryId: string }) {
  const outcome = conflictOutcome(c, countryId);
  const casualties = c.initiatorId === countryId ? c.initiatorCasualties : c.defenderCasualties;
  return (
    <div className="border-separator rounded-control text-body border p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {outcome.icon}
          <span>vs {opponentOf(c, countryId)?.name ?? "Unknown"}</span>
          <Badge variant={outcome.variant}>{outcome.label}</Badge>
        </div>
        {(c.initiatorCasualties > 0 || c.defenderCasualties > 0) && (
          <span className="text-label-secondary text-footnote">{casualties} casualties</span>
        )}
      </div>
    </div>
  );
}

export function PvPConflictPanel({ countryId }: PvPConflictPanelProps) {
  const [challengeOpen, setChallengeOpen] = useState(false);
  const [strikeOpen, setStrikeOpen] = useState(false);
  const [targetId, setTargetId] = useState("");
  const [reason, setReason] = useState("");
  // Outcome of the last PvNPC strike, shown after the dialog closes.
  const [strikeResult, setStrikeResult] = useState<{ target: string; won: boolean } | null>(null);

  const { data: conflicts, refetch } = api.security.getConflicts.useQuery(
    { countryId },
    { enabled: !!countryId }
  );

  const { data: relationships } = api.diplomaticCore.getRelationships.useQuery(
    { countryId },
    { enabled: challengeOpen }
  );

  // Only unclaimed (NPC) related nations; resolvePvNPCConflict rejects player nations.
  const npcTargetsQuery = api.security.getPvNPCTargets.useQuery(undefined, {
    enabled: strikeOpen,
    retry: false,
  });
  const npcTargets = npcTargetsQuery.data;

  const proposeMutation = api.security.proposePvPConflict.useMutation({
    onSuccess: () => {
      setChallengeOpen(false);
      setTargetId("");
      setReason("");
      void refetch();
    },
  });

  const respondMutation = api.security.respondToConflict.useMutation({
    onSuccess: () => void refetch(),
  });

  const concludeMutation = api.security.concludePvPConflict.useMutation({
    onSuccess: () => void refetch(),
  });

  const resolvePvNPCMutation = api.security.resolvePvNPCConflict.useMutation({
    onSuccess: (conflict) => {
      setStrikeResult({
        target: conflict.defender?.name ?? "the target",
        won: conflict.winner === countryId,
      });
      setStrikeOpen(false);
      setTargetId("");
      setReason("");
      void refetch();
    },
  });

  const handleStrikeOpenChange = (open: boolean) => {
    setStrikeOpen(open);
    setTargetId("");
    if (open) resolvePvNPCMutation.reset();
  };

  const targetCountries = relationships
    ? [
        ...new Map(
          relationships.map((r) => [
            r.targetCountryId,
            { id: r.targetCountryId, name: r.targetCountry ?? r.targetCountryId },
          ])
        ).values(),
      ]
    : [];

  const allConflicts = conflicts ?? [];
  const pendingForMe = allConflicts.filter(
    (c) => c.defenderId === countryId && c.status === "proposed"
  );
  const activeConflicts = allConflicts.filter(
    (c) => c.status === "active" || c.status === "proposed"
  );
  const resolvedConflicts = allConflicts.filter((c) => c.status === "resolved");
  const noNpcTargets = npcTargets?.length === 0;

  // An active PvP conflict runs until `endsAt`; then either side may conclude it.
  const concludeControl = (conflict: Conflict) => {
    const endsAt = new Date(conflict.endsAt!);
    if (endsAt.getTime() > Date.now()) {
      return (
        <span className="text-label-secondary text-footnote">
          Ends {endsAt.toLocaleDateString()}
        </span>
      );
    }
    return (
      <Button
        size="sm"
        variant="outline"
        className="ml-auto"
        onClick={() => concludeMutation.mutate({ conflictId: conflict.id, countryId })}
        disabled={concludeMutation.isPending}
      >
        {concludeMutation.isPending ? "Resolving…" : "Resolve conflict"}
      </Button>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-label text-headline flex items-center gap-2">
          <Swords aria-hidden="true" className="text-red h-4 w-4" />
          Military conflicts
        </h3>
        <div className="flex gap-2">
          <TargetDialog
            open={strikeOpen}
            onOpenChange={handleStrikeOpenChange}
            trigger="PvNPC strike"
            title="PvNPC military strike"
            description="Automatically resolve a military engagement against an NPC nation. Outcome is calculated based on relative military strength."
            targetLabel="Target NPC nation"
            placeholder={noNpcTargets ? "No NPC nations among your relations" : "Select target..."}
            reasonPlaceholder="Casus belli..."
            options={npcTargets ?? []}
            targetId={targetId}
            onTargetChange={setTargetId}
            reason={reason}
            onReasonChange={setReason}
            notices={
              <>
                <Alert message={npcTargetsQuery.error?.message} />
                {noNpcTargets && (
                  <p className="text-label-secondary text-footnote">
                    Strikes target NPC (unclaimed) nations you have diplomatic relations with. Open
                    relations with one under Diplomacy first.
                  </p>
                )}
                <Alert message={resolvePvNPCMutation.error?.message} />
              </>
            }
            submitLabel="Engage"
            pendingLabel="Engaging…"
            pending={resolvePvNPCMutation.isPending}
            onSubmit={() =>
              resolvePvNPCMutation.mutate({
                targetCountryId: targetId,
                reason: reason || undefined,
              })
            }
          />
          <TargetDialog
            open={challengeOpen}
            onOpenChange={setChallengeOpen}
            trigger="PvP challenge"
            title="Challenge player nation"
            description="Both sides must agree to rules before combat begins. This prevents metagaming."
            targetLabel="Target nation"
            placeholder="Select target..."
            reasonPlaceholder="Explain the conflict..."
            options={targetCountries}
            targetId={targetId}
            onTargetChange={setTargetId}
            reason={reason}
            onReasonChange={setReason}
            notices={<Alert message={proposeMutation.error?.message} />}
            submitLabel="Send Challenge"
            pendingLabel="Sending…"
            pending={proposeMutation.isPending}
            onSubmit={() =>
              proposeMutation.mutate({ defenderId: targetId, reason: reason || undefined })
            }
          />
        </div>
      </div>

      {strikeResult && (
        <div
          role="status"
          className={cn(
            "rounded-control text-body border p-3",
            strikeResult.won
              ? "border-green/30 text-green"
              : "border-destructive/30 text-destructive"
          )}
        >
          {strikeResult.won
            ? `Victory: your strike on ${strikeResult.target} succeeded. Both economies take a hit; see Past Conflicts.`
            : `Defeat: the strike on ${strikeResult.target} was repelled. See Past Conflicts for casualties.`}
        </div>
      )}

      {pendingForMe.length > 0 && (
        <ConflictGroup title="Incoming challenges">
          {pendingForMe.map((c) => (
            <Card variant="well" key={c.id} className="border-yellow/40 border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="text-label text-body font-medium">
                    {c.initiator?.name ?? "Unknown"}
                  </span>
                  <span className="text-label-secondary text-footnote ml-2">challenges you</span>
                  {c.reason && (
                    <p className="text-label-secondary text-footnote mt-1">
                      &quot;{c.reason}&quot;
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  {[
                    { accept: true, label: "Accept", Icon: Check, variant: "default" },
                    { accept: false, label: "Decline", Icon: X, variant: "outline" },
                  ].map(({ accept, label, Icon, variant }) => (
                    <Button
                      key={label}
                      size="sm"
                      variant={variant as "default" | "outline"}
                      onClick={() => respondMutation.mutate({ conflictId: c.id, accept })}
                      disabled={respondMutation.isPending}
                    >
                      <Icon className="mr-1 h-3 w-3" /> {label}
                    </Button>
                  ))}
                </div>
              </div>
            </Card>
          ))}
        </ConflictGroup>
      )}

      <Alert message={concludeMutation.error?.message} />

      {activeConflicts.length > 0 && (
        <ConflictGroup title="Active conflicts">
          {activeConflicts
            .filter((c) => !pendingForMe.some((p) => p.id === c.id))
            .map((c) => (
              <Card variant="well" key={c.id} className="text-body p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Swords aria-hidden="true" className="text-red h-3.5 w-3.5" />
                  <span>
                    vs{" "}
                    <span className="font-medium">
                      {opponentOf(c, countryId)?.name ?? "Unknown"}
                    </span>
                  </span>
                  <Badge variant="outline">{c.type.toUpperCase()}</Badge>
                  <Badge variant="outline" className="capitalize">
                    {c.status}
                  </Badge>
                  {c.endsAt && concludeControl(c)}
                </div>
              </Card>
            ))}
        </ConflictGroup>
      )}

      {resolvedConflicts.length > 0 && (
        <ConflictGroup title="Past conflicts">
          {resolvedConflicts.slice(0, 3).map((c) => (
            <PastConflictRow key={c.id} conflict={c} countryId={countryId} />
          ))}
        </ConflictGroup>
      )}

      {allConflicts.length === 0 && (
        <p className="text-label-secondary text-footnote py-4 text-center">
          No conflict history. Challenge other nations or engage NPC targets.
        </p>
      )}
    </div>
  );
}
