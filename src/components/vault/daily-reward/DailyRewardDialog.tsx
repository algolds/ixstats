"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion, useTransform, type MotionValue } from "motion/react";
import { api } from "~/trpc/react";
import { useCardSheetOpen } from "~/hooks/useCardSheet";
import { useCardsRefresh } from "~/hooks/useCardsRefresh";
import { usePointerParallax } from "~/hooks/usePointerParallax";
import { Dialog, DialogContent } from "~/components/ui/dialog";
import { FacetMaterial } from "~/components/ui/facet";
import { MonogramLayer } from "~/components/ui/facet/shared/MonogramLayer";
import { useFacetReducedMotion } from "~/components/providers/FacetMotionConfig";
import { proxyCardArtwork } from "~/lib/cards/ns-image-proxy";
import type { CardRarity } from "~/lib/cards/face/types";
import { REDUCED_MOTION_FADE, springSmooth, tweenExit } from "~/lib/design/motion";
import { levelMultiplier, streakMultiplier } from "~/lib/vault/daily-roll";
import { vaultNotify } from "~/lib/vault/vault-notifications";
import { DailyChoiceStage } from "./DailyChoiceStage";
import { DailyClaimedTodayStage, DailyRevealStage } from "./DailyRevealStage";
import {
  MONOGRAM_LAYERS,
  hasAutoOpenedToday,
  markAutoOpenedToday,
  type ClaimChoice,
  type ClaimResult,
} from "./daily-reward-utils";

interface ClaimSession {
  claiming: ClaimChoice | null;
  result: ClaimResult | null;
  preClaimCredits: number | null;
}

const INITIAL_SESSION: ClaimSession = {
  claiming: null,
  result: null,
  preClaimCredits: null,
};

/**
 * Ambient backdrop inside the `facet-overlay` sheet: front-page multi-plane monogram parallax,
 * an aurora wash (switching to the pulled card's rarity hue on card reveal, or foil luster on
 * credits reveal), a diffused full-bleed art wash when a card with artwork is revealed, and a
 * Facet 5 `facet-lens` refractive glass layer (`#facet-lens`) bending the monogram underneath.
 */
function StageAtmosphere({
  artwork,
  rarity,
  creditsClaimed,
  px,
  py,
}: {
  artwork: string | null;
  rarity: CardRarity | null;
  creditsClaimed: boolean;
  px: MotionValue<number>;
  py: MotionValue<number>;
}) {
  const auroraX = useTransform(px, (v) => v * -10);
  const auroraY = useTransform(py, (v) => v * -10);

  return (
    <div
      aria-hidden
      data-slot="monogram-parallax"
      data-card-rarity={rarity ?? undefined}
      className="rounded-sheet pointer-events-none absolute inset-0 -z-10 overflow-hidden [--facet-accent:var(--card-rarity,var(--tint))]"
    >
      <div className="absolute inset-0 print:hidden">
        {MONOGRAM_LAYERS.map((layer) => (
          <MonogramLayer key={layer.app} {...layer} px={px} py={py} className="-inset-6" />
        ))}
      </div>
      <motion.div className="facet-aurora absolute -inset-8" style={{ x: auroraX, y: auroraY }} />
      {creditsClaimed && <div className="facet-foil absolute -inset-8" />}
      {artwork && (
        <>
          <img
            alt=""
            src={proxyCardArtwork(artwork)}
            className="h-full w-full scale-110 object-cover opacity-30 blur-2xl"
          />
          <div className="bg-surface/45 absolute inset-0" />
        </>
      )}
      <FacetMaterial
        layer="lens"
        aria-hidden
        data-slot="monogram-lens"
        className="rounded-sheet pointer-events-none absolute inset-0 print:hidden"
      />
    </div>
  );
}

export function DailyRewardDialog({
  userId,
  isOpen,
  setIsOpen,
  autoOpen,
}: {
  userId: string;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  autoOpen: boolean;
}) {
  const utils = api.useUtils();
  const refreshCards = useCardsRefresh();
  const reduce = useFacetReducedMotion();
  const [session, setSession] = useState<ClaimSession>(INITIAL_SESSION);

  const { px, py, onPointerMove, onPointerLeave } = usePointerParallax(reduce);

  const { data: balanceData } = api.vault.getBalance.useQuery(undefined);

  const canClaim = balanceData?.canClaimDailyBonus ?? false;
  const claimedToday = balanceData !== undefined && !canClaim;
  const streak = balanceData?.loginStreak ?? 0;
  const claimStreak = balanceData?.claimStreak ?? streak;
  const totalBoost = streakMultiplier(claimStreak) * levelMultiplier(balanceData?.vaultLevel ?? 1);

  const sheetOpen = useCardSheetOpen();

  // Auto-open at most once per user per UTC day. Chromeless routes opt out and do not spend it.
  useEffect(() => {
    if (!autoOpen || sheetOpen || !canClaim || hasAutoOpenedToday(userId)) return;
    markAutoOpenedToday(userId);
    setIsOpen(true);
  }, [autoOpen, sheetOpen, userId, canClaim, setIsOpen]);

  const refreshVault = () => {
    void utils.vault.getBalance.invalidate();
    void utils.vault.getTransactions.invalidate();
    void utils.vault.getTodayEarnings.invalidate();
  };

  const claimMutation = api.vault.claimCombinedDailyClaim.useMutation({
    onSuccess: (data) => {
      setSession((prev) => ({ ...prev, claiming: null, result: data }));
      refreshVault();
      refreshCards();
    },
    onError: (err) => {
      setSession((prev) => ({ ...prev, claiming: null }));
      vaultNotify.error(err.message || "Couldn't claim the daily reward");
      refreshVault();
      if (/already/i.test(err.message)) setIsOpen(false);
    },
  });

  const handleClaim = (choice: ClaimChoice) => {
    if (session.claiming) return;
    setSession({
      claiming: choice,
      result: null,
      preClaimCredits: balanceData?.credits ?? null,
    });
    claimMutation.mutate({ choice });
  };

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open && session.claiming) return;
      setIsOpen(open);
      if (!open) {
        onPointerLeave();
        window.setTimeout(() => setSession(INITIAL_SESSION), 200);
      }
    },
    [onPointerLeave, session.claiming, setIsOpen]
  );

  const stageTransition = reduce ? REDUCED_MOTION_FADE : springSmooth;
  const stageMotion = reduce
    ? {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0, transition: tweenExit },
      }
    : {
        initial: { opacity: 0, y: 8 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: -6, transition: tweenExit },
      };

  const revealedFace = session.result?.cardFace ?? null;

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent
        data-app="vault"
        data-content={session.result ? "reveal" : undefined}
        showCloseButton={!session.claiming}
        onPointerMove={onPointerMove}
        onPointerLeave={onPointerLeave}
        className="isolate max-h-[calc(100dvh-2rem)] max-w-[calc(100%-2rem)] gap-0 overflow-x-hidden overflow-y-auto p-0 sm:max-w-lg"
      >
        <StageAtmosphere
          artwork={revealedFace?.artwork ?? null}
          rarity={revealedFace?.rarity ?? null}
          creditsClaimed={session.result?.creditsAwarded != null}
          px={px}
          py={py}
        />

        <AnimatePresence mode="wait" initial={false}>
          {!session.result && claimedToday && (
            <motion.div key="claimed" {...stageMotion} transition={stageTransition}>
              <DailyClaimedTodayStage onDone={() => handleOpenChange(false)} />
            </motion.div>
          )}

          {!session.result && !claimedToday && (
            <motion.div key="choice" {...stageMotion} transition={stageTransition}>
              <DailyChoiceStage
                credits={balanceData?.credits}
                totalBoost={totalBoost}
                claiming={session.claiming}
                onClaim={handleClaim}
              />
            </motion.div>
          )}

          {session.result && (
            <motion.div key="reveal" {...stageMotion} transition={stageTransition}>
              <DailyRevealStage
                result={session.result}
                preClaimCredits={session.preClaimCredits}
                onDone={() => handleOpenChange(false)}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
