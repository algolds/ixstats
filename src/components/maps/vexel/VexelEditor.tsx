"use client";

import { useEffect, useState } from "react";
import { Component } from "iconoir-react";
import { PageHeader } from "~/components/shell/PageHeader";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { Inspector } from "~/components/ui/inspector";
import { Skeleton } from "~/components/ui/skeleton";
import type { HeraldryComposition } from "~/lib/heraldry";
import { api } from "~/trpc/react";
import { VexelEditorProvider, useVexelEditor } from "./VexelEditorProvider";
import { ArmsActions, ArmsDetailsFields, useArmsRecord } from "./SaveControls";
import LayerPanel from "./panels/LayerPanel";
import PropertiesPanel from "./panels/PropertiesPanel";
import ChargeLibraryPanel from "./panels/ChargeLibraryPanel";
import CommonsBrowserPanel from "./panels/CommonsBrowserPanel";
import PreviewPanel from "./panels/PreviewPanel";
import BlazonPanel from "./panels/BlazonPanel";
import ValidationPanel from "./panels/ValidationPanel";

interface VexelEditorProps {
  achievementId?: string;
}

const PAGE = "mx-auto w-full max-w-6xl space-y-4 px-4 py-4 sm:px-6 sm:py-6";

/** The studio while a saved design loads: the header, the workspace and the panels under it. */
export function VexelEditorSkeleton() {
  return (
    <div className={PAGE} aria-busy="true" aria-label="Loading Vexel">
      <Skeleton className="h-10 w-48" />
      <Skeleton className="rounded-card h-[560px] w-full" />
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="rounded-card h-32" />
        <Skeleton className="rounded-card h-32" />
      </div>
    </div>
  );
}

/**
 * The Vexel workspace: the record's fields over the shield canvas, the blazon, rules and charge library under it,
 * and the layer tree with the selected layer's properties in the Inspector.
 */
function EditorShell() {
  const { isDirty, achievementId } = useVexelEditor();
  const record = useArmsRecord();
  const [isCommonsOpen, setIsCommonsOpen] = useState(false);
  const [layersOpen, setLayersOpen] = useState(false);
  const status = isDirty ? "Unsaved changes" : achievementId ? "Saved" : "New design";

  return (
    <div className={PAGE}>
      <PageHeader
        title="Vexel"
        subtitle={status}
        bleed
        actions={
          <>
            <Button
              variant="secondary"
              size="sm"
              className="xl:hidden"
              onClick={() => setLayersOpen(true)}
            >
              <Component />
              Layers
            </Button>
            <ArmsActions record={record} />
          </>
        }
      />

      <Card content="input" className="flex flex-col overflow-hidden">
        <div className="border-separator border-b p-4">
          <ArmsDetailsFields record={record} />
        </div>
        <div data-content="visualization" className="flex">
          <PreviewPanel
            // Below xl the properties live in a sheet, so picking a part of the shield opens it.
            onPick={() => setLayersOpen(!window.matchMedia("(min-width: 1280px)").matches)}
          />
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <BlazonPanel />
        <ValidationPanel />
      </div>

      <ChargeLibraryPanel onOpenCommons={() => setIsCommonsOpen(true)} />

      <Inspector
        title="Layers"
        open={layersOpen}
        onOpenChange={setLayersOpen}
        className="space-y-4"
      >
        <LayerPanel />
        <PropertiesPanel />
      </Inspector>

      {isCommonsOpen && <CommonsBrowserPanel onClose={() => setIsCommonsOpen(false)} />}
    </div>
  );
}

function EditorInner({ id }: { id?: string }) {
  const { setInitialState } = useVexelEditor();

  const { data: achievement, isLoading } = api.heraldry.getAchievement.useQuery(
    { id: id! },
    { enabled: !!id }
  );

  useEffect(() => {
    if (achievement) {
      setInitialState(
        achievement.compositionData as unknown as HeraldryComposition,
        achievement.id
      );
    }
  }, [achievement, setInitialState]);

  if (id && isLoading) return <VexelEditorSkeleton />;

  return <EditorShell />;
}

export default function VexelEditor({ achievementId }: VexelEditorProps) {
  return (
    <VexelEditorProvider>
      <EditorInner id={achievementId} />
    </VexelEditorProvider>
  );
}
