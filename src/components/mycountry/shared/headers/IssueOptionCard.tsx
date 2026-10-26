"use client";

import { KeyCommand as Command, WarningTriangle as AlertTriangle, Xmark as X } from "iconoir-react";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { cn } from "~/lib/utils";

export interface ResponseOption {
  id: string;
  label: string;
  description: string;
  previewEffects: {
    publicApproval?: number;
    economicImpact?: string;
    stabilityImpact?: string;
    diplomaticImpact?: string;
  };
  outcomeText: string;
  isRisky?: boolean;
  partyAlignment?: string;
  brokerAlignment?: string;
  costMessage?: string;
  requiredPolicyKey?: string;
  recommendedDirective?: string;
}

/** One response option of a national issue: its effects, its recommended directive and a two-step choose. */
export function OptionCard({
  option,
  isConfirming,
  isPending,
  onChoose,
  onCancel,
  onConfirm,
}: {
  option: ResponseOption;
  isConfirming: boolean;
  isPending: boolean;
  onChoose: () => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { previewEffects, isRisky } = option;
  const approval = previewEffects.publicApproval;
  const impacts = [
    ["Economy", previewEffects.economicImpact],
    ["Stability", previewEffects.stabilityImpact],
    ["Diplomacy", previewEffects.diplomaticImpact],
  ] as const;

  return (
    <Card
      className={cn(
        "rounded-row flex items-start justify-between gap-3 p-4 transition-[border-color,box-shadow] duration-150",
        isConfirming
          ? isRisky
            ? "border-destructive ring-destructive/40 ring-1"
            : "border-ring ring-tint ring-1"
          : isRisky
            ? "border-destructive/40"
            : "hover:border-ring/60"
      )}
    >
      <div className="min-w-0 flex-1">
        <h4 className={cn("text-headline mb-1", isRisky ? "text-destructive" : "text-label")}>
          {option.label}
        </h4>
        <p className="text-label-secondary text-footnote mb-2">{option.description}</p>

        <div className="text-footnote flex flex-wrap gap-2">
          {approval != null && approval !== 0 && (
            <EffectBadge label="Approval" value={approval} isNumeric />
          )}
          {impacts.map(
            ([label, impact]) => impact && <EffectBadge key={label} label={label} impact={impact} />
          )}
        </div>

        {option.recommendedDirective && (
          <p className="text-label-secondary bg-fill-3 rounded-control text-footnote mt-2 flex items-center gap-2 px-3 py-2">
            <Command className="h-3 w-3 shrink-0" />
            <span className="line-clamp-2">
              Recommended directive: &ldquo;{option.recommendedDirective}&rdquo;
            </span>
          </p>
        )}

        {isRisky && (
          <p className="text-destructive text-footnote mt-2 flex items-start gap-2 leading-snug">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Risky choice: it may backfire or hurt stability.
          </p>
        )}
      </div>

      <div className="shrink-0">
        {isConfirming ? (
          <div className="flex gap-2">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onCancel}
              aria-label="Cancel"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
            <Button
              type="button"
              size="sm"
              variant={isRisky ? "destructive" : "default"}
              onClick={onConfirm}
              disabled={isPending}
            >
              {isPending ? "Confirming…" : "Confirm"}
            </Button>
          </div>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={isRisky ? "text-destructive" : undefined}
            onClick={onChoose}
          >
            Choose
          </Button>
        )}
      </div>
    </Card>
  );
}

const IMPACT_TONE: Record<string, string> = {
  positive: "text-green",
  moderate_positive: "text-green",
  minor_positive: "text-green/80",
  negligible: "text-label-secondary",
  minor_negative: "text-destructive/80",
  moderate_negative: "text-destructive",
  significant_negative: "text-destructive",
  negative: "text-destructive",
};

function EffectBadge({
  label,
  value,
  impact,
  isNumeric,
}: {
  label: string;
  value?: number;
  impact?: string;
  isNumeric?: boolean;
}) {
  const chip = (tone: string, text: string) => (
    <span className={cn("inline-flex items-center gap-0.5 font-semibold", tone)}>{text}</span>
  );
  if (isNumeric && value != null) {
    const tone = value > 0 ? "text-green" : value < 0 ? "text-destructive" : "text-label-secondary";
    return chip(tone, `${value > 0 ? "+" : ""}${value} ${label}`);
  }
  if (!impact) return null;
  // A tone keyword ("positive") reads as the coloured label alone; free text is the effect itself.
  const tone = IMPACT_TONE[impact];
  return tone ? chip(tone, label) : chip("text-label-secondary", `${label}: ${impact}`);
}
