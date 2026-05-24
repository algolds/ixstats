"use client";

import { useStudioState } from "../../context/StudioStateContext";

const PRESET_INFO: Record<string, { label: string; description: string; icon: string }> = {
  ixworld: {
    label: "IxWorld",
    description: "Full-scale world (160-200 nations, 6 continents)",
    icon: "🌍",
  },
  "earth-like": {
    label: "Earth-like",
    description: "Balanced world (40-80 nations, 4 continents)",
    icon: "🌎",
  },
  pangaea: {
    label: "Pangaea",
    description: "Single supercontinent (15-40 nations)",
    icon: "🗺️",
  },
  archipelago: {
    label: "Archipelago",
    description: "Island chains (30-80 nations, 80% ocean)",
    icon: "🏝️",
  },
  desert: {
    label: "Desert",
    description: "Arid world (10-30 nations, rugged terrain)",
    icon: "🏜️",
  },
  waterworld: {
    label: "Waterworld",
    description: "Vast oceans (20-50 nations, 85% ocean)",
    icon: "🌊",
  },
};

export function CreateSection() {
  const { state, dispatch, navigateTo, applyPreset, updateParams } = useStudioState();
  const { worldGenParams } = state;

  const handleNext = () => {
    dispatch({ type: "COMPLETE_SECTION", section: "create" });
    navigateTo("terrain");
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white">Create a New Realm</h1>
        <p className="mt-2 text-sm text-white/60">
          Choose a preset to get started, set your seed, or upload a map image.
        </p>
      </div>

      {/* Preset Grid */}
      <div>
        <h2 className="mb-4 text-lg font-semibold text-white">World Presets</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Object.entries(PRESET_INFO).map(([key, info]) => (
            <button
              key={key}
              onClick={() => applyPreset(key)}
              className={`rounded-xl border p-5 text-left backdrop-blur-sm transition-all ${
                worldGenParams.preset === key
                  ? "border-violet-500/60 bg-violet-500/15"
                  : "border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10"
              }`}
            >
              <span className="text-2xl">{info.icon}</span>
              <h3 className="mt-2 font-semibold text-white">{info.label}</h3>
              <p className="mt-1 text-xs text-white/50">{info.description}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Seed Input */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm">
        <label className="mb-2 block text-sm font-medium text-white/80">World Seed</label>
        <div className="flex gap-3">
          <input
            type="number"
            value={worldGenParams.seed}
            onChange={(e) => updateParams({ seed: Number(e.target.value) })}
            className="flex-1 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-white placeholder-white/30 outline-none focus:border-violet-500/50"
          />
          <button
            onClick={() => updateParams({ seed: Math.floor(Math.random() * 100000) })}
            className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/70 transition-colors hover:bg-white/10"
          >
            Randomize
          </button>
        </div>
      </div>

      {/* Upload Zone */}
      <div className="rounded-xl border-2 border-dashed border-white/15 bg-white/5 p-8 text-center backdrop-blur-sm transition-colors hover:border-white/25">
        <div className="text-3xl">📤</div>
        <p className="mt-2 text-sm font-medium text-white/70">Upload Map Image</p>
        <p className="mt-1 text-xs text-white/40">Drag and drop a PNG or SVG, or click to browse</p>
        <input
          type="file"
          accept="image/png,image/svg+xml"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              const url = URL.createObjectURL(file);
              dispatch({ type: "SET_UPLOADED_IMAGE", image: url });
            }
          }}
        />
        {state.uploadedImage && <p className="mt-3 text-xs text-emerald-400">Image uploaded</p>}
      </div>

      {/* Next Button */}
      <div className="flex justify-end">
        <button
          onClick={handleNext}
          className="rounded-lg bg-gradient-to-r from-violet-600 to-purple-600 px-6 py-2.5 text-sm font-medium text-white shadow-lg transition-all hover:from-violet-500 hover:to-purple-500"
        >
          Next: Terrain →
        </button>
      </div>
    </div>
  );
}
