"use client";
// src/app/admin/wikios-settings/EditingSection.tsx
// The WikiOS editing switch: whether WikiOS takes edits (each copied on to classic MediaWiki) or stays read-only.

import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import { Card } from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";
import { Switch } from "~/components/ui/switch";
import { api } from "~/trpc/react";
import { EditPencil } from "iconoir-react";

export function EditingSection() {
  const utils = api.useUtils();
  const { data: status, isLoading } = api.wikios.getEditingStatus.useQuery();
  /** The state an administrator is being asked to confirm switching to. */
  const [pending, setPending] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  const setEditing = api.wikios.setEditing.useMutation({
    onSuccess: () => {
      setError(null);
      void utils.wikios.getEditingStatus.invalidate();
      void utils.wikios.getMirrorStatus.invalidate();
    },
    onError: (e) => setError(e.message),
  });

  const switchDisabled =
    !status ||
    status.forcedByEnv ||
    (!status.enabled && !status.mirrorConfigured) ||
    setEditing.isPending;

  return (
    <Card padding="lg" className="space-y-4">
      <div className="border-separator flex items-center gap-2 border-b pb-3">
        <EditPencil className="text-tint h-4 w-4" />
        <div>
          <h3 className="text-label text-caption">Editing</h3>
          <p className="text-label-secondary text-footnote">
            Whether WikiOS takes edits or stays read-only
          </p>
        </div>
      </div>

      {isLoading || !status ? (
        <Skeleton className="rounded-row h-10 w-full" />
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-4">
            <p className="text-label text-body">
              {status.enabled
                ? "On. WikiOS takes edits and copies each one to classic MediaWiki."
                : "Off. WikiOS is read-only; classic MediaWiki is the wiki you edit."}
            </p>
            <Switch
              aria-label="WikiOS editing"
              checked={status.enabled}
              disabled={switchDisabled}
              onCheckedChange={(next) => {
                setError(null);
                setPending(next);
              }}
            />
          </div>
          {status.forcedByEnv && (
            <p className="text-label-secondary text-footnote">Forced on by WIKIOS_V1_ENABLED</p>
          )}
          {!status.mirrorConfigured && (
            <p className="text-label-secondary text-footnote">
              The MediaWiki mirror is not configured: {status.missing.join(", ")}.
            </p>
          )}
          {error && <p className="text-red text-footnote">{error}</p>}
        </div>
      )}

      <AlertDialog open={pending !== null} onOpenChange={(open) => !open && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pending ? "Turn WikiOS editing on?" : "Turn WikiOS editing off?"}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-footnote">
              {pending
                ? "Anyone with wiki rights can edit in WikiOS. Every edit is copied to classic MediaWiki. Page protections set in MediaWiki before WikiOS started syncing are not enforced until the protections backfill (cutover runbook steps 1 and 1b) has run."
                : "New WikiOS edits are refused. Edits already made keep copying to MediaWiki."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pending !== null) setEditing.mutate({ enabled: pending });
              }}
            >
              {pending ? "Turn on" : "Turn off"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
