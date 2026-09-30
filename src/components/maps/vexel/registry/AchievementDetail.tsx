"use client";

import { FacetCard } from "~/components/ui/facet-container";
import { Eyebrow } from "~/components/ui/eyebrow";
import { Button } from "~/components/ui/button";
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "~/trpc/react";
import ShieldRenderer from "../renderer/ShieldRenderer";
import RevisionHistory from "../RevisionHistory";
import type { HeraldryComposition } from "~/lib/heraldry";

interface AchievementDetailProps {
  achievementId: string;
}

// Child component to resolve country name dynamically
function CountryNameResolver({ countryId }: { countryId: string }) {
  const { data: country } = api.countries.getByIdAtTime.useQuery({ id: countryId });
  return (
    <span className="text-foreground font-semibold">{country?.name || countryId.slice(0, 8)}</span>
  );
}

export default function AchievementDetail({ achievementId }: AchievementDetailProps) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);

  // Fetch Achievement details
  const {
    data: achievement,
    isLoading,
    error,
  } = api.heraldry.getAchievement.useQuery({
    id: achievementId,
  });

  const handleCopyBlazon = () => {
    if (!achievement?.generatedBlazon) return;
    navigator.clipboard.writeText(achievement.generatedBlazon);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleEditOrClone = () => {
    if (!achievement) return;
    if (typeof window !== "undefined") {
      sessionStorage.setItem("vexel-draft", JSON.stringify(achievement.compositionData));
      router.push(`/labs/vexel/${achievement.id}`);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center gap-3 text-xs text-amber-500">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
        <span>Consulting the Heraldic rolls...</span>
      </div>
    );
  }

  if (error || !achievement) {
    return (
      <div className="border-destructive/30 text-destructive rounded-xl border p-12 text-center text-xs">
        Failed to load the coat of arms: {error?.message || "Achievement not found."}
      </div>
    );
  }

  const composition = achievement.compositionData as unknown as HeraldryComposition;

  return (
    <div className="text-muted-foreground grid grid-cols-1 items-start gap-8 text-xs md:grid-cols-[1fr_350px]">
      {/* Left Column: Canvas & Description */}
      <div className="space-y-6">
        {/* Large Canvas Box */}
        <FacetCard
          surface="solid"
          className="border-border bg-muted/40 relative flex aspect-video max-h-[450px] items-center justify-center overflow-hidden rounded-2xl p-8"
        >
          <div className="relative flex aspect-square max-h-full max-w-full items-center justify-center">
            {composition.externals?.helm && (
              <div className="absolute -top-12 z-20 flex flex-col items-center">
                <Eyebrow>Helm</Eyebrow>
              </div>
            )}

            <ShieldRenderer composition={composition} />

            {composition.externals?.motto && (
              <div
                className={`absolute left-1/2 z-20 -translate-x-1/2 ${
                  composition.externals.motto.position === "above" ? "-top-10" : "-bottom-4"
                }`}
              >
                <Eyebrow className="block rounded-md border border-amber-600/30 bg-amber-500/90 px-5 py-2 whitespace-nowrap shadow-md">
                  {composition.externals.motto.text}
                </Eyebrow>
              </div>
            )}
          </div>
        </FacetCard>

        {/* Blazon Description Card */}
        <FacetCard surface="solid" className="border-border bg-muted/40 space-y-3 rounded-xl p-6">
          <div className="flex items-center justify-between">
            <Eyebrow className="block">Official Blazon (Heraldic Description)</Eyebrow>
            <Button variant="outline" size="xs" onClick={handleCopyBlazon}>
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
          <p className="text-foreground border-l-2 border-amber-500/50 py-1 pl-4 font-serif text-base leading-relaxed italic">
            {achievement.generatedBlazon}
          </p>
        </FacetCard>
      </div>

      {/* Right Column: Metadata & History */}
      <div className="space-y-6">
        {/* Metadata Card */}
        <FacetCard
          surface="solid"
          className="border-border bg-muted/40 flex flex-col gap-4 rounded-xl p-5"
        >
          <div className="border-border border-b pb-3">
            <Eyebrow className="mb-0.5 block">Title</Eyebrow>
            <h2 className="text-foreground text-base font-bold">{achievement.title}</h2>
          </div>

          <div>
            <Eyebrow className="mb-0.5 block">Registered Owner</Eyebrow>
            <span className="text-foreground font-semibold">{achievement.ownerId}</span>
          </div>

          <div>
            <Eyebrow className="mb-0.5 block">Subject Binding</Eyebrow>
            <span className="text-foreground mb-1 block font-semibold">
              {achievement.subjectType}
            </span>
            {achievement.subjectType === "COUNTRY" && achievement.subjectId && (
              <CountryNameResolver countryId={achievement.subjectId} />
            )}
          </div>

          <div>
            <Eyebrow className="mb-0.5 block">Registration Date</Eyebrow>
            <span className="text-muted-foreground">
              {new Date(achievement.createdAt).toLocaleString()}
            </span>
          </div>

          <div className="border-border border-t pt-2">
            <Button variant="outline" size="sm" className="w-full" onClick={handleEditOrClone}>
              Open in studio
            </Button>
          </div>
        </FacetCard>

        {/* Revision logs */}
        <FacetCard surface="solid" className="border-border bg-muted/40 rounded-xl p-5">
          <RevisionHistory achievementId={achievementId} />
        </FacetCard>
      </div>
    </div>
  );
}
