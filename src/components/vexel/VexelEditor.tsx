"use client";

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

interface VexelEditorProps {
  achievementId?: string;
}

function EditorShell() {
  const { isDirty, achievementId } = useVexelEditor();
  const [isCommonsOpen, setIsCommonsOpen] = React.useState(false);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-zinc-950 font-sans text-zinc-100 relative">
      {/* Top Navbar */}
      <header className="flex h-14 items-center justify-between border-b border-white/10 bg-zinc-900/60 px-6 backdrop-blur-md shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-xl font-bold tracking-wider text-amber-500">🛡️ VEXEL</span>
          <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-xs font-semibold text-amber-400">
            Heraldry Lab
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs text-zinc-400">
            {isDirty ? (
              <span className="flex items-center gap-1.5 text-amber-400">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-400" />
                Unsaved Changes
              </span>
            ) : (
              <span className="text-zinc-500">All saved</span>
            )}
          </span>
        </div>
      </header>

      {/* Main Layout Area */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Main Grid */}
        <div className="grid flex-1 grid-cols-[280px_1fr_320px] overflow-hidden">
          {/* Left Sidebar: Layers */}
          <aside className="overflow-y-auto border-r border-white/10 bg-zinc-900/40 p-4">
            <LayerPanel />
          </aside>

          {/* Center Canvas: Preview / Audit */}
          <main className="flex flex-col overflow-y-auto bg-zinc-900/10 p-6 space-y-6">
            <PreviewPanel />
            <BlazonPanel />
            <ValidationPanel />
          </main>

          {/* Right Sidebar: Properties & Charge Library */}
          <aside className="flex flex-col gap-6 overflow-y-auto border-l border-white/10 bg-zinc-900/40 p-4">
            <PropertiesPanel />
            <ChargeLibraryPanel onOpenCommons={() => setIsCommonsOpen(true)} />
          </aside>
        </div>

        {/* Wikimedia Commons slide-over */}
        {isCommonsOpen && (
          <CommonsBrowserPanel onClose={() => setIsCommonsOpen(false)} />
        )}
      </div>

      {/* Bottom Status Bar */}
      <footer className="flex h-8 items-center justify-between border-t border-white/10 bg-zinc-900/80 px-6 text-[10px] text-zinc-500 shrink-0">
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
      <div className="flex h-screen items-center justify-center bg-zinc-950 text-amber-500">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
          <span className="text-sm font-medium tracking-wide">Loading Achievement...</span>
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
