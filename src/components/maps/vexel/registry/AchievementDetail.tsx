"use client";
import { Eyebrow } from "~/components/ui/eyebrow";
import { Button } from "~/components/ui/button";
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "~/trpc/react";
import ShieldRenderer from "../renderer/ShieldRenderer";
import RevisionHistory from "../RevisionHistory";
import type { HeraldryComposition } from "~/lib/heraldry";
import { Card } from "~/components/ui/card";

interface AchievementDetailProps {
  achievementId: string;
}

// Child component to resolve country name dynamically
function CountryNameResolver({ countryId }: { countryId: string }) {
  const { data: country } = api.countries.getByIdAtTime.useQuery({ id: countryId });
  return <span className="text-label font-semibold">{country?.name || countryId.slice(0, 8)}</span>;
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
      <div className="text-footnote text-tint flex h-96 items-center justify-center gap-3">
        <div className="border-tint h-6 w-6 animate-spin rounded-full border-2 border-t-transparent" />
        <span>Consulting the Heraldic rolls...</span>
      </div>
    );
  }

  if (error || !achievement) {
    return (
      <div className="border-destructive/30 text-destructive rounded-row text-footnote border p-12 text-center">
        Failed to load the coat of arms: {error?.message || "Achievement not found."}
      </div>
    );
  }

  const composition = achievement.compositionData as unknown as HeraldryComposition;

  return (
    <div className="text-label-secondary text-footnote grid grid-cols-1 items-start gap-8 md:grid-cols-[1fr_350px]">
      {/* Left Column: Canvas & Description */}
      <div className="space-y-6">
        {/* Large Canvas Box */}
        <Card className="relative flex aspect-video max-h-[450px] items-center justify-center overflow-hidden p-8">
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
                <Eyebrow className="rounded-control-sm bg-surface-elevated text-label shadow-floating block px-5 py-2 whitespace-nowrap">
                  {composition.externals.motto.text}
                </Eyebrow>
              </div>
            )}
          </div>
        </Card>

        {/* Blazon Description Card */}
        <Card className="space-y-3 p-6">
          <div className="flex items-center justify-between">
            <Eyebrow className="block">Official blazon (heraldic description)</Eyebrow>
            <Button variant="outline" size="xs" onClick={handleCopyBlazon}>
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
          <p className="text-label border-tint/50 text-body border-l-2 py-1 pl-4 leading-relaxed italic">
            {achievement.generatedBlazon}
          </p>
        </Card>
      </div>

      {/* Right Column: Metadata & History */}
      <div className="space-y-6">
        {/* Metadata Card */}
        <Card className="flex flex-col gap-4 p-5">
          <div className="border-separator border-b pb-3">
            <Eyebrow className="mb-0.5 block">Title</Eyebrow>
            <h2 className="text-label text-title-3">{achievement.title}</h2>
          </div>

          <div>
            <Eyebrow className="mb-0.5 block">Registered owner</Eyebrow>
            <span className="text-label font-semibold">{achievement.ownerId}</span>
          </div>

          <div>
            <Eyebrow className="mb-0.5 block">Subject binding</Eyebrow>
            <span className="text-label mb-1 block font-semibold">{achievement.subjectType}</span>
            {achievement.subjectType === "COUNTRY" && achievement.subjectId && (
              <CountryNameResolver countryId={achievement.subjectId} />
            )}
          </div>

          <div>
            <Eyebrow className="mb-0.5 block">Registration date</Eyebrow>
            <span className="text-label-secondary">
              {new Date(achievement.createdAt).toLocaleString()}
            </span>
          </div>

          <div className="border-separator border-t pt-2">
            <Button variant="outline" size="sm" className="w-full" onClick={handleEditOrClone}>
              Open in studio
            </Button>
          </div>
        </Card>

        {/* Revision logs */}
        <Card className="p-5">
          <RevisionHistory achievementId={achievementId} />
        </Card>
      </div>
    </div>
  );
}
