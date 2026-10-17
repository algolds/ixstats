"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Link as LinkIcon, LogIn } from "iconoir-react";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { EmptyState } from "~/components/ui/empty-state";
import { Skeleton } from "~/components/ui/skeleton";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "~/components/ui/sheet";
import { cn } from "~/lib/utils/cn";
import { createUrl } from "~/lib/utils/url-utils";
import { withBasePath } from "~/lib/base-path";
import { CARD_FACE_WIDTH } from "~/lib/cards/face/face-size";
import { RARITY_LABEL } from "~/lib/cards/face/labels";
import { cardSheetHref, encodeSheetFrom, type SheetFrom } from "~/lib/cards/face/sheet-link";
import { CARD_HUB_PATHS } from "~/lib/cards/hub-routes";
import { vaultNotify } from "~/lib/vault/vault-notifications";
import { returnFocusToSheetOpener } from "~/hooks/useCardSheet";
import type { CardSheetData } from "~/lib/cards/hub/sheet";
import { useFacetReducedMotion } from "~/components/providers/FacetMotionConfig";
import { CardFlip } from "~/components/cards/face/CardFlip";
import { playRevealFeedback } from "~/components/cards/reveal/reveal-feedback";
import { CardBackProvenance } from "~/components/cards/face/CardBackProvenance";
import { AddToShowcaseDialog } from "~/components/cards/showcase/AddToShowcaseDialog";
import { CardSheetCopies } from "./CardSheetCopies";
import { CardSheetMarket } from "./CardSheetMarket";
import { CardSheetAbout } from "./CardSheetAbout";

interface CardSheetProps {
  cardId: string;
  from: SheetFrom | null;
  onClose: () => void;
}

type Side = "front" | "back";

const SIDE_SHOWN: Record<Side, string> = { front: "Showing the front", back: "Showing the back" };

/**
 * The one card sheet: no tabs; the card, then Your copies, Market and About. Stacks on phones. A signed-out visitor
 * sees it only for a card a player shows publicly, and is asked to sign in for any other.
 */
export function CardSheet({ cardId, from, onClose }: CardSheetProps) {
  const query = api.cards.getSheet.useQuery({ cardId, from: from ? encodeSheetFrom(from) : null });
  const data = query.data;
  const sheet = data && !("signIn" in data) ? data : null;
  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        size="wide"
        className="overflow-y-auto"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          returnFocusToSheetOpener();
        }}
      >
        {sheet ? (
          <SheetBody key={sheet.card.id} sheet={sheet} />
        ) : (
          <>
            <SheetTitle className="sr-only">Card</SheetTitle>
            <SheetPlaceholder
              loading={query.isLoading}
              signIn={Boolean(data && "signIn" in data)}
              failed={query.isError}
              onRetry={() => void query.refetch()}
            />
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

/** Signing in brings the visitor back to this address, with the sheet open on the same card. */
function SignInToSee() {
  const pathname = usePathname();
  const query = useSearchParams()?.toString();
  const here = query ? `${pathname}?${query}` : pathname;
  // createUrl: the redirect is a plain URL.
  const signInHref = `/sign-in?redirect_url=${encodeURIComponent(createUrl(here))}`;
  return (
    <EmptyState
      icon={<LogIn />}
      title="Sign in to see this card"
      message="Without an account, a card opens only where a player shows it publicly."
      action={
        <Button asChild>
          <Link href={signInHref}>Sign in</Link>
        </Button>
      }
    />
  );
}

function SheetPlaceholder({
  loading,
  signIn,
  failed,
  onRetry,
}: {
  loading: boolean;
  signIn: boolean;
  failed: boolean;
  onRetry: () => void;
}) {
  if (loading) {
    return <Skeleton className={cn("rounded-card mx-auto aspect-[5/7]", CARD_FACE_WIDTH.L)} />;
  }
  if (signIn) return <SignInToSee />;
  if (failed) {
    return (
      <EmptyState
        title="Could not load this card"
        message="Check your connection and try again."
        action={<Button onClick={onRetry}>Try again</Button>}
      />
    );
  }
  return (
    <EmptyState
      title="This card is not available"
      message="It may still be in review, or it no longer exists."
    />
  );
}

function SheetBody({ sheet }: { sheet: CardSheetData }) {
  const hero = useRef<HTMLDivElement>(null);
  // Null until the first turn, so the status line stays quiet when the sheet opens.
  const [side, setSide] = useState<Side | null>(null);
  const [showcasing, setShowcasing] = useState<string[] | null>(null);
  const reduce = useFacetReducedMotion();
  const { face, card } = sheet;
  const flipped = side === "back";
  // Turning to the back is a reveal (its provenance), so it gets the pack reveal's feedback for its rarity.
  const flip = useCallback(() => {
    setSide(flipped ? "front" : "back");
    if (!flipped) playRevealFeedback(face.rarity, reduce);
  }, [flipped, face.rarity, reduce]);

  // Focus the card once it is drawn, so Space turns it over instead of pressing the close button.
  useEffect(() => {
    hero.current?.focus({ preventScroll: true });
  }, []);

  const copyLink = async () => {
    const path = withBasePath(cardSheetHref(CARD_HUB_PATHS.explore, card.id));
    try {
      await navigator.clipboard.writeText(new URL(path, window.location.origin).toString());
      vaultNotify.success("Link copied", card.title);
    } catch {
      vaultNotify.error("Could not copy the link");
    }
  };

  return (
    <div className="grid gap-6 md:grid-cols-[auto_1fr]">
      <div
        ref={hero}
        role="group"
        tabIndex={-1}
        aria-label="The card. Press Space or F to turn it over."
        className="flex flex-col items-center gap-3 outline-none md:sticky md:top-0 md:self-start"
      >
        <CardFlip
          face={face}
          flipped={flipped}
          onFlip={flip}
          back={
            <CardBackProvenance
              face={face}
              copy={sheet.copies[0] ?? null}
              artCredit={card.artCredit}
              ns={card.ns}
            />
          }
        />
        <Button variant="secondary" size="sm" onClick={flip}>
          {flipped ? "Show the front" : "Show the back"}
        </Button>
        <p role="status" className="sr-only">
          {side ? SIDE_SHOWN[side] : ""}
        </p>
      </div>
      <div className="min-w-0 space-y-6">
        <header className="space-y-1 pr-10">
          <SheetTitle className="text-title-2">{card.title}</SheetTitle>
          <SheetDescription>
            {[
              RARITY_LABEL[card.rarity],
              face.realm.name,
              face.number !== null ? `No. ${face.number}` : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </SheetDescription>
          <Button variant="ghost" size="sm" className="px-0" onClick={() => void copyLink()}>
            <LinkIcon />
            Copy link
          </Button>
        </header>
        {sheet.signedIn && (
          <CardSheetCopies
            card={card}
            realmName={face.realm.name}
            copies={sheet.copies}
            onAddToShowcase={(id) => setShowcasing([id])}
          />
        )}
        <CardSheetMarket
          cardId={card.id}
          value={card.value}
          market={sheet.market}
          signedIn={sheet.signedIn}
        />
        <CardSheetAbout card={card} artHidden={face.silhouette || card.isRetired} />
      </div>
      <AddToShowcaseDialog
        open={showcasing !== null}
        onOpenChange={(open) => !open && setShowcasing(null)}
        ownershipIds={showcasing ?? []}
      />
    </div>
  );
}
