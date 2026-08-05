"use client";

import { useState, useMemo } from "react";
import dynamic from "next/dynamic";
import { Globe2, Shield, Landmark, Target, Users, Scale, Building2, TrendingUp } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "~/components/ui/sheet";
import { FacetCard } from "~/components/ui/facet-container";
import { useCountryData } from "../primitives";
import { api } from "~/trpc/react";
import { cn } from "~/lib/utils";

const EmbassiesAndRelationsPanel = dynamic(
  () =>
    import("~/components/diplomacy/EmbassiesAndRelationsPanel").then((m) => ({
      default: m.EmbassiesAndRelationsPanel,
    })),
  { loading: () => <div className="h-64 animate-pulse rounded-xl bg-white/5" /> }
);

const DefenseCommandPanel = dynamic(
  () =>
    import("~/components/defense/DefenseCommandPanel").then((m) => ({
      default: m.DefenseCommandPanel,
    })),
  { loading: () => <div className="h-64 animate-pulse rounded-xl bg-white/5" /> }
);

const CabinetPanel = dynamic(
  () =>
    import("~/components/executive/politics/CabinetPanel").then((m) => ({
      default: m.CabinetPanel,
    })),
  { loading: () => <div className="h-64 animate-pulse rounded-xl bg-white/5" /> }
);

const PartyManager = dynamic(
  () =>
    import("~/components/executive/politics/PartyManager").then((m) => ({
      default: m.PartyManager,
    })),
  { loading: () => <div className="h-64 animate-pulse rounded-xl bg-white/5" /> }
);

const LegislatureConfig = dynamic(
  () =>
    import("~/components/executive/politics/LegislatureConfig").then((m) => ({
      default: m.LegislatureConfig,
    })),
  { loading: () => <div className="h-64 animate-pulse rounded-xl bg-white/5" /> }
);

/** A v2 drill-down surface. Phase 3 connects deep domain panels directly inside right-side sheets. */
export type V2Drill =
  | { kind: "relations" | "defense" | "politics" | "economy" }
  | { kind: "intent"; intentId: string }
  | null;

const DRILL_META: Record<
  "relations" | "defense" | "politics" | "economy",
  { title: string; icon: typeof Globe2; accent: string; blurb: string }
> = {
  relations: {
    title: "Foreign Relations",
    icon: Globe2,
    accent: "text-cyan-400",
    blurb: "Embassies, treaties and foreign-policy stance. Diplomatic action surfaces here.",
  },
  defense: {
    title: "National Security",
    icon: Shield,
    accent: "text-red-400",
    blurb: "Defense posture, threat assessment and readiness. Defense directives land here.",
  },
  politics: {
    title: "Governance Configuration",
    icon: Landmark,
    accent: "text-purple-400",
    blurb: "Parties, legislature and electoral config — your nation's declared political reality.",
  },
  economy: {
    title: "Economy & Budget",
    icon: TrendingUp,
    accent: "text-emerald-400",
    blurb: "Macro trends, fiscal health and budget allocation. Financial posture surfaces here.",
  },
};

const TIER_BADGE: Record<string, string> = {
  measured: "text-emerald-300 bg-emerald-500/10 border-emerald-400/20",
  moderate: "text-amber-300 bg-amber-500/10 border-amber-400/20",
  extreme: "text-red-300 bg-red-500/10 border-red-400/20",
};

function EconomyDrillDown({ countryId }: { countryId: string }) {
  const { country } = useCountryData();
  const { data: dashboard } = api.mycountry.getCountryDashboard.useQuery(
    { countryId },
    { enabled: !!countryId }
  );

  const metrics = [
    {
      label: "GDP (Total)",
      value: country?.currentTotalGdp ? `$${(country.currentTotalGdp / 1e9).toFixed(2)}B` : "—",
      sub: "Gross Domestic Product",
      accent: "text-emerald-400 border-emerald-500/20 bg-emerald-500/5",
    },
    {
      label: "GDP Growth",
      value: country?.realGdpGrowthRate != null ? `${(country.realGdpGrowthRate * 100).toFixed(2)}%` : "—",
      sub: "Annual real rate",
      accent: "text-cyan-400 border-cyan-500/20 bg-cyan-500/5",
    },
    {
      label: "Economic Vitality",
      value: dashboard?.economicVitality != null ? `${dashboard.economicVitality}/100` : "—",
      sub: "National vitality band",
      accent: "text-amber-400 border-amber-500/20 bg-amber-500/5",
    },
    {
      label: "Government Efficiency",
      value: dashboard?.governmentalEfficiency != null ? `${dashboard.governmentalEfficiency}/100` : "—",
      sub: "Administrative capacity",
      accent: "text-purple-400 border-purple-500/20 bg-purple-500/5",
    },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {metrics.map(({ label, value, sub, accent }) => (
          <div key={label} className={cn("rounded-xl border p-3.5 backdrop-blur-md", accent)}>
            <p className="text-muted-foreground/70 text-[10px] font-bold tracking-wider uppercase">{label}</p>
            <p className="text-foreground mt-1 text-lg font-extrabold">{value}</p>
            <p className="text-muted-foreground mt-0.5 text-[11px]">{sub}</p>
          </div>
        ))}
      </div>

      <FacetCard depth={1} className="bg-card/30 space-y-3 p-4 backdrop-blur-md">
        <h4 className="text-xs font-bold tracking-widest text-muted-foreground uppercase">
          Fiscal Health & Upkeep Strategy
        </h4>
        <p className="text-muted-foreground text-xs leading-relaxed">
          Active policies, proactive intents, and military posture consume continuous Civil Service Capacity (CivCap) and treasury budget lines. Lower efficiency obscures raw breakdowns into qualitative bands.
        </p>
      </FacetCard>
    </div>
  );
}

function PoliticsDrillDown({ countryId }: { countryId: string }) {
  const [activeTab, setActiveTab] = useState<"cabinet" | "parties" | "legislature">("cabinet");

  const tabs = [
    { id: "cabinet" as const, label: "Cabinet", icon: Users },
    { id: "parties" as const, label: "Parties", icon: Scale },
    { id: "legislature" as const, label: "Legislature", icon: Building2 },
  ];

  return (
    <div className="space-y-4">
      <div className="flex rounded-lg border border-white/10 bg-white/[0.03] p-1">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveTab(id)}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all",
              activeTab === id
                ? "border border-purple-500/30 bg-purple-500/20 text-purple-300 shadow-sm"
                : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      {activeTab === "cabinet" && <CabinetPanel countryId={countryId} />}
      {activeTab === "parties" && <PartyManager countryId={countryId} />}
      {activeTab === "legislature" && <LegislatureConfig countryId={countryId} />}
    </div>
  );
}

function IntentDetail({ countryId, intentId }: { countryId: string; intentId: string }) {
  const tree = api.intent.getTree.useQuery({ countryId }, { enabled: !!countryId });
  const items = useMemo(() => tree.data ?? [], [tree.data]);
  const intent = useMemo(() => items.find((i: any) => i.id === intentId), [items, intentId]);
  const children = useMemo(() => items.filter((i: any) => i.parentId === intentId), [items, intentId]);

  if (!intent) {
    return <p className="text-muted-foreground text-sm">This directive could not be loaded.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-bold tracking-wider uppercase",
              TIER_BADGE[intent.tier] || "border-slate-500/20 bg-slate-500/10 text-slate-400"
            )}
          >
            {intent.tier}
          </span>
          <span className="text-muted-foreground/60 text-[10px] font-medium capitalize">
            {intent.category}
          </span>
        </div>
        <h3 className="text-foreground mt-2 text-lg font-bold leading-tight">{intent.goal}</h3>
        <p className="text-muted-foreground mt-1 text-xs capitalize">
          Status: {intent.status ?? "active"}
        </p>
      </div>

      {children.length > 0 && (
        <div>
          <h4 className="text-muted-foreground mb-2 text-[10px] font-bold tracking-widest uppercase">
            Follow-ups
          </h4>
          <div className="space-y-2">
            {children.map((kid: any) => (
              <div
                key={kid.id}
                className="text-foreground/85 rounded-lg border border-white/5 bg-white/[0.01] px-3 py-2 text-sm"
              >
                {kid.goal}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function V2DrillSheets({
  drill,
  onClose,
  countryId,
}: {
  drill: V2Drill;
  onClose: () => void;
  countryId: string;
}) {
  const open = drill !== null;

  const kindKind = drill === null ? "relations" : drill.kind;
  const meta = kindKind === "intent" ? null : DRILL_META[kindKind];

  const title =
    drill === null ? "" : drill.kind === "intent" ? "Directive Detail" : meta?.title ?? "";
  const Icon = drill === null ? Target : drill.kind === "intent" ? Target : meta?.icon ?? Target;
  const accent = drill === null ? "text-amber-400" : meta?.accent ?? "text-amber-400";

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="right"
        className="border-border bg-background/95 w-full overflow-y-auto backdrop-blur-xl sm:max-w-xl lg:max-w-2xl"
      >
        <SheetHeader className="mb-4">
          <SheetTitle className="flex items-center gap-2 text-base">
            <Icon className={cn("h-4 w-4", accent)} />
            {title}
          </SheetTitle>
          {drill && drill.kind !== "intent" && (
            <SheetDescription className="text-muted-foreground text-xs">
              {meta?.blurb}
            </SheetDescription>
          )}
        </SheetHeader>

        {drill === null ? null : drill.kind === "intent" ? (
          <IntentDetail countryId={countryId} intentId={drill.intentId} />
        ) : drill.kind === "relations" ? (
          <EmbassiesAndRelationsPanel countryId={countryId} />
        ) : drill.kind === "defense" ? (
          <DefenseCommandPanel countryId={countryId} />
        ) : drill.kind === "politics" ? (
          <PoliticsDrillDown countryId={countryId} />
        ) : drill.kind === "economy" ? (
          <EconomyDrillDown countryId={countryId} />
        ) : null}
      </SheetContent>
    </Sheet>
  );
}