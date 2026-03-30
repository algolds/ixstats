"use client";

import { useStudioState } from "../../context/StudioStateContext";

const GRID_OPTIONS = [128, 256, 512];

export function TerrainSection() {
  const { state, dispatch, navigateTo, updateParams } = useStudioState();
  const params = state.worldGenParams;

  const handleGenerate = () => {
    dispatch({
      type: "SET_GENERATION_STATUS",
      status: "generating",
      progress: 0,
      message: "Generating terrain preview...",
    });
  };

  const handleNext = () => {
    dispatch({ type: "COMPLETE_SECTION", section: "terrain" });
    navigateTo("climate");
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white">Terrain Configuration</h1>
        <p className="mt-2 text-sm text-white/60">
          Shape the physical geography of your world.
        </p>
      </div>

      {/* Sliders */}
      <div className="space-y-6 rounded-xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm">
        {/* Continent Count */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="text-sm font-medium text-white/80">Continent Count</label>
            <span className="text-sm font-mono text-white/60">{params.continentCount}</span>
          </div>
          <input
            type="range"
            min={1}
            max={8}
            step={1}
            value={params.continentCount}
            onChange={(e) => updateParams({ continentCount: Number(e.target.value) })}
            className="w-full accent-amber-500"
          />
          <div className="mt-1 flex justify-between text-xs text-white/30">
            <span>1</span>
            <span>8</span>
          </div>
        </div>

        {/* Ocean Percentage */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="text-sm font-medium text-white/80">Ocean Coverage</label>
            <span className="text-sm font-mono text-white/60">
              {Math.round(params.oceanPercentage * 100)}%
            </span>
          </div>
          <input
            type="range"
            min={40}
            max={85}
            step={1}
            value={Math.round(params.oceanPercentage * 100)}
            onChange={(e) => updateParams({ oceanPercentage: Number(e.target.value) / 100 })}
            className="w-full accent-amber-500"
          />
          <div className="mt-1 flex justify-between text-xs text-white/30">
            <span>40%</span>
            <span>85%</span>
          </div>
        </div>

        {/* Terrain Roughness */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="text-sm font-medium text-white/80">Terrain Roughness</label>
            <span className="text-sm font-mono text-white/60">
              {params.terrainRoughness.toFixed(2)}
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={Math.round(params.terrainRoughness * 100)}
            onChange={(e) => updateParams({ terrainRoughness: Number(e.target.value) / 100 })}
            className="w-full accent-amber-500"
          />
          <div className="mt-1 flex justify-between text-xs text-white/30">
            <span>Smooth</span>
            <span>Rugged</span>
          </div>
        </div>

        {/* Erosion Intensity */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="text-sm font-medium text-white/80">Erosion Intensity</label>
            <span className="text-sm font-mono text-white/60">
              {params.erosionIntensity.toFixed(2)}
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={Math.round(params.erosionIntensity * 100)}
            onChange={(e) => updateParams({ erosionIntensity: Number(e.target.value) / 100 })}
            className="w-full accent-amber-500"
          />
          <div className="mt-1 flex justify-between text-xs text-white/30">
            <span>None</span>
            <span>Heavy</span>
          </div>
        </div>

        {/* Grid Resolution */}
        <div>
          <label className="mb-2 block text-sm font-medium text-white/80">Grid Resolution</label>
          <div className="flex gap-3">
            {GRID_OPTIONS.map((res) => (
              <button
                key={res}
                onClick={() => updateParams({ gridResolution: res })}
                className={`flex-1 rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                  params.gridResolution === res
                    ? "border-amber-500/60 bg-amber-500/15 text-amber-300"
                    : "border-white/10 bg-white/5 text-white/60 hover:bg-white/10"
                }`}
              >
                {res}x{res}
              </button>
            ))}
          </div>
        </div>

        {/* Tectonic Toggle */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-white/80">Tectonic Elevation</p>
            <p className="text-xs text-white/40">Simulate tectonic plate boundaries</p>
          </div>
          <button
            onClick={() => updateParams({ useTectonicElevation: !params.useTectonicElevation })}
            className={`h-6 w-11 rounded-full transition-colors ${
              params.useTectonicElevation ? "bg-amber-500" : "bg-white/20"
            }`}
          >
            <div
              className={`h-5 w-5 rounded-full bg-white shadow transition-transform ${
                params.useTectonicElevation ? "translate-x-5.5" : "translate-x-0.5"
              }`}
            />
          </button>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <button
          onClick={handleGenerate}
          disabled={state.generationStatus === "generating"}
          className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-5 py-2.5 text-sm font-medium text-amber-300 transition-colors hover:bg-amber-500/20 disabled:opacity-50"
        >
          {state.generationStatus === "generating" ? "Generating..." : "Generate Preview"}
        </button>
        <button
          onClick={handleNext}
          className="rounded-lg bg-gradient-to-r from-amber-600 to-orange-600 px-6 py-2.5 text-sm font-medium text-white shadow-lg transition-all hover:from-amber-500 hover:to-orange-500"
        >
          Next: Climate →
        </button>
      </div>
    </div>
  );
}
