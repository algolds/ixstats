"use client";

import { useStudioState } from "../../context/StudioStateContext";

const LANGUAGE_FAMILIES = [
  { id: "latin", label: "Latin" },
  { id: "germanic", label: "Germanic" },
  { id: "slavic", label: "Slavic" },
  { id: "arabic", label: "Arabic" },
  { id: "eastasian", label: "East Asian" },
  { id: "polynesian", label: "Polynesian" },
  { id: "celtic", label: "Celtic" },
  { id: "turkic", label: "Turkic" },
  { id: "southasian", label: "South Asian" },
  { id: "african", label: "African" },
  { id: "mesoamerican", label: "Mesoamerican" },
];

export function NationsSection() {
  const { state, dispatch, navigateTo, updateParams } = useStudioState();
  const params = state.worldGenParams;
  const [min, max] = params.countryCountRange;

  const toggleFamily = (familyId: string) => {
    const current = params.languageFamilies;
    const next = current.includes(familyId)
      ? current.filter((f) => f !== familyId)
      : [...current, familyId];
    updateParams({ languageFamilies: next });
  };

  const handleNext = () => {
    dispatch({ type: "COMPLETE_SECTION", section: "nations" });
    navigateTo("populate");
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white">Nations & Cultures</h1>
        <p className="mt-2 text-sm text-white/60">
          Define how countries are generated and named across your world.
        </p>
      </div>

      {/* Country Count Range */}
      <div className="space-y-6 rounded-xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm">
        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="text-sm font-medium text-white/80">Minimum Countries</label>
            <span className="font-mono text-sm text-white/60">{min}</span>
          </div>
          <input
            type="range"
            min={5}
            max={200}
            step={5}
            value={min}
            onChange={(e) => {
              const v = Number(e.target.value);
              updateParams({ countryCountRange: [v, Math.max(v, max)] });
            }}
            className="w-full accent-violet-500"
          />
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="text-sm font-medium text-white/80">Maximum Countries</label>
            <span className="font-mono text-sm text-white/60">{max}</span>
          </div>
          <input
            type="range"
            min={5}
            max={200}
            step={5}
            value={max}
            onChange={(e) => {
              const v = Number(e.target.value);
              updateParams({ countryCountRange: [Math.min(min, v), v] });
            }}
            className="w-full accent-violet-500"
          />
        </div>
      </div>

      {/* Naming */}
      <div className="space-y-6 rounded-xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm">
        {/* Markov Toggle */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-white/80">Markov Name Generation</p>
            <p className="text-xs text-white/40">
              Generate culturally-influenced names using Markov chains
            </p>
          </div>
          <button
            onClick={() => updateParams({ useMarkovNaming: !params.useMarkovNaming })}
            className={`h-6 w-11 rounded-full transition-colors ${
              params.useMarkovNaming ? "bg-violet-500" : "bg-white/20"
            }`}
          >
            <div
              className={`h-5 w-5 rounded-full bg-white shadow transition-transform ${
                params.useMarkovNaming ? "translate-x-5.5" : "translate-x-0.5"
              }`}
            />
          </button>
        </div>

        {/* Language Families */}
        {params.useMarkovNaming && (
          <div>
            <label className="mb-3 block text-sm font-medium text-white/80">
              Language Families
            </label>
            <div className="flex flex-wrap gap-2">
              {LANGUAGE_FAMILIES.map((fam) => {
                const active = params.languageFamilies.includes(fam.id);
                return (
                  <button
                    key={fam.id}
                    onClick={() => toggleFamily(fam.id)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                      active
                        ? "border-violet-500/50 bg-violet-500/20 text-violet-300"
                        : "border-white/10 bg-white/5 text-white/50 hover:bg-white/10"
                    }`}
                  >
                    {fam.label}
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-white/30">Select none to use all families randomly.</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex justify-between">
        <button
          onClick={() => navigateTo("climate")}
          className="rounded-lg border border-white/10 bg-white/5 px-5 py-2.5 text-sm text-white/60 transition-colors hover:bg-white/10"
        >
          ← Back: Climate
        </button>
        <button
          onClick={handleNext}
          className="rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 px-6 py-2.5 text-sm font-medium text-white shadow-lg transition-all hover:from-violet-500 hover:to-indigo-500"
        >
          Next: Populate →
        </button>
      </div>
    </div>
  );
}
