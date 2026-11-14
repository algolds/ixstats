"use client";

import { useState } from "react";
import { Download, MapPin, SystemRestart } from "iconoir-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { OptionSelect } from "~/components/maps/shared/OptionSelect";
import { notifyFromStore } from "~/hooks/useNotify";
import { api } from "~/trpc/react";
import type { HeraldryComposition } from "~/lib/heraldry";
import ExportDialog from "./ExportDialog";
import { useVexelEditor } from "./VexelEditorProvider";

type SubjectType = "COUNTRY" | "CHARACTER" | "INSTITUTION" | "DYNASTY";

const SUBJECT_TYPES: { value: SubjectType; label: string }[] = [
  { value: "CHARACTER", label: "Character" },
  { value: "COUNTRY", label: "Country" },
  { value: "INSTITUTION", label: "Institution" },
  { value: "DYNASTY", label: "Dynasty" },
];

function notifyError(title: string, err: { message: string }) {
  notifyFromStore({ title, message: err.message, type: "error", priority: "high" });
}

/**
 * The saved record behind the design: its title and subject, and the save, publish, attach and export actions.
 * The editor calls it once and hands the result to the fields (over the canvas) and the actions (in the header).
 */
export function useArmsRecord() {
  const { composition, achievementId, setInitialState, markSaved } = useVexelEditor();
  const [title, setTitle] = useState("My coat of arms");
  const [subjectType, setSubjectType] = useState<SubjectType>("CHARACTER");
  const [subjectId, setSubjectId] = useState<string | null>(null);
  const [isExportOpen, setIsExportOpen] = useState(false);

  const utils = api.useUtils();
  const { data: countriesData } = api.countries.getAll.useQuery(
    { limit: 100 },
    { enabled: subjectType === "COUNTRY" }
  );
  const { data: current } = api.heraldry.getAchievement.useQuery(
    { id: achievementId! },
    { enabled: !!achievementId }
  );

  // A loaded (or refetched) achievement fills the form, during render.
  const [seededFrom, setSeededFrom] = useState<typeof current>(undefined);
  if (current !== seededFrom) {
    setSeededFrom(current);
    if (current) {
      setTitle(current.title);
      setSubjectType(current.subjectType as SubjectType);
      setSubjectId(current.subjectId);
    }
  }

  const save = api.heraldry.saveAchievement.useMutation({
    onSuccess: (data) => {
      setInitialState(data.compositionData as unknown as HeraldryComposition, data.id);
      markSaved();
      void utils.heraldry.getAchievement.invalidate({ id: data.id });
      void utils.heraldry.getRegistry.invalidate();
    },
    onError: (err) => notifyError("Could not save coat of arms", err),
  });
  const refreshPublishState = () => {
    void utils.heraldry.getAchievement.invalidate({ id: achievementId! });
    void utils.heraldry.getRegistry.invalidate();
  };
  const publish = api.heraldry.publishAchievement.useMutation({ onSuccess: refreshPublishState });
  const unpublish = api.heraldry.unpublishAchievement.useMutation({
    onSuccess: refreshPublishState,
  });
  const attach = api.heraldry.attachToCountry.useMutation({
    onSuccess: () =>
      notifyFromStore({
        title: "Coat of arms attached",
        message: "The country's political map layers will refresh with the new arms.",
        type: "success",
        priority: "medium",
      }),
    onError: (err) => notifyError("Could not attach coat of arms", err),
  });
  // Saving renders the design to an image; a design saved before that has none, so render it first.
  const render = api.heraldry.renderAchievementImage.useMutation({
    onSuccess: () => utils.heraldry.getAchievement.invalidate({ id: achievementId! }),
    onError: (err) => notifyError("Could not render coat of arms", err),
  });

  const handleSave = () => {
    const svgElement = document.getElementById("vexel-shield-canvas");
    const svgData = svgElement ? new XMLSerializer().serializeToString(svgElement) : undefined;
    save.mutate({
      id: achievementId || undefined,
      title,
      subjectType,
      subjectId: subjectId || null,
      compositionData: composition as never,
      svgData,
    });
  };

  const handlePublishToggle = () => {
    if (!achievementId) return;
    (current?.isPublished ? unpublish : publish).mutate({ id: achievementId });
  };

  const handleAttach = async () => {
    if (!achievementId || !subjectId) return;
    if (!current?.thumbnailUrl && !current?.largeUrl) {
      try {
        await render.mutateAsync({ id: achievementId });
      } catch {
        return; // reported by render.onError
      }
    }
    attach.mutate({ achievementId, countryId: subjectId });
  };

  return {
    achievementId,
    title,
    setTitle,
    subjectType,
    setSubjectType: (next: SubjectType) => {
      setSubjectType(next);
      setSubjectId(null);
    },
    subjectId,
    setSubjectId,
    countries: countriesData?.countries ?? [],
    isPublished: Boolean(current?.isPublished),
    isSaving: save.isPending,
    isPublishing: publish.isPending || unpublish.isPending,
    isRendering: render.isPending,
    isAttaching: render.isPending || attach.isPending,
    isExportOpen,
    setIsExportOpen,
    handleSave,
    handlePublishToggle,
    handleAttach,
  };
}

export type ArmsRecord = ReturnType<typeof useArmsRecord>;

/** The record's title and subject, in the workspace toolbar over the canvas. */
export function ArmsDetailsFields({ record }: { record: ArmsRecord }) {
  return (
    <div className="flex min-w-0 flex-1 flex-wrap items-end gap-3">
      <label className="flex min-w-48 flex-1 flex-col gap-1">
        <span className="text-subhead text-label-secondary">Title</span>
        <Input type="text" value={record.title} onChange={(e) => record.setTitle(e.target.value)} />
      </label>
      <div className="flex flex-col gap-1">
        <span id="vexel-subject-type" className="text-subhead text-label-secondary">
          Bearer
        </span>
        <OptionSelect
          aria-labelledby="vexel-subject-type"
          className="w-40"
          value={record.subjectType}
          onValueChange={(v) => record.setSubjectType(v as SubjectType)}
          options={SUBJECT_TYPES}
        />
      </div>
      {record.subjectType === "COUNTRY" && (
        <div className="flex min-w-48 flex-col gap-1">
          <span id="vexel-subject-country" className="text-subhead text-label-secondary">
            Country
          </span>
          <OptionSelect
            aria-labelledby="vexel-subject-country"
            value={record.subjectId || ""}
            onValueChange={(v) => record.setSubjectId(v || null)}
            options={[
              { value: "", label: "Choose a country" },
              ...record.countries.map((c) => ({ value: c.id, label: c.name })),
            ]}
          />
        </div>
      )}
    </div>
  );
}

/** The header actions. Save is the one primary; the rest are secondary. */
export function ArmsActions({ record }: { record: ArmsRecord }) {
  const canAttach = record.subjectType === "COUNTRY" && record.achievementId && record.subjectId;
  return (
    <>
      {canAttach && (
        <Button
          variant="secondary"
          size="sm"
          onClick={() => void record.handleAttach()}
          disabled={record.isAttaching}
        >
          <MapPin />
          {record.isRendering ? "Rendering" : record.isAttaching ? "Attaching" : "Attach to map"}
        </Button>
      )}
      {record.achievementId && (
        <Button
          variant="secondary"
          size="sm"
          onClick={record.handlePublishToggle}
          disabled={record.isPublishing}
        >
          {record.isPublished ? "Unpublish" : "Publish"}
        </Button>
      )}
      <Button variant="secondary" size="sm" onClick={() => record.setIsExportOpen(true)}>
        <Download />
        Export
      </Button>
      <Button size="sm" onClick={record.handleSave} disabled={record.isSaving}>
        {record.isSaving && <SystemRestart className="animate-spin motion-reduce:animate-none" />}
        {record.isSaving ? "Saving" : "Save"}
      </Button>
      {record.isExportOpen && <ExportDialog onClose={() => record.setIsExportOpen(false)} />}
    </>
  );
}
