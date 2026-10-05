import Link from "next/link";
import { Hammer } from "iconoir-react";
import { buttonVariants } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { EmptyState } from "~/components/ui/empty-state";

/**
 * Crafting is retired for now (owner decision, 2026-10-05). The route stays so old links land
 * somewhere useful; the workbench is gone and `crafting.*` refuses every call.
 */
export default function VaultCraftingRetiredPage() {
  return (
    <Card>
      <EmptyState
        icon={<Hammer />}
        title="Crafting is retired for now"
        message="Card crafting is switched off while the Vault is reworked. Your cards and credits are untouched."
        action={
          <Link href="/vault/cards" className={buttonVariants({ variant: "secondary" })}>
            Go to your cards
          </Link>
        }
      />
    </Card>
  );
}
