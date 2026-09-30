"use client";

import React from "react";
import { api } from "~/trpc/react";
import { UnifiedCountryFlag } from "~/components/shared/flags/UnifiedCountryFlag";
import { Badge } from "~/components/ui/badge";
import { Progress } from "~/components/ui/progress";
import { Skeleton } from "~/components/ui/skeleton";
import { Eyebrow } from "~/components/ui/eyebrow";
import { FacetCard } from "~/components/ui/facet-container";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  Globe,
  Calendar,
  Bank as Landmark,
  Community as Handshake,
  WarningCircle as AlertCircle,
  CheckCircle,
} from "iconoir-react";
import { useScrollToFocus } from "~/hooks/useScrollToFocus";
import { getStrengthLabel } from "~/lib/statecraft/diplo-intel";
import { useUser } from "~/context/auth-context";
import { formatExactCurrency } from "~/lib/utils/format-utils";

interface DiplomaticRelationsListProps {
  countryId: string;
  /** When set, scroll to + highlight the relation with this target country id. */
  focusId?: string | null;
}

/** A diplomatic relation, or a relation derived from an embassy with no relation record. */
interface RelationRow {
  id: string;
  targetCountryId: string;
  targetCountry?: string;
  targetCountryName: string;
  targetCountryFlag: string | null;
  flagUrl?: string | null;
  relationship: string;
  strength: number;
  establishedAt?: string;
  lastContact?: string;
  tradeVolume: number;
  goalSelf?: string | null;
  goalTarget?: string | null;
  recentActivity?: string | null;
  isEmbassyDerived?: boolean;
}

const DIPLOMATIC_GOALS = ["ALLY", "COEXIST", "HEGEMONY", "RIVAL"] as const;
type DiplomaticGoal = (typeof DIPLOMATIC_GOALS)[number];
const isDiplomaticGoal = (value: string): value is DiplomaticGoal =>
  DIPLOMATIC_GOALS.some((goal) => goal === value);

/** Relationship status is semantic (success → destructive), so it keeps its status colour. */
const STATUS_THEMES: Record<string, { text: string; progress: string }> = {
  allied: { text: "text-emerald-500", progress: "bg-emerald-500" },
  friendly: { text: "text-foreground", progress: "bg-primary" },
  neutral: { text: "text-muted-foreground", progress: "bg-muted-foreground" },
  tense: { text: "text-amber-500", progress: "bg-amber-500" },
  hostile: { text: "text-destructive", progress: "bg-destructive" },
};

const STANCE_OPTIONS: ReadonlyArray<{ value: DiplomaticGoal; label: string }> = [
  { value: "ALLY", label: "Ally (Alliance Pursuit)" },
  { value: "COEXIST", label: "Coexist (Peaceful Coexistence)" },
  { value: "HEGEMONY", label: "Hegemony (Soft Power/Influence)" },
  { value: "RIVAL", label: "Rival (Direct Rivalry)" },
];

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
    const list: RelationRow[] = [...(relations ?? [])];
    const seenIds = new Set<string>();
    list.forEach((r) => {
      if (r.targetCountryId) seenIds.add(r.targetCountryId.toLowerCase());
      if (r.targetCountry) seenIds.add(r.targetCountry.toLowerCase());
      if (r.targetCountryName) seenIds.add(r.targetCountryName.toLowerCase());
    });

    (rawEmbassies ?? []).forEach((e) => {
      const partnerId = e.guestCountryId === countryId ? e.hostCountryId : e.guestCountryId;
      const partnerName = e.country;
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
          strength: e.strength,
          establishedAt: e.establishedAt,
          tradeVolume: 0,
          goalSelf: null,
          goalTarget: null,
          isEmbassyDerived: true,
        });
      }
    });

    return list;
  }, [relations, rawEmbassies, countryId]);

  useScrollToFocus(focusId, [allRelations]);

  const handleGoalChange = (relationId: string, goal: DiplomaticGoal) => {
    if (relationId.startsWith("embassy-rel-")) return;
    setGoalMutation.mutate({ relationId, goal });
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
      <div
        className="grid grid-cols-1 gap-3 md:grid-cols-2"
        role="status"
        aria-label="Loading diplomatic relations"
      >
        <Skeleton className="h-56 rounded-2xl" />
        <Skeleton className="h-56 rounded-2xl" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[200px] items-center justify-center p-4">
        <div className="text-destructive flex flex-col items-center gap-2 text-center">
          <AlertCircle className="h-8 w-8" />
          <p className="text-sm font-semibold">Failed to load relations</p>
          <p className="text-muted-foreground text-xs">{error.message}</p>
        </div>
      </div>
    );
  }

  if (allRelations.length === 0) {
    return (
      <FacetCard
        depth={1}
        className="flex min-h-[200px] flex-col items-center justify-center rounded-2xl p-6 text-center"
      >
        <Globe className="text-muted-foreground mb-3 h-6 w-6" />
        <h4 className="text-foreground text-sm font-semibold">No diplomatic relations</h4>
        <p className="text-muted-foreground mt-1 max-w-sm text-xs">
          You haven't established diplomatic relationships with other nations yet. Create an embassy
          to start building ties.
        </p>
      </FacetCard>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {allRelations.map((rel) => {
        const statusKey = (rel.relationship || "neutral").toLowerCase();
        const theme = STATUS_THEMES[statusKey] || STATUS_THEMES.neutral;
        const targetName = rel.targetCountryName || rel.targetCountry || "Unknown Nation";

        // Check if nation shares a Bloc / Alliance
        const sharedBloc = (alliances ?? []).find((a) =>
          a.members?.some(
            (m) =>
              m.country?.name?.toLowerCase() === targetName.toLowerCase() ||
              m.countryId === rel.targetCountryId
          )
        );

        return (
          <FacetCard
            key={rel.id}
            depth={2}
            data-focus-id={rel.targetCountryId ?? rel.id}
            className="flex flex-col justify-between rounded-2xl p-4"
          >
            {/* Header info */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className="border-border shrink-0 overflow-hidden rounded border">
                  <UnifiedCountryFlag
                    countryName={targetName}
                    flagUrl={rel.targetCountryFlag || rel.flagUrl}
                    size="md"
                  />
                </div>
                <div className="min-w-0">
                  <h4 className="text-foreground truncate text-sm font-semibold">
                    {targetName.replace(/_/g, " ")}
                  </h4>
                  <p className="text-muted-foreground text-xs">
                    Established: {formatDate(rel.establishedAt)}
                  </p>
                  {sharedBloc && (
                    <Badge
                      variant="outline"
                      className="mt-1"
                      title={`Shares alliance membership in ${sharedBloc.name}`}
                    >
                      In bloc · {sharedBloc.name}
                    </Badge>
                  )}
                </div>
              </div>

              <Badge variant="outline" className={`shrink-0 capitalize ${theme.text}`}>
                {(rel.relationship || "neutral").toLowerCase()}
              </Badge>
            </div>

            {/* Strength indicator */}
            <div className="mt-4 space-y-1">
              <div className="flex items-center justify-between text-xs">
                <Eyebrow className="flex items-center gap-1">
                  <Handshake className="h-3 w-3" />
                  Relation strength
                </Eyebrow>
                <span className={`font-semibold ${theme.text}`}>
                  {getStrengthLabel(rel.strength)}
                </span>
              </div>
              <Progress
                value={rel.strength}
                className="h-1.5"
                indicatorClassName={theme.progress}
              />
            </div>

            {/* Stance Selection & Partner Stance */}
            <div className="border-border mt-3 grid grid-cols-2 gap-2 border-t pt-3 text-xs">
              <div className="flex min-w-0 flex-col gap-1">
                <Eyebrow>Your stance</Eyebrow>
                {isOwner ? (
                  <Select
                    value={rel.goalSelf || undefined}
                    onValueChange={(goal) => {
                      if (isDiplomaticGoal(goal)) handleGoalChange(rel.id, goal);
                    }}
                    disabled={setGoalMutation.isPending}
                  >
                    <SelectTrigger size="sm" className="w-full text-xs" aria-label="Your stance">
                      <SelectValue placeholder="Choose stance…" />
                    </SelectTrigger>
                    <SelectContent>
                      {STANCE_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <span className="text-foreground font-semibold">{rel.goalSelf || "Not set"}</span>
                )}
              </div>
              <div className="flex flex-col gap-1">
                <Eyebrow>Their stance</Eyebrow>
                <Badge variant="outline" className="w-fit">
                  {rel.goalTarget || "Not declared"}
                </Badge>
              </div>
            </div>

            {/* Synergy & Conflict Badges */}
            {rel.goalSelf === "ALLY" && rel.goalTarget === "ALLY" && (
              <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-emerald-500">
                <CheckCircle className="h-3.5 w-3.5 shrink-0" />
                Goals aligned: reaching Allied status significantly faster.
              </p>
            )}
            {rel.goalSelf && rel.goalTarget && rel.goalSelf !== rel.goalTarget && (
              <p className="text-destructive mt-2 flex items-center gap-1.5 text-xs font-medium">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                Stance conflict: relations degradation expected.
              </p>
            )}

            {/* Recent Activity / Pain Points */}
            {rel.recentActivity && (
              <p className="text-muted-foreground mt-2 text-xs italic">
                Status: {rel.recentActivity}
              </p>
            )}

            {/* Details Grid */}
            <div className="border-border mt-4 grid grid-cols-2 gap-2 border-t pt-3 text-xs">
              <div className="flex flex-col gap-0.5">
                <Eyebrow className="flex items-center gap-1">
                  <Landmark className="h-3 w-3 shrink-0" />
                  Bilateral trade
                </Eyebrow>
                <span className="text-foreground font-semibold tabular-nums">
                  {rel.tradeVolume ? formatExactCurrency(rel.tradeVolume) : "$0"}
                </span>
              </div>
              <div className="flex flex-col gap-0.5">
                <Eyebrow className="flex items-center gap-1">
                  <Calendar className="h-3 w-3 shrink-0" />
                  Last contact
                </Eyebrow>
                <span className="text-foreground font-semibold">{formatDate(rel.lastContact)}</span>
              </div>
            </div>
          </FacetCard>
        );
      })}
    </div>
  );
}
