"use client";

import { Refresh } from "iconoir-react";
import { FacetCard } from "~/components/ui/facet-container";
import { OptionSelect } from "~/components/maps/shared/OptionSelect";
import { Eyebrow } from "~/components/ui/eyebrow";
import { Button } from "~/components/ui/button";
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import ShieldRenderer from "./renderer/ShieldRenderer";
import { generateRandomComposition } from "~/lib/heraldry/generator";
import { generateBlazon } from "~/lib/heraldry/blazon";
import type { HeraldryComposition } from "~/lib/heraldry";
import { api } from "~/trpc/react";

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
      <FacetCard className="text-label-secondary text-footnote grid grid-cols-1 gap-3 p-4 md:grid-cols-4">
        <div className="space-y-1">
          <Eyebrow id="vexel-gallery-culture" className="block">
            Culture influence
          </Eyebrow>
          <OptionSelect
            aria-labelledby="vexel-gallery-culture"
            value={cultureGroup}
            onValueChange={setCultureGroup}
            options={[
              { value: "", label: "Standard (None)" },
              { value: "burgundian", label: "Burgundian (Fleur-de-lis)" },
              { value: "germanic", label: "Germanic (Eagle)" },
              { value: "nordic", label: "Nordic (Lion)" },
              { value: "frankish", label: "Frankish (Fleur-de-lis)" },
            ]}
          />
        </div>

        <div className="space-y-1">
          <Eyebrow id="vexel-gallery-religion" className="block">
            Religiosity
          </Eyebrow>
          <OptionSelect
            aria-labelledby="vexel-gallery-religion"
            value={religion}
            onValueChange={setReligion}
            options={[
              { value: "", label: "None" },
              { value: "christian", label: "Christian (Motto)" },
              { value: "islamic", label: "Islamic (Motto)" },
            ]}
          />
        </div>

        <div className="space-y-1">
          <Eyebrow id="vexel-gallery-government" className="block">
            Government
          </Eyebrow>
          <OptionSelect
            aria-labelledby="vexel-gallery-government"
            value={governmentType}
            onValueChange={setGovernmentType}
            options={[
              { value: "", label: "None" },
              { value: "republic", label: "Republic (Round Shield)" },
              { value: "monarchy", label: "Monarchy (Renaissance Shape)" },
            ]}
          />
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
        <div className="text-label-secondary text-footnote flex flex-col items-center justify-center gap-3 py-32">
          <div className="border-tint h-8 w-8 animate-spin rounded-full border-2 border-t-transparent" />
          <span>Forging procedural arms...</span>
        </div>
      ) : compositions.length === 0 ? (
        <div className="text-label-secondary text-footnote py-20 text-center italic">
          No candidates generated.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-4">
          {compositions.map((comp, idx) => {
            const blazon = generateBlazon(comp);

            return (
              <FacetCard key={idx} className="group overflow-hidden">
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
                        className="text-label-secondary text-footnote line-clamp-2 px-2 italic"
                        title={blazon}
                      >
                        {blazon}
                      </p>
                    </div>

                    <div className="border-separator mt-4 flex gap-2 border-t pt-3">
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
              </FacetCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
