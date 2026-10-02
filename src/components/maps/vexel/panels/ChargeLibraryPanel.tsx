"use client";

import { Component } from "iconoir-react";
import { Eyebrow } from "~/components/ui/eyebrow";
import { Button } from "~/components/ui/button";
import React, { useState } from "react";
import { useVexelEditor } from "../VexelEditorProvider";
import { api } from "~/trpc/react";
import { CHARGE_CATEGORIES } from "~/lib/heraldry";
import { FacetCard } from "~/components/ui/facet-container";
import { SearchField } from "~/components/ui/search-field";
import { OptionSelect } from "~/components/maps/shared/OptionSelect";

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
    <FacetCard className="h-full overflow-hidden">
      <div className="flex h-full flex-col p-4">
        <div className="border-separator mb-4 flex items-center justify-between border-b pb-2">
          <h2 className="text-label text-headline">Charge library</h2>
          <Button variant="ghost" size="xs" onClick={onOpenCommons}>
            Browse Commons
          </Button>
        </div>

        {/* Search and Filters */}
        <div className="text-footnote mb-4 space-y-2">
          <SearchField
            aria-label="Search charges"
            placeholder="Search charges..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onClear={() => setSearch("")}
          />

          <OptionSelect
            aria-label="Charge category"
            value={category}
            onValueChange={setCategory}
            options={[{ value: "", label: "All categories" }, ...CHARGE_CATEGORIES]}
          />
        </div>

        {/* Grid List */}
        <div className="flex-1 overflow-y-auto pr-1">
          <div className="space-y-4">
            {/* Local Templates */}
            {localTemplates.length > 0 && (
              <div>
                <Eyebrow className="mb-2 block">Built-in templates</Eyebrow>
                <div className="grid grid-cols-2 gap-2">
                  {localTemplates.map((item) => (
                    <Button
                      key={item.id}
                      type="button"
                      variant="outline"
                      onClick={() => handleAddCharge(item.id)}
                      className="h-auto min-w-0 flex-col gap-1 p-3 whitespace-normal"
                    >
                      <Component className="text-label-secondary h-5 w-5" aria-hidden />
                      <span className="text-label-secondary text-caption w-full truncate text-center">
                        {item.name}
                      </span>
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* Database Library */}
            <div>
              <Eyebrow className="mb-2 block">Imported charges</Eyebrow>

              {isLoading ? (
                <div className="text-label-secondary text-footnote flex justify-center py-6">
                  Loading library...
                </div>
              ) : (data?.items ?? []).length === 0 ? (
                <div className="text-label-secondary text-footnote py-6 text-center italic">
                  No custom charges found. Use the Commons Browser to import.
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {(data?.items ?? []).map((item: any) => (
                    <Button
                      key={item.id}
                      type="button"
                      variant="outline"
                      onClick={() => handleAddCharge(item.id)}
                      className="h-auto min-w-0 flex-col gap-1 p-3 whitespace-normal"
                    >
                      {/* SVG preview */}
                      <div
                        className="text-label-secondary flex h-8 w-8 items-center justify-center overflow-hidden"
                        dangerouslySetInnerHTML={{
                          __html: item.svgData
                            .replace(/width="[^"]*"/, 'width="100%"')
                            .replace(/height="[^"]*"/, 'height="100%"'),
                        }}
                      />
                      <span className="text-label-secondary text-caption w-full truncate text-center">
                        {item.name}
                      </span>
                    </Button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </FacetCard>
  );
}
