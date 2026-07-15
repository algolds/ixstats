"use client";

import React, { useEffect } from "react";
import { VexelEditorProvider, useVexelEditor } from "./VexelEditorProvider";
import { api } from "~/utils/api";
import type { HeraldryComposition } from "~/lib/heraldry";

interface VexelEditorProps {
  achievementId?: string;
}

function EditorShell() {
  const { blazon, validationWarnings, isDirty, achievementId } = useVexelEditor();

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-zinc-950 font-sans text-zinc-100">
      {/* Top Navbar */}
      <header className="flex h-14 items-center justify-between border-b border-white/10 bg-zinc-900/60 px-6 backdrop-blur-md">
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

      {/* Main Grid */}
      <div className="grid flex-1 grid-cols-[280px_1fr_320px] overflow-hidden">
        {/* Left Sidebar: Layers */}
        <aside className="overflow-y-auto border-r border-white/10 bg-zinc-900/40 p-4">
          <h2 className="mb-4 text-xs font-bold tracking-widest text-zinc-400 uppercase">Layers</h2>
          <div className="rounded-lg border border-dashed border-white/10 p-6 text-center text-xs text-zinc-500">
            Layer Panel Placeholder
          </div>
        </aside>

        {/* Center Canvas: Preview */}
        <main className="flex flex-col overflow-hidden bg-zinc-900/10 p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xs font-bold tracking-widest text-zinc-400 uppercase">Preview</h2>
          </div>

          {/* Shield Canvas Container */}
          <div className="relative flex flex-1 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-zinc-950/40 shadow-inner backdrop-blur-md">
            <div className="text-center text-xs text-zinc-500">
              Shield Preview Canvas Placeholder
            </div>
          </div>

          {/* Blazon Output Card */}
          <div className="mt-4 rounded-xl border border-white/10 bg-zinc-900/60 p-4 backdrop-blur-md">
            <h3 className="mb-2 text-xs font-bold tracking-widest text-amber-500 uppercase">
              Blazon
            </h3>
            <p className="font-serif text-sm leading-relaxed text-zinc-300 italic">
              {blazon || "No arms rendered."}
            </p>
          </div>
        </main>

        {/* Right Sidebar: Properties / Tools */}
        <aside className="flex flex-col gap-6 overflow-y-auto border-l border-white/10 bg-zinc-900/40 p-4">
          <div>
            <h2 className="mb-4 text-xs font-bold tracking-widest text-zinc-400 uppercase">
              Properties
            </h2>
            <div className="rounded-lg border border-dashed border-white/10 p-6 text-center text-xs text-zinc-500">
              Properties Panel Placeholder
            </div>
          </div>

          <div>
            <h2 className="mb-4 text-xs font-bold tracking-widest text-zinc-400 uppercase">
              Charge Library
            </h2>
            <div className="rounded-lg border border-dashed border-white/10 p-6 text-center text-xs text-zinc-500">
              Charge Library Placeholder
            </div>
          </div>
        </aside>
      </div>

      {/* Bottom Status Bar */}
      <footer className="flex h-8 items-center justify-between border-t border-white/10 bg-zinc-900/80 px-6 text-[10px] text-zinc-500">
        <div>{achievementId ? `Editing: ${achievementId}` : "New Design Draft"}</div>
        <div>Warnings: {validationWarnings.length}</div>
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
