"use client";

import { useId, useState, type FormEvent } from "react";
import { PagePlus } from "iconoir-react";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { RadioCard, RadioCardGroup } from "~/components/ui/radio-card";
import { useAddExistingPiece } from "~/hooks/lore/useLoreCuration";
import { isLoreType, type LoreType } from "~/lib/lore/lore-types";

const TYPE_OPTIONS: readonly (readonly [LoreType, string])[] = [
  ["person", "Person"],
  ["place", "Place"],
  ["event", "Event"],
  ["organisation", "Organisation"],
  ["other", "Other"],
];

function AddExistingForm({ countryId, onDone }: { countryId: string; onDone: () => void }) {
  const fieldId = useId();
  const { add, refusal, isPending } = useAddExistingPiece(countryId);
  const [title, setTitle] = useState("");
  const [type, setType] = useState<LoreType | null>(null);
  const trimmed = title.trim();

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (trimmed && type && (await add(trimmed, type))) onDone();
  };

  return (
    <form onSubmit={(event) => void submit(event)} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={fieldId}>Page title</Label>
        <Input
          id={fieldId}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          autoComplete="off"
        />
      </div>
      <RadioCardGroup
        aria-label="Lore type"
        columns={2}
        value={type}
        onValueChange={(next) => isLoreType(next) && setType(next)}
      >
        {TYPE_OPTIONS.map(([value, label]) => (
          <RadioCard key={value} value={value} title={label} />
        ))}
      </RadioCardGroup>
      {refusal && (
        <p role="alert" className="text-callout text-destructive">
          {refusal}
        </p>
      )}
      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={!trimmed || !type || isPending}>
          Add to the Lore tab
        </Button>
      </DialogFooter>
    </form>
  );
}

/**
 * The owner adds an existing wiki page to the Lore tab by title, with the type it is grouped under
 * (`countryLore.addExisting`). Nothing on the wiki changes. Each opening starts afresh: the dialog mounts its form only
 * while open.
 */
export function AddExistingPage({ countryId }: { countryId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>
        <PagePlus aria-hidden="true" />
        Add an existing page
      </Button>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add an existing page</DialogTitle>
          <DialogDescription>
            Show a wiki page on the Lore tab. The page itself is not changed.
          </DialogDescription>
        </DialogHeader>
        <AddExistingForm countryId={countryId} onDone={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}
