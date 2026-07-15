"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import ShieldRenderer from "./renderer/ShieldRenderer";
import { generateRandomComposition } from "~/lib/heraldry/generator";
import { generateBlazon } from "~/lib/heraldry/blazon";
import type { HeraldryComposition } from "~/lib/heraldry";
import { api } from "~/trpc/react";
import { FacetMaterial } from "~/components/facet-ui";

export default function GalleryMode() {
  const router = useRouter();

  // Filter states
  const [cultureGroup, setCultureGroup] = useState("");
  const [religion, setReligion] = useState("");
  const [governmentType, setGovernmentType] = useState("");

  const [compositions, setCompositions] = useState<HeraldryComposition[]>([]);

  // tRPC query to load initial candidates
  const {
    data: initialData,
    isLoading,
    refetch,
  } = api.heraldry.generateRandom.useQuery(
    {
      count: 8,
      options: {
        cultureGroup: cultureGroup || undefined,
        religion: religion || undefined,
        governmentType: governmentType || undefined,
      },
    },
    {
      refetchOnWindowFocus: false,
    }
  );

  // Set compositions state when data is loaded
  useEffect(() => {
    if (initialData) {
      setCompositions(initialData as unknown as HeraldryComposition[]);
    }
  }, [initialData]);

  const handleRollAll = async () => {
    await refetch();
  };

  const handleReRollSingle = (idx: number) => {
    const fresh = generateRandomComposition({
      cultureGroup: cultureGroup || undefined,
      religion: religion || undefined,
      governmentType: governmentType || undefined,
    });
    setCompositions((prev) => prev.map((c, i) => (i === idx ? fresh : c)));
  };

  const handleSelectCard = (comp: HeraldryComposition) => {
    if (typeof window !== "undefined") {
      sessionStorage.setItem("vexel-draft", JSON.stringify(comp));
      router.push("/labs/vexel");
    }
  };

  return (
    <div className="space-y-6">
      {/* Filters Toolbar */}
      <div className="grid grid-cols-1 gap-3 rounded-xl border border-white/5 bg-zinc-900/60 p-4 text-xs text-zinc-300 backdrop-blur-md md:grid-cols-4">
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-zinc-500 uppercase">Culture Influence</label>
          <select
            value={cultureGroup}
            onChange={(e) => setCultureGroup(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-zinc-950 p-2 focus:outline-none"
          >
            <option value="">Standard (None)</option>
            <option value="burgundian">Burgundian (Fleur-de-lis)</option>
            <option value="germanic">Germanic (Eagle)</option>
            <option value="nordic">Nordic (Lion)</option>
            <option value="frankish">Frankish (Fleur-de-lis)</option>
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-bold text-zinc-500 uppercase">Religiosity</label>
          <select
            value={religion}
            onChange={(e) => setReligion(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-zinc-950 p-2 focus:outline-none"
          >
            <option value="">None</option>
            <option value="christian">Christian (Motto)</option>
            <option value="islamic">Islamic (Motto)</option>
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-bold text-zinc-500 uppercase">Government</label>
          <select
            value={governmentType}
            onChange={(e) => setGovernmentType(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-zinc-950 p-2 focus:outline-none"
          >
            <option value="">None</option>
            <option value="republic">Republic (Round Shield)</option>
            <option value="monarchy">Monarchy (Renaissance Shape)</option>
          </select>
        </div>

        <div className="flex items-end">
          <button
            onClick={handleRollAll}
            disabled={isLoading}
            className="h-9 w-full rounded-lg bg-amber-500 font-bold tracking-wider text-zinc-950 transition-all hover:bg-amber-600 disabled:bg-zinc-800"
          >
            🎲 Roll All
          </button>
        </div>
      </div>

      {/* Grid view */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center gap-3 py-32 text-xs text-zinc-500">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
          <span>Forging procedural arms...</span>
        </div>
      ) : compositions.length === 0 ? (
        <div className="py-20 text-center text-xs text-zinc-500 italic">
          No candidates generated.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-4">
          {compositions.map((comp, idx) => {
            const blazon = generateBlazon(comp);

            return (
              <FacetMaterial
                key={idx}
                material="satin"
                className="group relative overflow-hidden rounded-xl border border-white/10 shadow-md transition-all duration-200 hover:border-amber-500/25"
              >
                <div className="flex flex-col items-center gap-4 p-4">
                  {/* Shield box */}
                  <div
                    onClick={() => handleSelectCard(comp)}
                    className="relative flex aspect-square w-full max-w-[150px] transform cursor-pointer items-center justify-center transition-transform duration-200 group-hover:scale-[1.03]"
                  >
                    <ShieldRenderer composition={comp} width="100%" height="100%" />
                  </div>

                  {/* Info & Blazon */}
                  <div className="flex w-full flex-1 flex-col justify-between text-center">
                    <div>
                      <span className="mb-1 block text-[10px] font-bold tracking-widest text-zinc-500 uppercase">
                        Design {idx + 1}
                      </span>
                      <p
                        className="line-clamp-2 px-2 font-serif text-[11px] text-zinc-300 italic"
                        title={blazon}
                      >
                        {blazon}
                      </p>
                    </div>

                    <div className="mt-4 flex gap-1.5 border-t border-white/5 pt-3">
                      <button
                        onClick={() => handleSelectCard(comp)}
                        className="flex-1 rounded border border-amber-500/20 bg-amber-500/10 py-1.5 text-[10px] font-bold text-amber-400 transition-all hover:bg-amber-500 hover:text-zinc-950"
                      >
                        ✏️ Edit Arms
                      </button>
                      <button
                        onClick={() => handleReRollSingle(idx)}
                        className="rounded border border-white/5 bg-zinc-800 px-2.5 text-[10px] text-zinc-300 transition-all hover:bg-zinc-700"
                        title="Re-roll this card"
                      >
                        🔄
                      </button>
                    </div>
                  </div>
                </div>
              </FacetMaterial>
            );
          })}
        </div>
      )}
    </div>
  );
}
