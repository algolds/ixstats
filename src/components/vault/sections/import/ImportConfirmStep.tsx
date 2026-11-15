"use client";

import React, { useId, useState } from "react";
import { motion } from "motion/react";
import {
  CheckCircle,
  InfoCircle as Info,
  ArrowLeft,
  Download,
  Package,
  Coins,
  ArrowRight,
} from "iconoir-react";
import { useFacetReducedMotion } from "~/components/providers/FacetMotionConfig";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { Checkbox } from "~/components/ui/checkbox";
import { Label } from "~/components/ui/label";
import { NumberFlowDisplay } from "~/components/ui/number-flow";
import { Stat } from "~/components/ui/stat";
import { CardFace } from "~/components/cards/face/CardFace";
import { IxCreditsSymbol } from "~/components/vault/IxCreditsSymbol";
import { REDUCED_MOTION_FADE, springGentle, springSmooth } from "~/lib/design/motion";
import type { CardFaceData } from "~/lib/cards/face/types";

/** How many of the imported copies the summary shows; the rest are counted. */
const SHOWN_FACES = 12;

export interface ImportResult {
  cardsImported: number;
  bonusCredits: number;
  nation: string;
  /** The copies just imported. */
  faces: CardFaceData[];
}

export function ImportConfirmStep({
  nationName,
  onBack,
  onConfirmImport,
}: {
  nationName: string;
  onBack: () => void;
  onConfirmImport: () => void;
}) {
  const reduce = useFacetReducedMotion();
  const [consented, setConsented] = useState(false);
  const consentId = useId();

  return (
    <div className="space-y-5">
      <div className="flex flex-col items-center py-2 text-center">
        <motion.div
          initial={reduce ? { opacity: 0 } : { scale: 0.96, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={reduce ? REDUCED_MOTION_FADE : springGentle}
          className="bg-green/15 border-green/30 mb-3 flex size-14 items-center justify-center rounded-full border"
        >
          <CheckCircle className="text-green-ink size-7" />
        </motion.div>
        <h2 className="text-label text-title-3">Nation verified</h2>
        <p className="text-label-secondary text-body mt-1">
          <span className="text-green-ink font-medium">{nationName}</span> is confirmed as yours.
        </p>
      </div>

      <Card variant="well" padding="md">
        <div className="flex items-start gap-3">
          <Info aria-hidden className="text-tint mt-0.5 size-4 shrink-0" />
          <div className="text-label-secondary text-footnote space-y-1">
            <p className="text-label text-subhead">Ready to import</p>
            <p>
              IxVault will fetch your NationStates trading card deck and mint a card copy for each
              entry. Depending on deck size, this takes a few seconds.
            </p>
          </div>
        </div>
      </Card>

      <Card variant="well" padding="md" className="flex items-start gap-3">
        <Checkbox
          id={consentId}
          checked={consented}
          onCheckedChange={(checked) => setConsented(checked === true)}
          className="mt-0.5"
        />
        <Label
          htmlFor={consentId}
          className="text-body text-label cursor-pointer leading-snug font-normal"
        >
          <span>
            I own or run <strong>{nationName}</strong> on NationStates, and I allow IxStates to show
            its flag and cards.
          </span>
        </Label>
      </Card>

      <div className="flex gap-3">
        <Button type="button" variant="outline" onClick={onBack}>
          <ArrowLeft className="size-4" />
          Back
        </Button>
        <Button type="button" onClick={onConfirmImport} disabled={!consented} className="flex-1">
          <Download className="size-4" />
          Import deck
        </Button>
      </div>
    </div>
  );
}

export function ImportCompleteStep({
  importResult,
  onReset,
}: {
  importResult: ImportResult;
  onReset: () => void;
}) {
  const reduce = useFacetReducedMotion();
  const moreFaces = importResult.faces.length - SHOWN_FACES;
  const facesLabel = useId();
  const transition = reduce ? REDUCED_MOTION_FADE : springSmooth;

  return (
    <div className="space-y-5">
      <div className="flex flex-col items-center py-2 text-center">
        <motion.div
          initial={reduce ? { opacity: 0 } : { scale: 0.94, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={reduce ? REDUCED_MOTION_FADE : springGentle}
          className="bg-green/15 border-green/30 mb-3 flex size-14 items-center justify-center rounded-full border"
        >
          <CheckCircle className="text-green-ink size-7" />
        </motion.div>

        <h2 className="text-label text-title-3">Import complete</h2>
        <p className="text-label-secondary text-body mt-1">
          Your deck from <span className="text-green-ink font-medium">{importResult.nation}</span>{" "}
          has been imported into your Vault.
        </p>
      </div>

      <motion.div
        className="grid grid-cols-1 gap-3 sm:grid-cols-2"
        initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
        animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0 }}
        transition={transition}
      >
        <Card variant="well" padding="md">
          <Stat
            icon={<Package />}
            label="Cards imported"
            value={<NumberFlowDisplay value={importResult.cardsImported} />}
          />
        </Card>
        <Card variant="well" padding="md">
          <Stat
            icon={<Coins />}
            label="Bonus IxCredits"
            value={
              <span className="inline-flex items-center gap-1 tabular-nums">
                +<IxCreditsSymbol decorative className="text-tint size-5 shrink-0" />
                <NumberFlowDisplay value={importResult.bonusCredits} />
              </span>
            }
          />
        </Card>
      </motion.div>

      {importResult.faces.length > 0 && (
        <motion.div
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
          animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0 }}
          transition={transition}
          className="space-y-2"
        >
          <p id={facesLabel} className="text-label-secondary text-subhead">
            Your cards
          </p>
          <ul
            aria-labelledby={facesLabel}
            className="grid grid-cols-[repeat(auto-fill,minmax(6.5rem,1fr))] gap-3"
          >
            {importResult.faces.slice(0, SHOWN_FACES).map((face) => (
              <li key={face.copy?.ownershipId ?? face.cardId}>
                <CardFace face={face} size="S" className="w-full" />
              </li>
            ))}
          </ul>
          {moreFaces > 0 && (
            <p className="text-label-secondary text-footnote text-center tabular-nums">
              +{moreFaces.toLocaleString()} more {moreFaces === 1 ? "card" : "cards"}
            </p>
          )}
        </motion.div>
      )}

      <div>
        <Button type="button" onClick={onReset} variant="outline" className="w-full">
          Import another nation
          <ArrowRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}
