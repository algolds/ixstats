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
  const { data: country } = api.countries.getById.useQuery({ id: countryId });
  return (
    <span className="font-semibold text-cyan-400">
      {country?.name || countryId.slice(0, 8)}
    </span>
  );
}

export default function AchievementDetail({ achievementId }: AchievementDetailProps) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);

  // Fetch Achievement details
  const { data: achievement, isLoading, error } = api.heraldry.getAchievement.useQuery({
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
      <div className="flex h-96 items-center justify-center text-amber-500 text-xs gap-3">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
        <span>Consulting the Heraldic rolls...</span>
      </div>
    );
  }

  if (error || !achievement) {
    return (
      <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-12 text-center text-red-400 text-xs">
        Failed to load the coat of arms: {error?.message || "Achievement not found."}
      </div>
    );
  }

  const composition = achievement.compositionData as unknown as HeraldryComposition;

  return (
    <div className="grid grid-cols-1 md:grid-cols-[1fr_350px] gap-8 items-start text-xs text-zinc-300">
      {/* Left Column: Canvas & Description */}
      <div className="space-y-6">
        {/* Large Canvas Box */}
        <div className="flex items-center justify-center rounded-2xl border border-white/10 bg-zinc-900/30 p-8 shadow-inner backdrop-blur-md relative overflow-hidden aspect-video max-h-[450px]">
          <div className="max-h-full max-w-full aspect-square flex items-center justify-center relative">
            {composition.externals?.helm && (
              <div className="absolute -top-12 z-20 flex flex-col items-center">
                <span className="text-4xl animate-bounce duration-1000">🪖</span>
              </div>
            )}

            <ShieldRenderer composition={composition} />

            {composition.externals?.motto && (
              <div
                className={`absolute left-1/2 -translate-x-1/2 z-20 ${
                  composition.externals.motto.position === "above" ? "-top-10" : "-bottom-4"
                }`}
              >
                <div className="bg-amber-500/90 text-zinc-950 px-5 py-2 rounded-md font-serif text-[10px] uppercase font-bold tracking-wider shadow-md border border-amber-600/30 whitespace-nowrap">
                  📜 {composition.externals.motto.text}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Blazon Description Card */}
        <div className="bg-zinc-900/60 border border-white/5 rounded-xl p-6 backdrop-blur-md space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-widest text-amber-500">
              Official Blazon (Heraldic Description)
            </h3>
            <button
              onClick={handleCopyBlazon}
              className="text-[10px] font-semibold text-zinc-400 hover:text-amber-400 bg-white/5 hover:bg-white/10 px-2 py-0.5 rounded transition-all"
            >
              {copied ? "✓ Copied" : "📋 Copy"}
            </button>
          </div>
          <p className="text-base font-serif italic leading-relaxed text-zinc-200 border-l-2 border-amber-500/50 pl-4 py-1">
            {achievement.generatedBlazon}
          </p>
        </div>
      </div>

      {/* Right Column: Metadata & History */}
      <div className="space-y-6">
        {/* Metadata Card */}
        <div className="bg-zinc-900/60 border border-white/5 rounded-xl p-5 backdrop-blur-md flex flex-col gap-4">
          <div className="border-b border-white/5 pb-3">
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block mb-0.5">
              Title
            </span>
            <h2 className="text-base font-bold text-zinc-100">{achievement.title}</h2>
          </div>

          <div>
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block mb-0.5">
              Registered Owner
            </span>
            <span className="font-semibold text-zinc-200">{achievement.ownerId}</span>
          </div>

          <div>
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block mb-0.5">
              Subject Binding
            </span>
            <span className="font-semibold text-zinc-200 block mb-1">{achievement.subjectType}</span>
            {achievement.subjectType === "COUNTRY" && achievement.subjectId && (
              <CountryNameResolver countryId={achievement.subjectId} />
            )}
          </div>

          <div>
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block mb-0.5">
              Registration Date
            </span>
            <span className="text-zinc-400">{new Date(achievement.createdAt).toLocaleString()}</span>
          </div>

          <div className="pt-2 border-t border-white/5">
            <button
              onClick={handleEditOrClone}
              className="w-full bg-amber-500 hover:bg-amber-600 text-zinc-950 font-bold py-2 rounded-lg text-center transition-all"
            >
              ✏️ Open in Studio / Edit
            </button>
          </div>
        </div>

        {/* Revision logs */}
        <div className="bg-zinc-900/60 border border-white/5 rounded-xl p-5 backdrop-blur-md">
          <RevisionHistory achievementId={achievementId} />
        </div>
      </div>
    </div>
  );
}
