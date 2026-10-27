"use client";

import { useId, useState, type FormEvent } from "react";
import { UserPlus } from "iconoir-react";
import { Button } from "~/components/ui/button";
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
import { FacetList, FacetListSection, FacetRow } from "~/components/ui/facet-list";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Skeleton } from "~/components/ui/skeleton";
import { useLoreTeam } from "~/hooks/lore/useLoreTeam";

interface Member {
  userId: string;
  handle: string;
  displayName: string | null;
}

/** A co-author's name as the identity rule gives it; with none, "A player" and their handle. */
const nameOf = (member: Member) => member.displayName ?? `A player (@${member.handle})`;

/** The handle as typed, without spaces or a leading @. */
const cleanHandle = (typed: string) => typed.trim().replace(/^@+/, "").trim();

function TeamRows({
  members,
  isLoading,
  failed,
  onRemove,
}: {
  members: Member[];
  isLoading: boolean;
  failed: boolean;
  onRemove: (member: Member) => void;
}) {
  if (isLoading) {
    return (
      <li role="status" aria-label="Loading the lore team" className="list-none px-4 py-3">
        <Skeleton className="h-4 w-1/2" />
      </li>
    );
  }
  if (failed) return <FacetRow title="The lore team could not be loaded." />;
  if (members.length === 0) return <FacetRow title="No co-authors yet." />;
  return members.map((member) => (
    <FacetRow
      key={member.userId}
      title={member.displayName ?? "A player"}
      // The identity rule's name is often the handle itself: then it shows once.
      subtitle={member.displayName === `@${member.handle}` ? undefined : `@${member.handle}`}
      trailing={
        <Button
          size="sm"
          variant="ghost"
          aria-label={`Remove ${nameOf(member)}`}
          onClick={() => onRemove(member)}
        >
          Remove
        </Button>
      }
    />
  ));
}

/**
 * LoreTeam: the owner's lore team on the country page's back face
 * (docs/superpowers/specs/2026-10-24-native-lore-design.md, "Co-authors"). Co-authors may write and edit the country's
 * lore from its page; on the wiki they are ordinary editors. The owner adds one by IxnayID handle and removes one after
 * confirming. Shown only to the owner while native lore is on for the country; the team is asked for once the back
 * face is shown (`active`).
 */
export function LoreTeam({ countryId, active }: { countryId: string; active: boolean }) {
  const team = useLoreTeam(countryId, active);
  const fieldId = useId();
  const [handle, setHandle] = useState("");
  const [removing, setRemoving] = useState<Member | null>(null);
  if (!team.manages) return null;

  const cleaned = cleanHandle(handle);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!cleaned) return;
    if (await team.addAuthor(cleaned)) setHandle("");
  };

  return (
    <section aria-label="Lore team" className="flex flex-col gap-3">
      <FacetList>
        <FacetListSection
          header="Lore team"
          footer="Co-authors can write and edit this country's lore from its page."
        >
          <TeamRows
            members={team.members}
            isLoading={team.isLoading}
            failed={team.failed}
            onRemove={setRemoving}
          />
        </FacetListSection>
      </FacetList>
      <form onSubmit={(event) => void submit(event)} className="flex items-end gap-2 px-4">
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <Label htmlFor={fieldId}>IxnayID handle</Label>
          <Input
            id={fieldId}
            value={handle}
            onChange={(event) => setHandle(event.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
        </div>
        <Button type="submit" size="sm" disabled={!cleaned || team.isPending}>
          <UserPlus aria-hidden="true" />
          Add
        </Button>
      </form>
      {team.refusal && (
        <p role="alert" className="text-callout text-destructive px-4">
          {team.refusal}
        </p>
      )}
      <AlertDialog open={removing !== null} onOpenChange={(open) => !open && setRemoving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Remove {removing ? nameOf(removing) : ""} from the lore team?
            </AlertDialogTitle>
            <AlertDialogDescription>
              They can no longer write this country&apos;s lore from its page. Their pages stay on
              the wiki.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep them</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => removing && void team.removeAuthor(removing.userId)}
            >
              Remove from the team
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
