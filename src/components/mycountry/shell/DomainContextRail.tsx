import React, { useMemo } from "react";
import {
  Building2,
  Handshake,
  TrendingUp,
  Scale,
  Globe2,
  Sword,
  AlertTriangle,
  ShieldAlert,
  Shield,
  Users,
  Landmark,
  CheckCircle,
  BarChart3,
  Vote,
  Coins,
  ScrollText,
  type LucideIcon,
} from "lucide-react";
import { FacetCard } from "~/components/ui/facet-container";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";
import { getStrengthLabel } from "~/lib/statecraft/diplo-intel";
import { computeApproval } from "~/lib/government/approval";
import { useCountryData } from "~/components/mycountry/shared/primitives";
import type { V2Domain } from "./domain-meta";
import { UnifiedCountryFlag } from "~/components/ui/UnifiedCountryFlag";
import { ReadinessOverviewCard } from "~/components/mycountry/domains/defense/command/ReadinessOverviewCard";
import { ParliamentHemicycle } from "~/components/executive/politics/ParliamentHemicycle";

const DOMAIN_ACCENT: Record<V2Domain, string> = {
  relations: "text-teal-400",
  defense: "text-red-400",
  politics: "text-purple-400",
  economy: "text-emerald-400",
};

interface Kpi {
  label: string;
  value: string | number;
  sub?: string;
}

interface ActivityEntry {
  id: string;
  icon: LucideIcon;
  iconColor: string;
  text: string;
  time: Date;
}

function formatCompact(num: number): string {
  if (num >= 1e12) return `${(num / 1e12).toFixed(2)}T`;
  if (num >= 1e9) return `${(num / 1e9).toFixed(2)}B`;
  if (num >= 1e6) return `${(num / 1e6).toFixed(2)}M`;
  return (num ?? 0).toLocaleString();
}

function timeAgo(date: Date): string {
  const diffMin = Math.floor((Date.now() - date.getTime()) / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 30) return `${diffDay}d ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function DomainKpiGrid({ items }: { items: Kpi[] }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {items.map((item) => (
        <div
          key={item.label}
          className="rounded-xl border border-white/5 bg-white/[0.02] p-2.5 text-center backdrop-blur-md"
        >
          <p className="text-foreground text-sm font-bold tabular-nums">{item.value}</p>
          <p className="text-muted-foreground/70 mt-0.5 text-[9px] font-medium tracking-wider uppercase">
            {item.label}
          </p>
          {item.sub && <p className="text-muted-foreground mt-0.5 text-[10px]">{item.sub}</p>}
        </div>
      ))}
    </div>
  );
}

function DomainActivityCard({
  domain,
  title,
  icon: HeaderIcon,
  entries,
  emptyMessage,
}: {
  domain: V2Domain;
  title: string;
  icon: LucideIcon;
  entries: ActivityEntry[];
  emptyMessage: string;
}) {
  const recent = entries.slice(0, 5);
  return (
    <FacetCard depth={1} className="bg-card/30 p-4 backdrop-blur-md">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <HeaderIcon className={cn("h-3.5 w-3.5", DOMAIN_ACCENT[domain])} />
          <h4 className={cn("text-xs font-bold tracking-widest uppercase", DOMAIN_ACCENT[domain])}>
            {title}
          </h4>
        </div>
        <span className="text-muted-foreground/60 rounded-full border border-white/10 px-1.5 py-0.5 text-[9px] font-bold">
          {recent.length}
        </span>
      </div>

      <div className="mt-3 space-y-1.5">
        {recent.length === 0 && (
          <p className="text-muted-foreground rounded-lg border border-dashed border-white/10 bg-white/[0.01] px-3 py-5 text-center text-[11px] leading-relaxed">
            {emptyMessage}
          </p>
        )}
        {recent.map((e) => (
          <div key={e.id} className="flex items-start gap-2 py-1">
            <e.icon className={cn("mt-0.5 h-3 w-3 shrink-0", e.iconColor)} />
            <div className="min-w-0 flex-1">
              <p className="line-clamp-1 text-[11px] leading-snug">{e.text}</p>
              <span className="text-muted-foreground text-[10px]">{timeAgo(e.time)}</span>
            </div>
          </div>
        ))}
      </div>
    </FacetCard>
  );
}

function DomainWidget({
  domain,
  title,
  kpis,
  activityTitle,
  activityIcon,
  entries,
  emptyMessage,
}: {
  domain: V2Domain;
  title: string;
  kpis: Kpi[];
  activityTitle: string;
  activityIcon: LucideIcon;
  entries: ActivityEntry[];
  emptyMessage: string;
}) {
  return (
    <div className="space-y-5">
      <FacetCard depth={1} className="bg-card/30 p-4 backdrop-blur-md">
        <div className="mb-3 flex items-center gap-2">
          <h4 className={cn("text-xs font-bold tracking-widest uppercase", DOMAIN_ACCENT[domain])}>
            {title}
          </h4>
        </div>
        <DomainKpiGrid items={kpis} />
      </FacetCard>

      <DomainActivityCard
        domain={domain}
        title={activityTitle}
        icon={activityIcon}
        entries={entries}
        emptyMessage={emptyMessage}
      />
    </div>
  );
}

/** Diplomacy rail — embassies / relations / foreign-policy / alliances snapshot + recent diplomatic activity. */
function DiplomacyContext({ countryId }: { countryId: string }) {
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

  const embassies = useMemo(() => embassiesRaw ?? [], [embassiesRaw]);
  const alliances = useMemo(() => alliancesRaw ?? [], [alliancesRaw]);

  const activeEmbassies = useMemo(
    () => embassies.filter((e: any) => e.status === "ACTIVE" || e.status === "active"),
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
    (relationsRaw ?? []).forEach((r: any) => {
      const name =
        r.targetCountryName ?? r.targetCountry?.name ?? r.targetCountry ?? "Partner Nation";
      const flag = r.targetCountryFlag ?? r.targetCountry?.flag ?? r.flagUrl ?? null;
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
    activeEmbassies.forEach((e: any) => {
      const partnerId = e.guestCountryId === countryId ? e.hostCountryId : e.guestCountryId;
      const partnerName =
        e.country ??
        (e.guestCountryId === countryId ? e.hostCountry : e.guestCountry) ??
        "Partner Nation";
      const partnerFlag =
        e.countryFlag ?? (e.guestCountryId === countryId ? e.hostCountryFlag : e.guestCountryFlag);

      if (partnerId && !seenTargets.has(partnerId)) {
        seenTargets.add(partnerId);
        const strength = e.strength ?? 65;

        list.push({
          id: `embassy-rel-${e.id}`,
          targetName: partnerName,
          targetFlag: partnerFlag,
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

    embassies.forEach((e: any) => {
      entries.push({
        id: `embassy-${e.id}`,
        icon: Building2,
        iconColor: "text-cyan-400",
        text: `Embassy with ${e.country?.name ?? e.guestCountry?.name ?? e.hostCountry?.name ?? "Partner Nation"}`,
        time: new Date(e.establishedAt ?? e.createdAt),
      });
    });

    liveRelations.forEach((r: any) => {
      const strength = r.strength ?? 0;
      entries.push({
        id: `relation-${r.id}`,
        icon: strength >= 70 ? TrendingUp : Handshake,
        iconColor: strength >= 70 ? "text-purple-400" : "text-teal-400",
        text: `${r.targetName} — ${r.stance}`,
        time: new Date(),
      });
    });

    alliances.forEach((a: any) => {
      entries.push({
        id: `alliance-${a.id}`,
        icon: Users,
        iconColor: "text-amber-400",
        text: `Alliance: ${a.name ?? "Diplomatic Pact"} (${a.memberCount ?? a.members?.length ?? 1} members)`,
        time: new Date(a.createdAt ?? Date.now()),
      });
    });

    foreignPolicies?.forEach((fp: any) => {
      if (fp.status === "active") {
        entries.push({
          id: `fp-${fp.id}`,
          icon: Scale,
          iconColor:
            fp.actionType === "free_trade" || fp.actionType === "military_alliance"
              ? "text-emerald-400"
              : "text-red-400",
          text: `${fp.actionType?.replace(/_/g, " ")} → ${fp.target?.name ?? "Partner"}`,
          time: new Date(fp.createdAt),
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
            <Globe2 className="h-3.5 w-3.5 text-teal-400" />
            <h4 className="text-xs font-bold tracking-widest text-teal-400 uppercase">
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
            activeEmbassies.slice(0, 3).map((emb: any) => {
              const partnerName =
                emb.country ??
                (emb.guestCountryId === countryId ? emb.hostCountry : emb.guestCountry) ??
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
                    <span className="text-[10px] font-bold text-teal-400">{rel.strength}%</span>
                  </div>
                  <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full bg-gradient-to-r from-teal-500 to-cyan-400 transition-all duration-300"
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

      {/* Alliances & Bocs Snapshot Card */}
      <FacetCard depth={1} className="bg-card/30 space-y-2.5 p-4 backdrop-blur-md">
        <div className="flex items-center justify-between border-b border-white/5 pb-2">
          <div className="flex items-center gap-2">
            <Users className="h-3.5 w-3.5 text-purple-400" />
            <h4 className="text-foreground text-xs font-bold">Alliances & Blocs</h4>
          </div>
          <span className="rounded-full border border-purple-500/30 bg-purple-500/10 px-2 py-0.5 text-[10px] font-extrabold text-purple-400">
            {alliances.length} Active
          </span>
        </div>

        <div className="space-y-1.5">
          {alliances.length === 0 ? (
            <p className="text-muted-foreground py-2 text-center text-[11px]">
              Not a member of any diplomatic alliance.
            </p>
          ) : (
            alliances.slice(0, 3).map((ally: any) => (
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
                <span className="rounded-md border border-purple-500/30 bg-purple-500/10 px-1.5 py-0.5 text-[9px] font-bold text-purple-300">
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

/** Defense rail — branches / readiness / threats snapshot + recent security activity. */
function DefenseContext({ countryId }: { countryId: string }) {
  const { data: assessment } = api.security.getSecurityAssessment.useQuery(
    { countryId },
    { enabled: !!countryId, staleTime: 30_000 }
  );
  const { data: branches } = api.security.getMilitaryBranches.useQuery(
    { countryId },
    { enabled: !!countryId, staleTime: 30_000 }
  );

  const { averageReadiness, averageTechnology, averageMorale } = useMemo(() => {
    const count = branches?.length ?? 0;
    if (count === 0) return { averageReadiness: 0, averageTechnology: 0, averageMorale: 0 };
    return {
      averageReadiness: Math.round(
        branches!.reduce((s: number, b: any) => s + (b.readinessLevel ?? 0), 0) / count
      ),
      averageTechnology: Math.round(
        branches!.reduce((s: number, b: any) => s + (b.technologyLevel ?? 0), 0) / count
      ),
      averageMorale: Math.round(
        branches!.reduce((s: number, b: any) => s + (b.morale ?? 0), 0) / count
      ),
    };
  }, [branches]);

  const activity = useMemo<ActivityEntry[]>(() => {
    const entries: ActivityEntry[] = [];

    branches?.forEach((b: any) => {
      const readiness = b.readinessLevel ?? 0;
      entries.push({
        id: `branch-${b.id}`,
        icon: Sword,
        iconColor: readiness >= 70 ? "text-green-500" : "text-red-500",
        text: `${b.name ?? "Military branch"} — ${Math.round(readiness)}% ready`,
        time: new Date(b.updatedAt ?? b.createdAt),
      });
    });

    assessment?.activeThreats?.forEach((t: any) => {
      const critical = t.severity === "critical" || t.severity === "existential";
      entries.push({
        id: `threat-${t.id}`,
        icon: critical ? AlertTriangle : ShieldAlert,
        iconColor: critical ? "text-red-500" : "text-orange-500",
        text: `${t.threatName ?? "Threat"} — ${t.severity ?? "monitoring"}`,
        time: new Date(t.lastUpdated ?? t.detectedAt ?? t.createdAt),
      });
    });

    return entries.sort((a, b) => b.time.getTime() - a.time.getTime());
  }, [assessment, branches]);

  return (
    <div className="space-y-4">
      {/* Strategic Readiness Overview (Sidebar Snapshot Rail) */}
      <ReadinessOverviewCard
        averageReadiness={averageReadiness}
        averageTechnology={averageTechnology}
        averageMorale={averageMorale}
        branches={branches as any}
      />

      {/* Military Branches & Readiness Snapshot Card */}
      <FacetCard depth={1} className="bg-card/30 space-y-2.5 p-4 backdrop-blur-md">
        <div className="flex items-center justify-between border-b border-white/5 pb-2">
          <div className="flex items-center gap-2">
            <Sword className="h-3.5 w-3.5 text-red-400" />
            <h4 className="text-foreground text-xs font-bold">Military Branches</h4>
          </div>
          <span className="rounded-full border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-[10px] font-extrabold text-red-400">
            {branches?.length ?? 0} Active
          </span>
        </div>

        <div className="space-y-1.5">
          {!branches || branches.length === 0 ? (
            <p className="text-muted-foreground py-2 text-center text-[11px]">
              No active military branches configured.
            </p>
          ) : (
            branches.slice(0, 4).map((b: any) => {
              const readiness = b.readinessLevel ?? b.readiness ?? 50;
              const personnel = b.personnelCount ?? b.personnel ?? 0;

              return (
                <div
                  key={b.id}
                  className="space-y-1 rounded-lg border border-white/5 bg-white/[0.02] p-2 text-xs backdrop-blur-md"
                >
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-foreground truncate font-semibold">
                      {b.name ?? b.branchType ?? "Military Branch"}
                    </span>
                    <span className="text-[10px] font-bold text-red-400">
                      {Math.round(readiness)}% ready · {(personnel / 1000).toFixed(1)}k personnel
                    </span>
                  </div>
                  <div className="h-1 w-full overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full bg-gradient-to-r from-red-500 to-amber-500 transition-all duration-300"
                      style={{ width: `${Math.min(100, Math.max(0, readiness))}%` }}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </FacetCard>

      {/* Threat Vectors Snapshot Card */}
      <FacetCard depth={1} className="bg-card/30 space-y-2.5 p-4 backdrop-blur-md">
        <div className="flex items-center justify-between border-b border-white/5 pb-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
            <h4 className="text-foreground text-xs font-bold">Threat Assessments</h4>
          </div>
          <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-extrabold text-amber-400">
            {assessment?.activeThreats?.length ?? 0} Threats
          </span>
        </div>

        <div className="space-y-1.5">
          {!assessment?.activeThreats || assessment.activeThreats.length === 0 ? (
            <p className="text-muted-foreground py-2 text-center text-[11px]">
              All threat vectors clear. Defensive alert level nominal.
            </p>
          ) : (
            assessment.activeThreats.slice(0, 3).map((threat: any) => {
              const critical = threat.severity === "critical" || threat.severity === "existential";

              return (
                <div
                  key={threat.id}
                  className="flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.02] p-2 text-xs backdrop-blur-md"
                >
                  <div className="flex min-w-0 items-center gap-2 pr-2">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-amber-500/30 bg-amber-500/10">
                      {critical ? (
                        <AlertTriangle className="h-3 w-3 text-red-400" />
                      ) : (
                        <ShieldAlert className="h-3 w-3 text-amber-400" />
                      )}
                    </span>
                    <span className="text-foreground truncate text-[11px] font-semibold">
                      {threat.threatName ?? threat.name ?? "Threat Vector"}
                    </span>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 rounded-md border px-1.5 py-0.5 text-[9px] font-bold uppercase",
                      critical
                        ? "border-red-500/30 bg-red-500/10 text-red-400"
                        : "border-amber-500/30 bg-amber-500/10 text-amber-400"
                    )}
                  >
                    {threat.severity ?? "Alert"}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </FacetCard>

      {/* Defense Log Activity Feed */}
      <DomainActivityCard
        domain="defense"
        title="Defense Log"
        icon={Shield}
        entries={activity}
        emptyMessage="No defense activity yet"
      />
    </div>
  );
}

/** Politics rail — parties / seats / approval snapshot + recent political activity. */
function PoliticsContext({ countryId }: { countryId: string }) {
  const { data: parties } = api.elections.getParties.useQuery(
    { countryId },
    { enabled: !!countryId, staleTime: 30_000 }
  );
  const { data: elections } = api.elections.getElections.useQuery(
    { countryId },
    { enabled: !!countryId, staleTime: 30_000 }
  );
  const { data: legislature } = api.elections.getLegislature.useQuery(
    { countryId },
    { enabled: !!countryId, staleTime: 30_000 }
  );
  const { data: parliament } = api.elections.getCurrentParliament.useQuery(
    { countryId },
    { enabled: !!countryId, staleTime: 30_000 }
  );

  const kpis = useMemo<Kpi[]>(() => {
    const approval = computeApproval(
      (parties ?? []).map((p: any) => ({ id: p.id, currentSupport: p.currentSupport })),
      null
    );
    return [
      { label: "Parties", value: parties?.length ?? 0 },
      { label: "Seats", value: legislature?.totalSeats ?? 0 },
      { label: "Approval", value: `${approval}%` },
    ];
  }, [parties, legislature]);

  const activity = useMemo<ActivityEntry[]>(() => {
    const entries: ActivityEntry[] = [];

    if (legislature && legislature.totalSeats > 0) {
      entries.push({
        id: "legislature",
        icon: Landmark,
        iconColor: "text-indigo-500",
        text: `Legislature: ${legislature.totalSeats} seats configured`,
        time: new Date(
          (legislature as any).updatedAt ?? (legislature as any).createdAt ?? Date.now()
        ),
      });
    }

    parties?.forEach((p: any) => {
      entries.push({
        id: `party-${p.id}`,
        icon: Users,
        iconColor: "text-purple-500",
        text: `Party: ${p.name} (${p.ideology?.replace(/_/g, " ")})`,
        time: new Date(p.createdAt),
      });
    });

    elections?.forEach((e: any) => {
      const isCompleted = e.status === "COMPLETED" || e.status === "completed";
      entries.push({
        id: `election-${e.id}`,
        icon: isCompleted ? CheckCircle : BarChart3,
        iconColor: isCompleted ? "text-green-500" : "text-violet-500",
        text: isCompleted
          ? `Completed: ${e.name ?? "Election"}`
          : `Scheduled: ${e.name ?? "Election"}`,
        time: new Date(e.updatedAt ?? e.createdAt),
      });
    });

    return entries.sort((a, b) => b.time.getTime() - a.time.getTime());
  }, [parties, elections, legislature]);

  const hasParliamentSeats = parliament && parliament.seats && parliament.seats.length > 0;

  return (
    <div className="space-y-4">
      {/* Political Snapshot Header KPIs */}
      <FacetCard depth={1} className="bg-card/30 p-4 backdrop-blur-md">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Landmark className="h-3.5 w-3.5 text-purple-400" />
            <h4 className="text-xs font-bold tracking-widest text-purple-400 uppercase">
              Political Snapshot
            </h4>
          </div>
        </div>
        <DomainKpiGrid items={kpis} />
      </FacetCard>

      {/* Parliament Seat Allocation Card (Hemicycle Arc & Seat Breakdown) */}
      <FacetCard depth={1} className="bg-card/30 space-y-3 p-4 backdrop-blur-md">
        <div className="flex items-center justify-between border-b border-white/5 pb-2">
          <div className="flex items-center gap-2">
            <Building2 className="h-3.5 w-3.5 shrink-0 text-purple-400" />
            <h4 className="text-foreground text-xs font-bold">Parliament Seat Allocation</h4>
          </div>
          <span className="rounded-full border border-purple-500/30 bg-purple-500/10 px-2 py-0.5 font-mono text-[10px] font-extrabold text-purple-400">
            {parliament?.legislature?.totalSeats ?? legislature?.totalSeats ?? 0} Seats
          </span>
        </div>

        {hasParliamentSeats ? (
          <div className="flex flex-col items-center overflow-hidden">
            <ParliamentHemicycle
              seats={parliament.seats}
              totalSeats={parliament.legislature.totalSeats}
              partySummary={parliament.partySummary}
              legislatureName={parliament.legislature?.name}
            />
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-muted-foreground py-1 text-center font-mono text-[10px]">
              Chamber Hemicycle ({legislature?.totalSeats ?? 100} Total Seats)
            </p>
            {parties && parties.length > 0 ? (
              <div className="space-y-1.5">
                {parties.slice(0, 4).map((p: any) => {
                  const seats = p.seatsOwned ?? p.seats ?? 0;
                  const total = legislature?.totalSeats ?? 100;
                  const pct = total > 0 ? (seats / total) * 100 : 0;
                  return (
                    <div key={p.id} className="flex items-center justify-between text-xs">
                      <span className="text-foreground truncate text-[11px] font-semibold">
                        {p.name}
                      </span>
                      <span className="font-mono text-[10px] font-bold text-purple-400">
                        {seats} seats ({pct.toFixed(0)}%)
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-muted-foreground py-2 text-center text-[11px]">
                No legislature seats allocated yet.
              </p>
            )}
          </div>
        )}
      </FacetCard>

      {/* Political Parties & Factions Snapshot Card */}
      <FacetCard depth={1} className="bg-card/30 space-y-2.5 p-4 backdrop-blur-md">
        <div className="flex items-center justify-between border-b border-white/5 pb-2">
          <div className="flex items-center gap-2">
            <Users className="h-3.5 w-3.5 text-purple-400" />
            <h4 className="text-foreground text-xs font-bold">Political Parties</h4>
          </div>
          <span className="rounded-full border border-purple-500/30 bg-purple-500/10 px-2 py-0.5 text-[10px] font-extrabold text-purple-400">
            {parties?.length ?? 0} Parties
          </span>
        </div>

        <div className="space-y-1.5">
          {!parties || parties.length === 0 ? (
            <p className="text-muted-foreground py-2 text-center text-[11px]">
              No registered political parties.
            </p>
          ) : (
            parties.slice(0, 4).map((party: any) => {
              const support = party.currentSupport ?? party.popularSupport ?? 0;
              const seats = party.seatsOwned ?? party.seats ?? 0;

              return (
                <div
                  key={party.id}
                  className="space-y-1 rounded-lg border border-white/5 bg-white/[0.02] p-2 text-xs backdrop-blur-md"
                >
                  <div className="flex items-center justify-between text-[11px]">
                    <div className="flex min-w-0 items-center gap-1.5 pr-2">
                      <span className="text-foreground truncate font-semibold">{party.name}</span>
                      <span className="text-muted-foreground font-mono text-[9px] uppercase">
                        ({party.ideology?.replace(/_/g, " ") ?? "Centrist"})
                      </span>
                    </div>
                    <span className="shrink-0 text-[10px] font-bold text-purple-400">
                      {support}% support · {seats} seats
                    </span>
                  </div>
                  <div className="h-1 w-full overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full bg-gradient-to-r from-purple-500 to-indigo-400 transition-all duration-300"
                      style={{ width: `${Math.min(100, Math.max(0, support))}%` }}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </FacetCard>

      {/* Political Activity Feed */}
      <DomainActivityCard
        domain="politics"
        title="Political Log"
        icon={Vote}
        entries={activity}
        emptyMessage="No political activity yet"
      />
    </div>
  );
}

import { FiscalPolicyInsights } from "./FiscalPolicyConsole";
import { TradeCommerceInsights } from "./TradeCommerceConsole";

function EconomyContext({ countryId }: { countryId: string }) {
  const { data: budget } = api.government.getBudgetSummary.useQuery(
    { countryId },
    { enabled: !!countryId, staleTime: 30_000 }
  );
  const { data: policies } = api.policies.getPolicies.useQuery(
    { countryId },
    { enabled: !!countryId, staleTime: 30_000 }
  );

  const activity = useMemo<ActivityEntry[]>(() => {
    const entries: ActivityEntry[] = [];

    policies
      ?.filter((p: any) => p.status === "active")
      .forEach((p: any) => {
        entries.push({
          id: `policy-${p.id}`,
          icon: ScrollText,
          iconColor: "text-emerald-500",
          text: `Policy: ${p.name ?? "Active policy"}`,
          time: new Date(p.updatedAt ?? p.effectiveDate ?? p.createdAt),
        });
      });

    budget?.topSpendingDepartments?.forEach((t: any) => {
      const deptName = t.department?.name ?? "Department";
      const amount = t.allocation?.allocatedAmount ?? 0;
      entries.push({
        id: `dept-${t.department?.id ?? deptName}`,
        icon: Coins,
        iconColor: "text-teal-500",
        text: `Budget: $${formatCompact(amount)} → ${deptName}`,
        time: new Date(t.allocation?.updatedAt ?? t.allocation?.createdAt ?? Date.now()),
      });
    });

    return entries.sort((a, b) => b.time.getTime() - a.time.getTime());
  }, [policies, budget]);

  return (
    <div className="space-y-4">
      {/* Fiscal Policy Insights — Tax Burden, Revenue Composition, Fiscal Health */}
      <FiscalPolicyInsights countryId={countryId} />

      {/* Trade & Commerce Insights — Openness Gauge & Commercial Telemetry */}
      <TradeCommerceInsights countryId={countryId} />
    </div>
  );
}

/**
 * V2DomainContext — the domain-contextual rail for the four full-page domain surfaces.
 * Replaces the shared National Standing / Your Agenda rail with per-domain KPIs and a
 * recent-activity log, so each tab shows information specific to what it manages.
 */
export interface DomainContextRailProps {
  countryId: string;
  domain: V2Domain;
}

export type V2DomainContextProps = DomainContextRailProps;

function DomainContextRailComponent({
  countryId,
  domain,
}: DomainContextRailProps): React.JSX.Element {
  switch (domain) {
    case "relations":
      return <DiplomacyContext countryId={countryId} />;
    case "defense":
      return <DefenseContext countryId={countryId} />;
    case "politics":
      return <PoliticsContext countryId={countryId} />;
    case "economy":
      return <EconomyContext countryId={countryId} />;
  }
}

export const DomainContextRail = React.memo(DomainContextRailComponent);
export const V2DomainContext = DomainContextRail;
