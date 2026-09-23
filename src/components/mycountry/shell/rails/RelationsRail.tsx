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
import { FacetCard } from "~/components/ui/facet-container";
import { api } from "~/trpc/react";
import { getStrengthLabel } from "~/lib/statecraft/diplo-intel";
import { UnifiedCountryFlag } from "~/components/ui/UnifiedCountryFlag";
import { DomainKpiGrid, DomainActivityCard, type Kpi, type ActivityEntry } from "./shared";

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
        iconColor: "text-cyan-400",
        text: `Embassy with ${resolvedName}`,
        time: new Date(e.establishedAt ?? e.createdAt ?? Date.now()),
      });
    });

    liveRelations.forEach((r) => {
      const strength = r.strength ?? 0;
      entries.push({
        id: `relation-${r.id}`,
        icon: strength >= 70 ? TrendingUp : Handshake,
        iconColor: strength >= 70 ? "text-cyan-400" : "text-cyan-500/70",
        text: `${r.targetName} — ${r.stance}`,
        time: new Date(),
      });
    });

    alliances.forEach((a) => {
      entries.push({
        id: `alliance-${a.id}`,
        icon: Users,
        iconColor: "text-amber-400",
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
              ? "text-emerald-400"
              : "text-red-400",
          text: `${fp.actionType?.replace(/_/g, " ")} → ${fp.target?.name ?? "Partner"}`,
          time: new Date(fp.createdAt ?? Date.now()),
        });
      }
    });

    return entries.sort((a, b) => b.time.getTime() - a.time.getTime());
  }, [embassies, liveRelations, alliances, foreignPolicies]);

  return (
    <div className="space-y-4">
      {/* Diplomatic Snapshot Header KPIs */}
      <FacetCard depth={1} className="bg-card/30 p-4 backdrop-blur-md">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Globe2 className="h-3.5 w-3.5 text-cyan-500" />
            <h4 className="text-xs font-bold tracking-widest text-cyan-500 uppercase">
              Diplomatic Snapshot
            </h4>
          </div>
        </div>
        <DomainKpiGrid items={kpis} />
      </FacetCard>

      {/* Unified Embassy & Bilateral Network Snapshot Card */}
      <FacetCard depth={1} className="bg-card/30 space-y-3 p-4 backdrop-blur-md">
        <div className="flex items-center justify-between border-b border-white/5 pb-2">
          <div className="flex items-center gap-2">
            <Building2 className="h-3.5 w-3.5 text-cyan-400" />
            <h4 className="text-foreground text-xs font-bold">Embassy & Bilateral Network</h4>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-extrabold text-cyan-400">
              {activeEmbassies.length} Embassies
            </span>
            <span className="rounded-full border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 text-[10px] font-extrabold text-blue-400">
              {liveRelations.length} Relations
            </span>
          </div>
        </div>

        {/* 1. Embassy Network Section */}
        <div className="space-y-1.5">
          <div className="text-muted-foreground flex items-center justify-between text-[10px] font-bold tracking-wider uppercase">
            <span>Active Embassies</span>
            <span className="text-[9px]">{activeEmbassies.length} total</span>
          </div>
          {activeEmbassies.length === 0 ? (
            <p className="text-muted-foreground py-1.5 text-center text-[11px]">
              No active embassies established.
            </p>
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
                <div
                  key={emb.id}
                  className="flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.02] p-2 text-xs backdrop-blur-md"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-md border border-cyan-500/30 bg-cyan-500/10 text-cyan-400">
                      <UnifiedCountryFlag
                        countryName={partnerName}
                        flagUrl={partnerFlag}
                        size="xs"
                      />
                    </div>
                    <div className="min-w-0">
                      <p className="text-foreground truncate text-[11px] font-semibold">
                        {partnerName}
                      </p>
                      <p className="text-muted-foreground text-[9px]">
                        {emb.guestCountryId === countryId ? "Host Embassy" : "Guest Embassy"}
                      </p>
                    </div>
                  </div>
                  <span className="shrink-0 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-bold text-emerald-400">
                    Active
                  </span>
                </div>
              );
            })
          )}
        </div>

        {/* 2. Bilateral Relations Section */}
        <div className="space-y-1.5 border-t border-white/5 pt-1">
          <div className="text-muted-foreground flex items-center justify-between text-[10px] font-bold tracking-wider uppercase">
            <span>Bilateral Relationships</span>
            <span className="text-[9px]">{liveRelations.length} partners</span>
          </div>
          {liveRelations.length === 0 ? (
            <p className="text-muted-foreground py-1.5 text-center text-[11px]">
              No diplomatic relationships recorded.
            </p>
          ) : (
            liveRelations.slice(0, 4).map((rel) => (
              <div
                key={rel.id}
                className="flex items-center gap-2 rounded-lg border border-white/5 bg-white/[0.02] p-2 text-xs backdrop-blur-md"
              >
                <div className="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-md border border-blue-500/30 bg-blue-500/10 text-blue-400">
                  <UnifiedCountryFlag
                    countryName={rel.targetName}
                    flagUrl={rel.targetFlag}
                    size="xs"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-foreground truncate font-semibold">{rel.targetName}</span>
                    <span className="text-[10px] font-bold text-cyan-500">{rel.strength}%</span>
                  </div>
                  <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full bg-cyan-500 transition-all duration-300"
                      style={{ width: `${Math.min(100, Math.max(0, rel.strength))}%` }}
                    />
                  </div>
                </div>
                <span className="text-muted-foreground shrink-0 text-[9px] font-bold tracking-wider uppercase">
                  {rel.stance}
                </span>
              </div>
            ))
          )}
        </div>
      </FacetCard>

      {/* Alliances & Blocs Snapshot Card */}
      <FacetCard depth={1} className="bg-card/30 space-y-2.5 p-4 backdrop-blur-md">
        <div className="flex items-center justify-between border-b border-white/5 pb-2">
          <div className="flex items-center gap-2">
            <Users className="h-3.5 w-3.5 text-cyan-400" />
            <h4 className="text-foreground text-xs font-bold">Alliances & Blocs</h4>
          </div>
          <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-extrabold text-cyan-400">
            {alliances.length} Active
          </span>
        </div>

        <div className="space-y-1.5">
          {alliances.length === 0 ? (
            <p className="text-muted-foreground py-2 text-center text-[11px]">
              Not a member of any diplomatic alliance.
            </p>
          ) : (
            alliances.slice(0, 3).map((ally) => (
              <div
                key={ally.id}
                className="flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.02] p-2 text-xs backdrop-blur-md"
              >
                <div>
                  <p className="text-foreground text-[11px] font-semibold">
                    {ally.name ?? "Defense Pact"}
                  </p>
                  <p className="text-muted-foreground text-[9px]">
                    {ally.memberCount ?? ally.members?.length ?? 1} Nations
                  </p>
                </div>
                <span className="rounded-md border border-cyan-500/30 bg-cyan-500/10 px-1.5 py-0.5 text-[9px] font-bold text-cyan-300">
                  {ally.myRole ?? "Member"}
                </span>
              </div>
            ))
          )}
        </div>
      </FacetCard>

      {/* Diplomatic Activity Log */}
      <DomainActivityCard
        domain="relations"
        title="Diplomatic Activity Log"
        icon={Globe2}
        entries={activity}
        emptyMessage="No recent diplomatic activity"
      />
    </div>
  );
}
