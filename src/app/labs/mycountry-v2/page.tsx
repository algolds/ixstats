"use client";

/**
 * MyCountry v2 — labs preview (design-bible v2).
 *
 * Composed from the platform's real premium primitives (CountryMapEmbed,
 * VitalityRings/HealthRing, UnifiedCountryFlag, formatCurrency, Facet glass,
 * bottom Sheet) so it reads as IxStates — not a generic dashboard.
 *
 * Hero (shared): interactive map (left) · vitality rings + real economy +
 * "what needs you" + directive launcher (right).
 * Two layouts to compare (chrome toggle): "Switch" (Brief/Directive) and
 * "Hub" (4 action-domain tiles). Feed is the spine. Currency is the nation's
 * own money — never IxCredits (that's Vault/metagame).
 *
 * Live data: api.mycountry.getCountryDashboard / getCanonFeed / getChangeLog,
 * api.intent.* (suggest/commit/getTree/getStatus), api.nationalIssues.*.
 */

import React, { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import {
  Newspaper,
  TerminalSquare,
  LayoutGrid,
  Rows3,
  ArrowUpRight,
  ArrowDownRight,
  Command,
  Loader2,
  Landmark,
  Handshake,
  Vote,
  Coins,
  ChevronRight,
  AlertTriangle,
  Sparkles,
  Crown,
  Cog,
  Star,
  Shield,
  Church,
  DollarSign,
  Users,
  Building,
} from "lucide-react";
import { api } from "~/trpc/react";
import { FacetCard, FacetContainer } from "~/components/ui/facet-container";
import { useUserCountry } from "~/hooks/useUserCountry";
import { PolicyCreatorSheet } from "~/components/executive/PolicyCreatorSheet";
import { VitalityRings } from "~/components/mycountry/primitives/VitalityRings";
import { formatCurrency, formatPopulation } from "~/lib/chart-utils";
import { cn } from "~/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";

const CountryMapEmbed = dynamic(
  () => import("~/components/maps/widgets/CountryMapEmbed").then((m) => ({ default: m.CountryMapEmbed })),
  { ssr: false, loading: () => <div className="bg-muted/40 h-full min-h-[240px] w-full animate-pulse rounded-xl" /> }
);

// ── bands (bible §7: bands, never numbers) — score drives the ring FILL only ──
type Tone = "good" | "mid" | "bad" | "fog" | "info";
function toBand(score: number | null | undefined): { tone: Tone; label: string; score: number } {
  if (score == null || Number.isNaN(score)) return { tone: "fog", label: "Unclear", score: 8 };
  if (score >= 66) return { tone: "good", label: "Strong", score };
  if (score >= 40) return { tone: "mid", label: "Holding", score };
  return { tone: "bad", label: "Strained", score };
}
const TONE_CLS: Record<Tone, string> = {
  good: "text-emerald-300 bg-emerald-500/10 border-emerald-400/20",
  mid: "text-amber-300 bg-amber-500/10 border-amber-400/20",
  bad: "text-red-300 bg-red-500/10 border-red-400/20",
  info: "text-blue-300 bg-blue-500/10 border-blue-400/20",
  fog: "text-muted-foreground bg-muted/40 border-border",
};
const RING_COLOR: Record<Tone, string> = {
  good: "#34d399",
  mid: "#fbbf24",
  bad: "#f87171",
  info: "#60a5fa",
  fog: "#71717a",
};
const DOT_CLS: Record<Tone, string> = {
  good: "bg-emerald-400",
  mid: "bg-amber-400",
  bad: "bg-red-400",
  info: "bg-blue-400",
  fog: "bg-zinc-500",
};

function sourceMeta(kind: string) {
  switch (kind) {
    case "decision":
      return { who: "Government", ring: "from-amber-500 to-yellow-600", glyph: "◉" };
    case "diplomacy":
      return { who: "World", ring: "from-purple-500 to-fuchsia-600", glyph: "◇" };
    default:
      return { who: "Press", ring: "from-slate-500 to-slate-700", glyph: "▦" };
  }
}
function fmtTime(ts: number) {
  const diff = Date.now() - ts;
  if (diff < 3_600_000) return `${Math.max(1, Math.round(diff / 60000))}m ago`;
  if (diff < 86_400_000) return `${Math.round(diff / 3_600_000)}h ago`;
  return new Date(ts).toLocaleDateString([], { month: "short", day: "numeric" });
}

type LocalPost = { id: string; kind: string; title: string; body: string; timestamp: number };
const GOAL_CHIPS = ["Cool the housing market", "Modernize the navy", "Court a neighbour as an ally", "Rein in inflation", "Develop the coast"];

// ════════════════════════════════════════════════════════════════════════════
export function MyCountryV2({
  lockedCountryId,
  showPicker = true,
  previewLabel = "live · labs preview",
}: {
  lockedCountryId?: string;
  showPicker?: boolean;
  previewLabel?: string;
} = {}) {
  const { country: userCountry } = useUserCountry();
  const { data: countriesData } = api.countries.getAll.useQuery({ limit: 300 }, { enabled: showPicker });
  const countries = countriesData?.countries;
  const [countryId, setCountryId] = useState<string | null>(null);
  useEffect(() => {
    if (lockedCountryId) return setCountryId(lockedCountryId);
    if (!countryId) setCountryId((userCountry as any)?.id ?? countries?.[0]?.id ?? null);
  }, [lockedCountryId, userCountry, countries, countryId]);

  const enabled = !!countryId;
  const { data: dash } = api.mycountry.getCountryDashboard.useQuery({ countryId: countryId!, includeHistory: false }, { enabled });
  const { data: feed = [] } = api.mycountry.getCanonFeed.useQuery({ countryId: countryId!, limit: 30 }, { enabled });
  const { data: ledger = [] } = api.mycountry.getChangeLog.useQuery({ countryId: countryId!, limit: 20 }, { enabled });

  const [layout, setLayout] = useState<"switch" | "hub">("switch");
  const [mode, setMode] = useState<"brief" | "directive">("brief");
  const [local, setLocal] = useState<LocalPost[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [composer, setComposer] = useState<{ open: boolean; goal: string }>({ open: false, goal: "" });
  useEffect(() => setLocal([]), [countryId]);

  const d: any = dash ?? {};
  const bands = useMemo(() => {
    const mk = (name: string, sub: string, score: number) => {
      const b = toBand(score);
      return { name, sub, tone: b.tone, value: b.label, score: b.score };
    };
    return [
      mk("Economy", "Output & growth", d.economicVitality),
      mk("Wellbeing", "The people", d.populationWellbeing),
      mk("Standing", "Abroad", d.diplomaticStanding),
      mk("Capacity", "The civil service", d.governmentalEfficiency),
    ];
  }, [d.economicVitality, d.populationWellbeing, d.diplomaticStanding, d.governmentalEfficiency]);

  const posts = useMemo(() => {
    const live = (feed as any[]).map((f) => ({ id: f.id, kind: f.kind, title: f.title, body: "", timestamp: f.timestamp }));
    return [...local, ...live].slice(0, 40);
  }, [feed, local]);

  const utils = api.useUtils();
  function openComposer(goal = "") {
    setComposer({ open: true, goal });
  }
  function handleCommitted(res: any) {
    const body = (res?.summary as string) ?? "Intent committed.";
    setLocal((p) => [{ id: res?.intent?.id ?? `local_${Date.now()}`, kind: "decision", title: `Intent: ${res?.intent?.goal ?? ""}`, body, timestamp: Date.now() }, ...p]);
    setToast(body);
    setTimeout(() => setToast(null), 4500);
    setComposer({ open: false, goal: "" });
    void utils.mycountry.getCanonFeed.invalidate();
    void utils.mycountry.getChangeLog.invalidate();
    void utils.mycountry.getCountryDashboard.invalidate();
    void utils.intent.getStatus.invalidate();
    void utils.intent.getTree.invalidate();
  }

  return (
    <div
      className="bg-background text-foreground min-h-screen"
      style={{ backgroundImage: "radial-gradient(1200px 600px at 10% -8%, rgba(202,138,4,0.08), transparent 60%), radial-gradient(900px 520px at 100% 0%, rgba(99,102,241,0.05), transparent 55%)" }}
    >
      <style>{SEAL_STYLE}</style>

      {/* chrome — layout switcher */}
      <div className="border-border/70 bg-background/70 sticky top-0 z-40 flex items-center justify-between gap-3 border-b px-4 py-2 backdrop-blur-xl">
        <div className="flex items-center gap-2 text-[13px] font-bold tracking-tight">
          <Landmark className="h-4 w-4 text-amber-500" /> MyCountry
          <span className="text-amber-500">v2</span>
          <span className="border-border/70 text-muted-foreground ml-1 rounded border px-1.5 py-0.5 text-[9px] font-medium tracking-wide">
            {previewLabel}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {showPicker && (
            <Select value={countryId ?? ""} onValueChange={(v) => setCountryId(v || null)}>
              <SelectTrigger size="sm" className="border-border bg-card/40 hover:bg-card/70 h-7 w-fit min-w-[140px] cursor-pointer text-[11px] focus:border-amber-500/30 focus:ring-amber-500/20">
                <SelectValue placeholder="Select Country" />
              </SelectTrigger>
              <SelectContent className="border-border bg-popover">
                {(countries ?? []).map((c: any) => (
                  <SelectItem key={c.id} value={c.id} className="text-xs">{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <div className="border-border/70 bg-card/40 flex rounded-md border p-0.5 text-[11px] font-semibold">
            <LayoutBtn active={layout === "switch"} onClick={() => setLayout("switch")} icon={<Rows3 className="h-3.5 w-3.5" />}>Switch</LayoutBtn>
            <LayoutBtn active={layout === "hub"} onClick={() => setLayout("hub")} icon={<LayoutGrid className="h-3.5 w-3.5" />}>Hub</LayoutBtn>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl space-y-5 p-4 sm:p-5">
        <CompositeHero d={d} countryId={countryId} bands={bands} onDeclare={openComposer} />

        {layout === "switch" ? (
          <SwitchBody
            d={d}
            mode={mode}
            setMode={setMode}
            countryId={countryId}
            name={d.name ?? "your nation"}
            bands={bands}
            posts={posts}
            ledger={ledger as any[]}
            onCommitted={handleCommitted}
            onDeclare={openComposer}
          />
        ) : (
          <HubBody d={d} bands={bands} posts={posts} onDeclare={openComposer} />
        )}
      </div>

      {/* directive composer — bottom sheet */}
      <Sheet open={composer.open} onOpenChange={(o) => setComposer((c) => ({ ...c, open: o }))}>
        <SheetContent side="bottom" className="border-border bg-background/95 max-h-[85vh] overflow-y-auto backdrop-blur-xl">
          <SheetHeader className="mb-2">
            <SheetTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4 text-amber-500" /> Issue a directive — {d.name ?? "your nation"}
            </SheetTitle>
          </SheetHeader>
          <div className="mx-auto max-w-3xl pb-6">
            {composer.open && countryId && (
              <IntentComposer countryId={countryId} initialGoal={composer.goal} onCommitted={handleCommitted} />
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* in-world toast */}
      {toast && (
        <div className="border-border bg-secondary animate-in fade-in slide-in-from-bottom-2 fixed bottom-5 left-1/2 z-50 flex max-w-lg -translate-x-1/2 items-start gap-2.5 rounded-xl border px-4 py-3 shadow-2xl">
          <StateSeal flagUrl={d.flag} governmentType={d.governmentType} size={24} showPips={false} className="mt-0.5" />
          <span className="text-foreground/90 text-[13px] leading-snug">{toast}</span>
        </div>
      )}
    </div>
  );
}

function LayoutBtn({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={cn("flex items-center gap-1.5 rounded px-2.5 py-1 transition", active ? "bg-amber-500/20 text-amber-300" : "text-muted-foreground hover:text-foreground")}>
      {icon} {children}
    </button>
  );
}

// ── the State Seal (signature): wax signet · flag field + regime glyph ·
//    rim pips by tier (living status) · minimal shimmer ─────────────────────
const SEAL_STYLE = `
.seal-shimmer::after{content:"";position:absolute;inset:0;border-radius:48% 52% 47% 53% / 52% 47% 53% 48%;background:linear-gradient(115deg,transparent 42%,rgba(255,246,214,0.32) 50%,transparent 58%);mix-blend-mode:screen;opacity:0;animation:sealSheen 7s ease-in-out infinite;pointer-events:none;}
@keyframes sealSheen{0%,74%,100%{opacity:0;transform:translateX(-28%)}84%{opacity:.85;transform:translateX(28%)}}
@media (prefers-reduced-motion: reduce){.seal-shimmer::after{animation:none}}
`;
function regimeIcon(gt?: string) {
  const g = (gt ?? "").toLowerCase();
  if (/monarch|kingdom|empire|imperial|royal|crown|principal|duchy|tsar|sultan/.test(g)) return Crown;
  if (/theocra|cleric|divine|holy|papal|ecclesi|caliph/.test(g)) return Church;
  if (/technocr|meritocr|cybernet/.test(g)) return Cog;
  if (/dictat|authorit|junta|military|autocrac|totalit|despot/.test(g)) return Shield;
  if (/republic|democr|parliament|president|federa|confedera|commonwealth|council|senate|union/.test(g)) return Star;
  return Landmark;
}
const TIER_PIPS: Record<string, number> = {
  Impoverished: 1, Developing: 2, Emerging: 2, Developed: 3, Healthy: 3,
  Advanced: 4, Strong: 4, "Very Strong": 5, Extravagant: 5,
};
function StateSeal({ flagUrl, governmentType, tier, size = 76, showPips = true, className }: {
  flagUrl?: string | null; governmentType?: string; tier?: string; size?: number; showPips?: boolean; className?: string;
}) {
  const Glyph = regimeIcon(governmentType);
  const pips = TIER_PIPS[tier ?? ""] ?? 3;
  const flag = flagUrl && /^(https?:|\/|data:)/.test(flagUrl) ? flagUrl : undefined;
  const disc = Math.round(size * 0.64);
  const waxRadius = "48% 52% 47% 53% / 52% 47% 53% 48%";
  return (
    <div className={cn("seal-shimmer relative shrink-0", className)} style={{ width: size, height: size }}>
      {/* wax body */}
      <div
        className="absolute inset-0"
        style={{
          borderRadius: waxRadius,
          background: "radial-gradient(circle at 38% 30%, #e2ad4a, #bd872f 46%, #8a5a1e 78%, #5f3d14)",
          boxShadow: "inset 0 2px 3px rgba(255,236,190,0.5), inset 0 -4px 8px rgba(58,30,0,0.55), 0 4px 14px rgba(0,0,0,0.45)",
        }}
      />
      {/* flag disc pressed into the wax (signet) */}
      <div
        className="absolute grid place-items-center"
        style={{
          top: (size - disc) / 2, left: (size - disc) / 2, width: disc, height: disc, borderRadius: "50%",
          backgroundColor: "#3a2a12",
          backgroundImage: flag ? `url("${flag}")` : "none",
          backgroundSize: "cover", backgroundPosition: "center",
          boxShadow: "inset 0 2px 6px rgba(0,0,0,0.6), inset 0 0 0 2px rgba(95,61,20,0.85)",
        }}
      >
        <div className="pointer-events-none absolute inset-0 rounded-full" style={{ background: "radial-gradient(circle at 40% 35%, rgba(226,173,74,0.14), rgba(95,61,20,0.3))" }} />
        <Glyph style={{ width: disc * 0.5, height: disc * 0.5, color: "rgba(52,32,6,0.62)", filter: "drop-shadow(0 1px 0 rgba(255,238,196,0.5))" }} />
      </div>
      {/* rim pips — living status by economic tier */}
      {showPips && (
        <div className="absolute inset-x-0 flex justify-center" style={{ bottom: size * 0.015, gap: size * 0.02 }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <Star
              key={i}
              style={{ width: size * 0.09, height: size * 0.09, filter: "drop-shadow(0 1px 0 rgba(58,30,0,0.5))" }}
              className={i < pips ? "fill-amber-100 text-amber-100" : "fill-transparent text-amber-950/50"}
              strokeWidth={1.5}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── composite hero — map (left) · rings + economy + needs-you + launcher ─────
function CompositeHero({ d, countryId, bands, onDeclare }: { d: any; countryId: string | null; bands: any[]; onDeclare: (g?: string) => void }) {
  const rings = bands.map((b) => {
    let icon = Shield;
    if (b.name === "Economy") icon = DollarSign;
    else if (b.name === "Wellbeing") icon = Users;
    else if (b.name === "Standing") icon = Shield;
    else if (b.name === "Capacity") icon = Building;

    return {
      key: b.name,
      label: b.name,
      subtitle: b.sub,
      color: RING_COLOR[b.tone as Tone],
      value: Math.round(b.score),
      displayValue: b.value, // the band word — never a raw number
      icon,
    };
  });
  return (
    <FacetContainer variant="mycountry" depth={1} className="overflow-hidden p-0">
      <div className="grid gap-0 lg:grid-cols-[1.05fr_1.35fr]">
        {/* map */}
        <div className="relative min-h-[260px] border-b border-white/5 lg:border-b-0 lg:border-r">
          {countryId ? (
            <CountryMapEmbed countryId={countryId} height="h-full" interactive className="h-full" />
          ) : (
            <div className="bg-muted/40 h-full min-h-[260px] w-full animate-pulse" />
          )}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end gap-3 bg-gradient-to-t from-black/75 to-transparent p-4">
            <StateSeal flagUrl={d.flag} governmentType={d.governmentType} tier={d.economicTier} size={78} className="pointer-events-auto" />
            <div className="pb-1">
              <div className="text-white/70 text-[10px] font-bold tracking-[0.16em] uppercase">
                {d.governmentType ?? "Government"} · {d.region ?? "—"}
              </div>
              <h1 className="text-xl font-bold tracking-tight text-white drop-shadow">{d.name ?? "Select a country"}</h1>
              <div className="text-white/60 text-[10px]">{d.economicTier ?? ""} · sealed by the state</div>
            </div>
          </div>
        </div>

        {/* right */}
        <div className="flex flex-col gap-4 p-5">
          {/* vitality rings — the platform signature; shows band words, not % */}
          <VitalityRings rings={rings as any} title="Vitality" variant="horizontal" />

          {/* real economy — the nation's own money */}
          <div className="grid grid-cols-3 gap-2">
            <EconStat label="Output" value={formatCurrency(d.currentTotalGdp)} sub={d.economicTier ?? ""} />
            <EconStat label="Per capita" value={formatCurrency(d.currentGdpPerCapita)} sub={formatPopulation(d.currentPopulation) + " people"} />
            <EconStat
              label="Currency"
              value={d.currency ? `${d.currency}${d.currencySymbol ? ` ${d.currencySymbol}` : ""}` : "—"}
              sub="national tender"
            />
          </div>

          {/* what needs you + launcher */}
          <div className="grid gap-3 sm:grid-cols-2">
            <NeedsYou countryId={countryId} onDeclare={onDeclare} />
            <button
              onClick={() => onDeclare()}
              className="group border-amber-400/40 bg-amber-500/10 hover:bg-amber-500/20 flex flex-col justify-between rounded-xl border p-3.5 text-left transition"
            >
              <div className="flex items-center gap-2 text-amber-300">
                <Sparkles className="h-4 w-4" />
                <span className="text-[13px] font-bold">Issue a directive</span>
              </div>
              <div className="text-muted-foreground mt-2 text-[11px] leading-snug">
                Tell the government a goal in plain words — it proposes Measured / Moderate / Extreme.
              </div>
              <div className="mt-2 flex items-center gap-1 text-[11px] font-semibold text-amber-300/80 group-hover:text-amber-200">
                Open composer <ChevronRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
              </div>
            </button>
          </div>
        </div>
      </div>
    </FacetContainer>
  );
}

function EconStat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="border-border/60 bg-white/[0.02] rounded-lg border p-2.5">
      <div className="text-muted-foreground/70 text-[9px] font-bold tracking-wider uppercase">{label}</div>
      <div className="text-foreground mt-0.5 truncate text-sm font-bold tabular-nums">{value}</div>
      <div className="text-muted-foreground/70 truncate text-[10px]">{sub}</div>
    </div>
  );
}

// ── "what needs you" — reactive issues, ranked ───────────────────────────────
function NeedsYou({ countryId, onDeclare }: { countryId: string | null; onDeclare: (g?: string) => void }) {
  const { data: issues = [] } = api.nationalIssues.getMyIssues.useQuery(
    { countryId: countryId!, status: "active" } as any,
    { enabled: !!countryId, retry: false }
  );
  const list = (issues as any[]).slice(0, 3);
  return (
    <div className="border-border/60 bg-white/[0.02] rounded-xl border p-3.5">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[12px] font-bold">What needs you</span>
        <span className={cn("rounded-full px-1.5 py-0.5 text-[9px] font-bold", list.length ? "bg-red-500/15 text-red-300" : "bg-emerald-500/15 text-emerald-300")}>
          {list.length || "0"}
        </span>
      </div>
      {list.length === 0 ? (
        <div className="text-muted-foreground text-[11px] leading-snug">Nothing urgent on the desk. A good day to declare something ambitious.</div>
      ) : (
        <div className="space-y-1.5">
          {list.map((i: any) => (
            <div key={i.id} className="flex items-start gap-1.5 text-[11px]">
              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-amber-400" />
              <span className="text-foreground/85 line-clamp-1">{i.title}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── SWITCH layout: Brief (feed spine) / Directive (composer) ─────────────────
function SwitchBody({ d, mode, setMode, countryId, name, bands, posts, ledger, onCommitted, onDeclare }: any) {
  return (
    <>
      <div className="flex items-center justify-center">
        <div className="border-border/70 bg-card/40 inline-flex rounded-lg border p-0.5 text-[12px] font-semibold">
          <LayoutBtn active={mode === "brief"} onClick={() => setMode("brief")} icon={<Newspaper className="h-3.5 w-3.5" />}>Brief</LayoutBtn>
          <LayoutBtn active={mode === "directive"} onClick={() => setMode("directive")} icon={<TerminalSquare className="h-3.5 w-3.5" />}>Directive</LayoutBtn>
        </div>
      </div>

      {mode === "brief" ? (
        <div className="grid gap-4 lg:grid-cols-[1.55fr_1fr]">
          <div className="space-y-3">
            <DispatchHeader />
            <DispatchFeed posts={posts} />
          </div>
          <div className="space-y-4">
            <StandingCard bands={bands} onDeclare={onDeclare} />
            <RecordCard ledger={ledger} seal={d} />
          </div>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1.55fr_1fr]">
          {countryId && <IntentComposer countryId={countryId} initialGoal="" onCommitted={onCommitted} />}
          <div className="space-y-4">
            <StandingCard bands={bands} onDeclare={onDeclare} />
            <RecordCard ledger={ledger} seal={d} />
          </div>
        </div>
      )}
    </>
  );
}

// ── HUB layout: 4 action-domain tiles + feed spine ───────────────────────────
function HubBody({ d, bands, posts, onDeclare }: any) {
  const byName = (n: string) => bands.find((b: any) => b.name === n);
  const tiles = [
    { key: "executive", name: "Executive", icon: Landmark, color: "from-amber-500 to-yellow-500", band: byName("Capacity"), sub: "Issues, policies, directives", href: "/mycountry/executive" },
    { key: "diplomacy", name: "Diplomacy", icon: Handshake, color: "from-cyan-500 to-blue-500", band: byName("Standing"), sub: "Relations, embassies, treaties", href: "/mycountry/diplomacy" },
    { key: "politics", name: "Politics", icon: Vote, color: "from-purple-500 to-fuchsia-500", band: byName("Wellbeing"), sub: "Parties, elections, legislature", href: "/mycountry/politics" },
    { key: "economy", name: "Economy", icon: Coins, color: "from-emerald-500 to-teal-500", band: byName("Economy"), sub: formatCurrency(d.currentTotalGdp) + " output", href: "/mycountry" },
  ];
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map((t) => (
          <a key={t.key} href={t.href} className="group">
            <FacetCard depth={2} interactive="hover" className="h-full p-4">
              <div className="flex items-center justify-between">
                <div className={cn("grid h-9 w-9 place-items-center rounded-lg bg-gradient-to-br text-white shadow-sm", t.color)}>
                  <t.icon className="h-4 w-4" />
                </div>
                {t.band && (
                  <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold", TONE_CLS[t.band.tone as Tone])}>
                    <span className={cn("h-1.5 w-1.5 rounded-full", DOT_CLS[t.band.tone as Tone])} /> {t.band.value}
                  </span>
                )}
              </div>
              <div className="mt-3 text-[15px] font-bold">{t.name}</div>
              <div className="text-muted-foreground truncate text-[11px]">{t.sub}</div>
              <div className="text-muted-foreground/70 mt-2 flex items-center gap-1 text-[11px] font-medium group-hover:text-amber-300">
                Open <ChevronRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
              </div>
            </FacetCard>
          </a>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.55fr_1fr]">
        <div className="space-y-3">
          <DispatchHeader />
          <DispatchFeed posts={posts} />
        </div>
        <div className="space-y-4">
          <StandingCard bands={bands} onDeclare={onDeclare} />
        </div>
      </div>
    </>
  );
}

// ── shared pieces ────────────────────────────────────────────────────────────
function DispatchHeader() {
  return (
    <div className="flex items-end justify-between px-1 pt-1">
      <h2 className="text-lg font-bold tracking-tight">The feed</h2>
      <span className="text-muted-foreground/70 text-[11px]">your decisions become headlines · the world answers</span>
    </div>
  );
}

function DispatchFeed({ posts }: { posts: any[] }) {
  if (posts.length === 0)
    return <FacetCard depth={2} className="text-muted-foreground p-5 text-sm">No events yet. Issue a directive to begin the story.</FacetCard>;
  return (
    <div className="space-y-3">
      {posts.map((p: any) => {
        const m = sourceMeta(p.kind);
        return (
          <FacetCard key={p.id} depth={2} interactive="hover" className="p-4">
            <div className="mb-1.5 flex items-center gap-2.5">
              <div className={cn("grid h-9 w-9 place-items-center rounded-lg bg-gradient-to-br text-sm font-bold text-white", m.ring)}>{m.glyph}</div>
              <div className="flex-1">
                <div className="text-[12px] font-semibold">{m.who}</div>
                <div className="text-muted-foreground/70 text-[11px]">{fmtTime(p.timestamp)}</div>
              </div>
            </div>
            <div className="text-foreground/90 text-[14px] leading-relaxed">{p.title}</div>
            {p.body && <div className="text-muted-foreground mt-1 text-[13px] leading-relaxed">{p.body}</div>}
          </FacetCard>
        );
      })}
    </div>
  );
}

function StandingCard({ bands, onDeclare }: { bands: any[]; onDeclare: (g?: string) => void }) {
  return (
    <FacetCard depth={1} className="p-5">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-bold">National standing</span>
        <span className="text-muted-foreground/70 text-[10px]">bands, not numbers</span>
      </div>
      <div className="space-y-2">
        {bands.map((b: any) => (
          <div key={b.name} className="flex items-center gap-2">
            <span className={cn("h-2 w-2 rounded-full", DOT_CLS[b.tone as Tone], b.tone === "fog" && "animate-pulse")} />
            <span className="text-foreground/80 flex-1 text-[13px]">{b.name}</span>
            <span className="text-foreground text-[12px] font-semibold">{b.value}</span>
          </div>
        ))}
      </div>
      <button onClick={() => onDeclare()} className="border-amber-400/40 bg-amber-500/10 hover:bg-amber-500/20 mt-4 flex w-full items-center justify-center gap-1.5 rounded-lg border py-2 text-[13px] font-semibold text-amber-300 transition">
        <Sparkles className="h-3.5 w-3.5" /> Issue a directive
      </button>
    </FacetCard>
  );
}

function RecordCard({ ledger, seal }: { ledger: any[]; seal?: any }) {
  return (
    <FacetCard depth={1} className="p-5">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-bold">The record</span>
        <span className="text-muted-foreground/70 text-[10px]">bounded &amp; logged</span>
      </div>
      <div className="border-border bg-card/10 rounded-xl border">
        {ledger.length === 0 && <div className="text-muted-foreground px-3 py-4 text-xs">No entries yet. Every change lands here with what moved and why.</div>}
        {ledger.map((l) => {
          const up = (l.deltaValue ?? 0) >= 0;
          return (
            <div key={l.id} className="border-border/60 flex items-center gap-2.5 border-b px-3 py-2.5 last:border-0">
              {l.sourceType === "decision" ? (
                <span className="flex items-center gap-1" title="Sealed by the state">
                  <StateSeal flagUrl={seal?.flag} governmentType={seal?.governmentType} size={18} showPips={false} />
                  <span className="text-[8px] font-bold tracking-wide text-amber-500/90 uppercase">sealed</span>
                </span>
              ) : (
                <span className="bg-card text-muted-foreground rounded px-1.5 py-0.5 text-[9px] font-bold uppercase">{l.sourceType}</span>
              )}
              <span className="text-foreground/80 flex-1 text-[12px]">{l.description}</span>
              {l.deltaValue != null && (
                <span className={cn("flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[11px] font-bold", up ? "bg-emerald-500/10 text-emerald-300" : "bg-red-500/10 text-red-300")}>
                  {up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                  {l.targetField ?? ""}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </FacetCard>
  );
}

// ── intent composer (shared: bottom sheet + Directive mode) ──────────────────
function IntentComposer({ countryId, initialGoal, onCommitted }: { countryId: string; initialGoal: string; onCommitted: (res: any) => void }) {
  const [q, setQ] = useState(initialGoal ?? "");
  const [goal, setGoal] = useState<string | null>(initialGoal || null);
  const [err, setErr] = useState<string | null>(null);
  const [parentId, setParentId] = useState<string | null>(null);
  const [chainOf, setChainOf] = useState<string | null>(null);
  const [justCommitted, setJustCommitted] = useState<{ id: string; goal: string } | null>(null);
  const [policyOpen, setPolicyOpen] = useState(false);
  useEffect(() => {
    if (initialGoal) { setQ(initialGoal); setGoal(initialGoal); }
  }, [initialGoal]);

  const tree = api.intent.getTree.useQuery({ countryId }, { enabled: !!countryId });
  const suggest = api.intent.suggest.useQuery(
    { countryId, goal: goal ?? "" },
    { enabled: !!goal && (goal?.trim().length ?? 0) >= 2 }
  );
  const commitM = api.intent.commit.useMutation({
    onSuccess: (res) => { onCommitted(res); setGoal(null); setQ(""); setParentId(null); setChainOf(null); setJustCommitted({ id: res.intent.id, goal: res.intent.goal }); },
    onError: (e) => setErr(e.message),
  });

  const propose = (g: string) => { setErr(null); if (g.trim().length >= 2) setGoal(g.trim()); };
  const commitTier = (tier: string) => { setErr(null); commitM.mutate({ countryId, goal: goal!, tier: tier as any, parentId: parentId ?? undefined }); };

  const data = suggest.data;
  const status = data?.status;
  const canCommit = (status?.canCommit ?? true) && !commitM.isPending;

  return (
    <div className="space-y-3">
      <FacetContainer variant="mycountry" depth={1} enableRefraction={false} className="p-0">
        <div className="flex items-center gap-3 p-4">
          <Command className="h-4 w-4 shrink-0 text-amber-400" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") propose(q); }}
            placeholder="What is your government trying to accomplish?  e.g. make housing affordable"
            className="placeholder:text-muted-foreground/50 facet-refraction-none flex-1 bg-transparent text-[16px] outline-none"
          />
          {suggest.isFetching ? <Loader2 className="h-4 w-4 animate-spin text-amber-400" /> : <span className="border-border text-muted-foreground rounded-md border px-2 py-0.5 text-[11px]">⏎</span>}
        </div>
      </FacetContainer>

      {chainOf && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-400/30 bg-amber-500/10 px-3 py-1.5 text-[12px] text-amber-200">
          ↳ continuing: <span className="font-semibold">{chainOf}</span>
          <button onClick={() => { setParentId(null); setChainOf(null); }} className="ml-auto text-amber-300/70 hover:text-amber-200">✕</button>
        </div>
      )}
      {justCommitted && !goal && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-[12px] text-emerald-200">
          ✓ Committed: <span className="font-semibold">{justCommitted.goal}</span>
          <button onClick={() => { setParentId(justCommitted.id); setChainOf(justCommitted.goal); setJustCommitted(null); }} className="ml-auto rounded-md border border-emerald-400/40 px-2 py-0.5 font-semibold hover:bg-emerald-500/20">Build on this →</button>
        </div>
      )}
      {err && <div className="rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-[12px] text-red-300">{err}</div>}
      {status && !status.canCommit && (
        <div className="rounded-lg border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-[12px] text-amber-200">
          Your government is executing this week's agenda ({status.usedThisWeek}/{status.cap}). New intents open after the weekly cooldown.
        </div>
      )}

      {!goal ? (
        <div className="space-y-1.5">
          <div className="text-muted-foreground px-1 text-[11px] font-bold tracking-widest uppercase">Suggested — from the state of your nation</div>
          {GOAL_CHIPS.map((g) => (
            <button key={g} onClick={() => propose(g)} className="flex w-full items-center gap-3 rounded-xl border border-transparent px-3.5 py-2.5 text-left hover:border-amber-400/30 hover:bg-amber-500/[0.06]">
              <span className="bg-muted grid h-7 w-7 place-items-center rounded-lg text-sm">✦</span>
              <span className="flex-1 text-[13px] font-medium">{g}</span>
              <span className="text-muted-foreground text-[10px]">goal</span>
            </button>
          ))}
        </div>
      ) : suggest.isFetching || !data ? (
        <div className="text-muted-foreground px-1 py-6 text-center text-sm">
          <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin text-amber-400" /> Your ministries are drawing up options…
        </div>
      ) : (
        <div className="space-y-2">
          <div className="px-1 text-[11px] font-bold tracking-widest text-amber-300/80 uppercase">
            “{goal}” — your government proposes
            {data.category && <span className="text-muted-foreground ml-2 lowercase">· {data.category}{data.target ? ` · ${data.target}` : ""}</span>}
          </div>
          {data.foreignNeedsTarget && (
            <div className="rounded-lg border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-[12px] text-amber-200">Foreign-policy intents need a specific target — name who or what (e.g. “…with Burgundie”).</div>
          )}
          {data.packages.map((p: any) => (
            <button key={p.tier} disabled={!canCommit} onClick={() => commitTier(p.tier)} className="border-border w-full rounded-xl border px-4 py-3 text-left transition hover:border-amber-400/50 hover:bg-amber-500/[0.05] disabled:cursor-not-allowed disabled:opacity-50">
              <div className="flex items-center justify-between">
                <div className="text-[13px] font-bold">{p.title}</div>
                <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-semibold", TONE_CLS[p.acceptance as Tone])}>
                  {p.acceptance === "good" ? "Broad support" : p.acceptance === "mid" ? "Contested" : "Hard sell"}
                </span>
              </div>
              <div className="text-muted-foreground mt-0.5 text-[12px]">{p.blurb}</div>
              <ul className="mt-2 space-y-1">
                {p.changes.map((c: any, i: number) => (
                  <li key={i} className="flex items-start gap-2 text-[12px]">
                    <span className="mt-[3px] text-amber-400">{c.kind === "budget" ? "▤" : c.kind === "policy" ? "◈" : c.kind === "foreign" ? "◇" : "•"}</span>
                    <span className="text-foreground/90">{c.label}<span className="text-muted-foreground"> — {c.detail}</span></span>
                  </li>
                ))}
              </ul>
              <div className="text-muted-foreground/70 mt-2 text-[10px] tracking-wide uppercase">{p.risk} · reserves {p.civCapCost} capacity</div>
            </button>
          ))}
          {data.broker && (
            <div className="text-muted-foreground/80 px-1 text-[11px]">
              Acceptance weighted by <span className="text-foreground/80 font-medium">{data.broker.name}</span>
              {data.broker.unlocked ? (data.broker.satisfied ? " · currently satisfied" : " · currently restless") : " · not a factor here"}.
            </div>
          )}
          <div className="flex items-center justify-between px-1 pt-1">
            <button onClick={() => setGoal(null)} className="text-muted-foreground hover:text-foreground text-[12px]">← no action / rethink</button>
            <button onClick={() => setPolicyOpen(true)} className="text-[11px] font-medium text-amber-300/80 hover:text-amber-200">Draft your own package →</button>
          </div>
        </div>
      )}

      {/* agenda / dependency tree */}
      {(tree.data ?? []).length > 0 && (
        <div className="border-border/60 mt-1 rounded-xl border p-3.5">
          <div className="mb-2 text-[12px] font-bold">Your agenda</div>
          <div className="space-y-1">
            {(tree.data ?? [])
              .filter((it: any) => !it.parentId || !(tree.data ?? []).some((x: any) => x.id === it.parentId))
              .map((root: any) => (
                <div key={root.id}>
                  <div className="flex items-center gap-2 py-1 text-[12px]">
                    <span className={cn("rounded px-1.5 py-0.5 text-[9px] font-bold uppercase", TONE_CLS[root.tier === "measured" ? "good" : root.tier === "moderate" ? "mid" : "bad"])}>{root.tier}</span>
                    <span className="text-foreground/90 flex-1 truncate">{root.goal}</span>
                    <span className="text-muted-foreground text-[10px]">{root.category}</span>
                  </div>
                  {(tree.data ?? []).filter((x: any) => x.parentId === root.id).map((kid: any) => (
                    <div key={kid.id} className="ml-3 border-l border-white/10 pl-3">
                      <div className="flex items-center gap-2 py-1 text-[12px]">
                        <span className="text-amber-400">↳</span>
                        <span className="text-foreground/80 flex-1 truncate">{kid.goal}</span>
                        <span className="text-muted-foreground text-[10px]">{kid.tier}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
          </div>
        </div>
      )}

      <PolicyCreatorSheet countryId={countryId} open={policyOpen} onOpenChange={setPolicyOpen} />
    </div>
  );
}

// labs route: design-iteration view with the country picker
export default function MyCountryV2Page() {
  return <MyCountryV2 />;
}
