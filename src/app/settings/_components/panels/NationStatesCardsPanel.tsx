"use client";

import { Button } from "~/components/ui/button";
import { useState } from "react";
import Link from "next/link";
import { ShieldAlert, OpenNewWindow as ExternalLink, Download } from "iconoir-react";
import { api } from "~/trpc/react";
import { SettingsHeader } from "../SettingsHeader";
import { SettingsGroup, SettingsRow } from "../primitives";
import { soundEffects } from "~/lib/sound/cuelume";
import { NationStatesLogo } from "~/components/cards/display/NationStatesLogo";
import { CARD_HUB_PATHS } from "~/lib/cards/hub-routes";
import { cardSheetHref } from "~/lib/cards/face/sheet-link";
import { NSTakedownModal } from "../modals/NSTakedownModal";

/** The NS card acquired most recently, or null when there is none. */
function newestCard<T extends { acquiredAt: Date }>(cards: readonly T[]): T | null {
  return cards.reduce<T | null>(
    (newest, card) => (newest && newest.acquiredAt >= card.acquiredAt ? newest : card),
    null
  );
}

/** Every NS copy held counts (a pack or trade can bring one too), so the row does not say "imported". */
function cardsSummary(count: number, newest: { acquiredAt: Date } | null): string {
  if (!newest) return "No NationStates cards yet. Import them from your NationStates deck.";
  const noun = count === 1 ? "card" : "cards";
  return `${count} NationStates ${noun}, the newest on ${newest.acquiredAt.toLocaleDateString()}`;
}

export function NationStatesCardsPanel() {
  const [showTakedownModal, setShowTakedownModal] = useState(false);

  const { data: nsCardsData, isLoading: cardsLoading } = api.nsImport.getMyNSCards.useQuery(
    undefined,
    { refetchOnWindowFocus: false }
  );

  const { data: userProfile } = api.users.getProfile.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });

  const cards = nsCardsData?.cards ?? [];
  const newest = newestCard(cards);

  return (
    <div className="space-y-6">
      <SettingsHeader
        title="NationStates cards"
        category="Vault"
        actions={
          <div className="flex items-center gap-2">
            <Button asChild variant="secondary" size="sm">
              <Link href="/vault" data-cuelume-press="soft">
                <span>Open Vault</span>
                <ExternalLink className="h-3 w-3 opacity-60" />
              </Link>
            </Button>
            <Button asChild variant="secondary" size="sm">
              <Link href="/vault/import" data-cuelume-press="soft">
                <NationStatesLogo size="xs" className="h-3 w-auto" />
                <span>Import cards</span>
              </Link>
            </Button>
          </div>
        }
      />

      {/* NationStates API disclaimer */}
      <div className="border-separator bg-surface text-muted-foreground rounded-card flex items-start gap-2.5 border p-3 text-xs leading-relaxed">
        <NationStatesLogo size="xs" className="mt-0.5 shrink-0 opacity-80" />
        <p className="min-w-0 flex-1">
          Card data comes from the official{" "}
          <a
            href="https://www.nationstates.net/pages/api.html#cards"
            target="_blank"
            rel="noopener noreferrer"
            className="text-foreground hover:text-primary font-medium underline underline-offset-2 transition-colors"
          >
            NationStates API
          </a>
          . IxStats is not affiliated with or endorsed by NationStates. Card artwork, flags and
          emblems remain the copyright of their authors.
        </p>
      </div>

      <SettingsGroup>
        <SettingsRow
          label="Your NationStates cards"
          description={
            cardsLoading ? "Loading your NationStates cards" : cardsSummary(cards.length, newest)
          }
          icon={Download}
        >
          {newest && (
            <Button asChild variant="secondary" size="sm">
              <Link
                href={cardSheetHref(CARD_HUB_PATHS.mine, newest.cardId)}
                data-cuelume-press="soft"
              >
                Open {newest.title}
              </Link>
            </Button>
          )}
        </SettingsRow>
      </SettingsGroup>

      {/* Takedown */}
      <SettingsGroup
        title="Card removal and opt-out"
        description="Disconnect deck sync or request removal of your cards from search."
      >
        <SettingsRow
          label="Takedown and disconnect"
          description="Request removal of your NationStates card data or unlink your deck"
          icon={ShieldAlert}
          glyphClass="bg-muted/60 text-foreground"
        >
          <Button
            type="button"
            onClick={() => {
              soundEffects.press();
              setShowTakedownModal(true);
            }}
            data-cuelume-press="soft"
            variant="secondary"
            size="sm"
            className="hover:text-destructive"
          >
            <ShieldAlert className="h-3.5 w-3.5" />
            <span>Takedown and opt-out</span>
          </Button>
        </SettingsRow>
      </SettingsGroup>

      <NSTakedownModal
        isOpen={showTakedownModal}
        onClose={() => setShowTakedownModal(false)}
        defaultNationName={userProfile?.country?.name ?? ""}
      />
    </div>
  );
}
