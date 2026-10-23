"use client";

import { useState, type ReactNode } from "react";
import { api } from "~/trpc/react";
import { CategoryChoiceDialog } from "~/components/cards/category/CategoryChoiceDialog";
import { Signal } from "~/components/ui/signal";
import type { CategoryChoice } from "~/lib/cards/category-taxonomy";
import { vaultNotify } from "~/lib/vault/vault-notifications";

const SENT = "Suggestion sent. Staff review it before the card changes.";

interface SuggestCategoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cardId: string;
  cardTitle: string;
  current: CategoryChoice;
  /** The control that opens it. */
  children: ReactNode;
}

/**
 * A signed-in player's category suggestion for a lore card, with an optional note. It goes to the admin's category
 * review queue; the card keeps its category until staff answer.
 */
export function SuggestCategoryDialog({
  open,
  onOpenChange,
  cardId,
  cardTitle,
  current,
  children,
}: SuggestCategoryDialogProps) {
  // The player already has one open for this card: say so here and keep the dialog up
  const [alreadyOpen, setAlreadyOpen] = useState(false);
  const changeOpen = (next: boolean) => {
    if (!next) setAlreadyOpen(false);
    onOpenChange(next);
  };
  const send = api.cards.suggestCategory.useMutation({
    onSuccess: ({ status }) => {
      if (status === "already") {
        setAlreadyOpen(true);
        return;
      }
      vaultNotify.success(SENT, cardTitle);
      changeOpen(false);
    },
    onError: (error) => vaultNotify.error(error.message),
  });

  return (
    <CategoryChoiceDialog
      open={open}
      onOpenChange={changeOpen}
      title="Suggest a category"
      description="Staff review every suggestion before the card changes."
      initial={current}
      confirmLabel="Send suggestion"
      pending={send.isPending}
      allowUncategorised={false}
      requireChange
      withNote
      trigger={children}
      notice={
        alreadyOpen && (
          <Signal tone="info" title="You already suggested a category for this card">
            Staff have not answered it yet.
          </Signal>
        )
      }
      onConfirm={(choice, note) => send.mutate({ cardId, choice, note })}
    />
  );
}
