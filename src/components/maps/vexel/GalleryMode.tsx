"use client";

import { Refresh } from "iconoir-react";
import { FacetCard } from "~/components/ui/facet-container";
import { Eyebrow } from "~/components/ui/eyebrow";
import { Button } from "~/components/ui/button";
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import ShieldRenderer from "./renderer/ShieldRenderer";
import { generateRandomComposition } from "~/lib/heraldry/generator";
import { generateBlazon } from "~/lib/heraldry/blazon";
import type { HeraldryComposition } from "~/lib/heraldry";
import { api } from "~/trpc/react";
import { FacetMaterial } from "~/components/ui/facet";

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
      // oxlint-disable-next-line
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
      <FacetCard
        surface="solid"
        className="border-border bg-muted/40 text-muted-foreground grid grid-cols-1 gap-3 rounded-xl p-4 text-xs md:grid-cols-4"
      >
        <div className="space-y-1">
          <Eyebrow className="block">Culture Influence</Eyebrow>
          <select
            value={cultureGroup}
            onChange={(e) => setCultureGroup(e.target.value)}
            className="border-border bg-card w-full rounded-lg border p-2 focus:outline-none"
          >
            <option value="">Standard (None)</option>
            <option value="burgundian">Burgundian (Fleur-de-lis)</option>
            <option value="germanic">Germanic (Eagle)</option>
            <option value="nordic">Nordic (Lion)</option>
            <option value="frankish">Frankish (Fleur-de-lis)</option>
          </select>
        </div>

        <div className="space-y-1">
          <Eyebrow className="block">Religiosity</Eyebrow>
          <select
            value={religion}
            onChange={(e) => setReligion(e.target.value)}
            className="border-border bg-card w-full rounded-lg border p-2 focus:outline-none"
          >
            <option value="">None</option>
            <option value="christian">Christian (Motto)</option>
            <option value="islamic">Islamic (Motto)</option>
          </select>
        </div>

        <div className="space-y-1">
          <Eyebrow className="block">Government</Eyebrow>
          <select
            value={governmentType}
            onChange={(e) => setGovernmentType(e.target.value)}
            className="border-border bg-card w-full rounded-lg border p-2 focus:outline-none"
          >
            <option value="">None</option>
            <option value="republic">Republic (Round Shield)</option>
            <option value="monarchy">Monarchy (Renaissance Shape)</option>
          </select>
        </div>

        <div className="flex items-end">
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={handleRollAll}
            disabled={isLoading}
          >
            Roll all
          </Button>
        </div>
      </FacetCard>

      {/* Grid view */}
      {isLoading ? (
        <div className="text-muted-foreground flex flex-col items-center justify-center gap-3 py-32 text-xs">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
          <span>Forging procedural arms...</span>
        </div>
      ) : compositions.length === 0 ? (
        <div className="text-muted-foreground py-20 text-center text-xs italic">
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
                className="group border-border relative overflow-hidden rounded-xl border shadow-md transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-200 hover:border-amber-500/25"
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
                      <Eyebrow className="mb-1 block">Design {idx + 1}</Eyebrow>
                      <p
                        className="text-muted-foreground line-clamp-2 px-2 font-serif text-xs italic"
                        title={blazon}
                      >
                        {blazon}
                      </p>
                    </div>

                    <div className="border-border mt-4 flex gap-1.5 border-t pt-3">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => handleSelectCard(comp)}
                      >
                        Edit arms
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleReRollSingle(idx)}
                        title="Re-roll this card"
                      >
                        <Refresh aria-hidden />
                      </Button>
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
