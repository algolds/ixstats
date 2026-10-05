"use client";

import { useState } from "react";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
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

/** Leave the realm with one of your nations: it is released and anyone may claim it. Typed confirmation. */
export function LeaveRealmButton({
  slug,
  realmName,
  countryId,
  countryName,
}: {
  slug: string;
  realmName: string;
  countryId: string;
  countryName: string;
}) {
  const notify = useNotify();
  const utils = api.useUtils();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const leave = api.realms.region.abandonNation.useMutation({
    onSuccess: () => {
      notify.success(`You left ${realmName}`, `${countryName} is now unclaimed.`);
      setOpen(false);
      setTyped("");
      void utils.realms.getBySlug.invalidate({ slug });
      void utils.realms.region.overview.invalidate({ slug });
      void utils.realms.myNations.invalidate();
      void utils.users.getProfile.invalidate();
    },
    onError: (error) => notify.error("Could not leave the realm", error.message),
  });
  const matches = typed.trim().toLowerCase() === countryName.trim().toLowerCase();

  return (
    <>
      <Button size="xs" variant="ghost" onClick={() => setOpen(true)}>
        Leave realm
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>
              Leave {realmName} with {countryName}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {countryName} will be released and become unclaimed: anyone may claim it, and you lose
              it and its MyCountry. This can&apos;t be undone. Type the nation&apos;s name to
              confirm.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder={countryName}
            aria-label="Nation name"
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={!matches || leave.isPending}
              onClick={() => leave.mutate({ countryId, confirmName: typed })}
            >
              Leave and release
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
