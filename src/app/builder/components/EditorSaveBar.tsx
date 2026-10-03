"use client";

import { motion } from "motion/react";
import { CloudCheck, CloudSync, CloudXmark, FloppyDisk, SystemRestart, Undo } from "iconoir-react";
import { cn } from "~/lib/utils";
import { springSmooth } from "~/lib/design/motion";
import { Button } from "~/components/ui/button";
import { FacetMaterial } from "~/components/ui/facet";
import { describeSaveStatus, type EditorSaveStatus } from "./editor/editor-sections";

interface EditorSaveBarProps {
  changeCount: number;
  canUndo: boolean;
  onUndo: () => void;
  onDiscard: () => void;
  onSave: () => void;
  /** A Save (or Save and leave) the player started is running. */
  isSaving: boolean;
  status: EditorSaveStatus;
  lastSyncedAt: Date | null;
  onRetry: () => void;
}

function describeChanges(count: number): string {
  if (count === 0) return "No changes";
  return count === 1 ? "1 change" : `${count} changes`;
}

const STATUS_ICONS: Record<EditorSaveStatus, typeof CloudCheck> = {
  saved: CloudCheck,
  pending: CloudSync,
  saving: SystemRestart,
  error: CloudXmark,
};

/**
 * The country editor's persistent bottom bar. The editor autosaves a moment
 * after each change; the bar says whether that save landed, counts the fields
 * changed since the country was opened (or last saved with Save), and offers
 * Undo, Discard (back to that version; undoable) and Save.
 */
export function EditorSaveBar({
  changeCount,
  canUndo,
  onUndo,
  onDiscard,
  onSave,
  isSaving,
  status,
  lastSyncedAt,
  onRetry,
}: EditorSaveBarProps) {
  const hasChanges = changeCount > 0;
  const StatusIcon = STATUS_ICONS[status];

  return (
    <>
      {/* Keeps the bottom of the page reachable above the floating bar. */}
      <div aria-hidden="true" className="h-28 shrink-0 sm:h-24" />
      <motion.div
        role="region"
        aria-label="Editor changes"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0, transition: springSmooth }}
        className="z-sticky pointer-events-none fixed right-0 bottom-[calc(var(--shell-tabbar-height)+1rem)] left-(--shell-sidebar-width) flex justify-center px-4 pb-[env(safe-area-inset-bottom)]"
      >
        <FacetMaterial
          material="regular"
          className="rounded-card shadow-floating pointer-events-auto flex w-full max-w-2xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3"
        >
          <div aria-live="polite" className="flex min-w-0 flex-1 items-center gap-3">
            <StatusIcon
              aria-hidden="true"
              className={cn(
                "h-5 w-5 shrink-0",
                status === "error"
                  ? "text-destructive"
                  : hasChanges
                    ? "text-tint"
                    : "text-label-secondary",
                status === "saving" && "animate-spin"
              )}
            />
            <div className="min-w-0">
              <p
                className="text-label text-headline truncate"
                title="Compared with the country as you opened it or last saved it"
              >
                {describeChanges(changeCount)}
              </p>
              <p
                className={cn(
                  "text-footnote truncate",
                  status === "error" ? "text-destructive" : "text-label-secondary"
                )}
              >
                {describeSaveStatus(status, lastSyncedAt)}
                {status === "error" && (
                  <>
                    {" · "}
                    <Button
                      type="button"
                      variant="link"
                      size="sm"
                      onClick={onRetry}
                      className="text-destructive h-auto p-0 underline"
                    >
                      Try again
                    </Button>
                  </>
                )}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onUndo}
              disabled={!canUndo || isSaving}
              aria-label="Undo last change"
              title="Undo"
            >
              <Undo aria-hidden="true" className="h-4 w-4" />
              <span className="hidden sm:inline">Undo</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onDiscard}
              disabled={!hasChanges || isSaving}
              title="Go back to the country as you opened it or last saved it"
            >
              Discard
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={onSave}
              disabled={(!hasChanges && status === "saved") || isSaving}
              aria-busy={isSaving}
            >
              {isSaving ? (
                <SystemRestart aria-hidden="true" className="h-4 w-4 animate-spin" />
              ) : (
                <FloppyDisk aria-hidden="true" className="h-4 w-4" />
              )}
              {isSaving ? "Saving…" : "Save"}
            </Button>
          </div>
        </FacetMaterial>
      </motion.div>
    </>
  );
}
