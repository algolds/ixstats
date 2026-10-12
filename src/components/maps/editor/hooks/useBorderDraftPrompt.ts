"use client";

/**
 * Offers back the unsaved border draft the server found when a feature was loaded: restore it as
 * unsaved changes, or discard it and edit the saved border. Asked once per draft.
 */

import { useEffect, useRef } from "react";
import type { BorderEditorActions, BorderEditorState } from "~/hooks/useBorderEditor";
import type { BorderDraft } from "~/lib/maps/border-draft";
import { confirmEditorAction } from "~/components/maps/editor/components/EditorConfirmDialog";

export function useBorderDraftPrompt(
  { featureId, pendingDraft }: Pick<BorderEditorState, "featureId" | "pendingDraft">,
  { restoreDraft, discardDraft }: Pick<BorderEditorActions, "restoreDraft" | "discardDraft">,
  name?: string | null
) {
  const offered = useRef<BorderDraft | null>(null);

  useEffect(() => {
    if (!pendingDraft || offered.current === pendingDraft) return;
    offered.current = pendingDraft;
    void confirmEditorAction({
      title: "Unsaved changes found",
      description: `${name ?? featureId} has border changes from ${new Date(pendingDraft.savedAt).toLocaleString()} that were never saved. Discarding them, or closing this dialog, deletes them.`,
      confirmLabel: "Restore unsaved changes",
      cancelLabel: "Discard",
    }).then((restore) => (restore ? restoreDraft(pendingDraft) : discardDraft(pendingDraft)));
  }, [pendingDraft, featureId, name, restoreDraft, discardDraft]);
}
