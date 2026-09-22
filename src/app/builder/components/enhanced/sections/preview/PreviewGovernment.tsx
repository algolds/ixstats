"use client";

import React, { memo } from "react";
import {
  City as Building2,
  Crown,
  Bank as Landmark,
  ScaleFrameEnlarge as Scale,
  User,
  Shield,
} from "iconoir-react";
import { Badge } from "~/components/ui/badge";
import type { ComponentType } from "~/lib/enums";
import type { GovernmentBuilderState } from "~/types/government";
import { ATOMIC_COMPONENTS } from "~/components/mycountry/domains/government/atoms/AtomicGovernmentComponents";
import { formatCurrency } from "~/lib/utils";

interface PreviewGovernmentProps {
  governmentStructure: GovernmentBuilderState | null;
  governmentComponents: ComponentType[];
  currency?: string;
}

export const PreviewGovernment = memo(function PreviewGovernment({
  governmentStructure,
  governmentComponents,
  currency = "USD",
}: PreviewGovernmentProps) {
  const structure = governmentStructure?.structure;

  if (!structure && governmentComponents.length === 0) {
    return (
      <div className="py-8 text-center">
        <Building2 className="mx-auto mb-3 h-10 w-10 text-muted-foreground/60" />
        <p className="text-sm text-muted-foreground">No government structure configured</p>
      </div>
    );
  }

  const govType = structure?.governmentType || "Republic";
  const headOfState = structure?.headOfState;
  const headOfGovernment = structure?.headOfGovernment;
  const legislature = structure?.legislatureName;
  const judicial = structure?.judicialName;
  const totalBudget = structure?.totalBudget;
  const fiscalYear = structure?.fiscalYear || "Calendar Year";

  return (
    <div className="space-y-5">
      {/* Government Details & Leadership */}
      <div className="rounded-xl border border-border/40 bg-card/30 p-4 backdrop-blur-md">
        <h4 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <Landmark className="h-3.5 w-3.5 text-primary" />
          Structure
        </h4>

        <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-0.5">
            <dt className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Government Type
            </dt>
            <dd className="text-xs font-semibold text-foreground break-words">{govType}</dd>
          </div>

          <div className="space-y-0.5">
            <dt className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Fiscal Year
            </dt>
            <dd className="text-xs font-medium text-foreground">{fiscalYear}</dd>
          </div>

          {headOfState && (
            <div className="space-y-0.5">
              <dt className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                <Crown className="h-3 w-3 text-amber-500" />
                Head of State
              </dt>
              <dd className="text-xs font-medium text-foreground break-words">{headOfState}</dd>
            </div>
          )}

          {headOfGovernment && (
            <div className="space-y-0.5">
              <dt className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                <User className="h-3 w-3 text-primary" />
                Head of Government
              </dt>
              <dd className="text-xs font-medium text-foreground break-words">{headOfGovernment}</dd>
            </div>
          )}

          {legislature && (
            <div className="space-y-0.5">
              <dt className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Legislature
              </dt>
              <dd className="text-xs font-medium text-foreground break-words">{legislature}</dd>
            </div>
          )}

          {judicial && (
            <div className="space-y-0.5">
              <dt className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                <Scale className="h-3 w-3 text-primary" />
                Judiciary
              </dt>
              <dd className="text-xs font-medium text-foreground break-words">{judicial}</dd>
            </div>
          )}

          {totalBudget && totalBudget > 0 ? (
            <div className="space-y-0.5">
              <dt className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Total Budget
              </dt>
              <dd className="text-xs font-medium text-foreground">
                {formatCurrency(totalBudget, currency)}
              </dd>
            </div>
          ) : null}
        </dl>
      </div>

      {/* Selected Institutions / Components */}
      <div className="space-y-2.5">
        <h4 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <Shield className="h-3.5 w-3.5 text-primary" />
          Institutions
        </h4>

        {governmentComponents.length === 0 ? (
          <div className="rounded-xl border border-border/30 bg-muted/20 p-3 text-center text-xs text-muted-foreground">
            Standard baseline institutions active
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {governmentComponents.map((compType) => {
              const meta = ATOMIC_COMPONENTS[compType as keyof typeof ATOMIC_COMPONENTS];
              const name = meta?.name || compType.replace(/_/g, " ").toLowerCase();
              const category = meta?.category || "Policy";

              return (
                <div
                  key={compType}
                  className="flex items-center justify-between rounded-lg border border-border/40 bg-card/40 px-3 py-2 text-xs backdrop-blur-md transition-colors hover:border-border/60"
                >
                  <span className="font-medium text-foreground capitalize truncate max-w-[70%]">
                    {name}
                  </span>
                  <Badge
                    variant="outline"
                    className="border-border/60 text-[10px] uppercase tracking-wider text-muted-foreground"
                  >
                    {category}
                  </Badge>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
});

PreviewGovernment.displayName = "PreviewGovernment";
