"use client";

import { useRef } from "react";
import { Xmark } from "iconoir-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { CardFace } from "~/components/cards/face/CardFace";
import { ReportInscriptionButton } from "~/components/cards/inscription/ReportInscriptionButton";
import { useCardSheet } from "~/hooks/useCardSheet";
import { FINISH_LABEL } from "~/lib/cards/face/labels";
import type { SheetFrom } from "~/lib/cards/face/sheet-link";
import type { TradeCopyLike } from "~/lib/cards/trade/builder-state";

export type { TradeCopyLike };

interface TradeSideColumnProps {
  title: "You give" | "You get";
  copies: TradeCopyLike[];
  credits: number;
  editable: boolean;
  /** Their copies: a signed one can be reported from here. */
  reportable: boolean;
  /** Where the sheet was opened from, when this offer waits on the viewer (its art shows there too). */
  sheetFrom: SheetFrom | null;
  onRemove: (ownershipId: string, targetToFocus?: HTMLElement | null) => void;
  onCredits: (credits: number) => void;
}

/** One column of the trade table: the cards and credits that side gives. */
export function TradeSideColumn(props: TradeSideColumnProps) {
  const sheet = useCardSheet();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const removeRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const creditsId = props.title === "You give" ? "trade-credits-give" : "trade-credits-get";

  const handleRemove = (copy: TradeCopyLike, index: number) => {
    let targetToFocus: HTMLElement | null = null;
    if (props.copies.length <= 1) {
      targetToFocus = headingRef.current;
    } else if (index < props.copies.length - 1) {
      const nextId = props.copies[index + 1]!.ownershipId;
      targetToFocus = removeRefs.current.get(nextId) ?? null;
    } else {
      const prevId = props.copies[index - 1]!.ownershipId;
      targetToFocus = removeRefs.current.get(prevId) ?? null;
    }
    props.onRemove(copy.ownershipId, targetToFocus);
  };

  return (
    <section aria-label={props.title} className="space-y-3">
      <h3 ref={headingRef} tabIndex={-1} className="text-headline outline-none">
        {props.title}
      </h3>
      {props.copies.length === 0 ? (
        <p className="text-footnote text-label-secondary">No cards yet</p>
      ) : (
        <ul className="space-y-2">
          {props.copies.map((copy, index) => (
            <li key={copy.ownershipId} className="flex items-center gap-2">
              <CardFace
                face={copy.face}
                size="S"
                className="w-12"
                onOpen={(face) => sheet.open(face.cardId, props.sheetFrom)}
              />
              <span className="min-w-0 flex-1">
                <span className="text-callout block truncate">{copy.face.title}</span>
                <span className="text-footnote text-label-secondary block tabular-nums">
                  {copy.face.copy
                    ? `${FINISH_LABEL[copy.face.copy.finish]} #${copy.face.copy.serialNumber} · `
                    : ""}
                  {copy.value.toLocaleString()} IxC
                </span>
                {copy.inscription && (
                  <span className="text-footnote block">“{copy.inscription}”</span>
                )}
                {props.reportable && copy.inscription && (
                  <ReportInscriptionButton
                    ownershipId={copy.ownershipId}
                    cardId={copy.face.cardId}
                  />
                )}
              </span>
              {props.editable && (
                <Button
                  ref={(el) => {
                    if (el) removeRefs.current.set(copy.ownershipId, el);
                    else removeRefs.current.delete(copy.ownershipId);
                  }}
                  size="icon-sm"
                  variant="ghost"
                  aria-label={`Remove ${copy.face.title}`}
                  onClick={() => handleRemove(copy, index)}
                >
                  <Xmark aria-hidden />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      <div className="space-y-1">
        <Label htmlFor={creditsId}>
          {props.title === "You give" ? "Credits you give" : "Credits you get"}
        </Label>
        <Input
          id={creditsId}
          inputMode="numeric"
          disabled={!props.editable}
          value={props.credits === 0 ? "" : String(props.credits)}
          placeholder="0"
          onChange={(e) => props.onCredits(Number(e.target.value))}
        />
      </div>
    </section>
  );
}
