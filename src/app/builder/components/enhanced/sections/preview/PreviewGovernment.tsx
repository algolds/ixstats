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
        <Building2 className="text-label-tertiary mx-auto mb-3 h-10 w-10" />
        <p className="text-body text-label-secondary">No government structure configured</p>
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
      <div className="rounded-row border-separator bg-surface border p-4">
        <h4 className="text-eyebrow text-label-secondary flex items-center gap-2">
          <Landmark className="text-tint h-3.5 w-3.5" />
          Structure
        </h4>

        <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-0.5">
            <dt className="text-eyebrow text-label-secondary">Government Type</dt>
            <dd className="text-caption text-label font-semibold break-words">{govType}</dd>
          </div>

          <div className="space-y-0.5">
            <dt className="text-eyebrow text-label-secondary">Fiscal Year</dt>
            <dd className="text-caption text-label">{fiscalYear}</dd>
          </div>

          {headOfState && (
            <div className="space-y-0.5">
              <dt className="text-eyebrow text-label-secondary flex items-center gap-1">
                <Crown className="text-tint h-3 w-3" />
                Head of State
              </dt>
              <dd className="text-caption text-label break-words">{headOfState}</dd>
            </div>
          )}

          {headOfGovernment && (
            <div className="space-y-0.5">
              <dt className="text-eyebrow text-label-secondary flex items-center gap-1">
                <User className="text-tint h-3 w-3" />
                Head of Government
              </dt>
              <dd className="text-caption text-label break-words">{headOfGovernment}</dd>
            </div>
          )}

          {legislature && (
            <div className="space-y-0.5">
              <dt className="text-eyebrow text-label-secondary">Legislature</dt>
              <dd className="text-caption text-label break-words">{legislature}</dd>
            </div>
          )}

          {judicial && (
            <div className="space-y-0.5">
              <dt className="text-eyebrow text-label-secondary flex items-center gap-1">
                <Scale className="text-tint h-3 w-3" />
                Judiciary
              </dt>
              <dd className="text-caption text-label break-words">{judicial}</dd>
            </div>
          )}

          {totalBudget && totalBudget > 0 ? (
            <div className="space-y-0.5">
              <dt className="text-eyebrow text-label-secondary">Total Budget</dt>
              <dd className="text-caption text-label">{formatCurrency(totalBudget, currency)}</dd>
            </div>
          ) : null}
        </dl>
      </div>

      {/* Selected Institutions / Components */}
      <div className="space-y-2">
        <h4 className="text-eyebrow text-label-secondary flex items-center gap-2">
          <Shield className="text-tint h-3.5 w-3.5" />
          Institutions
        </h4>

        {governmentComponents.length === 0 ? (
          <div className="rounded-row border-separator bg-fill-4 text-footnote text-label-secondary border p-3 text-center">
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
                  className="rounded-control border-separator bg-surface text-footnote hover:border-separator flex items-center justify-between border px-3 py-2 transition-colors"
                >
                  <span className="text-label max-w-[70%] truncate font-medium capitalize">
                    {name}
                  </span>
                  <Badge
                    variant="outline"
                    className="border-separator text-eyebrow text-label-secondary"
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
