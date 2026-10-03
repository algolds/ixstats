"use client";

import React, { useMemo } from "react";
import {
  City as Building2,
  Community as Handshake,
  StatUp as TrendingUp,
  ScaleFrameEnlarge as Scale,
  Globe as Globe2,
  Group as Users,
} from "iconoir-react";
import { Badge } from "~/components/ui/badge";
import { Eyebrow } from "~/components/ui/eyebrow";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";
import { getStrengthLabel } from "~/lib/statecraft/diplo-intel";
import { UnifiedCountryFlag } from "~/components/shared/flags/UnifiedCountryFlag";
import {
  DomainKpiGrid,
  DomainActivityCard,
  RailBar,
  RailCard,
  RailCount,
  RailEmpty,
  RailRow,
  STATUS_TEXT,
  type Kpi,
  type ActivityEntry,
} from "./shared";

interface EmbassyItem {
  id: string;
  status?: string | null;
  country?: string | { name?: string } | null;
  countryFlag?: string | null;
  guestCountryId?: string | null;
  hostCountryId?: string | null;
  guestCountry?: string | { name?: string; flag?: string } | null;
  hostCountry?: string | { name?: string; flag?: string } | null;
  guestCountryFlag?: string | null;
  hostCountryFlag?: string | null;
  strength?: number | null;
  establishedAt?: string | Date | null;
  createdAt?: string | Date | null;
}

interface RelationshipItem {
  id: string;
  targetCountryId?: string | null;
  targetCountryName?: string | null;
  targetCountry?: string | { name?: string; flag?: string } | null;
  targetCountryFlag?: string | null;
  flagUrl?: string | null;
  strength?: number | null;
}

interface AllianceItem {
  id: string;
  name?: string | null;
  memberCount?: number | null;
  members?: Array<{ id: string }> | null;
  myRole?: string | null;
  createdAt?: string | Date | null;
}

interface ForeignPolicyItem {
  id: string;
  status?: string | null;
  actionType?: string | null;
  target?: { name?: string } | null;
  createdAt?: string | Date | null;
}

/** Diplomacy rail — embassies / relations / foreign-policy / alliances snapshot + recent diplomatic activity. */
export function RelationsRail({ countryId }: { countryId: string }) {
  const { data: embassiesRaw } = api.diplomaticEmbassies.getEmbassies.useQuery(
    { countryId },
    { enabled: !!countryId, staleTime: 30_000 }
  );
  const { data: relationsRaw } = api.diplomaticCore.getRelationships.useQuery(
    { countryId },
    { enabled: !!countryId, staleTime: 30_000 }
  );
  const { data: foreignPolicies } = api.diplomaticPolicies.getActiveForeignPolicies.useQuery(
    { countryId },
    { enabled: !!countryId, staleTime: 30_000 }
  );
  const { data: alliancesRaw } = api.diplomaticPolicies.getAlliances.useQuery(
    { countryId },
    { enabled: !!countryId, staleTime: 30_000 }
  );

  const embassies = useMemo(() => (embassiesRaw ?? []) as EmbassyItem[], [embassiesRaw]);
  const alliances = useMemo(() => (alliancesRaw ?? []) as AllianceItem[], [alliancesRaw]);

  const activeEmbassies = useMemo(
    () => embassies.filter((e) => e.status === "ACTIVE" || e.status === "active"),
    [embassies]
  );

  const liveRelations = useMemo(() => {
    const list: Array<{
      id: string;
      targetName: string;
      targetFlag: string | null;
      strength: number;
      stance: string;
    }> = [];
    const seenTargets = new Set<string>();

    // 1. Live diplomaticRelation rows from database query DTO
    ((relationsRaw ?? []) as RelationshipItem[]).forEach((r) => {
      const name =
        r.targetCountryName ??
        (typeof r.targetCountry === "object" ? r.targetCountry?.name : r.targetCountry) ??
        "Partner Nation";
      const flag =
        r.targetCountryFlag ??
        (typeof r.targetCountry === "object" ? r.targetCountry?.flag : null) ??
        r.flagUrl ??
        null;
      const targetId = r.targetCountryId ?? r.id;
      if (targetId) seenTargets.add(targetId);

      list.push({
        id: r.id,
        targetName: name,
        targetFlag: flag,
        strength: r.strength ?? 50,
        stance: getStrengthLabel(r.strength ?? 50),
      });
    });

    // 2. Active embassy partners as implicit bilateral relations if not already listed
    activeEmbassies.forEach((e) => {
      const partnerId = e.guestCountryId === countryId ? e.hostCountryId : e.guestCountryId;
      const partnerCountryObj = e.guestCountryId === countryId ? e.hostCountry : e.guestCountry;
      const partnerName =
        (typeof e.country === "string" ? e.country : e.country?.name) ??
        (typeof partnerCountryObj === "string" ? partnerCountryObj : partnerCountryObj?.name) ??
        "Partner Nation";
      const partnerFlag =
        e.countryFlag ?? (e.guestCountryId === countryId ? e.hostCountryFlag : e.guestCountryFlag);

      if (partnerId && !seenTargets.has(partnerId)) {
        seenTargets.add(partnerId);
        const strength = e.strength ?? 65;

        list.push({
          id: `embassy-rel-${e.id}`,
          targetName: partnerName,
          targetFlag: partnerFlag ?? null,
          strength,
          stance: getStrengthLabel(strength),
        });
      }
    });

    return list;
  }, [relationsRaw, activeEmbassies, countryId]);

  const kpis = useMemo<Kpi[]>(() => {
    return [
      { label: "Embassies", value: activeEmbassies.length },
      { label: "Relations", value: liveRelations.length },
      { label: "Alliances", value: alliances.length },
    ];
  }, [activeEmbassies, liveRelations, alliances]);

  const activity = useMemo<ActivityEntry[]>(() => {
    const entries: ActivityEntry[] = [];

    embassies.forEach((e) => {
      const hostName = typeof e.hostCountry === "object" ? e.hostCountry?.name : e.hostCountry;
      const guestName = typeof e.guestCountry === "object" ? e.guestCountry?.name : e.guestCountry;
      const countryObjName = typeof e.country === "object" ? e.country?.name : e.country;
      const resolvedName = countryObjName ?? guestName ?? hostName ?? "Partner Nation";

      entries.push({
        id: `embassy-${e.id}`,
        icon: Building2,
        iconColor: STATUS_TEXT.neutral,
        text: `Embassy with ${resolvedName}`,
        time: new Date(e.establishedAt ?? e.createdAt ?? Date.now()),
      });
    });

    liveRelations.forEach((r) => {
      const strength = r.strength ?? 0;
      entries.push({
        id: `relation-${r.id}`,
        icon: strength >= 70 ? TrendingUp : Handshake,
        iconColor: strength >= 70 ? STATUS_TEXT.success : STATUS_TEXT.neutral,
        text: `${r.targetName} — ${r.stance}`,
        time: new Date(),
      });
    });

    alliances.forEach((a) => {
      entries.push({
        id: `alliance-${a.id}`,
        icon: Users,
        iconColor: STATUS_TEXT.neutral,
        text: `Alliance: ${a.name ?? "Diplomatic Pact"} (${a.memberCount ?? a.members?.length ?? 1} members)`,
        time: new Date(a.createdAt ?? Date.now()),
      });
    });

    ((foreignPolicies ?? []) as ForeignPolicyItem[]).forEach((fp) => {
      if (fp.status === "active") {
        entries.push({
          id: `fp-${fp.id}`,
          icon: Scale,
          iconColor:
            fp.actionType === "free_trade" || fp.actionType === "military_alliance"
              ? STATUS_TEXT.success
              : STATUS_TEXT.critical,
          text: `${fp.actionType?.replace(/_/g, " ")} → ${fp.target?.name ?? "Partner"}`,
          time: new Date(fp.createdAt ?? Date.now()),
        });
      }
    });

    return entries.sort((a, b) => b.time.getTime() - a.time.getTime());
  }, [embassies, liveRelations, alliances, foreignPolicies]);

  return (
    <div className="space-y-6">
      {/* Diplomatic snapshot KPIs */}
      <RailCard title="Diplomatic snapshot" icon={Globe2}>
        <DomainKpiGrid items={kpis} />
      </RailCard>

      {/* Embassy and bilateral network */}
      <RailCard title="Embassies and bilateral ties" icon={Building2} contentClassName="space-y-3">
        {/* 1. Embassy network */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Eyebrow>Active embassies</Eyebrow>
            <span className="text-label-secondary text-footnote tabular-nums">
              {activeEmbassies.length} total
            </span>
          </div>
          {activeEmbassies.length === 0 ? (
            <RailEmpty>No active embassies established.</RailEmpty>
          ) : (
            activeEmbassies.slice(0, 3).map((emb) => {
              const partnerCountryObj =
                emb.guestCountryId === countryId ? emb.hostCountry : emb.guestCountry;
              const partnerName =
                (typeof emb.country === "string" ? emb.country : emb.country?.name) ??
                (typeof partnerCountryObj === "string"
                  ? partnerCountryObj
                  : partnerCountryObj?.name) ??
                "Partner Nation";

              const partnerFlag =
                emb.countryFlag ??
                (emb.guestCountryId === countryId ? emb.hostCountryFlag : emb.guestCountryFlag);

              return (
                <RailRow key={emb.id} className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <UnifiedCountryFlag
                      countryName={partnerName}
                      flagUrl={partnerFlag}
                      size="xs"
                      className="shrink-0"
                    />
                    <div className="min-w-0">
                      <p className="text-label truncate font-medium">{partnerName}</p>
                      <p className="text-label-secondary">
                        {emb.guestCountryId === countryId ? "Host embassy" : "Guest embassy"}
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline" className={cn("shrink-0", STATUS_TEXT.success)}>
                    Active
                  </Badge>
                </RailRow>
              );
            })
          )}
        </div>

        {/* 2. Bilateral relations */}
        <div className="border-separator space-y-2 border-t pt-3">
          <div className="flex items-center justify-between">
            <Eyebrow>Bilateral relationships</Eyebrow>
            <span className="text-label-secondary text-footnote tabular-nums">
              {liveRelations.length} partners
            </span>
          </div>
          {liveRelations.length === 0 ? (
            <RailEmpty>No diplomatic relationships recorded.</RailEmpty>
          ) : (
            liveRelations.slice(0, 4).map((rel) => (
              <RailRow key={rel.id} className="flex items-center gap-2">
                <UnifiedCountryFlag
                  countryName={rel.targetName}
                  flagUrl={rel.targetFlag}
                  size="xs"
                  className="shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-label truncate font-medium">{rel.targetName}</span>
                    <span className="text-label shrink-0 tabular-nums">{rel.strength}%</span>
                  </div>
                  <RailBar value={rel.strength} />
                </div>
                <span className="text-label-secondary shrink-0">{rel.stance}</span>
              </RailRow>
            ))
          )}
        </div>
      </RailCard>

      {/* Alliances and blocs */}
      <RailCard
        title="Alliances and blocs"
        icon={Users}
        accessory={<RailCount>{alliances.length}</RailCount>}
      >
        {alliances.length === 0 ? (
          <RailEmpty>Not a member of any diplomatic alliance.</RailEmpty>
        ) : (
          alliances.slice(0, 3).map((ally) => (
            <RailRow key={ally.id} className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-label truncate font-medium">{ally.name ?? "Defense Pact"}</p>
                <p className="text-label-secondary">
                  {ally.memberCount ?? ally.members?.length ?? 1} nations
                </p>
              </div>
              <Badge variant="default" className="shrink-0 capitalize">
                {ally.myRole ?? "Member"}
              </Badge>
            </RailRow>
          ))
        )}
      </RailCard>

      {/* Diplomatic activity log */}
      <DomainActivityCard
        domain="relations"
        title="Diplomatic activity"
        icon={Globe2}
        entries={activity}
        emptyMessage="No recent diplomatic activity"
      />
    </div>
  );
}
