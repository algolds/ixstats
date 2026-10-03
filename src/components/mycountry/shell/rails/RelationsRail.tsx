"use client";

import React from "react";
import {
  City as Building2,
  ScaleFrameEnlarge as Scale,
  Globe as Globe2,
  Group as Users,
} from "iconoir-react";
import { Badge } from "~/components/ui/badge";
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
  pushRecorded,
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

type NamedCountry = string | { name?: string } | null | undefined;

const nameOf = (country: NamedCountry): string | undefined =>
  typeof country === "string" ? country : country?.name;

const PARTNER_FALLBACK = "Partner Nation";
const isActive = (e: EmbassyItem) => e.status === "ACTIVE" || e.status === "active";
const memberCountOf = (a: AllianceItem) => a.memberCount ?? a.members?.length ?? 1;
const stanceOf = (strength: number | null) =>
  strength != null ? getStrengthLabel(strength) : "Unrated";

/** The other side of an embassy, from this country's point of view. */
function embassyPartner(e: EmbassyItem, countryId: string) {
  const isGuest = e.guestCountryId === countryId;
  return {
    id: isGuest ? e.hostCountryId : e.guestCountryId,
    name: nameOf(e.country) ?? nameOf(isGuest ? e.hostCountry : e.guestCountry) ?? PARTNER_FALLBACK,
    flag: e.countryFlag ?? (isGuest ? e.hostCountryFlag : e.guestCountryFlag),
    isGuest,
  };
}

interface LiveRelation {
  id: string;
  targetName: string;
  targetFlag: string | null;
  strength: number | null;
  stance: string;
}

/** Recorded relationships, plus active embassy partners not already listed as one. */
function buildLiveRelations(
  relations: RelationshipItem[],
  activeEmbassies: EmbassyItem[],
  countryId: string
): LiveRelation[] {
  const seenTargets = new Set<string>();
  const list: LiveRelation[] = relations.map((r) => {
    const target = typeof r.targetCountry === "object" ? r.targetCountry : null;
    seenTargets.add(r.targetCountryId ?? r.id);
    return {
      id: r.id,
      targetName: r.targetCountryName ?? nameOf(r.targetCountry) ?? PARTNER_FALLBACK,
      targetFlag: r.targetCountryFlag ?? target?.flag ?? r.flagUrl ?? null,
      strength: r.strength ?? null,
      stance: stanceOf(r.strength ?? null),
    };
  });

  for (const e of activeEmbassies) {
    const partner = embassyPartner(e, countryId);
    if (!partner.id || seenTargets.has(partner.id)) continue;
    seenTargets.add(partner.id);
    list.push({
      id: `embassy-rel-${e.id}`,
      targetName: partner.name,
      targetFlag: partner.flag ?? null,
      strength: e.strength ?? null,
      stance: stanceOf(e.strength ?? null),
    });
  }
  return list;
}

const HOSTILE_TONE = (actionType: string | null | undefined) =>
  actionType === "free_trade" || actionType === "military_alliance"
    ? STATUS_TEXT.success
    : STATUS_TEXT.critical;

function buildActivity(
  embassies: EmbassyItem[],
  alliances: AllianceItem[],
  foreignPolicies: ForeignPolicyItem[]
): ActivityEntry[] {
  const entries: ActivityEntry[] = [];

  for (const e of embassies) {
    const name = nameOf(e.country) ?? nameOf(e.guestCountry) ?? nameOf(e.hostCountry);
    pushRecorded(
      entries,
      {
        id: `embassy-${e.id}`,
        icon: Building2,
        iconColor: STATUS_TEXT.neutral,
        text: `Embassy with ${name ?? PARTNER_FALLBACK}`,
      },
      e.establishedAt,
      e.createdAt
    );
  }

  for (const a of alliances) {
    pushRecorded(
      entries,
      {
        id: `alliance-${a.id}`,
        icon: Users,
        iconColor: STATUS_TEXT.neutral,
        text: `Alliance: ${a.name ?? "Diplomatic Pact"} (${memberCountOf(a)} members)`,
      },
      a.createdAt
    );
  }

  for (const fp of foreignPolicies.filter((p) => p.status === "active")) {
    pushRecorded(
      entries,
      {
        id: `fp-${fp.id}`,
        icon: Scale,
        iconColor: HOSTILE_TONE(fp.actionType),
        text: `${fp.actionType?.replace(/_/g, " ")} → ${fp.target?.name ?? "Partner"}`,
      },
      fp.createdAt
    );
  }

  return entries.sort((a, b) => b.time.getTime() - a.time.getTime());
}

function SectionHeading({ label, count }: { label: string; count: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-stat-label text-label-secondary">{label}</span>
      <span className="text-label-secondary text-footnote tabular-nums">{count}</span>
    </div>
  );
}

function EmbassyList({ embassies, countryId }: { embassies: EmbassyItem[]; countryId: string }) {
  return (
    <div className="space-y-2">
      <SectionHeading label="Active embassies" count={`${embassies.length} total`} />
      {embassies.length === 0 ? (
        <RailEmpty>No active embassies established.</RailEmpty>
      ) : (
        embassies.slice(0, 3).map((emb) => {
          const partner = embassyPartner(emb, countryId);
          return (
            <RailRow key={emb.id} className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <UnifiedCountryFlag
                  countryName={partner.name}
                  flagUrl={partner.flag}
                  size="xs"
                  className="shrink-0"
                />
                <div className="min-w-0">
                  <p className="text-label truncate font-medium">{partner.name}</p>
                  <p className="text-label-secondary">
                    {partner.isGuest ? "Host embassy" : "Guest embassy"}
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
  );
}

function RelationList({ relations }: { relations: LiveRelation[] }) {
  return (
    <div className="border-separator space-y-2 border-t pt-3">
      <SectionHeading label="Bilateral relationships" count={`${relations.length} partners`} />
      {relations.length === 0 ? (
        <RailEmpty>No diplomatic relationships recorded.</RailEmpty>
      ) : (
        relations.slice(0, 4).map((rel) => (
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
                <span className="text-label shrink-0 tabular-nums">
                  {rel.strength != null ? `${rel.strength}%` : "—"}
                </span>
              </div>
              {rel.strength != null && <RailBar value={rel.strength} />}
            </div>
            <span className="text-label-secondary shrink-0">{rel.stance}</span>
          </RailRow>
        ))
      )}
    </div>
  );
}

/** Diplomacy rail — embassies / relations / foreign-policy / alliances snapshot + recent diplomatic activity. */
export function RelationsRail({ countryId }: { countryId: string }) {
  const query = { enabled: !!countryId, staleTime: 30_000 };
  const { data: embassiesRaw } = api.diplomaticEmbassies.getEmbassies.useQuery(
    { countryId },
    query
  );
  const { data: relationsRaw } = api.diplomaticCore.getRelationships.useQuery({ countryId }, query);
  const { data: foreignPolicies } = api.diplomaticPolicies.getActiveForeignPolicies.useQuery(
    { countryId },
    query
  );
  const { data: alliancesRaw } = api.diplomaticPolicies.getAlliances.useQuery({ countryId }, query);

  const embassies = (embassiesRaw ?? []) as EmbassyItem[];
  const alliances = (alliancesRaw ?? []) as AllianceItem[];
  const activeEmbassies = embassies.filter(isActive);
  const relations = buildLiveRelations(
    (relationsRaw ?? []) as RelationshipItem[],
    activeEmbassies,
    countryId
  );
  const kpis: Kpi[] = [
    { label: "Embassies", value: activeEmbassies.length },
    { label: "Relations", value: relations.length },
    { label: "Alliances", value: alliances.length },
  ];
  const activity = buildActivity(
    embassies,
    alliances,
    (foreignPolicies ?? []) as ForeignPolicyItem[]
  );

  return (
    <div className="space-y-6">
      <RailCard title="Diplomatic snapshot" icon={Globe2}>
        <DomainKpiGrid items={kpis} />
      </RailCard>

      <RailCard title="Embassies and bilateral ties" icon={Building2} contentClassName="space-y-3">
        <EmbassyList embassies={activeEmbassies} countryId={countryId} />
        <RelationList relations={relations} />
      </RailCard>

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
                <p className="text-label-secondary">{memberCountOf(ally)} nations</p>
              </div>
              <Badge variant="default" className="shrink-0 capitalize">
                {ally.myRole ?? "Member"}
              </Badge>
            </RailRow>
          ))
        )}
      </RailCard>

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
