"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Link as LinkIcon, LogIn } from "iconoir-react";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { EmptyState } from "~/components/ui/empty-state";
import { Skeleton } from "~/components/ui/skeleton";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "~/components/ui/sheet";
import { Tooltip } from "~/components/ui/tooltip";
import { cn } from "~/lib/utils/cn";
import { createUrl } from "~/lib/utils/url-utils";
import { withBasePath } from "~/lib/base-path";
import { copiesBestFirst, pickedCopy } from "~/lib/cards/face/copy-pick";
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
import { CardSheetCraft, CardSheetMarket, CardSheetPriceHistory } from "./CardSheetMarket";
import { CardSheetAbout } from "./CardSheetAbout";
import { MuteToggle } from "./economy/MuteToggle";
import { WishlistToggle } from "./economy/WishlistToggle";

interface CardSheetProps {
  cardId: string;
  from: SheetFrom | null;
  onClose: () => void;
}

type Side = "front" | "back";

const SIDE_SHOWN: Record<Side, string> = { front: "Showing the front", back: "Showing the back" };

/**
 * The one card sheet: no tabs; the card, then Your copies, Market, About, and Price history and Mint folded. Stacks on
 * phones. A signed-out visitor sees it only for a card a player shows publicly, and is asked to sign in for any other.
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
    return (
      <Skeleton
        className={cn(
          "rounded-card mx-auto mt-8 aspect-[5/7] max-w-full md:mt-0",
          CARD_FACE_WIDTH.L
        )}
      />
    );
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
  // Null picks the best copy, also once the picked one is gone.
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [showcasing, setShowcasing] = useState<string[] | null>(null);
  const reduce = useFacetReducedMotion();
  const { card } = sheet;
  const held = useMemo(() => copiesBestFirst(sheet.copies), [sheet.copies]);
  const picked = pickedCopy(held, pickedId);
  // The big card is the picked copy; without one, the card itself, which has no back to turn to.
  const face = picked?.copy.face ?? sheet.face;
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
    // grid-cols-1 lets the phone's one column shrink below the card's 288 px. The bottom sheet's close button, and the
    // header's icon buttons beside it, sit over the column's top-right corner, so on a phone the card starts below
    // them (pt-8); beside the details it clears them.
    <div className="grid grid-cols-1 gap-6 md:grid-cols-[auto_1fr]">
      <div
        ref={hero}
        role="group"
        tabIndex={-1}
        aria-label={picked ? "The card. Press Space or F to turn it over." : "The card"}
        className="flex flex-col items-center gap-3 pt-8 outline-none md:sticky md:top-0 md:self-start md:pt-0"
      >
        <CardFlip
          face={face}
          turn={
            picked && {
              back: <CardBackProvenance face={face} facts={picked.facts} copy={picked.copy} />,
              flipped,
              onFlip: flip,
            }
          }
        />
        <p role="status" className="sr-only">
          {side ? SIDE_SHOWN[side] : ""}
        </p>
      </div>
      <div className="min-w-0 space-y-6">
        {/* The title clears the corner's buttons on wide screens; on a phone it sits below the card. */}
        <header className={cn("space-y-1", sheet.signedIn ? "md:pr-36" : "md:pr-20")}>
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
          {/*
           * Beside the close button and level with it (both sit against the sheet itself, top-4). On a phone the sheet
           * scrolls under them, so they get a backing, and z-10 keeps the action bar's buttons (relative, later in
           * the page) from painting over them. The wishlist and the mute are the signed-in player's own.
           */}
          <div className="max-md:bg-popover absolute top-4 right-14 z-10 flex items-center gap-1 max-md:rounded-full">
            <Tooltip content="Copy link">
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label="Copy link"
                onClick={() => void copyLink()}
              >
                <LinkIcon aria-hidden />
              </Button>
            </Tooltip>
            {sheet.signedIn && (
              <>
                <WishlistToggle cardId={card.id} />
                <MuteToggle cardId={card.id} />
              </>
            )}
          </div>
        </header>
        {sheet.signedIn && (
          <CardSheetCopies
            card={card}
            held={held}
            picked={picked}
            onPick={setPickedId}
            onAddToShowcase={(id) => setShowcasing([id])}
          />
        )}
        <CardSheetMarket
          cardId={card.id}
          cardTitle={card.title}
          value={card.value}
          market={sheet.market}
          signedIn={sheet.signedIn}
        />
        <CardSheetAbout card={card} artHidden={card.isRetired} signedIn={sheet.signedIn} />
        <CardSheetPriceHistory
          cardId={card.id}
          recentSales={sheet.market.recentSales}
          signedIn={sheet.signedIn}
        />
        <CardSheetCraft cardId={card.id} signedIn={sheet.signedIn} />
      </div>
      <AddToShowcaseDialog
        open={showcasing !== null}
        onOpenChange={(open) => !open && setShowcasing(null)}
        ownershipIds={showcasing ?? []}
      />
    </div>
  );
}
