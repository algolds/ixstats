"use client";

import React from "react";
import { api } from "~/trpc/react";
import { UnifiedCountryFlag } from "~/components/ui/UnifiedCountryFlag";
import { Badge } from "~/components/ui/badge";
import { Progress } from "~/components/ui/progress";
import {
  Globe,
  Calendar,
  Bank as Landmark,
  Activity,
  Community as Handshake,
  WarningCircle as AlertCircle,
  Sparks as Sparkles,
} from "iconoir-react";
import { useScrollToFocus } from "~/hooks/useScrollToFocus";
import { getStrengthLabel } from "~/lib/statecraft/diplo-intel";
import { useUser } from "~/context/auth-context";

interface DiplomaticRelationsListProps {
  countryId: string;
  /** When set, scroll to + highlight the relation with this target country id. */
  focusId?: string | null;
}

const STATUS_THEMES: Record<string, { badge: string; text: string; progress: string }> = {
  allied: {
    badge: "bg-emerald-500/15 text-emerald-500 border-emerald-500/20",
    text: "text-emerald-500",
    progress: "bg-emerald-500",
  },
  friendly: {
    badge: "bg-blue-500/15 text-blue-500 border-blue-500/20",
    text: "text-blue-500",
    progress: "bg-blue-500",
  },
  neutral: {
    badge: "bg-gray-500/15 text-gray-500 border-gray-500/20",
    text: "text-gray-500",
    progress: "bg-gray-500",
  },
  tense: {
    badge: "bg-amber-500/15 text-amber-500 border-amber-500/20",
    text: "text-amber-500",
    progress: "bg-amber-500",
  },
  hostile: {
    badge: "bg-red-500/15 text-red-500 border-red-500/20",
    text: "text-red-500",
    progress: "bg-red-500",
  },
};

export function DiplomaticRelationsList({ countryId, focusId }: DiplomaticRelationsListProps) {
  const { user } = useUser();
  const { data: userProfile } = api.users.getProfile.useQuery(undefined, { enabled: !!user?.id });
  const isOwner = userProfile?.countryId === countryId;

  const {
    data: relations,
    isLoading: isLoadingRelations,
    error,
  } = api.diplomaticCore.getRelationships.useQuery({ countryId }, { enabled: !!countryId });

  const { data: rawEmbassies, isLoading: isLoadingEmbassies } =
    api.diplomaticEmbassies.getEmbassies.useQuery({ countryId }, { enabled: !!countryId });

  const { data: alliances } = api.diplomaticPolicies.getAlliances.useQuery(
    { countryId },
    { enabled: !!countryId }
  );

  const utils = api.useUtils();
  const setGoalMutation = api.diplomaticCore.setDiplomaticGoal.useMutation({
    onSuccess: () => {
      void utils.diplomaticCore.getRelationships.invalidate();
    },
  });

  const allRelations = React.useMemo(() => {
    const list: any[] = [...(relations ?? [])];
    const seenIds = new Set<string>();
    list.forEach((r) => {
      if (r.targetCountryId) seenIds.add(r.targetCountryId.toLowerCase());
      if (r.targetCountry) seenIds.add(r.targetCountry.toLowerCase());
      if (r.targetCountryName) seenIds.add(r.targetCountryName.toLowerCase());
    });

    (rawEmbassies ?? []).forEach((e: any) => {
      const partnerId = e.guestCountryId === countryId ? e.hostCountryId : e.guestCountryId;
      const partnerName =
        e.country ?? (e.guestCountryId === countryId ? e.hostCountry : e.guestCountry) ?? "Partner Nation";
      const partnerFlag =
        e.countryFlag ?? (e.guestCountryId === countryId ? e.hostCountryFlag : e.guestCountryFlag);

      if (
        (partnerId && !seenIds.has(partnerId.toLowerCase())) ||
        (partnerName && !seenIds.has(partnerName.toLowerCase()))
      ) {
        if (partnerId) seenIds.add(partnerId.toLowerCase());
        if (partnerName) seenIds.add(partnerName.toLowerCase());

        list.push({
          id: `embassy-rel-${e.id}`,
          targetCountryId: partnerId,
          targetCountryName: partnerName,
          targetCountryFlag: partnerFlag,
          relationship: e.status === "ACTIVE" ? "FRIENDLY" : "NEUTRAL",
          strength: e.relationshipStrength ?? e.strength ?? 65,
          establishedAt: e.establishedAt,
          tradeVolume: e.tradeVolume ?? (e.economicBonus ? e.economicBonus * 1_000_000_000 : 0),
          goalSelf: null,
          goalTarget: null,
          isEmbassyDerived: true,
        });
      }
    });

    return list;
  }, [relations, rawEmbassies, countryId]);

  useScrollToFocus(focusId, [allRelations]);

  const handleGoalChange = (
    relationId: string,
    goal: "ALLY" | "COEXIST" | "HEGEMONY" | "RIVAL"
  ) => {
    if (relationId.startsWith("embassy-rel-")) return;
    setGoalMutation.mutate({ relationId, goal });
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatDate = (dateString: string | Date | undefined | null) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const isLoading = isLoadingRelations || isLoadingEmbassies;

  if (isLoading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <div className="flex flex-col items-center gap-2 text-center">
          <Activity className="h-8 w-8 animate-spin text-blue-500" />
          <p className="text-muted-foreground text-xs">Loading diplomatic relations...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[200px] items-center justify-center p-4">
        <div className="flex flex-col items-center gap-2 text-center text-red-500">
          <AlertCircle className="h-8 w-8" />
          <p className="text-sm font-semibold">Failed to load relations</p>
          <p className="text-muted-foreground text-xs">{error.message}</p>
        </div>
      </div>
    );
  }

  if (allRelations.length === 0) {
    return (
      <div className="border-border/40 bg-muted/20 flex min-h-[200px] flex-col items-center justify-center rounded-lg border border-dashed p-6 text-center">
        <Globe className="text-muted-foreground/40 mb-3 h-10 w-10" />
        <h4 className="text-sm font-semibold">No Diplomatic Relations</h4>
        <p className="text-muted-foreground mt-1 max-w-sm text-xs">
          You haven't established diplomatic relationships with other nations yet. Create an embassy
          to start building ties.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {allRelations.map((rel) => {
        const statusKey = (rel.relationship || "neutral").toLowerCase();
        const theme = STATUS_THEMES[statusKey] || STATUS_THEMES.neutral;
        const targetName = rel.targetCountryName || rel.targetCountry || "Unknown Nation";

        // Check if nation shares a Bloc / Alliance
        const sharedBloc = (alliances ?? []).find((a: any) =>
          a.members?.some(
            (m: any) =>
              m.country?.name?.toLowerCase() === targetName.toLowerCase() ||
              m.countryId === rel.targetCountryId
          )
        );

        return (
          <div
            key={rel.id}
            data-focus-id={rel.targetCountryId ?? rel.id}
            className="facet-hierarchy-child border-border/40 bg-card/40 flex flex-col justify-between rounded-xl border p-4 shadow-sm backdrop-blur-sm transition-all hover:scale-[1.01] hover:shadow-md"
          >
            {/* Header info */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className="border-border/30 shrink-0 overflow-hidden rounded border">
                  <UnifiedCountryFlag
                    countryName={targetName}
                    flagUrl={rel.targetCountryFlag || rel.flagUrl}
                    size="md"
                  />
                </div>
                <div className="min-w-0">
                  <h4 className="text-foreground truncate text-sm font-bold">
                    {targetName.replace(/_/g, " ")}
                  </h4>
                  <p className="text-muted-foreground text-[10px]">
                    Established: {formatDate(rel.establishedAt)}
                  </p>
                  {sharedBloc && (
                    <span className="inline-flex items-center gap-1 text-[9px] font-semibold text-cyan-400 mt-0.5" title={`Shares alliance membership in ${sharedBloc.name}`}>
                      <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
                      In Bloc ({sharedBloc.name})
                    </span>
                  )}
                </div>
              </div>

              <Badge
                variant="outline"
                className={`shrink-0 border text-[10px] font-semibold uppercase ${theme.badge}`}
              >
                {rel.relationship || "NEUTRAL"}
              </Badge>
            </div>

            {/* Strength indicator */}
            <div className="mt-4 space-y-1">
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-muted-foreground flex items-center gap-1 font-medium">
                  <Handshake className="h-3 w-3" />
                  Relation Strength
                </span>
                <span className={`font-bold ${theme.text}`}>{getStrengthLabel(rel.strength)}</span>
              </div>
              <Progress
                value={rel.strength}
                className="h-1.5"
                indicatorClassName={theme.progress}
              />
            </div>

            {/* Stance Selection & Partner Stance */}
            <div className="border-border/10 mt-3 grid grid-cols-2 gap-2 border-t pt-3 text-[10px]">
              <div className="flex flex-col gap-1">
                <span className="text-muted-foreground font-medium">Your Stance</span>
                {isOwner ? (
                  <select
                    value={rel.goalSelf || ""}
                    onChange={(e) => handleGoalChange(rel.id, e.target.value as any)}
                    disabled={setGoalMutation.isPending}
                    className="bg-background border-border/40 text-foreground rounded border px-1.5 py-0.5 text-[10px] focus:ring-1 focus:ring-blue-500 focus:outline-none"
                  >
                    <option value="">Choose Stance...</option>
                    <option value="ALLY">Ally (Alliance Pursuit)</option>
                    <option value="COEXIST">Coexist (Peaceful Coexistence)</option>
                    <option value="HEGEMONY">Hegemony (Soft Power/Influence)</option>
                    <option value="RIVAL">Rival (Direct Rivalry)</option>
                  </select>
                ) : (
                  <span className="font-bold">{rel.goalSelf || "Not Set"}</span>
                )}
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-muted-foreground font-medium">Their Stance</span>
                <Badge variant="outline" className="border-border/30 w-fit px-1 py-0 text-[9px]">
                  {rel.goalTarget || "NOT DECLARED"}
                </Badge>
              </div>
            </div>

            {/* Synergy & Conflict Badges */}
            {rel.goalSelf === "ALLY" && rel.goalTarget === "ALLY" && (
              <div className="mt-2 flex items-center gap-1 rounded border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 text-[9px] font-semibold text-emerald-600">
                <Sparkles className="h-3 w-3 text-emerald-500" />
                Goals aligned! Reaching Allied status significantly faster.
              </div>
            )}
            {rel.goalSelf && rel.goalTarget && rel.goalSelf !== rel.goalTarget && (
              <div className="mt-2 flex items-center gap-1 rounded border border-red-500/20 bg-red-500/10 px-2 py-1 text-[9px] font-semibold text-red-600">
                <AlertCircle className="h-3 w-3 text-red-500" />
                Stance conflict: Relations degradation expected.
              </div>
            )}

            {/* Recent Activity / Pain Points */}
            {(rel as any).recentActivity && (
              <div className="bg-muted/40 border-border/20 text-muted-foreground mt-2 rounded border px-2 py-1 text-[9px] italic">
                Status: {(rel as any).recentActivity}
              </div>
            )}

            {/* Details Grid */}
            <div className="border-border/10 mt-4 grid grid-cols-2 gap-2 border-t pt-3 text-[10px]">
              <div className="flex flex-col gap-0.5">
                <span className="text-muted-foreground flex items-center gap-1 font-medium">
                  <Landmark className="h-3 w-3 shrink-0 text-cyan-500" />
                  Bilateral Trade
                </span>
                <span className="text-foreground font-bold">
                  {rel.tradeVolume ? formatCurrency(rel.tradeVolume) : "$0"}
                </span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-muted-foreground flex items-center gap-1 font-medium">
                  <Calendar className="h-3 w-3 shrink-0 text-amber-500" />
                  Last Contact
                </span>
                <span className="text-foreground font-bold">{formatDate(rel.lastContact)}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
