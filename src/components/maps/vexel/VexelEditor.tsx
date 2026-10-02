"use client";

import { Badge } from "~/components/ui/badge";
import React, { useEffect } from "react";
import { VexelEditorProvider, useVexelEditor } from "./VexelEditorProvider";
import { api } from "~/trpc/react";
import type { HeraldryComposition } from "~/lib/heraldry";

import LayerPanel from "./panels/LayerPanel";
import PropertiesPanel from "./panels/PropertiesPanel";
import ChargeLibraryPanel from "./panels/ChargeLibraryPanel";
import CommonsBrowserPanel from "./panels/CommonsBrowserPanel";
import PreviewPanel from "./panels/PreviewPanel";
import BlazonPanel from "./panels/BlazonPanel";
import ValidationPanel from "./panels/ValidationPanel";
import SaveControls from "./SaveControls";

interface VexelEditorProps {
  achievementId?: string;
}

function EditorShell() {
  const { isDirty, achievementId } = useVexelEditor();
  const [isCommonsOpen, setIsCommonsOpen] = React.useState(false);

  return (
    <div className="bg-surface text-label relative flex h-screen flex-col overflow-hidden font-sans">
      {/* Top Navbar */}
      <header className="border-separator bg-fill-3 flex h-14 shrink-0 items-center justify-between border-b px-6">
        <div className="flex items-center gap-3">
          <span className="text-title-2 text-tint">Vexel</span>
          <Badge variant="secondary">Heraldry lab</Badge>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-label-secondary text-footnote">
            {isDirty ? (
              <span className="text-tint flex items-center gap-2">
                <span className="bg-tint h-1.5 w-1.5 rounded-full" aria-hidden />
                Unsaved changes
              </span>
            ) : (
              <span className="text-label-secondary">All saved</span>
            )}
          </span>
        </div>
      </header>

      {/* Main Layout Area */}
      <div className="relative flex flex-1 overflow-hidden">
        {/* Main Grid */}
        <div className="grid flex-1 grid-cols-[280px_1fr_320px] overflow-hidden">
          {/* Left Sidebar: Layers */}
          <aside className="border-separator bg-fill-3 overflow-y-auto border-r p-4">
            <LayerPanel />
          </aside>

          {/* Center Canvas: Preview / Audit */}
          <main className="bg-fill-3 flex flex-col space-y-0 overflow-y-auto p-6">
            <SaveControls />
            <div className="mt-4 space-y-6">
              <PreviewPanel />
              <BlazonPanel />
              <ValidationPanel />
            </div>
          </main>

          {/* Right Sidebar: Properties & Charge Library */}
          <aside className="border-separator bg-fill-3 flex flex-col gap-6 overflow-y-auto border-l p-4">
            <PropertiesPanel />
            <ChargeLibraryPanel onOpenCommons={() => setIsCommonsOpen(true)} />
          </aside>
        </div>

        {/* Wikimedia Commons slide-over */}
        {isCommonsOpen && <CommonsBrowserPanel onClose={() => setIsCommonsOpen(false)} />}
      </div>

      {/* Bottom Status Bar */}
      <footer className="border-separator bg-fill-3 text-label-secondary text-footnote flex h-8 shrink-0 items-center justify-between border-t px-6">
        <div>{achievementId ? `Editing: ${achievementId}` : "New Design Draft"}</div>
        <div>IxStates Vexel Engine v1.0.0</div>
      </footer>
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

  if (id && isLoading) {
    return (
      <div className="bg-surface text-tint flex h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="border-tint h-8 w-8 animate-spin rounded-full border-2 border-t-transparent" />
          <span className="text-body font-medium">Loading Achievement...</span>
        </div>
      </div>
    );
  }

  return <EditorShell />;
}

export default function VexelEditor({ achievementId }: VexelEditorProps) {
  return (
    <VexelEditorProvider>
      <EditorInner id={achievementId} />
    </VexelEditorProvider>
  );
}
