"use client";

/**
 * MyCountry v2 — labs preview (design-bible v2).
 *
 * Blends the two variants the user liked:
 *  - "The Briefing" (editorial situation-room: AI morning brief + attention model + bands)
 *  - "The Ticker"  (living feed as the main surface: the dashboard IS the stream)
 * ...with a mode toggle to "The Console" as Executive mode (AI-chatbox intent bar).
 *
 * Live data: api.mycountry.getCountryDashboard / getCanonFeed / getChangeLog + useUserCountry.
 * ponytail: map hero uses the live flag as a cover (real map component can mount in the
 * marked slot later — kept out to avoid the map-engine lifecycle in a labs page).
 */

import React, { useEffect, useMemo, useState } from "react";
import {
  Newspaper,
  Globe2,
  Sparkles,
  TerminalSquare,
  ArrowUpRight,
  ArrowDownRight,
  CircleDot,
  Command,
  Send,
  Loader2,
} from "lucide-react";
import { api } from "~/trpc/react";
import { FacetCard, FacetContainer } from "~/components/ui/facet-container";
import { useUserCountry } from "~/hooks/useUserCountry";
import { PolicyCreatorSheet } from "~/components/executive/PolicyCreatorSheet";
import { IxTime } from "~/lib/ixtime";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";

// ── band helpers (bible §7: bands, never numbers) ──────────────────────────
type Tone = "good" | "mid" | "bad" | "fog" | "info";
function toBand(score: number | null | undefined): { tone: Tone; label: string } {
  if (score == null || Number.isNaN(score)) return { tone: "fog", label: "Unclear" };
  if (score >= 66) return { tone: "good", label: "Strong" };
  if (score >= 40) return { tone: "mid", label: "Holding" };
  return { tone: "bad", label: "Strained" };
}
const TONE_CLS: Record<Tone, string> = {
  good: "text-emerald-300 bg-emerald-500/10 border-emerald-400/20",
  mid: "text-amber-300 bg-amber-500/10 border-amber-400/20",
  bad: "text-red-300 bg-red-500/10 border-red-400/20",
  info: "text-blue-300 bg-blue-500/10 border-blue-400/20",
  fog: "text-muted-foreground bg-muted/40 border-border",
};
function Band({ label, value, tone }: { label: string; value: string; tone: Tone }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${TONE_CLS[tone]}`}
    >
      <CircleDot className={`h-2.5 w-2.5 ${tone === "fog" ? "animate-pulse" : ""}`} />
      {label}: {value}
    </span>
  );
}

// feed source styling
function sourceMeta(kind: string) {
  switch (kind) {
    case "decision":
      return {
        who: "Government",
        av: "gov",
        tone: "text-blue-300 bg-blue-500/12",
        ring: "from-blue-500 to-amber-600",
      };
    case "diplomacy":
      return {
        who: "World",
        av: "world",
        tone: "text-purple-300 bg-purple-500/12",
        ring: "from-purple-500 to-fuchsia-600",
      };
    default:
      return {
        who: "Press",
        av: "press",
        tone: "text-foreground/90 bg-muted/50",
        ring: "from-slate-500 to-slate-700",
      };
  }
}
function fmtTime(ts: number) {
  const d = new Date(ts);
  const diff = Date.now() - ts;
  if (diff < 3_600_000) return `${Math.max(1, Math.round(diff / 60000))}m ago`;
  if (diff < 86_400_000) return `${Math.round(diff / 3_600_000)}h ago`;
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

type LocalPost = { id: string; kind: string; title: string; body: string; timestamp: number };

const GOAL_CHIPS = [
  "Cool the housing market",
  "Modernize the navy",
  "Court a neighbour as an ally",
  "Rein in inflation",
  "Develop the coast",
];

// ponytail: shell lives under app/labs for now; relocate to components/mycountry/v2
// when v2 stabilizes. Both /labs/mycountry-v2 and /mycountry/v2 render it.
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
  const { data: countriesData } = api.countries.getAll.useQuery(
    { limit: 300 },
    { enabled: showPicker }
  );
  const countries = countriesData?.countries;
  const [countryId, setCountryId] = useState<string | null>(null);
  useEffect(() => {
    if (lockedCountryId) {
      setCountryId(lockedCountryId);
      return;
    }
    if (!countryId) setCountryId((userCountry as any)?.id ?? countries?.[0]?.id ?? null);
  }, [lockedCountryId, userCountry, countries, countryId]);

  const enabled = !!countryId;
  const { data: dash, isLoading: dashLoading } = api.mycountry.getCountryDashboard.useQuery(
    { countryId: countryId!, includeHistory: false },
    { enabled }
  );
  const { data: feed = [] } = api.mycountry.getCanonFeed.useQuery(
    { countryId: countryId!, limit: 30 },
    { enabled }
  );
  const { data: ledger = [] } = api.mycountry.getChangeLog.useQuery(
    { countryId: countryId!, limit: 20 },
    { enabled }
  );

  const [mode, setMode] = useState<"briefing" | "executive">("briefing");
  const [local, setLocal] = useState<LocalPost[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [ixYear, setIxYear] = useState<number | null>(null);
  useEffect(() => {
    try {
      setIxYear(new Date(IxTime.getCurrentIxTime()).getFullYear());
    } catch {
      /* dateline is decorative — omit if unavailable */
    }
  }, []);
  useEffect(() => {
    setLocal([]);
  }, [countryId]); // reset optimistic feed on country switch

  const d: any = dash ?? {};
  const bands = useMemo(() => {
    const mk = (name: string, score: number) => {
      const b = toBand(score);
      return { name, tone: b.tone, value: b.label };
    };
    return [
      mk("Economy", d.economicVitality),
      mk("Wellbeing", d.populationWellbeing),
      mk("Standing", d.diplomaticStanding),
      mk("Capacity", d.governmentalEfficiency),
      { name: "Treasury", tone: "fog" as Tone, value: "Unclear" }, // demonstrates Fog of Information
    ];
  }, [d.economicVitality, d.populationWellbeing, d.diplomaticStanding, d.governmentalEfficiency]);

  // synthesize the "AI morning brief" from live bands (no raw numbers)
  const briefing = useMemo(() => {
    if (!dash) return null;
    const strong = bands.filter((b) => b.tone === "good").map((b) => b.name);
    const weak = bands.filter((b) => b.tone === "bad").map((b) => b.name);
    const name = d.name ?? "your nation";
    const lead = strong.length
      ? `${name}'s ${strong.join(" and ").toLowerCase()} ${strong.length > 1 ? "are" : "is"} strong this session.`
      : `${name} holds steady this session.`;
    const worry = weak.length
      ? `Your attention is wanted on ${weak.join(" and ").toLowerCase()} — the numbers below are shown as evidence, not a scoreboard.`
      : `No red flags on the desk — a good day to declare something ambitious.`;
    return { lead, worry };
  }, [dash, bands, d.name]);

  // merged feed: optimistic local intents first, then live canon
  const posts = useMemo(() => {
    const live = (feed as any[]).map((f) => ({
      id: f.id,
      kind: f.kind,
      title: f.title,
      body: "",
      timestamp: f.timestamp,
    }));
    return [...local, ...live].slice(0, 40);
  }, [feed, local]);

  const utils = api.useUtils();
  const [execGoal, setExecGoal] = useState<string | null>(null);

  // briefing rail hands the goal to Executive mode (where the packages live)
  function handoffToExecutive(goal: string) {
    const g = goal.trim();
    if (!g) return;
    setExecGoal(g);
    setMode("executive");
  }

  // called after a real intent.commit succeeds: optimistic feed + toast + refetch
  function handleCommitted(res: any) {
    const body = (res?.summary as string) ?? "Intent committed.";
    setLocal((p) => [
      {
        id: res?.intent?.id ?? `local_${Date.now()}`,
        kind: "decision",
        title: `Intent: ${res?.intent?.goal ?? ""}`,
        body,
        timestamp: Date.now(),
      },
      ...p,
    ]);
    setToast(`◆ In-world: ${body}`);
    setTimeout(() => setToast(null), 4500);
    void utils.mycountry.getCanonFeed.invalidate();
    void utils.mycountry.getChangeLog.invalidate();
    void utils.mycountry.getCountryDashboard.invalidate();
    void utils.intent.getStatus.invalidate();
    void utils.intent.getTree.invalidate();
  }

  const rawFlag = d.flag as string | undefined;
  const flag = rawFlag && /^(https?:|\/|data:)/.test(rawFlag) ? rawFlag : undefined; // guard: skip emoji/empty flags

  return (
    <div
      className="bg-background text-foreground min-h-screen"
      style={{
        backgroundImage:
          "radial-gradient(1100px 560px at 12% -6%, rgba(202,138,4,0.10), transparent 60%), radial-gradient(900px 500px at 100% 0%, rgba(99,102,241,0.06), transparent 55%)",
      }}
    >
      {/* Gazette design system — the "State Seal" signature + editorial type.
          ponytail: scoped style block; graduate to facet/*.css if v2 ships. */}
      <style>{`
        .gz-serif { font-family: "Iowan Old Style","Palatino Linotype",Palatino,Georgia,ui-serif,serif; }
        .gz-mono { font-family: ui-monospace,"SF Mono","JetBrains Mono",Menlo,monospace; }
        .gz-foil { background: linear-gradient(92deg,#a16207,#eab308 42%,#fde68a 56%,#ca8a04); -webkit-background-clip:text; background-clip:text; color:transparent; }
        .gz-rule { height:1px; background:linear-gradient(90deg,transparent,rgba(234,179,8,.55),rgba(234,179,8,.12),transparent); }
        .gz-lede::first-letter { float:left; font-size:3.1em; line-height:.8; padding:.06em .12em 0 0; color:#eab308; font-weight:700; font-family:"Iowan Old Style","Palatino Linotype",Palatino,Georgia,ui-serif,serif; }
        .gz-seal { position:relative; width:64px; height:64px; flex:none; }
        .gz-seal .gz-ring { position:absolute; inset:0; border-radius:999px; background:conic-gradient(from 0deg,#8a5a06,#eab308,#fde68a,#ca8a04,#8a5a06); box-shadow:0 6px 22px rgba(202,138,4,.28), inset 0 0 0 1px rgba(0,0,0,.5); animation:gz-spin 22s linear infinite; }
        .gz-seal .gz-disc { position:absolute; inset:5px; border-radius:999px; background-color:#12141a; background-image:var(--gz-flag,none); background-size:cover; background-position:center; box-shadow:inset 0 0 0 1.5px rgba(234,179,8,.55), inset 0 0 12px rgba(0,0,0,.6); display:grid; place-items:center; }
        .gz-seal .gz-glare { position:absolute; inset:0; border-radius:999px; background:radial-gradient(circle at 32% 26%,rgba(255,255,255,.5),transparent 46%); mix-blend-mode:screen; pointer-events:none; }
        .gz-stamp { display:inline-flex; align-items:center; gap:4px; font-family:ui-monospace,monospace; font-size:8px; letter-spacing:.14em; text-transform:uppercase; color:#eab308; border:1px solid rgba(234,179,8,.45); border-radius:5px; padding:1px 5px; transform:rotate(-3.5deg); }
        @keyframes gz-spin { to { transform:rotate(360deg); } }
        @keyframes gz-stampin { from { opacity:0; transform:rotate(-14deg) scale(1.5); } to { opacity:1; transform:rotate(-3.5deg) scale(1); } }
        .gz-stampin { animation:gz-stampin .32s cubic-bezier(.34,1.56,.64,1); }
        @media (prefers-reduced-motion: reduce){ .gz-seal .gz-ring{ animation:none; } .gz-stampin{ animation:none; } }
      `}</style>

      {/* Gazette chrome — slim editorial bar */}
      <div className="border-border/70 bg-background/70 sticky top-0 z-40 flex items-center justify-between gap-3 border-b px-4 py-2 backdrop-blur-xl">
        <div className="gz-mono flex items-center gap-2 text-[11px] font-semibold tracking-[0.16em] uppercase">
          <span className="gz-foil">◉ Gazette of State</span>
          <span className="border-border/70 text-muted-foreground ml-1 rounded border px-1.5 py-0.5 text-[9px] tracking-[0.1em]">
            {previewLabel}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {showPicker && (
            <Select value={countryId ?? ""} onValueChange={(val) => setCountryId(val || null)}>
              <SelectTrigger
                size="sm"
                className="border-border bg-card/40 text-foreground hover:bg-card/70 gz-mono h-7 w-fit min-w-[140px] cursor-pointer text-[11px] tracking-wide focus:border-amber-500/30 focus:ring-amber-500/20"
              >
                <SelectValue placeholder="Select Country" />
              </SelectTrigger>
              <SelectContent className="border-border bg-popover text-popover-foreground">
                {(countries ?? []).map((c: any) => (
                  <SelectItem key={c.id} value={c.id} className="text-xs">
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <div className="border-border/70 bg-card/40 gz-mono flex rounded-md border p-0.5 text-[11px] font-semibold tracking-[0.08em] uppercase">
            <button
              onClick={() => setMode("briefing")}
              className={`flex items-center gap-1.5 rounded px-2.5 py-1 transition ${mode === "briefing" ? "bg-amber-500/20 text-amber-300" : "text-muted-foreground hover:text-foreground"}`}
            >
              <Newspaper className="h-3.5 w-3.5" /> Brief
            </button>
            <button
              onClick={() => setMode("executive")}
              className={`flex items-center gap-1.5 rounded px-2.5 py-1 transition ${mode === "executive" ? "bg-amber-500/20 text-amber-300" : "text-muted-foreground hover:text-foreground"}`}
            >
              <TerminalSquare className="h-3.5 w-3.5" /> Directive
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl space-y-4 p-4">
        {/* MASTHEAD — the hero. State Seal signature + serif nameplate + dateline. */}
        <FacetContainer
          variant="mycountry"
          depth={1}
          className="facet-texture-paper-grain relative overflow-hidden p-6"
        >
          {/* faint flag wash behind the masthead */}
          {flag && (
            <img
              src={flag}
              alt=""
              className="pointer-events-none absolute inset-0 h-full w-full scale-110 object-cover opacity-[0.08] blur-lg"
            />
          )}
          <div className="relative flex items-start gap-5">
            {/* the seal */}
            <div
              className="gz-seal mt-0.5"
              style={{ ["--gz-flag" as any]: flag ? `url("${flag}")` : "none" }}
            >
              <div className="gz-ring" />
              <div className="gz-disc">
                {!flag && (
                  <span className="gz-serif text-2xl font-black text-amber-300/90">
                    {(d.name ?? "?")[0]}
                  </span>
                )}
              </div>
              <div className="gz-glare" />
            </div>
            {/* nameplate */}
            <div className="min-w-0 flex-1">
              <div className="gz-mono text-muted-foreground text-[10px] tracking-[0.2em] uppercase">
                {d.governmentType ?? "Government"} · {d.region ?? "—"}
              </div>
              <h1 className="gz-serif mt-1 truncate text-3xl font-bold tracking-tight sm:text-[2.4rem] sm:leading-[1.05]">
                {dashLoading ? "…" : (d.name ?? "Select a country")}
              </h1>
              <div className="gz-mono text-muted-foreground/80 mt-1.5 text-[10px] tracking-[0.14em] uppercase">
                Under the hand of {d.leader ?? "the government"}
                {ixYear ? ` · year ${ixYear}` : ""} · {d.economicTier ?? "—"} economy
              </div>
            </div>
          </div>

          <div className="gz-rule my-4" />

          {/* standing ledger strip — the bands, editorial */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <span className="gz-mono text-muted-foreground/70 text-[9px] tracking-[0.2em] uppercase">
              State of the Nation
            </span>
            {bands.map((b: any) => (
              <div key={b.name} className="flex items-center gap-1.5">
                <span
                  className={`h-1.5 w-1.5 rounded-full ${b.tone === "good" ? "bg-emerald-400" : b.tone === "mid" ? "bg-amber-400" : b.tone === "bad" ? "bg-red-400" : b.tone === "info" ? "bg-blue-400" : "bg-zinc-500"} ${b.tone === "fog" ? "animate-pulse" : ""}`}
                />
                <span className="gz-mono text-muted-foreground text-[10px] tracking-wide uppercase">
                  {b.name}
                </span>
                <span className="text-foreground/90 text-[12px] font-semibold">{b.value}</span>
              </div>
            ))}
          </div>
        </FacetContainer>

        {mode === "briefing" ? (
          <div className="grid gap-4 lg:grid-cols-[1.55fr_1fr]">
            {/* LEFT: the living feed, led by the AI brief */}
            <div className="space-y-4">
              <FacetCard depth={1} className="facet-texture-paper-grain p-6">
                <div className="gz-mono mb-3 flex items-center justify-between text-[10px] tracking-[0.2em] uppercase">
                  <span className="text-amber-400/90">Morning Brief</span>
                  <span className="text-muted-foreground/70">
                    {ixYear ? `Year ${ixYear}` : "Executive"} · Dispatch
                  </span>
                </div>
                {briefing ? (
                  <p className="gz-serif gz-lede text-foreground/90 text-[17px] leading-[1.7]">
                    <span className="text-foreground font-semibold">{briefing.lead}</span>{" "}
                    {briefing.worry}
                  </p>
                ) : (
                  <p className="text-muted-foreground text-sm">Compiling the brief…</p>
                )}
              </FacetCard>

              <div className="flex items-end justify-between px-1 pt-1">
                <h2 className="gz-serif text-xl font-bold tracking-tight">Dispatches</h2>
                <span className="gz-mono text-muted-foreground/70 text-[9px] tracking-[0.16em] uppercase">
                  Your decrees · the world answers
                </span>
              </div>

              {posts.length === 0 && (
                <FacetCard depth={2} className="text-muted-foreground p-5 text-sm">
                  No dispatches yet. Issue a directive to begin the record.
                </FacetCard>
              )}
              {posts.map((p: any) => {
                const m = sourceMeta(p.kind);
                return (
                  <FacetCard key={p.id} depth={2} interactive="hover" className="p-4">
                    <div className="mb-1.5 flex items-center gap-2.5">
                      <div
                        className={`grid h-9 w-9 place-items-center rounded-lg bg-gradient-to-br ${m.ring} text-sm font-bold text-white`}
                      >
                        {p.kind === "decision" ? "◉" : p.kind === "diplomacy" ? "◇" : "▦"}
                      </div>
                      <div className="flex-1">
                        <div className="gz-mono flex items-center gap-2 text-[11px] font-semibold tracking-[0.08em] uppercase">
                          {m.who}
                          <span className={`rounded px-1.5 py-0.5 text-[8px] tracking-wide ${m.tone}`}>
                            {p.kind}
                          </span>
                        </div>
                        <div className="gz-mono text-muted-foreground/70 text-[10px] tracking-wide uppercase">
                          {fmtTime(p.timestamp)}
                        </div>
                      </div>
                    </div>
                    <div className="gz-serif text-foreground text-[15px] leading-snug">{p.title}</div>
                    {p.body && (
                      <div className="text-muted-foreground mt-1 text-[13px] leading-relaxed">
                        {p.body}
                      </div>
                    )}
                  </FacetCard>
                );
              })}
            </div>

            {/* RIGHT: attention + declare + ledger */}
            <div className="space-y-4">
              <FacetContainer variant="mycountry" depth={1} className="p-5">
                <div className="gz-mono mb-1 text-[10px] tracking-[0.2em] text-amber-400/90 uppercase">
                  The Executive
                </div>
                <div className="gz-serif mb-3 text-lg font-bold">Issue a directive</div>
                <QuickDeclare onDeclare={handoffToExecutive} />
              </FacetContainer>

              <FacetCard depth={1} className="p-5">
                <div className="mb-3 flex items-center justify-between">
                  <div className="gz-serif text-lg font-bold">The Record</div>
                  <span className="gz-mono text-muted-foreground/70 text-[9px] tracking-[0.16em] uppercase">
                    Sealed &amp; bounded
                  </span>
                </div>
                <div className="border-border bg-card/10 rounded-xl border">
                  {(ledger as any[]).length === 0 && (
                    <div className="text-muted-foreground px-3 py-4 text-xs">
                      No ledger entries yet. Every change lands here with what moved and why.
                    </div>
                  )}
                  {(ledger as any[]).map((l) => {
                    const up = (l.deltaValue ?? 0) >= 0;
                    return (
                      <div
                        key={l.id}
                        className="border-border/60 flex items-center gap-2.5 border-b px-3 py-2.5 last:border-0"
                      >
                        {l.sourceType === "decision" ? (
                          <span className="gz-stamp">◉ sealed</span>
                        ) : (
                          <span className="bg-card text-muted-foreground gz-mono rounded px-1.5 py-0.5 text-[9px] font-bold tracking-wide uppercase">
                            {l.sourceType}
                          </span>
                        )}
                        <span className="text-foreground/80 flex-1 text-[12px]">
                          {l.description}
                        </span>
                        {l.deltaValue != null && (
                          <span
                            className={`flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[11px] font-bold ${up ? "bg-emerald-500/10 text-emerald-300" : "bg-red-500/10 text-red-300"}`}
                          >
                            {up ? (
                              <ArrowUpRight className="h-3 w-3" />
                            ) : (
                              <ArrowDownRight className="h-3 w-3" />
                            )}
                            {l.targetField ?? ""}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </FacetCard>
            </div>
          </div>
        ) : (
          /* EXECUTIVE MODE — the Console (AI-chatbox intent bar) over the same live feed */
          <ExecutiveConsole
            countryId={countryId}
            name={d.name ?? "your nation"}
            bands={bands}
            posts={posts}
            initialGoal={execGoal}
            onCommitted={handleCommitted}
          />
        )}
      </div>

      {/* in-world dispatch toast — the seal "stamps" in */}
      {toast && (
        <div className="gz-stampin border-border bg-secondary fixed bottom-5 left-1/2 z-50 flex max-w-lg -translate-x-1/2 items-start gap-2.5 rounded-xl border px-4 py-3 shadow-2xl">
          <span className="gz-foil mt-0.5 text-base leading-none">◉</span>
          <span className="gz-serif text-foreground/90 text-[13px] leading-snug">{toast}</span>
        </div>
      )}
    </div>
  );
}

// labs route: design-iteration view with the country picker
export default function MyCountryV2Page() {
  return <MyCountryV2 />;
}

// ── quick declare (briefing rail) ──────────────────────────────────────────
function QuickDeclare({ onDeclare }: { onDeclare: (g: string) => void }) {
  const [v, setV] = useState("");
  return (
    <div className="space-y-3">
      <div className="text-muted-foreground text-[12px]">
        What is your government trying to accomplish?
      </div>
      <div className="flex gap-2">
        <input
          value={v}
          onChange={(e) => setV(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              onDeclare(v);
              setV("");
            }
          }}
          placeholder="e.g. Secure the northern sea lanes"
          className="border-input bg-muted/40 facet-refraction-none flex-1 rounded-lg border px-3 py-2 text-sm outline-none focus:border-amber-500/60"
        />
        <button
          onClick={() => {
            onDeclare(v);
            setV("");
          }}
          className="flex items-center gap-1.5 rounded-lg border border-amber-400/50 bg-amber-500/16 px-3 py-2 text-sm font-semibold text-amber-200 hover:bg-amber-500/26"
        >
          <Send className="h-3.5 w-3.5" /> Explore
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {GOAL_CHIPS.slice(0, 4).map((g) => (
          <button
            key={g}
            onClick={() => onDeclare(g)}
            className="border-border bg-card/30 text-muted-foreground hover:text-foreground rounded-full border px-2.5 py-1 text-[11px] hover:border-amber-500/50"
          >
            {g}
          </button>
        ))}
      </div>
      <div className="text-muted-foreground/80 text-[11px]">
        See Measured / Moderate / Extreme options in Executive mode. Weekly cooldown.
      </div>
    </div>
  );
}

// ── executive console (AI-chatbox) ─────────────────────────────────────────
function ExecutiveConsole({
  countryId,
  name,
  bands,
  posts,
  initialGoal,
  onCommitted,
}: {
  countryId: string | null;
  name: string;
  bands: any[];
  posts: any[];
  initialGoal: string | null;
  onCommitted: (res: any) => void;
}) {
  const [q, setQ] = useState(initialGoal ?? "");
  const [goal, setGoal] = useState<string | null>(initialGoal ?? null);
  const [err, setErr] = useState<string | null>(null);
  const [parentId, setParentId] = useState<string | null>(null);
  const [chainOf, setChainOf] = useState<string | null>(null);
  const [justCommitted, setJustCommitted] = useState<{ id: string; goal: string } | null>(null);
  const [policyOpen, setPolicyOpen] = useState(false);
  useEffect(() => {
    if (initialGoal) {
      setQ(initialGoal);
      setGoal(initialGoal);
    }
  }, [initialGoal]);

  const tree = api.intent.getTree.useQuery({ countryId: countryId ?? "" }, { enabled: !!countryId });
  // live: the government proposes Measured/Moderate/Extreme packages
  const suggest = api.intent.suggest.useQuery(
    { countryId: countryId ?? "", goal: goal ?? "" },
    { enabled: !!countryId && !!goal && (goal?.trim().length ?? 0) >= 2 }
  );
  const commitM = api.intent.commit.useMutation({
    onSuccess: (res) => {
      onCommitted(res);
      setGoal(null);
      setQ("");
      setParentId(null);
      setChainOf(null);
      setJustCommitted({ id: res.intent.id, goal: res.intent.goal });
    },
    onError: (e) => setErr(e.message),
  });

  function propose(g: string) {
    setErr(null);
    const t = g.trim();
    if (t.length >= 2) setGoal(t);
  }
  function commitTier(tier: string) {
    if (!countryId || !goal) return;
    setErr(null);
    commitM.mutate({
      countryId,
      goal,
      tier: tier as "measured" | "moderate" | "extreme",
      parentId: parentId ?? undefined,
    });
  }
  function buildOn(it: { id: string; goal: string }) {
    setParentId(it.id);
    setChainOf(it.goal);
    setJustCommitted(null);
  }

  const data = suggest.data;
  const status = data?.status;
  const canCommit = (status?.canCommit ?? true) && !commitM.isPending;

  return (
    <div className="grid gap-4 lg:grid-cols-[1.55fr_1fr]">
      <div className="space-y-4">
        <div className="mb-1 text-center">
          <div className="gz-mono text-[10px] tracking-[0.2em] text-amber-400/90 uppercase">
            The Executive · {name}
          </div>
          <h2 className="gz-serif mt-1 text-2xl font-bold tracking-tight">
            What are you trying to accomplish?
          </h2>
        </div>

        <FacetContainer variant="mycountry" depth={1} enableRefraction={false} className="p-0">
          <div className="flex items-center gap-3 p-4">
            <Command className="h-4 w-4 shrink-0 text-amber-400" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") propose(q);
              }}
              placeholder="Type a goal in plain language…  e.g. make housing affordable"
              className="placeholder:text-muted-foreground/50 facet-refraction-none flex-1 bg-transparent text-[17px] outline-none"
            />
            {suggest.isFetching ? (
              <Loader2 className="h-4 w-4 animate-spin text-amber-400" />
            ) : (
              <span className="border-border text-muted-foreground gz-mono rounded-md border px-2 py-0.5 text-[11px]">
                ⏎
              </span>
            )}
          </div>
        </FacetContainer>

        {chainOf && (
          <div className="flex items-center gap-2 rounded-lg border border-amber-400/30 bg-amber-500/10 px-3 py-1.5 text-[12px] text-amber-200">
            ↳ continuing: <span className="font-semibold">{chainOf}</span>
            <button
              onClick={() => {
                setParentId(null);
                setChainOf(null);
              }}
              className="ml-auto text-amber-300/70 hover:text-amber-200"
            >
              ✕
            </button>
          </div>
        )}
        {justCommitted && !goal && (
          <div className="flex items-center gap-2 rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-[12px] text-emerald-200">
            ✓ Committed: <span className="font-semibold">{justCommitted.goal}</span>
            <button
              onClick={() => buildOn(justCommitted)}
              className="ml-auto rounded-md border border-emerald-400/40 px-2 py-0.5 font-semibold hover:bg-emerald-500/20"
            >
              Build on this →
            </button>
          </div>
        )}
        {err && (
          <div className="rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-[12px] text-red-300">
            {err}
          </div>
        )}
        {status && !status.canCommit && (
          <div className="rounded-lg border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-[12px] text-amber-200">
            Your government is executing this week's agenda ({status.usedThisWeek}/{status.cap}).
            New intents open after the weekly cooldown.
          </div>
        )}

        {!goal ? (
          <div className="space-y-1.5">
            <div className="text-muted-foreground px-1 text-[11px] font-bold tracking-widest uppercase">
              Suggested — from the state of your nation
            </div>
            {GOAL_CHIPS.map((g) => (
              <button
                key={g}
                onClick={() => propose(g)}
                className="flex w-full items-center gap-3 rounded-xl border border-transparent px-3.5 py-2.5 text-left hover:border-amber-400/30 hover:bg-amber-500/[0.06]"
              >
                <span className="bg-muted grid h-7 w-7 place-items-center rounded-lg text-sm">
                  ✦
                </span>
                <span className="flex-1 text-[13px] font-medium">{g}</span>
                <span className="text-muted-foreground text-[10px]">goal</span>
              </button>
            ))}
          </div>
        ) : suggest.isFetching || !data ? (
          <div className="text-muted-foreground px-1 py-6 text-center text-sm">
            <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin text-amber-400" />
            Your ministries are drawing up options…
          </div>
        ) : (
          <div className="space-y-2">
            <div className="px-1 text-[11px] font-bold tracking-widest text-amber-300/80 uppercase">
              “{goal}” — your government proposes
              {data.category && (
                <span className="text-muted-foreground ml-2 lowercase">
                  · {data.category}
                  {data.target ? ` · ${data.target}` : ""}
                </span>
              )}
            </div>
            {data.foreignNeedsTarget && (
              <div className="rounded-lg border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-[12px] text-amber-200">
                Foreign-policy intents need a specific target — name who or what (e.g. “…with Burgundie”).
              </div>
            )}
            {data.packages.map((p: any) => (
              <button
                key={p.tier}
                disabled={!canCommit}
                onClick={() => commitTier(p.tier)}
                className="border-border w-full rounded-xl border px-4 py-3 text-left transition hover:border-amber-400/50 hover:bg-amber-500/[0.05] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <div className="flex items-center justify-between">
                  <div className="text-[13px] font-bold">{p.title}</div>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${TONE_CLS[p.acceptance as Tone]}`}
                  >
                    {p.acceptance === "good"
                      ? "Broad support"
                      : p.acceptance === "mid"
                        ? "Contested"
                        : "Hard sell"}
                  </span>
                </div>
                <div className="text-muted-foreground mt-0.5 text-[12px]">{p.blurb}</div>
                <ul className="mt-2 space-y-1">
                  {p.changes.map((c: any, i: number) => (
                    <li key={i} className="flex items-start gap-2 text-[12px]">
                      <span className="mt-[3px] text-amber-400">
                        {c.kind === "budget"
                          ? "▤"
                          : c.kind === "policy"
                            ? "◈"
                            : c.kind === "foreign"
                              ? "◇"
                              : "•"}
                      </span>
                      <span className="text-foreground/90">
                        {c.label}
                        <span className="text-muted-foreground"> — {c.detail}</span>
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="text-muted-foreground/70 mt-2 text-[10px] tracking-wide uppercase">
                  {p.risk} · reserves {p.civCapCost} capacity
                </div>
              </button>
            ))}
            {data.broker && (
              <div className="text-muted-foreground/80 px-1 text-[11px]">
                Acceptance weighted by <span className="text-foreground/80 font-medium">{data.broker.name}</span>
                {data.broker.unlocked ? (data.broker.satisfied ? " · currently satisfied" : " · currently restless") : " · not a factor here"}.
              </div>
            )}
            <div className="flex items-center justify-between px-1 pt-1">
              <button
                onClick={() => setGoal(null)}
                className="text-muted-foreground hover:text-foreground text-[12px]"
              >
                ← no action / rethink
              </button>
              <button
                onClick={() => setPolicyOpen(true)}
                className="text-[11px] font-medium text-amber-300/80 hover:text-amber-200"
              >
                Draft your own package →
              </button>
            </div>
          </div>
        )}
        {countryId && (
          <PolicyCreatorSheet countryId={countryId} open={policyOpen} onOpenChange={setPolicyOpen} />
        )}
      </div>

      {/* the record + standing */}
      <div className="space-y-4">
        <FacetCard depth={1} className="p-5">
          <div className="mb-3 text-sm font-bold">National standing</div>
          <div className="flex flex-wrap gap-2">
            {bands.map((b: any) => (
              <Band key={b.name} label={b.name} value={b.value} tone={b.tone} />
            ))}
          </div>
        </FacetCard>
        <FacetCard depth={1} className="p-5">
          <div className="mb-3 flex items-center gap-2 text-sm font-bold">
            <Sparkles className="text-muted-foreground h-4 w-4" /> Your agenda
          </div>
          {(tree.data ?? []).length === 0 ? (
            <div className="text-muted-foreground text-xs">
              Committed intents and their follow-ups appear here as a dependency tree.
            </div>
          ) : (
            <div className="space-y-1">
              {(tree.data ?? [])
                .filter(
                  (it: any) =>
                    !it.parentId || !(tree.data ?? []).some((x: any) => x.id === it.parentId)
                )
                .map((root: any) => (
                  <div key={root.id}>
                    <div className="flex items-center gap-2 py-1 text-[12px]">
                      <span
                        className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${TONE_CLS[root.tier === "measured" ? "good" : root.tier === "moderate" ? "mid" : "bad"]}`}
                      >
                        {root.tier}
                      </span>
                      <span className="text-foreground/90 flex-1 truncate">{root.goal}</span>
                      <span className="text-muted-foreground text-[10px]">{root.category}</span>
                    </div>
                    {(tree.data ?? [])
                      .filter((x: any) => x.parentId === root.id)
                      .map((kid: any) => (
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
          )}
        </FacetCard>
        <FacetCard depth={1} className="p-5">
          <div className="mb-3 flex items-center gap-2 text-sm font-bold">
            <Globe2 className="text-muted-foreground h-4 w-4" /> The record
          </div>
          <div className="space-y-3">
            {posts.slice(0, 8).map((p: any) => (
              <div key={p.id} className="border-border/60 border-b pb-2.5 last:border-0">
                <div className="text-muted-foreground text-[10px] tracking-wide uppercase">
                  {sourceMeta(p.kind).who} · {fmtTime(p.timestamp)}
                </div>
                <div className="text-foreground/90 text-[13px]">{p.title}</div>
              </div>
            ))}
            {posts.length === 0 && (
              <div className="text-muted-foreground text-xs">
                Commit an intent to write the first entry.
              </div>
            )}
          </div>
        </FacetCard>
      </div>
    </div>
  );
}
