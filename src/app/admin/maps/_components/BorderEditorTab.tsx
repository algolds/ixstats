"use client";

import React, { useState, useCallback } from "react";
import { useBorderEditor } from "~/hooks/useBorderEditor";
import { BorderEditorMap } from "~/components/maps/editor/BorderEditorMap";
import { BorderEditorToolbar } from "~/components/maps/editor/BorderEditorToolbar";
import { BorderEditorPanel } from "~/components/maps/editor/BorderEditorPanel";
import { SplitMergeDialog } from "~/components/maps/editor/SplitMergeDialog";
import { canUndo, canRedo } from "~/lib/border-editor";
import { api } from "~/trpc/react";
import { Search, Loader2 } from "lucide-react";

export function BorderEditorTab() {
  const [state, actions] = useBorderEditor();
  const [searchQuery, setSearchQuery] = useState("");
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [showSplitDialog, setShowSplitDialog] = useState(false);
  const [showMergeDialog, setShowMergeDialog] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Search for features
  const { data: searchResults } = api.geoCore.searchFeatures.useQuery(
    { query: searchQuery, types: ["political"], limit: 10 },
    { enabled: searchQuery.length >= 2 }
  );

  // Load neighbor geometries when editing
  const { data: neighborGeoms } = api.geoCore.getNeighborGeometries.useQuery(
    { featureId: state.featureId! },
    { enabled: !!state.featureId }
  );

  const handleSelectFeature = useCallback(
    (featureId: string, name?: string) => {
      actions.loadFeature(featureId);
      setDisplayName(name ?? null);
      setSearchQuery("");
    },
    [actions]
  );

  const handleSubmit = useCallback(async () => {
    try {
      setIsSubmitting(true);
      await actions.submitEdit(true); // Apply directly for admins
    } catch (err) {
      console.error("Submit failed:", err);
    } finally {
      setIsSubmitting(false);
    }
  }, [actions]);

  const handleSplitConfirm = useCallback(
    async (nameA: string, nameB: string) => {
      try {
        setIsSubmitting(true);
        await actions.executeSplit(nameA, nameB);
        setShowSplitDialog(false);
      } catch (err) {
        console.error("Split failed:", err);
      } finally {
        setIsSubmitting(false);
      }
    },
    [actions]
  );

  const handleMergeConfirm = useCallback(
    async (newName: string) => {
      try {
        setIsSubmitting(true);
        await actions.executeMerge(newName);
        setShowMergeDialog(false);
      } catch (err) {
        console.error("Merge failed:", err);
      } finally {
        setIsSubmitting(false);
      }
    },
    [actions]
  );

  const handleToolbarSubmit = useCallback(() => {
    if (state.mode === "split" && state.splitLine.length >= 2) {
      setShowSplitDialog(true);
    } else if (state.mode === "merge" && state.mergeTargets.length > 0) {
      setShowMergeDialog(true);
    } else {
      void handleSubmit();
    }
  }, [state.mode, state.splitLine, state.mergeTargets, handleSubmit]);

  return (
    <div className="flex h-[calc(100vh-200px)] gap-3">
      {/* Left: Feature selector + info panel */}
      <div className="flex w-72 flex-col gap-3">
        {/* Search */}
        <div className="relative">
          <Search className="text-muted-foreground absolute top-2.5 left-2.5 h-4 w-4" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search countries..."
            className="border-border bg-muted/50 text-foreground placeholder-muted-foreground w-full rounded-lg border py-2 pr-3 pl-9 text-sm focus:border-blue-500/50 focus:outline-none"
          />
          {searchResults && searchQuery.length >= 2 && (
            <div className="border-border bg-card absolute top-full z-10 mt-1 w-full rounded-lg border py-1 shadow-xl">
              {searchResults.length === 0 ? (
                <div className="text-muted-foreground px-3 py-2 text-xs">No results</div>
              ) : (
                searchResults.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => handleSelectFeature(r.id, r.name)}
                    className="text-foreground hover:bg-muted w-full px-3 py-1.5 text-left text-sm"
                  >
                    {r.name || r.id}
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {/* Loading state */}
        {state.isLoading && (
          <div className="text-muted-foreground flex items-center justify-center gap-2 py-8">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">Loading feature...</span>
          </div>
        )}

        {/* Error */}
        {state.error && (
          <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-500">
            {state.error}
          </div>
        )}

        {/* Info Panel */}
        <BorderEditorPanel
          featureId={state.featureId}
          displayName={displayName || state.featureId}
          geometry={state.geometry}
          neighbors={state.neighbors}
          mergeTargets={state.mergeTargets}
          onToggleMergeTarget={actions.toggleMergeTarget}
          mode={state.mode}
          areaKm2={state.areaKm2}
          isDirty={state.isDirty}
        />
      </div>

      {/* Center: Map */}
      <div className="border-border relative flex-1 overflow-hidden rounded-lg border">
        <BorderEditorMap
          geometry={state.geometry}
          neighborGeometries={neighborGeoms}
          mode={state.mode}
          splitLine={state.splitLine}
          mergeTargets={state.mergeTargets}
          selectedVertex={state.selectedVertex}
          onMapClick={actions.handleMapClick}
          onVertexDrag={actions.handleVertexDrag}
          onDragEnd={actions.commitDrag}
        />

        {/* Toolbar overlay */}
        {state.featureId && (
          <div className="absolute top-3 left-3 z-10">
            <BorderEditorToolbar
              mode={state.mode}
              onModeChange={actions.setMode}
              canUndo={canUndo(state.undoStackState)}
              canRedo={canRedo(state.undoStackState)}
              onUndo={actions.undo}
              onRedo={actions.redo}
              onSave={() => void actions.save()}
              onSubmit={handleToolbarSubmit}
              onCancel={actions.reset}
              isDirty={state.isDirty}
              isSaving={isSubmitting}
              areaKm2={state.areaKm2}
              splitPointCount={state.splitLine.length}
            />
          </div>
        )}
      </div>

      {/* Split Dialog */}
      {showSplitDialog && state.featureId && (
        <SplitMergeDialog
          type="split"
          featureName={displayName || state.featureId || ""}
          onConfirm={handleSplitConfirm}
          onCancel={() => setShowSplitDialog(false)}
          isLoading={isSubmitting}
        />
      )}

      {/* Merge Dialog */}
      {showMergeDialog && state.featureId && (
        <SplitMergeDialog
          type="merge"
          featureNames={[displayName || state.featureId || "", ...state.mergeTargets]}
          onConfirm={handleMergeConfirm}
          onCancel={() => setShowMergeDialog(false)}
          isLoading={isSubmitting}
        />
      )}
    </div>
  );
}
