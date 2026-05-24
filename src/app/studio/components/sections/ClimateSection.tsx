"use client";

import { useStudioState } from "../../context/StudioStateContext";

export function ClimateSection() {
  const { state, dispatch, navigateTo, updateParams } = useStudioState();
  const params = state.worldGenParams;
  const stats = state.generationStats;

  const handleNext = () => {
    dispatch({ type: "COMPLETE_SECTION", section: "climate" });
    navigateTo("nations");
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white">Climate & Biomes</h1>
        <p className="mt-2 text-sm text-white/60">
          Configure atmospheric simulation and biome generation.
        </p>
      </div>

      {/* Controls */}
      <div className="space-y-6 rounded-xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm">
        {/* Climate Detail */}
        <div>
          <label className="mb-3 block text-sm font-medium text-white/80">Climate Detail</label>
          <div className="flex gap-3">
            {(["simple", "full"] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => updateParams({ climateDetail: mode })}
                className={`flex-1 rounded-lg border px-4 py-3 text-left transition-colors ${
                  params.climateDetail === mode
                    ? "border-sky-500/60 bg-sky-500/15"
                    : "border-white/10 bg-white/5 hover:bg-white/10"
                }`}
              >
                <p className="text-sm font-medium text-white">
                  {mode === "simple" ? "Simple" : "Full Simulation"}
                </p>
                <p className="mt-0.5 text-xs text-white/40">
                  {mode === "simple"
                    ? "Basic latitude-based climate bands"
                    : "Trewartha zones, ocean currents, rain shadows"}
                </p>
              </button>
            ))}
          </div>
        </div>

        {/* Icecaps Toggle */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-white/80">Polar Icecaps</p>
            <p className="text-xs text-white/40">Generate ice sheets at the poles</p>
          </div>
          <button
            onClick={() => updateParams({ hasIcecaps: !params.hasIcecaps })}
            className={`h-6 w-11 rounded-full transition-colors ${
              params.hasIcecaps ? "bg-sky-500" : "bg-white/20"
            }`}
          >
            <div
              className={`h-5 w-5 rounded-full bg-white shadow transition-transform ${
                params.hasIcecaps ? "translate-x-5.5" : "translate-x-0.5"
              }`}
            />
          </button>
        </div>
      </div>

      {/* Biome Info */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm">
        <h2 className="mb-4 text-lg font-semibold text-white">Biome Overview</h2>
        {params.climateDetail === "full" ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-white/5 bg-white/5 p-4">
              <p className="text-xs text-white/40">Climate Zones</p>
              <p className="mt-1 text-2xl font-bold text-sky-300">
                {stats?.climateZoneCount ?? 12}
              </p>
              <p className="mt-1 text-xs text-white/30">Trewartha classification</p>
            </div>
            <div className="rounded-lg border border-white/5 bg-white/5 p-4">
              <p className="text-xs text-white/40">Biomes</p>
              <p className="mt-1 text-2xl font-bold text-emerald-300">{stats?.biomeCount ?? 18}</p>
              <p className="mt-1 text-xs text-white/30">Distinct biome regions</p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-white/50">
            Simple mode generates basic climate bands based on latitude. Switch to full simulation
            for detailed Trewartha zones, ocean currents, and rain shadow effects.
          </p>
        )}
      </div>

      {/* Navigation */}
      <div className="flex justify-between">
        <button
          onClick={() => navigateTo("terrain")}
          className="rounded-lg border border-white/10 bg-white/5 px-5 py-2.5 text-sm text-white/60 transition-colors hover:bg-white/10"
        >
          ← Back: Terrain
        </button>
        <button
          onClick={handleNext}
          className="rounded-lg bg-gradient-to-r from-sky-600 to-cyan-600 px-6 py-2.5 text-sm font-medium text-white shadow-lg transition-all hover:from-sky-500 hover:to-cyan-500"
        >
          Next: Nations →
        </button>
      </div>
    </div>
  );
}
