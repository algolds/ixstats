// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
"use client";

import { useState } from "react";
import { Swords, Check, X, Loader2, Trophy, Skull, HandshakeIcon } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
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

interface PvPConflictPanelProps {
  countryId: string;
}

export function PvPConflictPanel({ countryId }: PvPConflictPanelProps) {
  const [challengeOpen, setChallengeOpen] = useState(false);
  const [targetId, setTargetId] = useState("");
  const [reason, setReason] = useState("");

  const { data: conflicts, refetch } = api.security.getConflicts.useQuery(
    { countryId },
    { enabled: !!countryId }
  );

  const { data: relationships } = api.diplomaticCore.getRelationships.useQuery(
    { countryId },
    { enabled: challengeOpen }
  );

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
    onSuccess: () => void refetch(),
  });

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
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Swords className="h-4 w-4" />
          Military Conflicts
        </h3>
        <div className="flex gap-2">
          {/* PvNPC quick action */}
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                PvNPC Strike
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>PvNPC Military Strike</DialogTitle>
                <DialogDescription>
                  Automatically resolve a military engagement against an NPC nation. Outcome is
                  calculated based on relative military strength.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Target NPC Nation</Label>
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
                    placeholder="Casus belli..."
                    rows={2}
                  />
                </div>
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
                  {resolvePvNPCMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  Engage
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* PvP challenge */}
          <Dialog open={challengeOpen} onOpenChange={setChallengeOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="border-red-500/50 text-red-500">
                PvP Challenge
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Challenge Player Nation</DialogTitle>
                <DialogDescription>
                  Both sides must agree to rules before combat begins. This prevents metagaming.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Target Nation</Label>
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
                  <div className="text-sm text-red-500">{proposeMutation.error.message}</div>
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
                  {proposeMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  Send Challenge
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Pending challenges that need response */}
      {pendingForMe.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-yellow-500">Incoming Challenges</h4>
          {pendingForMe.map((c) => (
            <div key={c.id} className="rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm font-medium">{c.initiator.name}</span>
                  <span className="text-muted-foreground ml-2 text-xs">challenges you</span>
                  {c.reason && (
                    <p className="text-muted-foreground mt-1 text-xs">&quot;{c.reason}&quot;</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-green-500/50 text-green-500"
                    onClick={() => respondMutation.mutate({ conflictId: c.id, accept: true })}
                    disabled={respondMutation.isPending}
                  >
                    <Check className="mr-1 h-3 w-3" /> Accept
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-red-500/50 text-red-500"
                    onClick={() => respondMutation.mutate({ conflictId: c.id, accept: false })}
                    disabled={respondMutation.isPending}
                  >
                    <X className="mr-1 h-3 w-3" /> Decline
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Active conflicts */}
      {activeConflicts.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-red-500">Active Conflicts</h4>
          {activeConflicts
            .filter((c) => !pendingForMe.some((p) => p.id === c.id))
            .map((c) => {
              const isInitiator = c.initiatorId === countryId;
              const opponent = isInitiator ? c.defender : c.initiator;
              return (
                <div key={c.id} className="rounded-lg border border-red-500/20 p-3 text-sm">
                  <div className="flex items-center gap-2">
                    <Swords className="h-3 w-3 text-red-500" />
                    <span>
                      vs <span className="font-medium">{opponent.name}</span>
                    </span>
                    <Badge variant="outline" className="text-[10px]">
                      {c.type.toUpperCase()}
                    </Badge>
                    <Badge variant="outline" className="text-[10px]">
                      {c.status}
                    </Badge>
                  </div>
                </div>
              );
            })}
        </div>
      )}

      {/* Resolved conflicts */}
      {resolvedConflicts.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-muted-foreground text-xs font-semibold">Past Conflicts</h4>
          {resolvedConflicts.slice(0, 3).map((c) => {
            const isInitiator = c.initiatorId === countryId;
            const opponent = isInitiator ? c.defender : c.initiator;
            const won = c.winner === countryId;
            const draw = c.winner === "draw" || c.winner === "declined";

            return (
              <div key={c.id} className="rounded-lg border p-3 text-sm opacity-70">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {draw ? (
                      <HandshakeIcon className="h-3 w-3 text-gray-500" />
                    ) : won ? (
                      <Trophy className="h-3 w-3 text-yellow-500" />
                    ) : (
                      <Skull className="h-3 w-3 text-red-500" />
                    )}
                    <span>vs {opponent.name}</span>
                    <Badge
                      variant="outline"
                      className={`text-[10px] ${
                        draw ? "text-gray-500" : won ? "text-green-500" : "text-red-500"
                      }`}
                    >
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
                    <span className="text-muted-foreground text-xs">
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
        <p className="text-muted-foreground py-4 text-center text-xs">
          No conflict history. Challenge other nations or engage NPC targets.
        </p>
      )}
    </div>
  );
}
