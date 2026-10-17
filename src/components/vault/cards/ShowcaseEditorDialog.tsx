"use client";

import { useId, useState, type FormEvent, type ReactNode } from "react";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";
import { Textarea } from "~/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { useShowcaseRefresh } from "~/hooks/useShowcaseRefresh";
import { SHOWCASE_LIMITS } from "~/lib/cards/face/showcase-limits";
import { cn } from "~/lib/utils/cn";
import { vaultNotify } from "~/lib/vault/vault-notifications";

interface EditableShowcase {
  id: string;
  name: string;
  description: string | null;
  isPublic: boolean;
  pinned: boolean;
}

interface ShowcaseEditorDialogProps {
  /** The showcase to edit, or null to make a new one. */
  showcase: EditableShowcase | null;
  /** The button that opens the editor; focus goes back to it when the editor closes. */
  trigger: ReactNode;
  onSaved?: (showcaseId: string) => void;
}

/** Names a showcase, describes it, and chooses whether other players may see it. */
export function ShowcaseEditorDialog({ showcase, trigger, onSaved }: ShowcaseEditorDialogProps) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-title-3">
            {showcase ? "Edit showcase" : "New showcase"}
          </DialogTitle>
          <DialogDescription>{`A showcase holds up to ${SHOWCASE_LIMITS.items} of your cards.`}</DialogDescription>
        </DialogHeader>
        {/* Inside the content, so the fields start over from the showcase each time the editor opens. */}
        <EditorForm
          showcase={showcase}
          onSaved={(id) => {
            setOpen(false);
            onSaved?.(id);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

function EditorForm({
  showcase,
  onSaved,
}: {
  showcase: EditableShowcase | null;
  onSaved: (showcaseId: string) => void;
}) {
  const [name, setName] = useState(showcase?.name ?? "");
  const [description, setDescription] = useState(showcase?.description ?? "");
  const [isPublic, setIsPublic] = useState(showcase?.isPublic ?? false);
  const id = useId();
  const refresh = useShowcaseRefresh();
  const saved = (showcaseId: string) => {
    refresh(showcaseId);
    onSaved(showcaseId);
  };
  const onError = (error: { message: string }) => vaultNotify.error(error.message);
  const create = api.cards.createShowcase.useMutation({
    onSuccess: (created) => saved(created.id),
    onError,
  });
  const update = api.cards.updateShowcase.useMutation({
    onSuccess: (_result, input) => saved(input.showcaseId),
    onError,
  });
  const trimmed = name.trim();
  // The server unpins a showcase made private, so the player hears it before saving.
  const unpins = showcase?.pinned === true && !isPublic;

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!trimmed) return;
    // Every field goes each time: an update replaces them all, and a cleared description clears it.
    const fields = { name: trimmed, description: description.trim() || undefined, isPublic };
    if (showcase) update.mutate({ showcaseId: showcase.id, ...fields });
    else create.mutate(fields);
  };

  return (
    <form className="space-y-4" onSubmit={submit}>
      <div className="space-y-2">
        <Label htmlFor={`${id}-name`}>Name</Label>
        <Input
          id={`${id}-name`}
          value={name}
          maxLength={SHOWCASE_LIMITS.name}
          onChange={(event) => setName(event.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${id}-description`}>Description, optional</Label>
        <Textarea
          id={`${id}-description`}
          value={description}
          maxLength={SHOWCASE_LIMITS.description}
          onChange={(event) => setDescription(event.target.value)}
        />
      </div>
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor={`${id}-public`}>Other players can see it</Label>
          <Switch
            id={`${id}-public`}
            checked={isPublic}
            onCheckedChange={setIsPublic}
            aria-describedby={`${id}-hint`}
          />
        </div>
        <p
          id={`${id}-hint`}
          className={cn("text-footnote", unpins ? "text-warning-ink" : "text-label-secondary")}
        >
          {unpins
            ? "Making it private unpins it from your wallet."
            : "Only a public showcase can be pinned to your wallet."}
        </p>
      </div>
      <DialogFooter>
        <Button type="submit" disabled={!trimmed || create.isPending || update.isPending}>
          {showcase ? "Save" : "Create"}
        </Button>
      </DialogFooter>
    </form>
  );
}
