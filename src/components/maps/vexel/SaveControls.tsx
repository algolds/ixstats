"use client";

import { Eyebrow } from "~/components/ui/eyebrow";
import { Button } from "~/components/ui/button";
import { useState, useEffect } from "react";
import { notifyFromStore } from "~/hooks/useNotify";
import { useVexelEditor } from "./VexelEditorProvider";
import { api } from "~/trpc/react";
import ExportDialog from "./ExportDialog";
import { Input } from "~/components/ui/input";
import { OptionSelect } from "~/components/maps/shared/OptionSelect";
import { Card } from "~/components/ui/card";

export default function SaveControls() {
  // oxlint-disable-next-line eslint/no-unused-vars
  const { composition, achievementId, isDirty, setInitialState, markSaved } = useVexelEditor();

  const [title, setTitle] = useState("My Coat of Arms");
  const [subjectType, setSubjectType] = useState<
    "COUNTRY" | "CHARACTER" | "INSTITUTION" | "DYNASTY"
  >("CHARACTER");
  const [subjectId, setSubjectId] = useState<string | null>(null);

  const [isExportOpen, setIsExportOpen] = useState(false);

  const utils = api.useUtils();

  const { data: countriesData } = api.countries.getAll.useQuery(
    { limit: 100 },
    { enabled: subjectType === "COUNTRY" }
  );
  const countries = countriesData?.countries ?? [];

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

  const saveMutation = api.heraldry.saveAchievement.useMutation({
    onSuccess: (data) => {
      setInitialState(data.compositionData as any, data.id);
      markSaved();
      utils.heraldry.getAchievement.invalidate({ id: data.id });
      utils.heraldry.getRegistry.invalidate();
    },
  });

  const refreshPublishState = () => {
    utils.heraldry.getAchievement.invalidate({ id: achievementId! });
    utils.heraldry.getRegistry.invalidate();
  };
  const publishMutation = api.heraldry.publishAchievement.useMutation({
    onSuccess: refreshPublishState,
  });
  const unpublishMutation = api.heraldry.unpublishAchievement.useMutation({
    onSuccess: refreshPublishState,
  });
  const isPublishing = publishMutation.isPending || unpublishMutation.isPending;

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
    const mutation = currentAchievement?.isPublished ? unpublishMutation : publishMutation;
    mutation.mutate({ id: achievementId });
  };

  // Saving renders the design to an image; a design saved before that has none, so render it first.
  const renderMutation = api.heraldry.renderAchievementImage.useMutation({
    onSuccess: () => utils.heraldry.getAchievement.invalidate({ id: achievementId! }),
    onError: (err) => {
      notifyFromStore({
        title: "Could not render coat of arms",
        message: err.message,
        type: "error",
        priority: "high",
      });
    },
  });
  const isAttaching = renderMutation.isPending || attachMutation.isPending;

  const handleAttach = async () => {
    if (!achievementId || !subjectId) return;
    if (!currentAchievement?.thumbnailUrl && !currentAchievement?.largeUrl) {
      try {
        await renderMutation.mutateAsync({ id: achievementId });
      } catch {
        return; // reported by renderMutation.onError
      }
    }
    attachMutation.mutate({ achievementId, countryId: subjectId });
  };

  return (
    <Card className="mb-6 shrink-0 overflow-hidden">
      <div className="text-label-secondary text-footnote flex flex-wrap items-center justify-between gap-4 p-4">
        <div className="flex flex-1 flex-wrap items-center gap-4">
          <div className="flex min-w-[150px] flex-col gap-1">
            <Eyebrow id="vexel-arms-title">Arms title</Eyebrow>
            <Input
              type="text"
              aria-labelledby="vexel-arms-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1">
            <Eyebrow id="vexel-subject-type">Subject type</Eyebrow>
            <OptionSelect
              aria-labelledby="vexel-subject-type"
              className="w-40"
              value={subjectType}
              onValueChange={(v) => {
                setSubjectType(v as any);
                setSubjectId(null);
              }}
              options={[
                { value: "CHARACTER", label: "Character" },
                { value: "COUNTRY", label: "Country" },
                { value: "INSTITUTION", label: "Institution" },
                { value: "DYNASTY", label: "Dynasty" },
              ]}
            />
          </div>

          {subjectType === "COUNTRY" && (
            <div className="animate-in fade-in slide-in-from-left-2 flex min-w-[150px] flex-col gap-1 duration-150">
              <Eyebrow id="vexel-subject-country">Select country</Eyebrow>
              <OptionSelect
                aria-labelledby="vexel-subject-country"
                value={subjectId || ""}
                onValueChange={(v) => setSubjectId(v || null)}
                options={[
                  { value: "", label: "Choose country..." },
                  ...countries.map((c) => ({ value: c.id, label: c.name })),
                ]}
              />
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {subjectType === "COUNTRY" && achievementId && subjectId && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => void handleAttach()}
              disabled={isAttaching}
            >
              {renderMutation.isPending
                ? "Rendering..."
                : attachMutation.isPending
                  ? "Attaching..."
                  : "Attach to map"}
            </Button>
          )}

          {achievementId && (
            <Button
              variant={currentAchievement?.isPublished ? "outline" : "secondary"}
              size="sm"
              onClick={handlePublishToggle}
              disabled={isPublishing}
              className={currentAchievement?.isPublished ? "text-destructive" : undefined}
            >
              {currentAchievement?.isPublished ? "Unpublish" : "Publish"}
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={handleSave}
            disabled={saveMutation.isPending}
          >
            {saveMutation.isPending ? "Saving..." : "Save changes"}
          </Button>

          <Button variant="outline" size="sm" onClick={() => setIsExportOpen(true)}>
            Export
          </Button>
        </div>

        {isExportOpen && <ExportDialog onClose={() => setIsExportOpen(false)} />}
      </div>
    </Card>
  );
}
