"use client";

import React, { useCallback } from "react";
import { Languages, Heart, Music, Sparkles } from "lucide-react";
import { EnhancedNumberInput } from "../../../primitives/enhanced";
import { IdentityAutocomplete } from "./IdentityAutocomplete";
import { GlassCard, GlassCardContent } from "../../glass/GlassCard";
import type { NationalIdentityData } from "~/app/builder/lib/economy-data-service";

interface CultureFormProps {
  identity: NationalIdentityData;
  onIdentityChange: (field: keyof NationalIdentityData, value: any) => void;
  onFieldSave: (fieldName: string, value: string) => void;
}

export const CultureForm = React.memo(
  function CultureForm({ identity, onIdentityChange, onFieldSave }: CultureFormProps) {
    // Memoize all change handlers with empty deps since parent callback is stable
    const handleMottoChange = useCallback((value: any) => {
      onIdentityChange("motto", String(value));
    }, []);

    const handleMottoNativeChange = useCallback((value: any) => {
      onIdentityChange("mottoNative", String(value));
    }, []);

    const handleOfficialLanguagesChange = useCallback((value: string) => {
      onIdentityChange("officialLanguages", value);
    }, []);

    const handleNationalLanguageChange = useCallback((value: string) => {
      onIdentityChange("nationalLanguage", value);
    }, []);

    const handleNationalAnthemChange = useCallback((value: any) => {
      onIdentityChange("nationalAnthem", String(value));
    }, []);

    const handleNationalReligionChange = useCallback((value: any) => {
      onIdentityChange("nationalReligion", String(value));
    }, []);

    const handleNationalDayChange = useCallback((value: any) => {
      onIdentityChange("nationalDay", String(value));
    }, []);

    return (
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Aspirations & Symbols Card */}
        <GlassCard
          depth="base"
          theme="gold"
          className="border-amber-500/20"
          texture="chevron"
          textureOpacity={0.06}
        >
          <div className="border-border/40 border-b bg-white/[0.02] px-6 py-4 dark:bg-black/[0.1]">
            <h3 className="text-foreground flex items-center gap-2 text-base font-bold">
              <Sparkles className="h-5 w-5 text-yellow-400" />
              Aspirations & Symbols
            </h3>
          </div>
          <GlassCardContent className="space-y-4 p-6">
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

            <EnhancedNumberInput
              label="National Anthem"
              icon={Music}
              value={String(identity.nationalAnthem || "")}
              onChange={handleNationalAnthemChange}
              sectionId="symbols"
              showButtons={false}
              placeholder="Name of national anthem"
              acceptText={true}
            />
          </GlassCardContent>
        </GlassCard>

        {/* Social & Civic Profile Card */}
        <GlassCard
          depth="base"
          theme="indigo"
          className="border-indigo-500/20"
          texture="chevron"
          textureOpacity={0.06}
        >
          <div className="border-border/40 border-b bg-white/[0.02] px-6 py-4 dark:bg-black/[0.1]">
            <h3 className="text-foreground flex items-center gap-2 text-base font-bold">
              <Languages className="h-5 w-5 text-indigo-400" />
              Social & Civic Profile
            </h3>
          </div>
          <GlassCardContent className="space-y-4 p-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
            </div>

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
          </GlassCardContent>
        </GlassCard>
      </div>
    );
  },
  (prevProps, nextProps) => {
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
  }
);
