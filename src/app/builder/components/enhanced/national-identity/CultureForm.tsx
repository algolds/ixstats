"use client";

import React, { useCallback, useState } from "react";
import dynamic from "next/dynamic";
import { Languages, Heart, Music, Sparkles, ChevronDown, ChevronUp, Globe, Trophy, Rabbit, Bird, Fish, Users, Flower2, UtensilsCrossed, Apple, Wine, Guitar, Star, Image, X } from "lucide-react";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "~/components/ui/collapsible";
import { EnhancedNumberInput } from "../../../primitives/enhanced";
import { IdentityAutocomplete } from "./IdentityAutocomplete";
import { CurrencyAutocomplete } from "./CurrencyAutocomplete";
import { GlassCard, GlassCardContent } from "../../glass/GlassCard";
import type { NationalIdentityData } from "~/app/builder/lib/economy-data-service";

const MediaSearchModal = dynamic(
  () => import("~/components/MediaSearchModal").then((m) => m.MediaSearchModal),
  { ssr: false }
);

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

    const handleNationalSportChange = useCallback((value: any) => {
      onIdentityChange("nationalSport", String(value));
    }, []);

    const handleCurrencyChange = useCallback((value: string) => {
      onIdentityChange("currency", value);
    }, []);

    const handleCurrencySymbolChange = useCallback((symbol: string) => {
      onIdentityChange("currencySymbol", symbol);
    }, []);

    const [isNativeMottoOpen, setIsNativeMottoOpen] = useState(false);
    const [isSymbolsOpen, setIsSymbolsOpen] = useState(false);
    const [imagePickerField, setImagePickerField] = useState<string | null>(null);

    const handleImageSelect = useCallback((url: string) => {
      if (imagePickerField) {
        onIdentityChange(imagePickerField as keyof NationalIdentityData, url);
        setImagePickerField(null);
      }
    }, [imagePickerField, onIdentityChange]);

    return (
      <div className="grid grid-cols-1 gap-6 text-left lg:grid-cols-2">
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
              National Symbols
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

            <Collapsible open={isNativeMottoOpen} onOpenChange={setIsNativeMottoOpen}>
              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-lg border border-amber-500/20 px-4 py-2 text-sm text-amber-600/70 hover:bg-amber-50/[0.04] dark:text-amber-400/60"
                >
                  <Globe className="h-3.5 w-3.5" />
                  <span>National Motto (Native Language)</span>
                  {isNativeMottoOpen ? (
                    <ChevronUp className="ml-auto h-3.5 w-3.5" />
                  ) : (
                    <ChevronDown className="ml-auto h-3.5 w-3.5" />
                  )}
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="pt-3">
                  <EnhancedNumberInput
                    label=""
                    value={String(identity.mottoNative || "")}
                    onChange={handleMottoNativeChange}
                    sectionId="symbols"
                    showButtons={false}
                    placeholder="Original language version"
                    acceptText={true}
                  />
                </div>
              </CollapsibleContent>
            </Collapsible>

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

            <div className="border-border/20 border-t pt-4">
              <Collapsible open={isSymbolsOpen} onOpenChange={setIsSymbolsOpen}>
                <CollapsibleTrigger asChild>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 text-sm font-semibold text-amber-600/70 hover:text-amber-600 dark:text-amber-400/60 dark:hover:text-amber-400"
                  >
                    <Star className="h-4 w-4 text-yellow-400" />
                    <span>Additional National Symbols</span>
                    {isSymbolsOpen ? (
                      <ChevronUp className="ml-auto h-4 w-4" />
                    ) : (
                      <ChevronDown className="ml-auto h-4 w-4" />
                    )}
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {([
                      ["nationalAnimal", "National Animal(s)", Rabbit, "Bald Eagle, Lion, Panda...", "nationalAnimalImage"],
                      ["nationalBird", "National Bird(s)", Bird, "Robin, Phoenix, Eagle...", "nationalBirdImage"],
                      ["nationalFish", "National Fish", Fish, "Salmon, Koi, Cod...", "nationalFishImage"],
                      ["founders", "Founder(s)", Users, "Founding figures", "foundersImage"],
                      ["nationalFlower", "National Flower(s) & Plants", Flower2, "Rose, Lotus, Cherry Blossom...", "nationalFlowerImage"],
                      ["nationalDish", "National Dish(es) & Food", UtensilsCrossed, "Pizza, Sushi, Tacos...", "nationalDishImage"],
                      ["nationalFruit", "Fruit(s)", Apple, "Mango, Apple, Durian...", "nationalFruitImage"],
                      ["nationalDrink", "Drink(s)", Wine, "Tea, Coffee, Wine...", "nationalDrinkImage"],
                      ["nationalInstrument", "National Instrument(s)", Guitar, "Sitar, Bagpipes, Drum...", "nationalInstrumentImage"],
                      ["nationalSymbol", "Other Custom Symbol(s)", Star, "Any other national symbol", "nationalSymbolImage"],
                    ] as const).map(([key, label, Icon, placeholder, imageKey]) => (
                      <div key={key} className="flex items-start gap-2">
                        <div className="min-w-0 flex-1">
                          <EnhancedNumberInput
                            label={label}
                            value={String((identity as any)[key] || "")}
                            onChange={(v: any) => onIdentityChange(key as keyof NationalIdentityData, String(v))}
                            sectionId="symbols"
                            icon={Icon}
                            showButtons={false}
                            placeholder={placeholder}
                            acceptText={true}
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => setImagePickerField(imageKey)}
                          className="mt-6 shrink-0 rounded-md p-1 hover:bg-amber-50/10"
                          title="Add or change image"
                        >
                          {(identity as any)[imageKey] ? (
                            <div className="group relative">
                              <img
                                src={(identity as any)[imageKey]}
                                alt=""
                                className="h-9 w-9 rounded-md border border-amber-500/20 object-cover"
                              />
                              <div className="absolute inset-0 flex items-center justify-center rounded-md bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                                <Image className="h-4 w-4 text-white" />
                              </div>
                            </div>
                          ) : (
                            <div className="flex h-9 w-9 items-center justify-center rounded-md border border-dashed border-amber-500/30 text-amber-400/40 hover:border-amber-500/60 hover:text-amber-400/70">
                              <Image className="h-4 w-4" />
                            </div>
                          )}
                        </button>
                      </div>
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </div>

            {imagePickerField && (
              <MediaSearchModal
                isOpen={true}
                onClose={() => setImagePickerField(null)}
                onSelect={handleImageSelect}
              />
            )}
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
              Society & Culture
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

            <EnhancedNumberInput
              label="National Sport"
              description="Most popular or official sport"
              value={String(identity.nationalSport || "")}
              onChange={handleNationalSportChange}
              sectionId="symbols"
              icon={Trophy}
              showButtons={false}
              placeholder="Football, Cricket, Hockey..."
              acceptText={true}
            />

            <div className="border-border/20 border-t pt-4">
              <CurrencyAutocomplete
                fieldName="currency"
                value={String(identity.currency || "")}
                onChange={handleCurrencyChange}
                placeholder="Select or enter currency"
                currencySymbol={identity.currencySymbol || "$"}
                onSymbolSelect={handleCurrencySymbolChange}
              />
            </div>
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
      prevProps.identity.nationalDay === nextProps.identity.nationalDay &&
      prevProps.identity.nationalSport === nextProps.identity.nationalSport &&
      prevProps.identity.nationalAnimal === nextProps.identity.nationalAnimal &&
      prevProps.identity.nationalBird === nextProps.identity.nationalBird &&
      prevProps.identity.nationalFish === nextProps.identity.nationalFish &&
      prevProps.identity.founders === nextProps.identity.founders &&
      prevProps.identity.nationalFlower === nextProps.identity.nationalFlower &&
      prevProps.identity.nationalDish === nextProps.identity.nationalDish &&
      prevProps.identity.nationalFruit === nextProps.identity.nationalFruit &&
      prevProps.identity.nationalDrink === nextProps.identity.nationalDrink &&
      prevProps.identity.nationalInstrument === nextProps.identity.nationalInstrument &&
      prevProps.identity.nationalSymbol === nextProps.identity.nationalSymbol &&
      prevProps.identity.nationalAnimalImage === nextProps.identity.nationalAnimalImage &&
      prevProps.identity.nationalBirdImage === nextProps.identity.nationalBirdImage &&
      prevProps.identity.nationalFishImage === nextProps.identity.nationalFishImage &&
      prevProps.identity.foundersImage === nextProps.identity.foundersImage &&
      prevProps.identity.nationalFlowerImage === nextProps.identity.nationalFlowerImage &&
      prevProps.identity.nationalDishImage === nextProps.identity.nationalDishImage &&
      prevProps.identity.nationalFruitImage === nextProps.identity.nationalFruitImage &&
      prevProps.identity.nationalDrinkImage === nextProps.identity.nationalDrinkImage &&
      prevProps.identity.nationalInstrumentImage === nextProps.identity.nationalInstrumentImage &&
      prevProps.identity.nationalSymbolImage === nextProps.identity.nationalSymbolImage &&
      prevProps.identity.currency === nextProps.identity.currency &&
      prevProps.identity.currencySymbol === nextProps.identity.currencySymbol
    );
  }
);
