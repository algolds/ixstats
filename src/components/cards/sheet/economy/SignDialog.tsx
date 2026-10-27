"use client";

import { useId, useState, type FormEvent } from "react";
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
import { useCopyActions } from "~/hooks/cards/useCopyActions";
import { INSCRIPTION_MAX, sanitizeInscription } from "~/lib/cards/inscription";
import type { CopyDialogProps } from "./ListCopyDialog";

/** `cards.inscribe`'s refusal for a player other players cannot name (`inscribeCopy`). */
const NO_NAME = "Claim an IxnayID handle or a nation before signing a card.";

interface SignFormProps {
  ownershipId: string;
  signerName: string;
  onDone: () => void;
}

/** The text, cleaned and counted by the rule the server applies, and previewed as it will print. */
function SignForm({ ownershipId, signerName, onDone }: SignFormProps) {
  const { sign } = useCopyActions();
  const [raw, setRaw] = useState("");
  const id = useId();
  const check = sanitizeInscription(raw);
  const refused = raw.trim() !== "" && !check.ok;
  const status = check.ok
    ? `${[...check.text].length} of ${INSCRIPTION_MAX}`
    : refused
      ? check.reason
      : `0 of ${INSCRIPTION_MAX}`;

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!check.ok) return;
    sign.mutate({ ownershipId, text: check.text }, { onSuccess: onDone });
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="space-y-1">
        <Label htmlFor={`${id}-text`}>Inscription</Label>
        <Input
          id={`${id}-text`}
          autoComplete="off"
          aria-describedby={`${id}-status`}
          aria-invalid={refused}
          value={raw}
          onChange={(event) => setRaw(event.target.value)}
        />
        <p
          id={`${id}-status`}
          className="text-footnote text-label-secondary tabular-nums"
          aria-live="polite"
        >
          {status}
        </p>
      </div>
      {check.ok && <p className="text-callout">{`“${check.text}” · ${signerName}`}</p>}
      <p className="text-footnote text-label-secondary">
        A signed copy can&apos;t be broken down or fused.
      </p>
      <DialogFooter>
        <Button type="submit" disabled={!check.ok || sign.isPending}>
          Sign this copy
        </Button>
      </DialogFooter>
    </form>
  );
}

/**
 * Sign a copy once. The name saved with the inscription is the viewer's own display name, shown here exactly as it
 * will be frozen (the owner's Q1 ruling); a player with none is told how to get one instead.
 */
export function SignDialog({
  signerName,
  ...props
}: CopyDialogProps & { signerName: string | null }) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-w-md" {...props.focus}>
        <DialogHeader>
          <DialogTitle>Sign {props.cardTitle}</DialogTitle>
          <DialogDescription>
            {signerName
              ? `You can sign a copy once. Your name as other players see it, ${signerName}, is saved with it and stays with the copy wherever it goes. Others see the name while your Passport shows your Vault cards.`
              : "You can sign a copy once, with the name other players know you by."}
          </DialogDescription>
        </DialogHeader>
        {signerName ? (
          <SignForm ownershipId={props.ownershipId} signerName={signerName} onDone={props.onDone} />
        ) : (
          <p className="text-callout">{NO_NAME}</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
