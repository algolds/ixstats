"use client";

import React from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Archery as Target, WarningTriangle as AlertTriangle, ArrowUpRight } from "iconoir-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "~/components/ui/sheet";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import { DOMAIN_META, type MyCountryDomain } from "./domain-meta";
import { IntentDetail } from "./IntentDetail";
import { IssueDetailBrief } from "~/components/mycountry/shared/headers/IssueDetailBrief";

const PoliticsDrillDown = dynamic(
  () => import("./PoliticsDrillDown").then((m) => ({ default: m.PoliticsDrillDown })),
  { loading: () => <Skeleton className="rounded-card h-64" />, ssr: false }
);

const EconomyDrillDown = dynamic(
  () => import("./EconomyDrillDown").then((m) => ({ default: m.EconomyDrillDown })),
  { loading: () => <Skeleton className="rounded-card h-64" />, ssr: false }
);

const EmbassiesAndRelationsPanel = dynamic(
  () =>
    import("~/components/mycountry/domains/diplomacy/EmbassiesAndRelationsPanel").then((m) => ({
      default: m.EmbassiesAndRelationsPanel,
    })),
  { loading: () => <Skeleton className="rounded-card h-64" /> }
);

const DefenseCommandPanel = dynamic(
  () =>
    import("~/components/mycountry/domains/defense/DefenseCommandPanel").then((m) => ({
      default: m.DefenseCommandPanel,
    })),
  { loading: () => <Skeleton className="rounded-card h-64" /> }
);

/** What a drill sheet shows. */
export type DrillSheetKind =
  | { kind: "intent"; intentId: string }
  | { kind: "issue"; issueId: string }
  | { kind: "relations" }
  | { kind: "defense" }
  | { kind: "politics" }
  | { kind: "economy" }
  | null;

interface DrillSheetsProps {
  drill: DrillSheetKind;
  onClose: () => void;
  countryId: string;
  onDeclare?: (prefilledGoal?: string) => void;
}

function sheetHeading(drill: DrillSheetKind) {
  if (!drill) return { title: "", Icon: Target, meta: null, domainKind: null };
  if (drill.kind === "intent")
    return { title: "Directive Detail", Icon: Target, meta: null, domainKind: null };
  if (drill.kind === "issue")
    return { title: "Issue Brief", Icon: AlertTriangle, meta: null, domainKind: null };
  const meta = DOMAIN_META[drill.kind as MyCountryDomain];
  return {
    title: meta?.sheetTitle ?? "",
    Icon: meta?.icon ?? Target,
    meta,
    domainKind: drill.kind,
  };
}

function DrillSheetsComponent({
  drill,
  onClose,
  countryId,
  onDeclare,
}: DrillSheetsProps): React.JSX.Element {
  const { title, Icon, meta, domainKind } = sheetHeading(drill);

  return (
    <Sheet open={drill !== null} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="right"
        className="border-separator bg-surface w-full overflow-y-auto backdrop-blur-xl sm:max-w-xl lg:max-w-2xl"
      >
        <SheetHeader className="mb-4">
          <div className="flex items-center justify-between gap-2">
            <SheetTitle className="text-headline flex items-center gap-3">
              <Icon aria-hidden="true" className="text-label-secondary size-5 shrink-0" />
              {title}
            </SheetTitle>
            {domainKind && (
              <Button asChild variant="outline" size="sm" className="shrink-0">
                <Link
                  href={`/countries/${encodeURIComponent(countryId)}#${domainKind}`}
                  target="_blank"
                >
                  Open page
                  <span className="sr-only"> (opens in a new tab)</span>
                  <ArrowUpRight aria-hidden="true" />
                </Link>
              </Button>
            )}
          </div>
          {drill && drill.kind !== "intent" && (
            <SheetDescription className="text-label-secondary text-footnote">
              {meta?.blurb}
            </SheetDescription>
          )}
        </SheetHeader>

        {drill?.kind === "intent" && (
          <IntentDetail
            countryId={countryId}
            intentId={drill.intentId}
            onDeclare={onDeclare}
            onClose={onClose}
          />
        )}
        {drill?.kind === "issue" && (
          <IssueDetailBrief issueId={drill.issueId} onDeclare={onDeclare} onClose={onClose} />
        )}
        {drill?.kind === "relations" && <EmbassiesAndRelationsPanel countryId={countryId} />}
        {drill?.kind === "defense" && <DefenseCommandPanel countryId={countryId} />}
        {drill?.kind === "politics" && <PoliticsDrillDown countryId={countryId} />}
        {drill?.kind === "economy" && <EconomyDrillDown countryId={countryId} />}
      </SheetContent>
    </Sheet>
  );
}

export const DrillSheets = React.memo(DrillSheetsComponent);
