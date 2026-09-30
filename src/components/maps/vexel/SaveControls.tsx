"use client";

import { Eyebrow } from "~/components/ui/eyebrow";
import { Button } from "~/components/ui/button";
import React, { useState, useEffect } from "react";
import { notifyFromStore } from "~/hooks/useNotify";
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
      // oxlint-disable-next-line
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
      notifyFromStore({
        title: "Coat of arms attached",
        message: "The country's political map layers will refresh with the new arms.",
        type: "success",
        priority: "medium",
      });
    },
    onError: (err) => {
      notifyFromStore({
        title: "Could not attach coat of arms",
        message: err.message,
        type: "error",
        priority: "high",
      });
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
      className="border-border mb-6 shrink-0 overflow-hidden rounded-xl border"
    >
      <div className="text-muted-foreground flex flex-wrap items-center justify-between gap-4 p-4 text-xs">
        <div className="flex flex-1 flex-wrap items-center gap-4">
          {/* Title Input */}
          <div className="flex min-w-[150px] flex-col gap-1">
            <Eyebrow>Arms Title</Eyebrow>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="border-border bg-card text-foreground rounded-lg border p-2 focus:border-amber-500 focus:outline-none"
            />
          </div>

          {/* Subject Type */}
          <div className="flex flex-col gap-1">
            <Eyebrow>Subject Type</Eyebrow>
            <select
              value={subjectType}
              onChange={(e) => {
                setSubjectType(e.target.value as any);
                setSubjectId(null);
              }}
              className="border-border bg-card text-muted-foreground rounded-lg border p-2 focus:outline-none"
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
              <Eyebrow>Select Country</Eyebrow>
              <select
                value={subjectId || ""}
                onChange={(e) => setSubjectId(e.target.value || null)}
                className="border-border bg-card text-muted-foreground rounded-lg border p-2 focus:outline-none"
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
            <Button
              variant="outline"
              size="sm"
              onClick={handleAttach}
              disabled={attachMutation.isPending}
            >
              {attachMutation.isPending ? "Attaching..." : "Attach to map"}
            </Button>
          )}

          {/* Publish Button */}
          {achievementId && (
            <button
              onClick={handlePublishToggle}
              disabled={isPublishing}
              className={`h-9 rounded-lg px-4 font-bold transition-[color,background-color,border-color,box-shadow,opacity,transform] ${
                currentAchievement?.isPublished
                  ? "border-destructive/30 text-destructive hover:bg-destructive/10 border"
                  : "border border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/20"
              }`}
            >
              {currentAchievement?.isPublished ? "Unpublish" : "Publish"}
            </button>
          )}

          {/* Save Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleSave}
            disabled={saveMutation.isPending}
          >
            {saveMutation.isPending ? "Saving..." : "Save changes"}
          </Button>

          {/* Export Button */}
          <Button variant="outline" size="sm" onClick={() => setIsExportOpen(true)}>
            Export
          </Button>
        </div>

        {isExportOpen && <ExportDialog onClose={() => setIsExportOpen(false)} />}
      </div>
    </FacetMaterial>
  );
}
