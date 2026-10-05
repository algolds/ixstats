"use client";

import { useState } from "react";
import { Trash } from "iconoir-react";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { DEFAULT_REALM_ID } from "~/lib/realms/realm-ids";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";

/**
 * Delete a realm created by mistake (AT-8). Only an empty realm can go: one with nations is archived instead,
 * since deleting never releases or moves a nation. Confirmed by typing the realm's slug.
 */
export function DeleteRealmButton({
  realm,
}: {
  realm: { id: string; slug: string; name: string; countryCount: number };
}) {
  const notify = useNotify();
  const utils = api.useUtils();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const remove = api.realms.region.deleteRealm.useMutation({
    onSuccess: () => {
      notify.success(`${realm.name} deleted`);
      setOpen(false);
      setTyped("");
      void utils.realms.adminListRealms.invalidate();
      void utils.realms.directory.invalidate();
    },
    onError: (error) => notify.error("Could not delete the realm", error.message),
  });
  if (realm.id === DEFAULT_REALM_ID) return null;
  const hasNations = realm.countryCount > 0;

  return (
    <>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={`Delete ${realm.name}`}
        onClick={() => setOpen(true)}
      >
        <Trash className="h-4 w-4" />
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {realm.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              {hasNations
                ? `${realm.name} has ${realm.countryCount} nation${realm.countryCount === 1 ? "" : "s"}. Deleting never releases or moves nations: set its status to Archived instead, or remove its nations first.`
                : "Its claims, lore index, officers, embassies, poll and board go with it. This can't be undone. Type the realm's slug to confirm."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {!hasNations && (
            <Input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={realm.slug}
              aria-label="Realm slug"
              className="font-mono"
            />
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>{hasNations ? "Close" : "Cancel"}</AlertDialogCancel>
            {!hasNations && (
              <Button
                variant="destructive"
                disabled={typed.trim() !== realm.slug || remove.isPending}
                onClick={() => remove.mutate({ realmId: realm.id, confirmSlug: typed })}
              >
                Delete realm
              </Button>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
