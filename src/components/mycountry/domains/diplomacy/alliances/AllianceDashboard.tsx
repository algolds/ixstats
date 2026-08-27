"use client";

import { useState } from "react";
import {
  Group as Users,
  Page as FileText,
  CheckSquare as Vote,
  Crown,
  Eye,
  UserPlus,
  LogOut,
  SystemRestart as Loader2,
} from "iconoir-react";
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
import { api } from "~/trpc/react";
import { CollectiveActionsPanel } from "./CollectiveActionsPanel";

interface AllianceDashboardProps {
  allianceId: string;
  countryId: string;
  myRole: string;
  onLeave?: () => void;
}

const ROLE_BADGES: Record<string, { color: string; label: string }> = {
  founder: { color: "bg-yellow-500/20 text-yellow-500", label: "Founder" },
  leader: { color: "bg-blue-500/20 text-blue-500", label: "Leader" },
  member: { color: "bg-green-500/20 text-green-500", label: "Member" },
  observer: { color: "bg-gray-500/20 text-gray-500", label: "Observer" },
};

export function AllianceDashboard({
  allianceId,
  countryId,
  myRole,
  onLeave,
}: AllianceDashboardProps) {
  const [inviteTarget, setInviteTarget] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);

  const { data: alliance, refetch } = api.diplomaticPolicies.getAllianceDashboard.useQuery(
    { allianceId },
    { enabled: !!allianceId }
  );

  const { data: relationships } = api.diplomaticCore.getRelationships.useQuery(
    { countryId },
    { enabled: inviteOpen }
  );

  const inviteMutation = api.diplomaticPolicies.inviteMember.useMutation({
    onSuccess: () => {
      setInviteOpen(false);
      setInviteTarget("");
      void refetch();
    },
  });

  const leaveMutation = api.diplomaticPolicies.leaveAlliance.useMutation({
    onSuccess: () => {
      onLeave?.();
    },
  });

  if (!alliance) return null;

  const canInvite = myRole === "founder" || myRole === "leader";
  const formatNumber = (n: number) => {
    if (n >= 1e12) return `$${(n / 1e12).toFixed(1)}T`;
    if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
    if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
    return n.toLocaleString();
  };

  const targetCountries = relationships
    ? [
        ...new Map(
          relationships
            .filter((r) => !alliance.members.some((m) => m.countryId === r.targetCountryId))
            .map((r) => [
              r.targetCountryId,
              { id: r.targetCountryId, name: r.targetCountry ?? r.targetCountryId },
            ])
        ).values(),
      ]
    : [];

  return (
    <div className="space-y-4 rounded-lg border border-cyan-500/20 p-4">
      {/* Alliance header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-lg text-sm font-bold text-white"
            style={{ backgroundColor: alliance.color }}
          >
            {alliance.shortName ?? alliance.name.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <h3 className="font-semibold">{alliance.name}</h3>
            <div className="text-muted-foreground flex items-center gap-2 text-xs">
              <Badge variant="outline" className="text-[10px]">
                {alliance.type}
              </Badge>
              <Badge variant="outline" className="text-[10px]">
                {alliance.visibility}
              </Badge>
              <span>{alliance.memberCount} members</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {canInvite && (
            <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <UserPlus className="mr-1 h-3 w-3" />
                  Invite
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Invite Nation</DialogTitle>
                  <DialogDescription>Invite a country to join {alliance.name}.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <Select value={inviteTarget} onValueChange={setInviteTarget}>
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
                  <Button
                    onClick={() =>
                      inviteMutation.mutate({ allianceId, targetCountryId: inviteTarget })
                    }
                    disabled={!inviteTarget || inviteMutation.isPending}
                    className="w-full"
                  >
                    {inviteMutation.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : null}
                    Send Invitation
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}

          <Button
            variant="ghost"
            size="sm"
            className="text-red-500 hover:text-red-600"
            onClick={() => leaveMutation.mutate({ allianceId })}
            disabled={leaveMutation.isPending}
          >
            <LogOut className="mr-1 h-3 w-3" />
            Leave
          </Button>
        </div>
      </div>

      {alliance.description && (
        <p className="text-muted-foreground text-sm">{alliance.description}</p>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 text-center">
        <div className="rounded-lg border p-2">
          <p className="text-lg font-bold">{alliance.memberCount}</p>
          <p className="text-muted-foreground text-xs">Members</p>
        </div>
        <div className="rounded-lg border p-2">
          <p className="text-lg font-bold">{formatNumber(alliance.calculatedTotalGdp)}</p>
          <p className="text-muted-foreground text-xs">Combined GDP</p>
        </div>
        <div className="rounded-lg border p-2">
          <p className="text-lg font-bold">{formatNumber(alliance.calculatedTotalPopulation)}</p>
          <p className="text-muted-foreground text-xs">Total Pop.</p>
        </div>
      </div>

      {/* Members list */}
      <div>
        <h4 className="mb-2 flex items-center gap-1 text-sm font-semibold">
          <Users className="h-4 w-4" />
          Members
        </h4>
        <div className="space-y-1">
          {alliance.members.map((m) => {
            const roleBadge = ROLE_BADGES[m.role] ?? ROLE_BADGES.member!;
            return (
              <div key={m.id} className="flex items-center justify-between py-1 text-sm">
                <div className="flex items-center gap-2">
                  {m.role === "founder" && <Crown className="h-3 w-3 text-yellow-500" />}
                  {m.role === "observer" && <Eye className="h-3 w-3 text-gray-400" />}
                  <span className={m.countryId === countryId ? "font-medium" : ""}>
                    {m.country.name}
                  </span>
                </div>
                <Badge className={`text-[10px] ${roleBadge.color}`}>{roleBadge.label}</Badge>
              </div>
            );
          })}
        </div>
      </div>

      {/* Collective actions */}
      <CollectiveActionsPanel allianceId={allianceId} countryId={countryId} myRole={myRole} />

      {/* Quick stats */}
      <div className="text-muted-foreground flex items-center gap-4 text-xs">
        <span className="flex items-center gap-1">
          <Vote className="h-3 w-3" />
          {alliance.pendingActions} pending proposals
        </span>
        <span className="flex items-center gap-1">
          <FileText className="h-3 w-3" />
          {(alliance as any)._count?.documents ?? 0} documents
        </span>
      </div>
    </div>
  );
}
