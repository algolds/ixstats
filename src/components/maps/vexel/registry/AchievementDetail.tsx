"use client";

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
    <span className="font-semibold text-cyan-400">{country?.name || countryId.slice(0, 8)}</span>
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
      <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-12 text-center text-xs text-red-400">
        Failed to load the coat of arms: {error?.message || "Achievement not found."}
      </div>
    );
  }

  const composition = achievement.compositionData as unknown as HeraldryComposition;

  return (
    <div className="grid grid-cols-1 items-start gap-8 text-xs text-zinc-300 md:grid-cols-[1fr_350px]">
      {/* Left Column: Canvas & Description */}
      <div className="space-y-6">
        {/* Large Canvas Box */}
        <div className="relative flex aspect-video max-h-[450px] items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-zinc-900/30 p-8 shadow-inner backdrop-blur-md">
          <div className="relative flex aspect-square max-h-full max-w-full items-center justify-center">
            {composition.externals?.helm && (
              <div className="absolute -top-12 z-20 flex flex-col items-center">
                <span className="animate-bounce text-4xl duration-1000">🪖</span>
              </div>
            )}

            <ShieldRenderer composition={composition} />

            {composition.externals?.motto && (
              <div
                className={`absolute left-1/2 z-20 -translate-x-1/2 ${
                  composition.externals.motto.position === "above" ? "-top-10" : "-bottom-4"
                }`}
              >
                <div className="rounded-md border border-amber-600/30 bg-amber-500/90 px-5 py-2 font-serif text-[10px] font-bold tracking-wider whitespace-nowrap text-zinc-950 uppercase shadow-md">
                  📜 {composition.externals.motto.text}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Blazon Description Card */}
        <div className="space-y-3 rounded-xl border border-white/5 bg-zinc-900/60 p-6 backdrop-blur-md">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold tracking-widest text-amber-500 uppercase">
              Official Blazon (Heraldic Description)
            </h3>
            <button
              onClick={handleCopyBlazon}
              className="rounded bg-white/5 px-2 py-0.5 text-[10px] font-semibold text-zinc-400 transition-all hover:bg-white/10 hover:text-amber-400"
            >
              {copied ? "✓ Copied" : "📋 Copy"}
            </button>
          </div>
          <p className="border-l-2 border-amber-500/50 py-1 pl-4 font-serif text-base leading-relaxed text-zinc-200 italic">
            {achievement.generatedBlazon}
          </p>
        </div>
      </div>

      {/* Right Column: Metadata & History */}
      <div className="space-y-6">
        {/* Metadata Card */}
        <div className="flex flex-col gap-4 rounded-xl border border-white/5 bg-zinc-900/60 p-5 backdrop-blur-md">
          <div className="border-b border-white/5 pb-3">
            <span className="mb-0.5 block text-[10px] font-bold tracking-widest text-zinc-500 uppercase">
              Title
            </span>
            <h2 className="text-base font-bold text-zinc-100">{achievement.title}</h2>
          </div>

          <div>
            <span className="mb-0.5 block text-[10px] font-bold tracking-widest text-zinc-500 uppercase">
              Registered Owner
            </span>
            <span className="font-semibold text-zinc-200">{achievement.ownerId}</span>
          </div>

          <div>
            <span className="mb-0.5 block text-[10px] font-bold tracking-widest text-zinc-500 uppercase">
              Subject Binding
            </span>
            <span className="mb-1 block font-semibold text-zinc-200">
              {achievement.subjectType}
            </span>
            {achievement.subjectType === "COUNTRY" && achievement.subjectId && (
              <CountryNameResolver countryId={achievement.subjectId} />
            )}
          </div>

          <div>
            <span className="mb-0.5 block text-[10px] font-bold tracking-widest text-zinc-500 uppercase">
              Registration Date
            </span>
            <span className="text-zinc-400">
              {new Date(achievement.createdAt).toLocaleString()}
            </span>
          </div>

          <div className="border-t border-white/5 pt-2">
            <button
              onClick={handleEditOrClone}
              className="w-full rounded-lg bg-amber-500 py-2 text-center font-bold text-zinc-950 transition-all hover:bg-amber-600"
            >
              ✏️ Open in Studio / Edit
            </button>
          </div>
        </div>

        {/* Revision logs */}
        <div className="rounded-xl border border-white/5 bg-zinc-900/60 p-5 backdrop-blur-md">
          <RevisionHistory achievementId={achievementId} />
        </div>
      </div>
    </div>
  );
}
