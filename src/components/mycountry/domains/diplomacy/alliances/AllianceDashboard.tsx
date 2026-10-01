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
} from "iconoir-react";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Eyebrow } from "~/components/ui/eyebrow";
import { FacetCard } from "~/components/ui/facet-container";
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
import { formatCurrency, formatNumber } from "~/lib/utils/format-utils";
import { CollectiveActionsPanel } from "./CollectiveActionsPanel";

interface AllianceDashboardProps {
  allianceId: string;
  countryId: string;
  myRole: string;
  onLeave?: () => void;
}

const ROLE_BADGES: Record<string, { variant: "default" | "secondary" | "outline"; label: string }> =
  {
    founder: { variant: "default", label: "Founder" },
    leader: { variant: "secondary", label: "Leader" },
    member: { variant: "outline", label: "Member" },
    observer: { variant: "outline", label: "Observer" },
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

  const utils = api.useUtils();
  const inviteMutation = api.diplomaticPolicies.inviteMember.useMutation({
    onSuccess: () => {
      setInviteOpen(false);
      setInviteTarget("");
      void refetch();
      void utils.diplomaticPolicies.getOutgoingAllianceInvites.invalidate();
    },
  });

  const leaveMutation = api.diplomaticPolicies.leaveAlliance.useMutation({
    onSuccess: () => {
      onLeave?.();
    },
  });

  if (!alliance) return null;

  const canInvite = myRole === "founder" || myRole === "leader";
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
    <FacetCard className="rounded-card space-y-4 p-4">
      {/* Alliance header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div
            className="rounded-control text-headline flex h-10 w-10 shrink-0 items-center justify-center text-white"
            // The alliance's own chosen colour (user data), so it is applied inline.
            style={{ backgroundColor: alliance.color }}
          >
            {alliance.shortName ?? alliance.name.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <h3 className="text-label text-title-3 truncate">{alliance.name}</h3>
            <div className="text-label-secondary text-footnote flex items-center gap-2">
              <Badge variant="outline">{alliance.type}</Badge>
              <Badge variant="outline">{alliance.visibility}</Badge>
              <span>{alliance.memberCount} members</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {canInvite && (
            <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <UserPlus className="h-3.5 w-3.5" />
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
                    {inviteMutation.isPending ? "Sending…" : "Send Invitation"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}

          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={() => leaveMutation.mutate({ allianceId })}
            disabled={leaveMutation.isPending}
          >
            <LogOut className="h-3.5 w-3.5" />
            Leave
          </Button>
        </div>
      </div>

      {alliance.description && (
        <p className="text-label-secondary text-body">{alliance.description}</p>
      )}

      {/* Stats */}
      <dl className="grid grid-cols-3 gap-3 text-center">
        {[
          { label: "Members", value: String(alliance.memberCount) },
          { label: "Combined GDP", value: formatCurrency(alliance.calculatedTotalGdp) },
          { label: "Total pop.", value: formatNumber(alliance.calculatedTotalPopulation) },
        ].map((stat) => (
          <div key={stat.label} className="bg-fill-3 rounded-row p-2">
            <dd className="text-label text-title-3 tabular-nums">{stat.value}</dd>
            <dt>
              <Eyebrow>{stat.label}</Eyebrow>
            </dt>
          </div>
        ))}
      </dl>

      {/* Members list */}
      <div>
        <h4 className="text-label text-headline mb-2 flex items-center gap-2">
          <Users className="text-label-secondary h-4 w-4" />
          Members
        </h4>
        <div className="space-y-1">
          {alliance.members.map((m) => {
            const roleBadge = ROLE_BADGES[m.role] ?? ROLE_BADGES.member!;
            return (
              <div key={m.id} className="text-body flex items-center justify-between py-1">
                <div className="flex items-center gap-2">
                  {m.role === "founder" && <Crown className="text-yellow h-3 w-3" />}
                  {m.role === "observer" && <Eye className="text-label-secondary h-3 w-3" />}
                  <span className={m.countryId === countryId ? "font-medium" : ""}>
                    {m.country.name}
                  </span>
                </div>
                <Badge variant={roleBadge.variant}>{roleBadge.label}</Badge>
              </div>
            );
          })}
        </div>
      </div>

      {/* Collective actions */}
      <CollectiveActionsPanel allianceId={allianceId} countryId={countryId} myRole={myRole} />

      {/* Quick stats */}
      <div className="text-label-secondary text-footnote flex items-center gap-4">
        <span className="flex items-center gap-1">
          <Vote className="h-3 w-3" />
          {alliance.pendingActions} pending proposals
        </span>
        <span className="flex items-center gap-1">
          <FileText className="h-3 w-3" />
          {alliance.documents.length} documents
        </span>
      </div>
    </FacetCard>
  );
}
