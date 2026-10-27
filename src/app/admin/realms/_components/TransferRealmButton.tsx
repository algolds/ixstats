"use client";

import { useState } from "react";
import { UserCrown } from "iconoir-react";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { STAFF_FOUNDER_ID } from "~/lib/realms/realm-region";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { Input } from "~/components/ui/input";
import { SearchField } from "~/components/ui/search-field";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";

interface Successor {
  /** A Clerk id, or `null` for IxStats staff. */
  clerkUserId: string | null;
  label: string;
}

/**
 * Site admins: hand a realm to a player (an active account, found by nation or Clerk id; players holding a
 * nation in the realm first) or back to IxStats staff. The previous founder can stay on as an officer with
 * every power. Confirmed by typing the realm's slug; recorded in the admin audit log.
 */
export function TransferRealmButton({
  realm,
}: {
  realm: { id: string; slug: string; name: string; ownerId: string };
}) {
  const notify = useNotify();
  const utils = api.useUtils();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<Successor | null>(null);
  const [keep, setKeep] = useState(false);
  const [typed, setTyped] = useState("");
  const { data: users } = api.realms.adminListUsers.useQuery(undefined, { enabled: open });
  const transfer = api.realms.region.adminTransferOwner.useMutation({
    onSuccess: () => {
      notify.success(`${realm.name} now belongs to ${picked?.label ?? "its new founder"}`);
      close();
      void utils.realms.adminListRealms.invalidate();
    },
    onError: (error) => notify.error("Could not transfer the realm", error.message),
  });
  const ownedByStaff = realm.ownerId === STAFF_FOUNDER_ID;

  function close() {
    setOpen(false);
    setQuery("");
    setPicked(null);
    setKeep(false);
    setTyped("");
  }

  type User = NonNullable<typeof users>[number];
  const label = (user: User) => user.nations.map((n) => n.name).join(", ") || user.clerkUserId;
  const here = (user: User) => user.nations.some((n) => n.realmId === realm.id);
  const q = query.trim().toLowerCase();
  const matches = (users ?? [])
    .filter((u) => u.isActive && u.clerkUserId !== realm.ownerId)
    .filter(
      (u) =>
        !q ||
        u.clerkUserId.toLowerCase().includes(q) ||
        u.nations.some((n) => n.name.toLowerCase().includes(q))
    )
    .sort((a, b) => Number(here(b)) - Number(here(a)) || label(a).localeCompare(label(b)))
    .slice(0, 20);

  return (
    <>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={`Transfer ${realm.name}`}
        onClick={() => setOpen(true)}
      >
        <UserCrown className="h-4 w-4" />
      </Button>
      <AlertDialog open={open} onOpenChange={(next) => (next ? setOpen(true) : close())}>
        <AlertDialogContent className="sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Transfer {realm.name}</AlertDialogTitle>
            <AlertDialogDescription>
              The new founder gets every founder power: appointing officers, reviewing claims and
              handing the realm on. The previous founder loses them unless kept as an officer.
              Recorded in the admin audit log.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {picked ? (
            <div className="bg-fill-4 rounded-row flex items-center justify-between gap-2 p-4">
              <span className="text-label text-body">New founder: {picked.label}</span>
              <Button size="xs" variant="ghost" onClick={() => setPicked(null)}>
                Change
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <SearchField
                size="sm"
                value={query}
                onValueChange={setQuery}
                placeholder="Find a player by nation or Clerk id"
                aria-label="Find the new founder"
              />
              <ul className="flex max-h-56 flex-col overflow-y-auto">
                {!ownedByStaff && (
                  <li>
                    <button
                      type="button"
                      onClick={() => setPicked({ clerkUserId: null, label: "IxStats staff" })}
                      className="hover:bg-fill-3 rounded-row text-label text-body w-full p-2 text-left"
                    >
                      IxStats staff
                    </button>
                  </li>
                )}
                {matches.map((user) => (
                  <li key={user.clerkUserId}>
                    <button
                      type="button"
                      onClick={() =>
                        setPicked({ clerkUserId: user.clerkUserId, label: label(user) })
                      }
                      className="hover:bg-fill-3 rounded-row text-label text-body w-full p-2 text-left"
                    >
                      {label(user)}
                      <span className="text-label-secondary text-footnote">
                        {here(user) ? "" : " (no nation here)"} {user.clerkUserId}
                      </span>
                    </button>
                  </li>
                ))}
                {users && matches.length === 0 && (
                  <li className="text-label-secondary text-footnote p-2">
                    No active player matches.
                  </li>
                )}
              </ul>
            </div>
          )}
          {!ownedByStaff && (
            <label
              htmlFor={`transfer-keep-${realm.id}`}
              className="text-label text-footnote flex items-center gap-2"
            >
              <Checkbox
                id={`transfer-keep-${realm.id}`}
                checked={keep}
                onCheckedChange={(checked) => setKeep(checked === true)}
              />
              Keep previous owner as officer
            </label>
          )}
          <Input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder={realm.slug}
            aria-label="Realm slug"
            className="font-mono"
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={!picked || typed.trim() !== realm.slug || transfer.isPending}
              onClick={() =>
                picked &&
                transfer.mutate({
                  realmId: realm.id,
                  newOwnerId: picked.clerkUserId,
                  confirmSlug: typed,
                  keepPreviousAsOfficer: keep,
                })
              }
            >
              Transfer realm
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
