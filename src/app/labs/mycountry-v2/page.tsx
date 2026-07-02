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
  Landmark, Newspaper, Globe2, Sparkles, TerminalSquare, LayoutGrid,
  ArrowUpRight, ArrowDownRight, CircleDot, Command, Send, Loader2,
} from "lucide-react";
import { api } from "~/trpc/react";
import { FacetCard } from "~/components/ui/facet-container";
import { useUserCountry } from "~/hooks/useUserCountry";

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
  fog: "text-zinc-400 bg-white/5 border-white/10",
};
function Band({ label, value, tone }: { label: string; value: string; tone: Tone }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${TONE_CLS[tone]}`}>
      <CircleDot className={`h-2.5 w-2.5 ${tone === "fog" ? "animate-pulse" : ""}`} />
      {label}: {value}
    </span>
  );
}

// feed source styling
function sourceMeta(kind: string) {
  switch (kind) {
    case "decision": return { who: "Government", av: "gov", tone: "text-blue-300 bg-blue-500/12", ring: "from-blue-500 to-indigo-600" };
    case "diplomacy": return { who: "World", av: "world", tone: "text-purple-300 bg-purple-500/12", ring: "from-purple-500 to-fuchsia-600" };
    default: return { who: "Press", av: "press", tone: "text-zinc-300 bg-white/8", ring: "from-slate-500 to-slate-700" };
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

const GOAL_CHIPS = ["Cool the housing market", "Modernize the navy", "Court a neighbour as an ally", "Rein in inflation", "Develop the coast"];

export default function MyCountryV2Page() {
  const { country: userCountry } = useUserCountry();
  const { data: countriesData } = api.countries.getAll.useQuery({ limit: 300 });
  const countries = countriesData?.countries;
  const [countryId, setCountryId] = useState<string | null>(null);
  useEffect(() => {
    if (!countryId) setCountryId((userCountry as any)?.id ?? countries?.[0]?.id ?? null);
  }, [userCountry, countries, countryId]);

  const enabled = !!countryId;
  const { data: dash, isLoading: dashLoading } = api.mycountry.getCountryDashboard.useQuery(
    { countryId: countryId!, includeHistory: false }, { enabled });
  const { data: feed = [] } = api.mycountry.getCanonFeed.useQuery(
    { countryId: countryId!, limit: 30 }, { enabled });
  const { data: ledger = [] } = api.mycountry.getChangeLog.useQuery(
    { countryId: countryId!, limit: 20 }, { enabled });

  const [mode, setMode] = useState<"briefing" | "executive">("briefing");
  const [local, setLocal] = useState<LocalPost[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => { setLocal([]); }, [countryId]); // reset optimistic feed on country switch

  const d: any = dash ?? {};
  const bands = useMemo(() => {
    const mk = (name: string, score: number) => { const b = toBand(score); return { name, tone: b.tone, value: b.label }; };
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
    const live = (feed as any[]).map((f) => ({ id: f.id, kind: f.kind, title: f.title, body: "", timestamp: f.timestamp }));
    return [...local, ...live].slice(0, 40);
  }, [feed, local]);

  function declare(goal: string, plan?: string) {
    const g = goal.trim();
    if (!g) return;
    const body = `The government of ${d.name ?? "the nation"} commits to ${g}${plan ? ` via a ${plan.toLowerCase()} course` : ""}. Ministries begin work; expect the world to push back.`;
    setLocal((p) => [{ id: `local_${Date.now()}`, kind: "decision", title: `Intent: ${g}`, body, timestamp: Date.now() }, ...p]);
    setToast(`◆ In-world: ${body}`);
    setTimeout(() => setToast(null), 4500);
  }

  const rawFlag = d.flag as string | undefined;
  const flag = rawFlag && /^(https?:|\/|data:)/.test(rawFlag) ? rawFlag : undefined; // guard: skip emoji/empty flags

  return (
    <div className="min-h-screen bg-[#0f1114] text-zinc-100"
      style={{ backgroundImage: "radial-gradient(1100px 560px at 12% -6%, rgba(202,138,4,0.10), transparent 60%), radial-gradient(900px 500px at 100% 0%, rgba(99,102,241,0.06), transparent 55%)" }}>

      {/* top bar */}
      <div className="sticky top-0 z-40 flex items-center justify-between gap-3 border-b border-white/10 bg-[#0f1114]/70 px-4 py-2.5 backdrop-blur-xl">
        <div className="flex items-center gap-2 text-sm font-extrabold tracking-tight">
          <Landmark className="h-4 w-4 text-amber-500" /> MyCountry <span className="text-amber-500">v2</span>
          <span className="ml-2 rounded-full border border-white/10 px-2.5 py-0.5 text-[11px] font-medium text-zinc-400">live · labs preview</span>
        </div>
        <div className="flex items-center gap-2">
          <select value={countryId ?? ""} onChange={(e) => setCountryId(e.target.value)}
            className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-zinc-200 outline-none">
            {(countries ?? []).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <div className="flex rounded-lg border border-white/10 bg-white/5 p-0.5 text-xs font-semibold">
            <button onClick={() => setMode("briefing")}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 transition ${mode === "briefing" ? "bg-amber-500/20 text-amber-200" : "text-zinc-400 hover:text-zinc-200"}`}>
              <LayoutGrid className="h-3.5 w-3.5" /> Briefing
            </button>
            <button onClick={() => setMode("executive")}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 transition ${mode === "executive" ? "bg-indigo-500/20 text-indigo-200" : "text-zinc-400 hover:text-zinc-200"}`}>
              <TerminalSquare className="h-3.5 w-3.5" /> Executive
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl space-y-4 p-4">

        {/* HERO — map/identity (existing mycountry identity) */}
        <FacetCard depth={1} className="relative overflow-hidden">
          {flag && <img src={flag} alt="" className="pointer-events-none absolute inset-0 h-full w-full scale-110 object-cover opacity-25 blur-md" />}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0f1114] via-[#0f1114]/70 to-transparent" />
          <div className="relative flex items-center justify-between gap-4 p-6">
            <div className="flex items-center gap-4">
              {flag
                ? <img src={flag} alt="" className="h-16 w-24 rounded-md border border-white/15 object-cover shadow-lg" />
                : <div className="grid h-16 w-24 place-items-center rounded-md border border-white/15 bg-gradient-to-br from-amber-500 to-yellow-600 text-2xl font-black text-[#14130f]">{(d.name ?? "?")[0]}</div>}
              <div>
                <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-400">
                  {d.governmentType ?? "Government"} · {d.region ?? "—"}
                </div>
                <h1 className="text-2xl font-bold tracking-tight">{dashLoading ? "Loading…" : d.name ?? "Select a country"}</h1>
                <div className="mt-0.5 text-xs text-zinc-400">Led by {d.leader ?? "the government"} · {d.economicTier ?? "—"} economy</div>
              </div>
            </div>
            <div className="hidden shrink-0 text-right text-[10px] uppercase tracking-widest text-zinc-500 sm:block">
              {/* ◍ real IxWorld map hero can mount in this slot */}
              ◍ map hero slot
            </div>
          </div>
        </FacetCard>

        {mode === "briefing" ? (
          <div className="grid gap-4 lg:grid-cols-[1.55fr_1fr]">
            {/* LEFT: the living feed, led by the AI brief */}
            <div className="space-y-4">
              <FacetCard depth={1} className="p-5">
                <div className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-amber-400/90">
                  <Sparkles className="h-3.5 w-3.5" /> Executive morning brief
                </div>
                {briefing ? (
                  <p className="text-[15px] leading-relaxed text-zinc-200">
                    <span className="font-semibold text-white">{briefing.lead}</span> {briefing.worry}
                  </p>
                ) : <p className="text-sm text-zinc-500">Compiling briefing…</p>}
                <div className="mt-4 flex flex-wrap gap-2">
                  {bands.map((b: any) => <Band key={b.name} label={b.name} value={b.value} tone={b.tone} />)}
                </div>
              </FacetCard>

              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2 text-sm font-bold"><Newspaper className="h-4 w-4 text-zinc-400" /> The feed</div>
                <span className="text-[11px] text-zinc-500">your decisions become headlines · the world answers</span>
              </div>

              {posts.length === 0 && <FacetCard depth={2} className="p-5 text-sm text-zinc-500">No canon events yet for this nation. Declare an intent below to start the story.</FacetCard>}
              {posts.map((p: any) => {
                const m = sourceMeta(p.kind);
                return (
                  <FacetCard key={p.id} depth={2} className="p-4">
                    <div className="mb-1.5 flex items-center gap-2.5">
                      <div className={`grid h-9 w-9 place-items-center rounded-lg bg-gradient-to-br ${m.ring} text-sm font-bold text-white`}>
                        {p.kind === "decision" ? "◈" : p.kind === "diplomacy" ? "◇" : "▦"}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 text-sm font-semibold">
                          {m.who} <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${m.tone}`}>{p.kind}</span>
                        </div>
                        <div className="text-[11px] text-zinc-500">{fmtTime(p.timestamp)}</div>
                      </div>
                    </div>
                    <div className="text-[14px] leading-relaxed text-zinc-200">{p.title}</div>
                    {p.body && <div className="mt-1 text-[13px] leading-relaxed text-zinc-400">{p.body}</div>}
                  </FacetCard>
                );
              })}
            </div>

            {/* RIGHT: attention + declare + ledger */}
            <div className="space-y-4">
              <FacetCard depth={1} className="p-5">
                <div className="mb-3 text-sm font-bold">Declare an intent</div>
                <QuickDeclare onDeclare={declare} />
              </FacetCard>

              <FacetCard depth={1} className="p-5">
                <div className="mb-3 flex items-center justify-between">
                  <div className="text-sm font-bold">What changed — the record</div>
                  <span className="text-[10px] text-zinc-500">bounded &amp; logged</span>
                </div>
                <div className="rounded-xl border border-white/8 bg-white/[0.02]">
                  {(ledger as any[]).length === 0 && <div className="px-3 py-4 text-xs text-zinc-500">No ledger entries yet. Every change lands here with what moved and why.</div>}
                  {(ledger as any[]).map((l) => {
                    const up = (l.deltaValue ?? 0) >= 0;
                    return (
                      <div key={l.id} className="flex items-center gap-2.5 border-b border-white/6 px-3 py-2.5 last:border-0">
                        <span className="rounded px-1.5 py-0.5 text-[9px] font-bold uppercase text-zinc-400 bg-white/5">{l.sourceType}</span>
                        <span className="flex-1 text-[12px] text-zinc-300">{l.description}</span>
                        {l.deltaValue != null && (
                          <span className={`flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[11px] font-bold ${up ? "text-emerald-300 bg-emerald-500/10" : "text-red-300 bg-red-500/10"}`}>
                            {up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}{l.targetField ?? ""}
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
          <ExecutiveConsole name={d.name ?? "your nation"} bands={bands} posts={posts} onDeclare={declare} />
        )}
      </div>

      {/* in-world toast */}
      {toast && (
        <div className="fixed bottom-5 left-1/2 z-50 max-w-lg -translate-x-1/2 rounded-xl border border-white/15 bg-[#1e2028] px-4 py-3 text-sm shadow-2xl">
          <span className="font-semibold text-amber-400">{toast}</span>
        </div>
      )}
    </div>
  );
}

// ── quick declare (briefing rail) ──────────────────────────────────────────
function QuickDeclare({ onDeclare }: { onDeclare: (g: string) => void }) {
  const [v, setV] = useState("");
  return (
    <div className="space-y-3">
      <div className="text-[12px] text-zinc-400">What is your government trying to accomplish?</div>
      <div className="flex gap-2">
        <input value={v} onChange={(e) => setV(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { onDeclare(v); setV(""); } }}
          placeholder="e.g. Secure the northern sea lanes"
          className="flex-1 rounded-lg border border-white/12 bg-black/25 px-3 py-2 text-sm outline-none focus:border-amber-500/60" />
        <button onClick={() => { onDeclare(v); setV(""); }}
          className="flex items-center gap-1.5 rounded-lg border border-amber-400/50 bg-amber-500/16 px-3 py-2 text-sm font-semibold text-amber-200 hover:bg-amber-500/26">
          <Send className="h-3.5 w-3.5" /> Commit
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {GOAL_CHIPS.slice(0, 4).map((g) => (
          <button key={g} onClick={() => onDeclare(g)}
            className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11px] text-zinc-400 hover:border-amber-500/50 hover:text-zinc-200">{g}</button>
        ))}
      </div>
      <div className="text-[11px] text-zinc-500">Instant commit, cooldown-gated. Deliberation is opt-in.</div>
    </div>
  );
}

// ── executive console (AI-chatbox) ─────────────────────────────────────────
function ExecutiveConsole({ name, bands, posts, onDeclare }: {
  name: string; bands: any[]; posts: any[]; onDeclare: (g: string, plan?: string) => void;
}) {
  const [q, setQ] = useState("");
  const [goal, setGoal] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function propose(g: string) { if (!g.trim()) return; setBusy(true); setTimeout(() => { setGoal(g.trim()); setBusy(false); }, 350); }
  function commit(plan?: string) { if (goal) { onDeclare(goal, plan); setGoal(null); setQ(""); } }

  const PLANS = [
    { key: "State-led", tone: "bad", note: "Treasury objects", body: "Direct public program. Fast and visible; heavy on capacity and budget." },
    { key: "Market-led", tone: "mid", note: "Slower payoff", body: "Incentivize private actors. Cheap; magnates pleased, approval slower." },
    { key: "Balanced", tone: "good", note: "Broad support", body: "Targeted mix. Moderate cost and timing, widest coalition." },
  ];

  return (
    <div className="grid gap-4 lg:grid-cols-[1.55fr_1fr]">
      <div className="space-y-4">
        <div className="mb-1 text-center">
          <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-indigo-300/80">Executive mode · {name}</div>
          <h2 className="mt-1 text-xl font-bold tracking-tight" style={{ fontFamily: "Iowan Old Style, Palatino Linotype, Georgia, serif" }}>What are you trying to accomplish?</h2>
        </div>

        <FacetCard depth={1} className="p-0" variant="base">
          <div className="flex items-center gap-3 p-4">
            <Command className="h-4 w-4 shrink-0 text-indigo-400" />
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") propose(q); }}
              placeholder="Type a goal in plain language…  e.g. make housing affordable"
              className="flex-1 bg-transparent text-[17px] outline-none placeholder:text-zinc-600" />
            {busy ? <Loader2 className="h-4 w-4 animate-spin text-indigo-400" /> : <span className="rounded-md border border-white/10 px-2 py-0.5 text-[11px] text-zinc-500">⏎</span>}
          </div>
        </FacetCard>

        {!goal ? (
          <div className="space-y-1.5">
            <div className="px-1 text-[11px] font-bold uppercase tracking-widest text-zinc-500">Suggested — from the state of your nation</div>
            {GOAL_CHIPS.map((g) => (
              <button key={g} onClick={() => propose(g)}
                className="flex w-full items-center gap-3 rounded-xl border border-transparent px-3.5 py-2.5 text-left hover:border-indigo-400/30 hover:bg-indigo-500/[0.06]">
                <span className="grid h-7 w-7 place-items-center rounded-lg bg-white/5 text-sm">✦</span>
                <span className="flex-1 text-[13px] font-medium">{g}</span>
                <span className="text-[10px] text-zinc-500">domestic</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            <div className="px-1 text-[11px] font-bold uppercase tracking-widest text-indigo-300/80">“{goal}” — your government proposes</div>
            {PLANS.map((p, i) => (
              <button key={p.key} onClick={() => commit(p.key)}
                className="w-full rounded-xl border border-white/10 px-4 py-3 text-left hover:border-indigo-400/50 hover:bg-indigo-500/[0.05]">
                <div className="flex items-center justify-between">
                  <div className="text-[13px] font-bold">Plan {String.fromCharCode(65 + i)} · {p.key}</div>
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${TONE_CLS[p.tone as Tone]}`}>{p.note}</span>
                </div>
                <div className="mt-1 text-[12px] text-zinc-400">{p.body}</div>
              </button>
            ))}
            <button onClick={() => commit()} className="flex w-full items-center gap-3 rounded-xl border border-transparent px-3.5 py-2.5 text-left hover:bg-white/5">
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-white/5 text-sm">⚡</span>
              <span className="flex-1 text-[13px] font-medium">Just commit — pick for me</span>
              <span className="text-[10px] text-zinc-500">instant</span>
            </button>
          </div>
        )}
      </div>

      {/* the record + standing */}
      <div className="space-y-4">
        <FacetCard depth={1} className="p-5">
          <div className="mb-3 text-sm font-bold">National standing</div>
          <div className="flex flex-wrap gap-2">{bands.map((b: any) => <Band key={b.name} label={b.name} value={b.value} tone={b.tone} />)}</div>
        </FacetCard>
        <FacetCard depth={1} className="p-5">
          <div className="mb-3 flex items-center gap-2 text-sm font-bold"><Globe2 className="h-4 w-4 text-zinc-400" /> The record</div>
          <div className="space-y-3">
            {posts.slice(0, 8).map((p: any) => (
              <div key={p.id} className="border-b border-white/6 pb-2.5 last:border-0">
                <div className="text-[10px] uppercase tracking-wide text-zinc-500">{sourceMeta(p.kind).who} · {fmtTime(p.timestamp)}</div>
                <div className="text-[13px] text-zinc-300">{p.title}</div>
              </div>
            ))}
            {posts.length === 0 && <div className="text-xs text-zinc-500">Commit an intent to write the first entry.</div>}
          </div>
        </FacetCard>
      </div>
    </div>
  );
}
