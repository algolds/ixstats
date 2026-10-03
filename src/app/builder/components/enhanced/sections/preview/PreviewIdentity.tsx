"use client";

import React, { memo } from "react";
import {
  WhiteFlag as Flag,
  Globe,
  Translate as Languages,
} from "iconoir-react";
import { UnifiedCountryFlag } from "~/components/shared/flags/UnifiedCountryFlag";
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
        <Flag className="text-label-tertiary mx-auto mb-3 h-10 w-10" />
        <p className="text-body text-label-secondary">No national identity configured</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Flag and Coat of Arms Badges */}
      <div className="flex items-center justify-center gap-6">
        {/* Flag */}
        <div className="rounded-row border-separator bg-surface shadow-card hover:border-tint/40 hover:shadow-card relative flex h-16 w-28 items-center justify-center overflow-hidden border p-1 transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-300">
          {economicInputs?.flagUrl || nationalIdentity.countryName ? (
            <UnifiedCountryFlag
              countryName={nationalIdentity.countryName}
              size="lg"
              className="rounded-control h-full w-full object-cover"
            />
          ) : (
            <Flag className="text-label-tertiary h-6 w-6" />
          )}
        </div>

        {/* Coat of Arms */}
        {economicInputs?.coatOfArmsUrl && (
          <div className="rounded-row border-separator bg-surface shadow-card hover:border-tint/40 hover:shadow-card relative flex h-16 w-16 items-center justify-center overflow-hidden border p-2 transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-300">
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
        <div className="rounded-row border-separator bg-surface border p-4">
          <h3 className="text-eyebrow text-label-secondary flex items-center gap-2">
            <Globe className="text-tint h-3.5 w-3.5" />
            Basic info
          </h3>
          <dl className="mt-3 space-y-2">
            <div className="space-y-0.5">
              <dt className="text-eyebrow text-label-secondary">Common name</dt>
              <dd className="text-caption text-label font-semibold break-words">
                {nationalIdentity.countryName}
              </dd>
            </div>
            {nationalIdentity.officialName && (
              <div className="space-y-0.5">
                <dt className="text-eyebrow text-label-secondary">Official title</dt>
                <dd className="text-caption text-label break-words">
                  {nationalIdentity.officialName}
                </dd>
              </div>
            )}
            <div className="grid grid-cols-2 gap-2 pt-0.5">
              <div className="space-y-0.5">
                <dt className="text-eyebrow text-label-secondary">Capital</dt>
                <dd className="text-caption text-label truncate">
                  {nationalIdentity.capitalCity || "Unspecified"}
                </dd>
              </div>
              <div className="space-y-0.5">
                <dt className="text-eyebrow text-label-secondary">Largest city</dt>
                <dd className="text-caption text-label truncate">
                  {nationalIdentity.largestCity || nationalIdentity.capitalCity || "Unspecified"}
                </dd>
              </div>
            </div>
            {nationalIdentity.callingCode && (
              <div className="space-y-0.5 pt-0.5">
                <dt className="text-eyebrow text-label-secondary">Calling code</dt>
                <dd className="text-caption text-label">{nationalIdentity.callingCode}</dd>
              </div>
            )}
          </dl>
        </div>

        {/* Culture */}
        <div className="rounded-row border-separator bg-surface border p-4">
          <h3 className="text-eyebrow text-label-secondary flex items-center gap-2">
            <Languages className="text-tint h-3.5 w-3.5" />
            Culture
          </h3>
          <dl className="mt-3 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-0.5">
                <dt className="text-eyebrow text-label-secondary">Demonym</dt>
                <dd className="text-caption text-label truncate">
                  {nationalIdentity.demonym || "Citizen"}
                </dd>
              </div>
              <div className="space-y-0.5">
                <dt className="text-eyebrow text-label-secondary">Language</dt>
                <dd className="text-caption text-label truncate">
                  {nationalIdentity.officialLanguages || "English"}
                </dd>
              </div>
            </div>

            {nationalIdentity.nationalReligion && (
              <div className="space-y-0.5">
                <dt className="text-eyebrow text-label-secondary">Religion</dt>
                <dd className="text-caption text-label truncate">
                  {nationalIdentity.nationalReligion}
                </dd>
              </div>
            )}

            {nationalIdentity.motto && (
              <div className="space-y-0.5">
                <dt className="text-eyebrow text-label-secondary">Motto</dt>
                <dd className="text-caption text-label break-words italic">
                  &ldquo;{nationalIdentity.motto.replace(/^\*+|\*+$/g, "").trim()}&rdquo;
                </dd>
              </div>
            )}

            {nationalIdentity.nationalAnthem && (
              <div className="space-y-0.5">
                <dt className="text-eyebrow text-label-secondary">Anthem</dt>
                <dd className="text-caption text-label break-words">
                  {nationalIdentity.nationalAnthem}
                </dd>
              </div>
            )}

            {nationalIdentity.nationalDay && (
              <div className="space-y-0.5">
                <dt className="text-eyebrow text-label-secondary">National day</dt>
                <dd className="text-caption text-label">{nationalIdentity.nationalDay}</dd>
              </div>
            )}
          </dl>
        </div>
      </div>
    </div>
  );
});

PreviewIdentity.displayName = "PreviewIdentity";
