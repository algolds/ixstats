"use client";

import React, { useState, useEffect } from "react";
import { useVexelEditor } from "./VexelEditorProvider";
import { api } from "~/trpc/react";
import ExportDialog from "./ExportDialog";
import { FacetMaterial } from "~/components/ui/facet";

export default function SaveControls() {
  // oxlint-disable-next-line eslint/no-unused-vars
  const { composition, achievementId, isDirty, setInitialState, markSaved } = useVexelEditor();

  const [title, setTitle] = useState("My Coat of Arms");
  const [subjectType, setSubjectType] = useState<
    "COUNTRY" | "CHARACTER" | "INSTITUTION" | "DYNASTY"
  >("CHARACTER");
  const [subjectId, setSubjectId] = useState<string | null>(null);

  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);

  const utils = api.useUtils();

  // Load countries for association
  const { data: countriesData } = api.countries.getAll.useQuery(
    { limit: 100 },
    { enabled: subjectType === "COUNTRY" }
  );
  const countries = countriesData?.countries ?? [];

  // Fetch current achievement properties if loaded
  const { data: currentAchievement } = api.heraldry.getAchievement.useQuery(
    { id: achievementId! },
    { enabled: !!achievementId }
  );

  useEffect(() => {
    if (currentAchievement) {
      setTitle(currentAchievement.title);
      setSubjectType(currentAchievement.subjectType as any);
      setSubjectId(currentAchievement.subjectId);
    }
  }, [currentAchievement]);

  // Mutations
  const saveMutation = api.heraldry.saveAchievement.useMutation({
    onSuccess: (data) => {
      setInitialState(data.compositionData as any, data.id);
      markSaved();
      utils.heraldry.getAchievement.invalidate({ id: data.id });
      utils.heraldry.getRegistry.invalidate();
    },
  });

  const publishMutation = api.heraldry.publishAchievement.useMutation({
    onSuccess: () => {
      utils.heraldry.getAchievement.invalidate({ id: achievementId! });
      utils.heraldry.getRegistry.invalidate();
      setIsPublishing(false);
    },
  });

  const unpublishMutation = api.heraldry.unpublishAchievement.useMutation({
    onSuccess: () => {
      utils.heraldry.getAchievement.invalidate({ id: achievementId! });
      utils.heraldry.getRegistry.invalidate();
      setIsPublishing(false);
    },
  });

  const attachMutation = api.heraldry.attachToCountry.useMutation({
    onSuccess: () => {
      alert(
        "Successfully attached coat of arms to the country! The political map layers have been invalidated."
      );
    },
  });

  const handleSave = () => {
    const svgElement = document.getElementById("vexel-shield-canvas");
    const svgData = svgElement ? new XMLSerializer().serializeToString(svgElement) : undefined;

    saveMutation.mutate({
      id: achievementId || undefined,
      title,
      subjectType,
      subjectId: subjectId || null,
      compositionData: composition as any,
      svgData,
    });
  };

  const handlePublishToggle = () => {
    if (!achievementId) return;
    setIsPublishing(true);
    if (currentAchievement?.isPublished) {
      unpublishMutation.mutate({ id: achievementId });
    } else {
      publishMutation.mutate({ id: achievementId });
    }
  };

  const handleAttach = () => {
    if (!achievementId || !subjectId) return;
    attachMutation.mutate({
      achievementId,
      countryId: subjectId,
    });
  };

  return (
    <FacetMaterial
      material="satin"
      className="mb-6 shrink-0 overflow-hidden rounded-xl border border-white/10"
    >
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 text-xs text-zinc-300">
        <div className="flex flex-1 flex-wrap items-center gap-4">
          {/* Title Input */}
          <div className="flex min-w-[150px] flex-col gap-1">
            <span className="text-[10px] font-bold tracking-wider text-zinc-500 uppercase">
              Arms Title
            </span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="rounded-lg border border-white/10 bg-zinc-950 p-2 text-zinc-200 focus:border-amber-500 focus:outline-none"
            />
          </div>

          {/* Subject Type */}
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-bold tracking-wider text-zinc-500 uppercase">
              Subject Type
            </span>
            <select
              value={subjectType}
              onChange={(e) => {
                setSubjectType(e.target.value as any);
                setSubjectId(null);
              }}
              className="rounded-lg border border-white/10 bg-zinc-950 p-2 text-zinc-300 focus:outline-none"
            >
              <option value="CHARACTER">Character</option>
              <option value="COUNTRY">Country</option>
              <option value="INSTITUTION">Institution</option>
              <option value="DYNASTY">Dynasty</option>
            </select>
          </div>

          {/* Subject Association (Conditional) */}
          {subjectType === "COUNTRY" && (
            <div className="animate-in fade-in slide-in-from-left-2 flex min-w-[150px] flex-col gap-1 duration-150">
              <span className="text-[10px] font-bold tracking-wider text-zinc-500 uppercase">
                Select Country
              </span>
              <select
                value={subjectId || ""}
                onChange={(e) => setSubjectId(e.target.value || null)}
                className="rounded-lg border border-white/10 bg-zinc-950 p-2 text-zinc-300 focus:outline-none"
              >
                <option value="">Choose Country...</option>
                {countries.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Buttons */}
        <div className="flex items-center gap-2">
          {/* Attach Button (Country only) */}
          {subjectType === "COUNTRY" && achievementId && subjectId && (
            <button
              onClick={handleAttach}
              disabled={attachMutation.isPending}
              className="h-9 rounded-lg bg-indigo-600 px-4 font-bold text-zinc-100 transition-all hover:bg-indigo-700 disabled:bg-zinc-800"
            >
              {attachMutation.isPending ? "Attaching..." : "🔗 Attach to Map"}
            </button>
          )}

          {/* Publish Button */}
          {achievementId && (
            <button
              onClick={handlePublishToggle}
              disabled={isPublishing}
              className={`h-9 rounded-lg px-4 font-bold transition-all ${
                currentAchievement?.isPublished
                  ? "border border-red-500/20 bg-red-500/10 text-red-400 hover:bg-red-500/20"
                  : "border border-emerald-500/20 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
              }`}
            >
              {currentAchievement?.isPublished ? "Unpublish" : "📢 Publish"}
            </button>
          )}

          {/* Save Button */}
          <button
            onClick={handleSave}
            disabled={saveMutation.isPending}
            className="h-9 rounded-lg bg-amber-500 px-4 font-bold text-zinc-950 transition-all hover:bg-amber-600 disabled:bg-zinc-800"
          >
            {saveMutation.isPending ? "Saving..." : "💾 Save Changes"}
          </button>

          {/* Export Button */}
          <button
            onClick={() => setIsExportOpen(true)}
            className="h-9 rounded-lg border border-white/10 px-4 font-bold text-zinc-300 transition-all hover:bg-white/5"
          >
            📤 Export
          </button>
        </div>

        {isExportOpen && <ExportDialog onClose={() => setIsExportOpen(false)} />}
      </div>
    </FacetMaterial>
  );
}
