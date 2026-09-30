"use client";

import { Component } from "iconoir-react";
import { Eyebrow } from "~/components/ui/eyebrow";
import { Button } from "~/components/ui/button";
import React, { useState } from "react";
import { useVexelEditor } from "../VexelEditorProvider";
import { api } from "~/trpc/react";
import { CHARGE_CATEGORIES } from "~/lib/heraldry";
import { FacetMaterial } from "~/components/ui/facet";

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
      className="border-border h-full overflow-hidden rounded-xl border"
    >
      <div className="flex h-full flex-col p-4">
        <div className="border-border mb-4 flex items-center justify-between border-b pb-2">
          <h2 className="text-foreground text-sm font-semibold">Charge Library</h2>
          <Button variant="ghost" size="xs" onClick={onOpenCommons}>
            Browse Commons
          </Button>
        </div>

        {/* Search and Filters */}
        <div className="mb-4 space-y-2 text-xs">
          <input
            type="text"
            placeholder="Search charges..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border-border bg-card text-muted-foreground w-full rounded-lg border p-2 focus:border-amber-500 focus:outline-none"
          />

          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="border-border bg-card text-muted-foreground w-full rounded-lg border p-2 focus:outline-none"
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
                <Eyebrow className="mb-2 block">Built-in Templates</Eyebrow>
                <div className="grid grid-cols-2 gap-2">
                  {localTemplates.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => handleAddCharge(item.id)}
                      className="border-border bg-card/30 hover:bg-accent flex flex-col items-center justify-center gap-1 rounded-lg border p-3 text-left text-xs transition-[color,background-color,border-color,box-shadow,opacity,transform] outline-none hover:border-amber-500/30"
                    >
                      <Component className="text-muted-foreground h-5 w-5" aria-hidden />
                      <span className="text-muted-foreground w-full truncate text-center text-xs font-medium">
                        {item.name}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Database Library */}
            <div>
              <Eyebrow className="mb-2 block">Imported Charges</Eyebrow>

              {isLoading ? (
                <div className="text-muted-foreground flex justify-center py-6 text-xs">
                  Loading library...
                </div>
              ) : (data?.items ?? []).length === 0 ? (
                <div className="text-muted-foreground py-6 text-center text-xs italic">
                  No custom charges found. Use the Commons Browser to import.
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {(data?.items ?? []).map((item: any) => (
                    <button
                      key={item.id}
                      onClick={() => handleAddCharge(item.id)}
                      className="border-border bg-card/30 hover:bg-accent flex flex-col items-center justify-center gap-1 rounded-lg border p-3 text-left text-xs transition-[color,background-color,border-color,box-shadow,opacity,transform] outline-none hover:border-amber-500/30"
                    >
                      {/* SVG preview */}
                      <div
                        className="text-muted-foreground flex h-8 w-8 items-center justify-center overflow-hidden"
                        dangerouslySetInnerHTML={{
                          __html: item.svgData
                            .replace(/width="[^"]*"/, 'width="100%"')
                            .replace(/height="[^"]*"/, 'height="100%"'),
                        }}
                      />
                      <span className="text-muted-foreground w-full truncate text-center text-xs font-medium">
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
