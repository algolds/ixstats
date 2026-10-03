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
import { api } from "~/trpc/react";
import { Card } from "~/components/ui/card";

interface PvPConflictPanelProps {
  countryId: string;
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

  const pendingForMe =
    conflicts?.filter((c) => c.defenderId === countryId && c.status === "proposed") ?? [];

  const activeConflicts =
    conflicts?.filter((c) => c.status === "active" || c.status === "proposed") ?? [];

  const resolvedConflicts = conflicts?.filter((c) => c.status === "resolved") ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-label text-headline flex items-center gap-2">
          <Swords aria-hidden="true" className="text-red h-4 w-4" />
          Military conflicts
        </h3>
        <div className="flex gap-2">
          {/* PvNPC quick action */}
          <Dialog open={strikeOpen} onOpenChange={handleStrikeOpenChange}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                PvNPC strike
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>PvNPC military strike</DialogTitle>
                <DialogDescription>
                  Automatically resolve a military engagement against an NPC nation. Outcome is
                  calculated based on relative military strength.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Target NPC nation</Label>
                  <Select value={targetId} onValueChange={setTargetId}>
                    <SelectTrigger>
                      <SelectValue
                        placeholder={
                          npcTargets?.length === 0
                            ? "No NPC nations among your relations"
                            : "Select target..."
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {(npcTargets ?? []).map((c) => (
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
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Casus belli..."
                    rows={2}
                  />
                </div>
                {npcTargetsQuery.error && (
                  <div role="alert" className="text-destructive text-body">
                    {npcTargetsQuery.error.message}
                  </div>
                )}
                {npcTargets?.length === 0 && (
                  <p className="text-label-secondary text-footnote">
                    Strikes target NPC (unclaimed) nations you have diplomatic relations with. Open
                    relations with one under Diplomacy first.
                  </p>
                )}
                {resolvePvNPCMutation.error && (
                  <div role="alert" className="text-destructive text-body">
                    {resolvePvNPCMutation.error.message}
                  </div>
                )}
                <Button
                  onClick={() =>
                    resolvePvNPCMutation.mutate({
                      targetCountryId: targetId,
                      reason: reason || undefined,
                    })
                  }
                  disabled={!targetId || resolvePvNPCMutation.isPending}
                  className="w-full"
                >
                  {resolvePvNPCMutation.isPending ? "Engaging…" : "Engage"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* PvP challenge */}
          <Dialog open={challengeOpen} onOpenChange={setChallengeOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                PvP challenge
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Challenge player nation</DialogTitle>
                <DialogDescription>
                  Both sides must agree to rules before combat begins. This prevents metagaming.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Target nation</Label>
                  <Select value={targetId} onValueChange={setTargetId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select target..." />
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
                <div>
                  <Label>Reason</Label>
                  <Textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Explain the conflict..."
                    rows={2}
                  />
                </div>
                {proposeMutation.error && (
                  <div role="alert" className="text-destructive text-body">
                    {proposeMutation.error.message}
                  </div>
                )}
                <Button
                  onClick={() =>
                    proposeMutation.mutate({
                      defenderId: targetId,
                      reason: reason || undefined,
                    })
                  }
                  disabled={!targetId || proposeMutation.isPending}
                  className="w-full"
                >
                  {proposeMutation.isPending ? "Sending…" : "Send Challenge"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
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

      {/* Pending challenges that need response */}
      {pendingForMe.length > 0 && (
        <div className="space-y-2">
          <Eyebrow className="block">Incoming challenges</Eyebrow>
          {pendingForMe.map((c) => (
            <Card variant="inset" key={c.id} className="border-yellow/40 border p-3">
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
                  <Button
                    size="sm"
                    onClick={() => respondMutation.mutate({ conflictId: c.id, accept: true })}
                    disabled={respondMutation.isPending}
                  >
                    <Check className="mr-1 h-3 w-3" /> Accept
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => respondMutation.mutate({ conflictId: c.id, accept: false })}
                    disabled={respondMutation.isPending}
                  >
                    <X className="mr-1 h-3 w-3" /> Decline
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Active conflicts */}
      {activeConflicts.length > 0 && (
        <div className="space-y-2">
          <Eyebrow className="block">Active conflicts</Eyebrow>
          {activeConflicts
            .filter((c) => !pendingForMe.some((p) => p.id === c.id))
            .map((c) => {
              const isInitiator = c.initiatorId === countryId;
              const opponent = isInitiator ? c.defender : c.initiator;
              return (
                <Card variant="inset" key={c.id} className="text-body p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Swords aria-hidden="true" className="text-red h-3.5 w-3.5" />
                    <span>
                      vs <span className="font-medium">{opponent?.name ?? "Unknown"}</span>
                    </span>
                    <Badge variant="outline">{c.type.toUpperCase()}</Badge>
                    <Badge variant="outline" className="capitalize">
                      {c.status}
                    </Badge>
                  </div>
                </Card>
              );
            })}
        </div>
      )}

      {/* Resolved conflicts */}
      {resolvedConflicts.length > 0 && (
        <div className="space-y-2">
          <Eyebrow className="block">Past conflicts</Eyebrow>
          {resolvedConflicts.slice(0, 3).map((c) => {
            const isInitiator = c.initiatorId === countryId;
            const opponent = isInitiator ? c.defender : c.initiator;
            const won = c.winner === countryId;
            const draw = c.winner === "draw" || c.winner === "declined";

            return (
              <div key={c.id} className="border-separator rounded-control text-body border p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {draw ? (
                      <HandshakeIcon
                        aria-hidden="true"
                        className="text-label-secondary h-3.5 w-3.5"
                      />
                    ) : won ? (
                      <Trophy aria-hidden="true" className="text-green h-3.5 w-3.5" />
                    ) : (
                      <X aria-hidden="true" className="text-destructive h-3.5 w-3.5" />
                    )}
                    <span>vs {opponent?.name ?? "Unknown"}</span>
                    <Badge variant={draw ? "default" : won ? "success" : "destructive"}>
                      {draw
                        ? c.winner === "declined"
                          ? "Declined"
                          : "Draw"
                        : won
                          ? "Victory"
                          : "Defeat"}
                    </Badge>
                  </div>
                  {(c.initiatorCasualties > 0 || c.defenderCasualties > 0) && (
                    <span className="text-label-secondary text-footnote">
                      {isInitiator ? c.initiatorCasualties : c.defenderCasualties} casualties
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {(!conflicts || conflicts.length === 0) && (
        <p className="text-label-secondary text-footnote py-4 text-center">
          No conflict history. Challenge other nations or engage NPC targets.
        </p>
      )}
    </div>
  );
}
