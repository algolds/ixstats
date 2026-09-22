"use client";

import React, { memo } from "react";
import {
  WhiteFlag as Flag,
  Globe,
  Crown,
  Calendar,
  Phone,
  Translate as Languages,
} from "iconoir-react";
import { UnifiedCountryFlag } from "~/components/ui/UnifiedCountryFlag";
import type { EconomicInputs } from "~/app/builder/lib/economy-data-service";

interface PreviewIdentityProps {
  economicInputs: EconomicInputs | null;
}

export const PreviewIdentity = memo(function PreviewIdentity({
  economicInputs,
}: PreviewIdentityProps) {
  const nationalIdentity = economicInputs?.nationalIdentity;

  if (!nationalIdentity) {
    return (
      <div className="py-8 text-center">
        <Flag className="mx-auto mb-3 h-10 w-10 text-muted-foreground/60" />
        <p className="text-sm text-muted-foreground">No national identity configured</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Flag and Coat of Arms Badges */}
      <div className="flex items-center justify-center gap-6">
        {/* Flag */}
        <div className="relative flex h-16 w-28 items-center justify-center overflow-hidden rounded-xl border border-border/50 bg-card/60 p-1 shadow-sm backdrop-blur-md transition-all duration-300 hover:border-primary/40 hover:shadow-md">
          {economicInputs?.flagUrl || nationalIdentity.countryName ? (
            <UnifiedCountryFlag
              countryName={nationalIdentity.countryName}
              size="lg"
              className="h-full w-full rounded-lg object-cover"
            />
          ) : (
            <Flag className="h-6 w-6 text-muted-foreground/50" />
          )}
        </div>

        {/* Coat of Arms */}
        {economicInputs?.coatOfArmsUrl && (
          <div className="relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-xl border border-border/50 bg-card/60 p-1.5 shadow-sm backdrop-blur-md transition-all duration-300 hover:border-primary/40 hover:shadow-md">
            <img
              src={economicInputs.coatOfArmsUrl}
              alt="Coat of Arms"
              className="h-full w-full object-contain"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
          </div>
        )}
      </div>

      {/* Identity Details Bento Columns */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* Basic Info */}
        <div className="rounded-xl border border-border/40 bg-card/30 p-4 backdrop-blur-md">
          <h4 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <Globe className="h-3.5 w-3.5 text-primary" />
            Basic Info
          </h4>
          <dl className="mt-3 space-y-2.5">
            <div className="space-y-0.5">
              <dt className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Common Name
              </dt>
              <dd className="text-xs font-semibold text-foreground break-words">
                {nationalIdentity.countryName}
              </dd>
            </div>
            {nationalIdentity.officialName && (
              <div className="space-y-0.5">
                <dt className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  Official Title
                </dt>
                <dd className="text-xs font-medium text-foreground break-words">
                  {nationalIdentity.officialName}
                </dd>
              </div>
            )}
            <div className="grid grid-cols-2 gap-2 pt-0.5">
              <div className="space-y-0.5">
                <dt className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  Capital
                </dt>
                <dd className="text-xs font-medium text-foreground truncate">
                  {nationalIdentity.capitalCity || "Unspecified"}
                </dd>
              </div>
              <div className="space-y-0.5">
                <dt className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  Largest City
                </dt>
                <dd className="text-xs font-medium text-foreground truncate">
                  {nationalIdentity.largestCity || nationalIdentity.capitalCity || "Unspecified"}
                </dd>
              </div>
            </div>
            {nationalIdentity.callingCode && (
              <div className="space-y-0.5 pt-0.5">
                <dt className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  Calling Code
                </dt>
                <dd className="text-xs font-medium text-foreground">
                  {nationalIdentity.callingCode}
                </dd>
              </div>
            )}
          </dl>
        </div>

        {/* Culture */}
        <div className="rounded-xl border border-border/40 bg-card/30 p-4 backdrop-blur-md">
          <h4 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <Languages className="h-3.5 w-3.5 text-primary" />
            Culture
          </h4>
          <dl className="mt-3 space-y-2.5">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-0.5">
                <dt className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  Demonym
                </dt>
                <dd className="text-xs font-medium text-foreground truncate">
                  {nationalIdentity.demonym || "Citizen"}
                </dd>
              </div>
              <div className="space-y-0.5">
                <dt className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  Language
                </dt>
                <dd className="text-xs font-medium text-foreground truncate">
                  {nationalIdentity.officialLanguages || "English"}
                </dd>
              </div>
            </div>

            {nationalIdentity.nationalReligion && (
              <div className="space-y-0.5">
                <dt className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  Religion
                </dt>
                <dd className="text-xs font-medium text-foreground truncate">
                  {nationalIdentity.nationalReligion}
                </dd>
              </div>
            )}

            {nationalIdentity.motto && (
              <div className="space-y-0.5">
                <dt className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  Motto
                </dt>
                <dd className="text-xs font-medium italic text-foreground break-words">
                  &ldquo;{nationalIdentity.motto.replace(/^\*+|\*+$/g, "").trim()}&rdquo;
                </dd>
              </div>
            )}

            {nationalIdentity.nationalAnthem && (
              <div className="space-y-0.5">
                <dt className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  Anthem
                </dt>
                <dd className="text-xs font-medium text-foreground break-words">
                  {nationalIdentity.nationalAnthem}
                </dd>
              </div>
            )}

            {nationalIdentity.nationalDay && (
              <div className="space-y-0.5">
                <dt className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  National Day
                </dt>
                <dd className="text-xs font-medium text-foreground">
                  {nationalIdentity.nationalDay}
                </dd>
              </div>
            )}
          </dl>
        </div>
      </div>
    </div>
  );
});

PreviewIdentity.displayName = "PreviewIdentity";
