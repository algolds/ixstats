"use client";

import { useStudioState } from "../../context/StudioStateContext";

export function PopulateSection() {
  const { state, dispatch, navigateTo, updateParams } = useStudioState();
  const params = state.worldGenParams;
  const stats = state.generationStats;

  const handleNext = () => {
    dispatch({ type: "COMPLETE_SECTION", section: "populate" });
    navigateTo("economics");
  };

  const statCards = [
    { label: "Cities", key: "cityCount", icon: "🏙️", color: "text-emerald-300" },
    { label: "Rivers", key: "riverCount", icon: "🏞️", color: "text-blue-300" },
    { label: "Lakes", key: "lakeCount", icon: "💧", color: "text-cyan-300" },
    { label: "Trade Routes", key: "tradeRouteCount", icon: "🛤️", color: "text-amber-300" },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white">Populate the World</h1>
        <p className="mt-2 text-sm text-white/60">
          Add rivers, lakes, cities, and trade routes to your generated terrain.
        </p>
      </div>

      {/* Toggles */}
      <div className="space-y-4 rounded-xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm">
        <h2 className="text-lg font-semibold text-white">Hydrology</h2>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-white/80">Rivers</p>
            <p className="text-xs text-white/40">Generate river systems flowing to the ocean</p>
          </div>
          <button
            onClick={() => updateParams({ hasRivers: !params.hasRivers })}
            className={`h-6 w-11 rounded-full transition-colors ${
              params.hasRivers ? "bg-emerald-500" : "bg-white/20"
            }`}
          >
            <div
              className={`h-5 w-5 rounded-full bg-white shadow transition-transform ${
                params.hasRivers ? "translate-x-5.5" : "translate-x-0.5"
              }`}
            />
          </button>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-white/80">Lakes</p>
            <p className="text-xs text-white/40">Place inland water bodies in low-elevation areas</p>
          </div>
          <button
            onClick={() => updateParams({ hasLakes: !params.hasLakes })}
            className={`h-6 w-11 rounded-full transition-colors ${
              params.hasLakes ? "bg-emerald-500" : "bg-white/20"
            }`}
          >
            <div
              className={`h-5 w-5 rounded-full bg-white shadow transition-transform ${
                params.hasLakes ? "translate-x-5.5" : "translate-x-0.5"
              }`}
            />
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div>
        <h2 className="mb-4 text-lg font-semibold text-white">Generation Stats</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {statCards.map((card) => (
            <div
              key={card.key}
              className="rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm"
            >
              <div className="flex items-center gap-2">
                <span className="text-lg">{card.icon}</span>
                <p className="text-xs text-white/40">{card.label}</p>
              </div>
              <p className={`mt-2 text-2xl font-bold ${card.color}`}>
                {stats?.[card.key] ?? "---"}
              </p>
            </div>
          ))}
        </div>
        {!stats && (
          <p className="mt-3 text-center text-xs text-white/30">
            Stats will appear after terrain generation.
          </p>
        )}
      </div>

      {/* Navigation */}
      <div className="flex justify-between">
        <button
          onClick={() => navigateTo("nations")}
          className="rounded-lg border border-white/10 bg-white/5 px-5 py-2.5 text-sm text-white/60 transition-colors hover:bg-white/10"
        >
          ← Back: Nations
        </button>
        <button
          onClick={handleNext}
          className="rounded-lg bg-gradient-to-r from-emerald-600 to-green-600 px-6 py-2.5 text-sm font-medium text-white shadow-lg transition-all hover:from-emerald-500 hover:to-green-500"
        >
          Next: Economics →
        </button>
      </div>
    </div>
  );
}
