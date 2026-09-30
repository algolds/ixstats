"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { FloppyDisk, SystemRestart, Undo } from "iconoir-react";
import { Button } from "~/components/ui/button";
import { useNotify } from "~/hooks/useNotify";
import type { EditChanges } from "../hooks/useEditChanges";

interface EditorSaveBarProps {
  edit: EditChanges;
  /** The builder's existing save path (localStorage + countries.updateCountry). */
  onPersist: () => Promise<void>;
}

function describeChanges(count: number): string {
  if (count === 0) return "No changes";
  return count === 1 ? "1 change" : `${count} changes`;
}

/**
 * Sticky bottom bar for the country editor: change count, Undo, Discard and Save.
 * Shown while there is a change to save or a step to undo.
 */
export function EditorSaveBar({ edit, onPersist }: EditorSaveBarProps) {
  const notify = useNotify();
  const [isSaving, setIsSaving] = useState(false);
  const changeCount = edit.changes.length;
  const hasChanges = changeCount > 0;
  const isVisible = hasChanges || edit.canUndo;

  useEffect(() => {
    if (!hasChanges) return;
    const warnBeforeLeaving = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warnBeforeLeaving);
    return () => window.removeEventListener("beforeunload", warnBeforeLeaving);
  }, [hasChanges]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await edit.save(onPersist);
      notify.success("Changes saved");
    } catch (error) {
      notify.error(
        "Save failed",
        error instanceof Error ? error.message : "Your changes could not be saved."
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      {/* Keeps the bottom of the page reachable above the floating bar. */}
      {isVisible && <div aria-hidden="true" className="h-20 shrink-0" />}
      <AnimatePresence>
        {isVisible && (
          <motion.div
            key="editor-save-bar"
            role="region"
            aria-label="Editor changes"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0, transition: { duration: 0.2, ease: [0.23, 1, 0.32, 1] } }}
            exit={{ opacity: 0, y: 16, transition: { duration: 0.15, ease: "easeOut" } }}
            className="pointer-events-none fixed inset-x-0 bottom-4 z-[100] flex justify-center px-4 pb-[env(safe-area-inset-bottom)]"
          >
            <div className="border-border/60 bg-background/85 pointer-events-auto flex w-full max-w-xl items-center gap-2 rounded-2xl border px-4 py-2.5 shadow-lg backdrop-blur-xl">
              <p
                aria-live="polite"
                title="Compared with the country as you opened it or last saved it"
                className="text-foreground flex min-w-0 flex-1 items-center gap-2 text-sm font-medium"
              >
                {hasChanges && (
                  <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full bg-amber-500" />
                )}
                <span className="truncate">{describeChanges(changeCount)}</span>
              </p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={edit.undo}
                disabled={!edit.canUndo || isSaving}
                aria-label="Undo last change"
              >
                <Undo aria-hidden="true" />
                <span className="hidden sm:inline">Undo</span>
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={edit.discard}
                disabled={!hasChanges || isSaving}
                aria-label="Discard all changes"
              >
                Discard
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleSave}
                disabled={!hasChanges || isSaving}
                aria-busy={isSaving}
              >
                {isSaving ? (
                  <SystemRestart aria-hidden="true" className="animate-spin" />
                ) : (
                  <FloppyDisk aria-hidden="true" />
                )}
                {isSaving ? "Saving…" : "Save"}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
