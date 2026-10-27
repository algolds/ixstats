"use client";
/** A player's copies: revoke one, or grant a card. Both take a reason and are audited. */
import { useState } from "react";
import { api, type RouterOutputs } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { CardType } from "~/lib/cards/enums";
import { CARD_TYPE_LABELS, RARITY_LABELS, labelOf } from "~/app/admin/cards/shared/card-labels";
import { ReasonDialog } from "~/app/admin/cards/shared/ReasonDialog";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { EmptyState } from "~/components/ui/empty-state";
import { Label } from "~/components/ui/label";
import { SearchField } from "~/components/ui/search-field";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { useDialogTarget } from "~/hooks/admin/useDialogTarget";

type Copy = RouterOutputs["cards"]["admin"]["tools"]["playerCards"]["copies"][number];
interface Pending {
  kind: "grant" | "revoke";
  id: string;
  title: string;
}

const DIALOG = {
  grant: {
    title: (name: string) => `Grant ${name}`,
    description: "A new copy is minted for this player. The reason goes in the audit log.",
    confirm: "Grant",
  },
  revoke: {
    title: (name: string) => `Revoke ${name}`,
    description:
      "The copy leaves this player's collection. Its history is kept, and the reason goes in the audit log.",
    confirm: "Revoke",
  },
} as const;

/** Why a copy cannot be revoked here, or null when it can. */
function lockNote(copy: Copy): string | null {
  if (copy.isLocked) return "In a trade or auction";
  if (copy.auctioned) return "Auctioned";
  return copy.listed ? "Listed" : null;
}

function CopyRow({ copy, onRevoke }: { copy: Copy; onRevoke: (pending: Pending) => void }) {
  const name = `${copy.cards.title} #${copy.serialNumber}`;
  const note = lockNote(copy);
  return (
    <TableRow>
      <TableCell>
        {name}
        {note && (
          <Badge variant={copy.isLocked ? "warning" : "default"} className="ml-2">
            {note}
          </Badge>
        )}
      </TableCell>
      <TableCell>{labelOf(RARITY_LABELS, copy.cards.rarity)}</TableCell>
      <TableCell className="text-right tabular-nums">
        {new Date(copy.acquiredAt).toLocaleDateString()}
      </TableCell>
      <TableCell pinned className="text-right">
        {copy.cards.cardType !== CardType.TROPHY && (
          <Button
            size="xs"
            variant="ghost"
            disabled={note !== null}
            aria-label={`Revoke ${name}`}
            onClick={() => onRevoke({ kind: "revoke", id: copy.id, title: name })}
          >
            Revoke
          </Button>
        )}
      </TableCell>
    </TableRow>
  );
}

function GrantSearch({ onPick }: { onPick: (pending: Pending) => void }) {
  const [query, setQuery] = useState("");
  const term = query.trim();
  // Only cards a grant accepts: approved, not retired, not a trophy
  const matches = api.cards.admin.overview.findCards.useQuery(
    { query: term, grantable: true },
    { enabled: term.length >= 2 }
  );
  const grantable = term.length >= 2 ? (matches.data ?? []) : [];
  return (
    <div className="space-y-2">
      <Label htmlFor="grant-card">Grant a card</Label>
      <SearchField
        id="grant-card"
        value={query}
        onValueChange={setQuery}
        placeholder="Card title"
      />
      {term.length >= 2 && matches.data && grantable.length === 0 && (
        <p className="text-footnote text-label-secondary">No grantable card matches that title.</p>
      )}
      {grantable.length > 0 && (
        <ul className="flex flex-wrap gap-1">
          {grantable.map((card) => (
            <li key={card.id}>
              <Button
                size="xs"
                variant="secondary"
                onClick={() => {
                  setQuery("");
                  onPick({ kind: "grant", id: card.id, title: card.title });
                }}
              >
                {/* Titles repeat across types (a nation's card and its Lore card), so the type is shown */}
                {card.title} · {labelOf(CARD_TYPE_LABELS, card.cardType)}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function CopiesSection({
  userId,
  copies,
  copyCount,
}: {
  userId: string;
  copies: readonly Copy[];
  copyCount: number;
}) {
  const notify = useNotify();
  const utils = api.useUtils();
  const dialogTarget = useDialogTarget<Pending>();
  const pending = dialogTarget.target;
  const done = (title: string) => {
    notify.success(title);
    dialogTarget.close();
    void utils.cards.admin.tools.playerCards.invalidate({ userId });
  };
  const onError = (error: { message: string }) => notify.error("Nothing changed", error.message);
  const grant = api.cards.admin.tools.grant.useMutation({
    onSuccess: (copy) => done(`Granted copy #${copy.serialNumber}`),
    onError,
  });
  const revoke = api.cards.admin.tools.revoke.useMutation({
    onSuccess: () => done("Copy revoked"),
    onError,
  });
  const confirm = (reason: string) => {
    if (pending?.kind === "grant") {
      grant.mutate({ userId, cardId: pending.id, finish: "STANDARD", reason });
    }
    if (pending?.kind === "revoke") revoke.mutate({ ownershipId: pending.id, reason });
  };
  // The copy follows the target last opened, which stays put while the dialog closes
  const shown = dialogTarget.shown;
  const dialog = DIALOG[shown?.kind ?? "grant"];

  return (
    <div className="space-y-4">
      <GrantSearch onPick={dialogTarget.open} />
      {copies.length === 0 ? (
        <EmptyState compact title="No cards yet" message="Grant one above, or award a pack." />
      ) : (
        <Card content="data">
          <CardContent className="py-3">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Card</TableHead>
                  <TableHead>Rarity</TableHead>
                  <TableHead className="text-right">Acquired</TableHead>
                  <TableHead pinned>
                    <span className="sr-only">Revoke</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {copies.map((copy) => (
                  <CopyRow key={copy.id} copy={copy} onRevoke={dialogTarget.open} />
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
      {copyCount > copies.length && (
        <p className="text-footnote text-label-secondary">
          Showing the latest {copies.length.toLocaleString()} of {copyCount.toLocaleString()}{" "}
          copies.
        </p>
      )}
      <ReasonDialog
        open={pending !== null}
        onOpenChange={(open) => !open && dialogTarget.close()}
        title={dialog.title(shown?.title ?? "")}
        description={dialog.description}
        confirmLabel={dialog.confirm}
        destructive={shown?.kind === "revoke"}
        pending={grant.isPending || revoke.isPending}
        onConfirm={confirm}
      />
    </div>
  );
}
