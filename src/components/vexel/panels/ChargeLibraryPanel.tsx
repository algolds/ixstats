"use client";

import React, { useState } from "react";
import { useVexelEditor } from "../VexelEditorProvider";
import { api } from "~/trpc/react";
import { CHARGE_CATEGORIES } from "~/lib/heraldry";
import { FacetMaterial } from "~/components/facet-ui";

interface ChargeLibraryPanelProps {
  onOpenCommons: () => void;
}

export default function ChargeLibraryPanel({ onOpenCommons }: ChargeLibraryPanelProps) {
  const { addCharge } = useVexelEditor();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("");

  // Fetch paginated charges from backend library
  const { data, isLoading } = api.heraldry.getChargeLibrary.useQuery({
    search: search || undefined,
    category: category ? (category as any) : undefined,
    limit: 30,
  });

  // Local static template charges list
  const localTemplates = [
    { id: "star", name: "Star (Mullet)" },
    { id: "cross", name: "Cross" },
    { id: "fleur-de-lis", name: "Fleur-de-lis" },
    { id: "lion", name: "Lion Rampant" },
    { id: "eagle", name: "Eagle Displayed" },
  ].filter((c) => {
    if (search) {
      return c.name.toLowerCase().includes(search.toLowerCase());
    }
    return true;
  });

  const handleAddCharge = (chargeId: string) => {
    addCharge({
      chargeId,
      position: "fess-point",
      count: 1,
      tincture: "or",
      size: 1.0,
    });
  };

  return (
    <FacetMaterial
      material="satin"
      className="h-full overflow-hidden rounded-xl border border-white/10"
    >
      <div className="flex h-full flex-col p-4">
        <div className="mb-4 flex items-center justify-between border-b border-white/5 pb-2">
          <h2 className="text-xs font-bold tracking-widest text-zinc-400 uppercase">
            Charge Library
          </h2>
          <button
            onClick={onOpenCommons}
            className="rounded bg-amber-500 px-2 py-1 text-[10px] font-bold text-zinc-950 transition-colors hover:bg-amber-600"
          >
            🌐 Browse Commons
          </button>
        </div>

        {/* Search and Filters */}
        <div className="mb-4 space-y-2 text-xs">
          <input
            type="text"
            placeholder="Search charges..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-zinc-950 p-2 text-zinc-300 focus:border-amber-500 focus:outline-none"
          />

          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-zinc-950 p-2 text-zinc-400 focus:outline-none"
          >
            <option value="">All Categories</option>
            {CHARGE_CATEGORIES.map((cat) => (
              <option key={cat.value} value={cat.value}>
                {cat.label}
              </option>
            ))}
          </select>
        </div>

        {/* Grid List */}
        <div className="flex-1 overflow-y-auto pr-1">
          <div className="space-y-4">
            {/* Local Templates */}
            {localTemplates.length > 0 && (
              <div>
                <span className="mb-2 block text-[9px] font-bold tracking-wider text-zinc-500 uppercase">
                  Built-in Templates
                </span>
                <div className="grid grid-cols-2 gap-2">
                  {localTemplates.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => handleAddCharge(item.id)}
                      className="flex flex-col items-center justify-center gap-1 rounded-lg border border-white/5 bg-zinc-950/30 p-3 text-left text-xs transition-all outline-none hover:border-amber-500/30 hover:bg-zinc-800/40"
                    >
                      <span className="text-xl">🐾</span>
                      <span className="w-full truncate text-center text-[10px] font-medium text-zinc-300">
                        {item.name}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Database Library */}
            <div>
              <span className="mb-2 block text-[9px] font-bold tracking-wider text-zinc-500 uppercase">
                Imported Charges
              </span>

              {isLoading ? (
                <div className="flex justify-center py-6 text-xs text-zinc-500">
                  Loading library...
                </div>
              ) : (data?.items ?? []).length === 0 ? (
                <div className="py-6 text-center text-[10px] text-zinc-600 italic">
                  No custom charges found. Use the Commons Browser to import.
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {(data?.items ?? []).map((item: any) => (
                    <button
                      key={item.id}
                      onClick={() => handleAddCharge(item.id)}
                      className="flex flex-col items-center justify-center gap-1 rounded-lg border border-white/5 bg-zinc-950/30 p-3 text-left text-xs transition-all outline-none hover:border-amber-500/30 hover:bg-zinc-800/40"
                    >
                      {/* SVG preview */}
                      <div
                        className="flex h-8 w-8 items-center justify-center overflow-hidden text-zinc-300"
                        dangerouslySetInnerHTML={{
                          __html: item.svgData
                            .replace(/width="[^"]*"/, 'width="100%"')
                            .replace(/height="[^"]*"/, 'height="100%"'),
                        }}
                      />
                      <span className="w-full truncate text-center text-[10px] font-medium text-zinc-300">
                        {item.name}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </FacetMaterial>
  );
}
