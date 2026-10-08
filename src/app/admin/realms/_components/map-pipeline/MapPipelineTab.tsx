"use client";

import { useState } from "react";
import { api } from "~/trpc/react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import { Button } from "~/components/ui/button";
import { Label } from "~/components/ui/label";
import { ValueSelect } from "~/components/ui/value-select";
import { MapPipelinePanel } from "./MapPipelinePanel";

/** /admin/realms "Map": pick a realm, then its map pipeline. Switching realm with unsaved edits asks first. */
export function MapPipelineTab() {
  const { data: realms, isLoading } = api.realms.adminListRealms.useQuery();
  const [slug, setSlug] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const chosen = slug ?? realms?.find((r) => r.id !== "default")?.slug ?? null;

  if (isLoading) return <p className="text-label-secondary text-body">Loading realms…</p>;
  const pick = (next: string) => {
    if (next === chosen) return;
    if (dirty) setPending(next);
    else setSlug(next);
  };
  return (
    <div className="flex flex-col gap-6">
      <div className="flex max-w-sm flex-col gap-2">
        <Label htmlFor="map-pipeline-realm">Realm</Label>
        <ValueSelect
          id="map-pipeline-realm"
          value={chosen ?? undefined}
          placeholder="Choose a realm"
          options={(realms ?? []).map((realm) => [realm.slug, realm.name] as const)}
          onValueChange={pick}
        />
      </div>
      {chosen ? (
        <MapPipelinePanel key={chosen} slug={chosen} onDirtyChange={setDirty} />
      ) : (
        <p className="text-label-secondary text-body">Create a realm first.</p>
      )}
      <AlertDialog open={!!pending} onOpenChange={(open) => !open && setPending(null)}>
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Discard unsaved changes?</AlertDialogTitle>
            <AlertDialogDescription>
              This realm&apos;s map pipeline has edits that are not saved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={() => {
                setDirty(false);
                setSlug(pending);
                setPending(null);
              }}
            >
              Discard
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
