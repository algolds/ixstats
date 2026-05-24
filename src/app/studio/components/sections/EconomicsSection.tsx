"use client";

import { useStudioState } from "../../context/StudioStateContext";

export function EconomicsSection() {
  const { dispatch, navigateTo } = useStudioState();

  const handleNext = () => {
    dispatch({ type: "COMPLETE_SECTION", section: "economics" });
    navigateTo("preview");
  };

  const tiers = [
    { label: "Tier 1 — Major Powers", pct: "10%", color: "bg-yellow-500/30 border-yellow-500/40" },
    { label: "Tier 2 — Regional Powers", pct: "20%", color: "bg-amber-500/30 border-amber-500/40" },
    { label: "Tier 3 — Developing", pct: "40%", color: "bg-orange-500/30 border-orange-500/40" },
    { label: "Tier 4 — Emerging", pct: "30%", color: "bg-red-500/30 border-red-500/40" },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white">Economic Generation</h1>
        <p className="mt-2 text-sm text-white/60">
          IxStats economic data will be automatically generated based on geographic factors.
        </p>
      </div>

      {/* Info Panel */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm">
        <h2 className="mb-3 text-lg font-semibold text-white">Auto-Population</h2>
        <p className="text-sm leading-relaxed text-white/60">
          Each nation will receive generated economic data based on its geographic properties: land
          area, coastline access, climate zones, natural resources, and proximity to trade routes.
          The following data points will be computed:
        </p>
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {[
            "GDP & GDP per capita",
            "Population & demographics",
            "Government type",
            "Trade partners & routes",
            "Natural resources",
            "Military capacity",
            "Infrastructure index",
            "Development indicators",
          ].map((item) => (
            <li key={item} className="flex items-center gap-2 text-sm text-white/50">
              <span className="h-1.5 w-1.5 rounded-full bg-yellow-500/60" />
              {item}
            </li>
          ))}
        </ul>
      </div>

      {/* Tier Distribution */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm">
        <h2 className="mb-4 text-lg font-semibold text-white">Tier Distribution</h2>
        <p className="mb-4 text-xs text-white/40">
          Nations are assigned economic tiers based on geographic advantage.
        </p>
        <div className="space-y-3">
          {tiers.map((tier) => (
            <div
              key={tier.label}
              className={`flex items-center justify-between rounded-lg border p-3 ${tier.color}`}
            >
              <span className="text-sm font-medium text-white/80">{tier.label}</span>
              <span className="font-mono text-sm text-white/60">{tier.pct}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Navigation */}
      <div className="flex justify-between">
        <button
          onClick={() => navigateTo("populate")}
          className="rounded-lg border border-white/10 bg-white/5 px-5 py-2.5 text-sm text-white/60 transition-colors hover:bg-white/10"
        >
          ← Back: Populate
        </button>
        <button
          onClick={handleNext}
          className="rounded-lg bg-gradient-to-r from-yellow-600 to-amber-600 px-6 py-2.5 text-sm font-medium text-white shadow-lg transition-all hover:from-yellow-500 hover:to-amber-500"
        >
          Next: Preview →
        </button>
      </div>
    </div>
  );
}
