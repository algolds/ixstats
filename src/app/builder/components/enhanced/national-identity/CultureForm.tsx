"use client";

import React, { useCallback } from "react";
import { Languages, Heart } from "lucide-react";
import { EnhancedNumberInput } from "../../../primitives/enhanced";
import { IdentityAutocomplete } from "./IdentityAutocomplete";
import type { NationalIdentityData } from "~/app/builder/lib/economy-data-service";

interface CultureFormProps {
  identity: NationalIdentityData;
  onIdentityChange: (field: keyof NationalIdentityData, value: any) => void;
  onFieldSave: (fieldName: string, value: string) => void;
}

export const CultureForm = React.memo(function CultureForm({
  identity,
  onIdentityChange,
  onFieldSave,
}: CultureFormProps) {
  // Memoize all change handlers with empty deps since parent callback is stable
  const handleMottoChange = useCallback(
    (value: any) => {
      onIdentityChange("motto", String(value));
    },
    []
  );

  const handleMottoNativeChange = useCallback(
    (value: any) => {
      onIdentityChange("mottoNative", String(value));
    },
    []
  );

  const handleOfficialLanguagesChange = useCallback(
    (value: string) => {
      onIdentityChange("officialLanguages", value);
    },
    []
  );

  const handleNationalLanguageChange = useCallback(
    (value: string) => {
      onIdentityChange("nationalLanguage", value);
    },
    []
  );

  const handleNationalAnthemChange = useCallback(
    (value: any) => {
      onIdentityChange("nationalAnthem", String(value));
    },
    []
  );

  const handleNationalReligionChange = useCallback(
    (value: any) => {
      onIdentityChange("nationalReligion", String(value));
    },
    []
  );

  const handleNationalDayChange = useCallback(
    (value: any) => {
      onIdentityChange("nationalDay", String(value));
    },
    []
  );

  return (
    <>
      {/* Mottos Section */}
      <div className="space-y-4">
        <h4 className="text-lg font-semibold">National Mottos</h4>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <EnhancedNumberInput
            label="National Motto (English)"
            value={String(identity.motto || "")}
            onChange={handleMottoChange}
            sectionId="symbols"
            showButtons={false}
            placeholder="E pluribus unum, Liberty, Equality, Fraternity..."
            acceptText={true}
          />

          <EnhancedNumberInput
            label="National Motto (Native Language)"
            value={String(identity.mottoNative || "")}
            onChange={handleMottoNativeChange}
            sectionId="symbols"
            showButtons={false}
            placeholder="Original language version"
            acceptText={true}
          />
        </div>
      </div>

      {/* Languages & Culture Section */}
      <div className="space-y-4">
        <h4 className="text-lg font-semibold">Languages & Culture</h4>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <IdentityAutocomplete
            fieldName="officialLanguages"
            value={String(identity.officialLanguages || "")}
            onChange={handleOfficialLanguagesChange}
            placeholder="English, Spanish, French..."
            icon={Languages}
            onSave={onFieldSave}
          />

          <IdentityAutocomplete
            fieldName="nationalLanguage"
            value={String(identity.nationalLanguage || "")}
            onChange={handleNationalLanguageChange}
            placeholder="Primary language"
            icon={Languages}
            onSave={onFieldSave}
          />

          <EnhancedNumberInput
            label="National Anthem"
            value={String(identity.nationalAnthem || "")}
            onChange={handleNationalAnthemChange}
            sectionId="symbols"
            showButtons={false}
            placeholder="Name of national anthem"
            acceptText={true}
          />

          <EnhancedNumberInput
            label="National Religion"
            description="Primary or state religion (if applicable)"
            value={String(identity.nationalReligion || "")}
            onChange={handleNationalReligionChange}
            sectionId="symbols"
            icon={Heart}
            showButtons={false}
            placeholder="e.g., Christianity, Islam, Buddhism, Secular..."
            acceptText={true}
          />

          <EnhancedNumberInput
            label="National Day"
            description="Independence or national celebration day"
            value={String(identity.nationalDay || "")}
            onChange={handleNationalDayChange}
            sectionId="symbols"
            showButtons={false}
            placeholder="July 4th, December 1st..."
            acceptText={true}
          />
        </div>
      </div>
    </>
  );
}, (prevProps, nextProps) => {
  // Custom comparison to prevent re-renders
  return (
    prevProps.identity.motto === nextProps.identity.motto &&
    prevProps.identity.mottoNative === nextProps.identity.mottoNative &&
    prevProps.identity.officialLanguages === nextProps.identity.officialLanguages &&
    prevProps.identity.nationalLanguage === nextProps.identity.nationalLanguage &&
    prevProps.identity.nationalAnthem === nextProps.identity.nationalAnthem &&
    prevProps.identity.nationalReligion === nextProps.identity.nationalReligion &&
    prevProps.identity.nationalDay === nextProps.identity.nationalDay
  );
});
