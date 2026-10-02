"use client";

import React, { useCallback, useId, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import {
  Translate as Languages,
  Heart,
  MusicDoubleNote as Music,
  Sparks as Sparkles,
  NavArrowDown as ChevronDown,
  NavArrowUp as ChevronUp,
  Globe,
  Trophy,
  Eye as Rabbit,
  Eye as Bird,
  Fish,
  Group as Users,
  Flower as Flower2,
  Cutlery as UtensilsCrossed,
  Apple,
  GlassEmpty as Wine,
  MusicDoubleNote as Guitar,
  Star,
  MediaImage as Image,
  Plus,
} from "iconoir-react";
import { Input } from "~/components/ui/input";
import { Button, focusRing } from "~/components/ui/button";
import { IdentityAutocomplete } from "./IdentityAutocomplete";
import { CurrencyAutocomplete } from "./CurrencyAutocomplete";
import { CurrencyIcon } from "./CurrencyIcon";
import { soundEffects } from "~/lib/sound/cuelume";
import type { NationalIdentityData } from "~/app/builder/lib/economy-data-service";
import { cn, getCurrencyInfo } from "~/lib/utils";
import { POPULAR_LANGUAGES } from "./identityUtils";
import { IMAGE_SCRIM_LIGHT, IMAGE_SCRIM_TOUCH_BAND } from "~/app/builder/lib/image-scrim";
import { Card, CardContent } from "~/components/ui/card";

const MediaSearchModal = dynamic(
  () =>
    import("~/components/wiki-os/media-search/MediaSearchModal").then((m) => m.MediaSearchModal),
  { ssr: false }
);

interface CultureFormProps {
  identity: NationalIdentityData;
  onIdentityChange: <K extends keyof NationalIdentityData>(
    fieldOrFields: K | Partial<NationalIdentityData>,
    value?: NationalIdentityData[K]
  ) => void;
  onFieldSave?: (fieldName: string, value: string) => void;
}

interface HeritageItem {
  key: string;
  label: string;
  shortLabel: string;
  icon: React.ComponentType<{ className?: string }>;
  placeholder: string;
  imageKey: string;
}

const CORE_HERITAGE_SYMBOLS: HeritageItem[] = [
  {
    key: "nationalAnimal",
    label: "National Animal",
    shortLabel: "Animal",
    icon: Rabbit,
    placeholder: "e.g. Bald Eagle, Lion, Panda...",
    imageKey: "nationalAnimalImage",
  },
  {
    key: "nationalFlower",
    label: "National Flora / Flower",
    shortLabel: "Flora",
    icon: Flower2,
    placeholder: "e.g. Rose, Lotus, Cherry Blossom...",
    imageKey: "nationalFlowerImage",
  },
  {
    key: "nationalDish",
    label: "National Dish",
    shortLabel: "Dish",
    icon: UtensilsCrossed,
    placeholder: "e.g. Roast, Paella, Pho...",
    imageKey: "nationalDishImage",
  },
  {
    key: "founders",
    label: "Founding Figure(s)",
    shortLabel: "Founders",
    icon: Users,
    placeholder: "e.g. Founding fathers, monarchs...",
    imageKey: "foundersImage",
  },
];

const ADDITIONAL_HERITAGE_SYMBOLS: HeritageItem[] = [
  {
    key: "nationalBird",
    label: "National Bird",
    shortLabel: "Bird",
    icon: Bird,
    placeholder: "e.g. Phoenix, Robin, Falcon...",
    imageKey: "nationalBirdImage",
  },
  {
    key: "nationalFish",
    label: "National Aquatic Symbol",
    shortLabel: "Aquatic",
    icon: Fish,
    placeholder: "e.g. Salmon, Koi, Dolphin...",
    imageKey: "nationalFishImage",
  },
  {
    key: "nationalFruit",
    label: "National Fruit / Produce",
    shortLabel: "Produce",
    icon: Apple,
    placeholder: "e.g. Mango, Olive, Apple...",
    imageKey: "nationalFruitImage",
  },
  {
    key: "nationalDrink",
    label: "National Beverage",
    shortLabel: "Beverage",
    icon: Wine,
    placeholder: "e.g. Green Tea, Coffee, Wine...",
    imageKey: "nationalDrinkImage",
  },
  {
    key: "nationalInstrument",
    label: "National Instrument",
    shortLabel: "Instrument",
    icon: Guitar,
    placeholder: "e.g. Sitar, Bagpipes, Lute...",
    imageKey: "nationalInstrumentImage",
  },
  {
    key: "nationalSymbol",
    label: "Custom Heritage Emblem",
    shortLabel: "Custom Emblem",
    icon: Star,
    placeholder: "Any other national motif...",
    imageKey: "nationalSymbolImage",
  },
];

export const CultureForm = React.memo(
  function CultureForm({ identity, onIdentityChange, onFieldSave }: CultureFormProps) {
    const fieldId = useId();
    const [imagePickerField, setImagePickerField] = useState<string | null>(null);
    const [showAllMotifs, setShowAllMotifs] = useState(false);
    const [revealedKeys, setRevealedKeys] = useState<Set<string>>(new Set());

    const handleCurrencyChange = useCallback(
      (value: string, symbol?: string) => {
        if (symbol !== undefined) {
          onIdentityChange({
            currency: value,
            currencySymbol: symbol,
          });
        } else {
          onIdentityChange("currency", value);
        }
      },
      [onIdentityChange]
    );

    const handleCurrencySymbolChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        onIdentityChange("currencySymbol", e.target.value);
      },
      [onIdentityChange]
    );

    const handleImageSelect = useCallback(
      (url: string) => {
        if (imagePickerField) {
          soundEffects.bloom();
          onIdentityChange(imagePickerField as keyof NationalIdentityData, url);
          setImagePickerField(null);
        }
      },
      [imagePickerField, onIdentityChange]
    );

    // Filter additional motifs: show if showAllMotifs, in revealedKeys, or has data
    const visibleAdditionalSymbols = useMemo(() => {
      return ADDITIONAL_HERITAGE_SYMBOLS.filter((sym) => {
        if (showAllMotifs) return true;
        if (revealedKeys.has(sym.key)) return true;
        const text = identity[sym.key as keyof NationalIdentityData];
        const img = identity[sym.imageKey as keyof NationalIdentityData];
        return Boolean(
          (typeof text === "string" && text.trim()) || (typeof img === "string" && img.trim())
        );
      });
    }, [showAllMotifs, revealedKeys, identity]);

    // Symbols available to be added via chips
    const unrevealedSymbols = useMemo(() => {
      return ADDITIONAL_HERITAGE_SYMBOLS.filter((sym) => {
        if (showAllMotifs) return false;
        if (revealedKeys.has(sym.key)) return false;
        const text = identity[sym.key as keyof NationalIdentityData];
        const img = identity[sym.imageKey as keyof NationalIdentityData];
        return !Boolean(
          (typeof text === "string" && text.trim()) || (typeof img === "string" && img.trim())
        );
      });
    }, [showAllMotifs, revealedKeys, identity]);

    const handleRevealMotif = useCallback((key: string) => {
      soundEffects.toggle();
      setRevealedKeys((prev) => {
        const next = new Set(prev);
        next.add(key);
        return next;
      });
    }, []);

    const handleToggleShowAll = useCallback(() => {
      soundEffects.toggle();
      setShowAllMotifs((prev) => !prev);
    }, []);

    const renderSymbolCard = useCallback(
      ({ key, label, icon: Icon, placeholder, imageKey }: HeritageItem) => {
        const textVal = identity[key as keyof NationalIdentityData];
        const imgVal = identity[imageKey as keyof NationalIdentityData];
        const hasImage = typeof imgVal === "string" && imgVal !== "";

        return (
          <div key={key} className="bg-surface-secondary rounded-row flex items-center gap-3 p-3">
            {/* Media Thumbnail / Picker Trigger */}
            <button
              type="button"
              onClick={() => {
                soundEffects.press();
                setImagePickerField(imageKey);
              }}
              className={cn(
                "group border-separator bg-fill-3 rounded-control facet-press facet-press-sm facet-lift relative size-12 shrink-0 overflow-hidden border",
                focusRing
              )}
              title="Upload or search emblem on IxWiki"
              aria-label={`${hasImage ? "Change" : "Choose"} image for ${label}`}
              data-cuelume-press
            >
              {hasImage ? (
                <img src={imgVal} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="text-label-tertiary group-hover:text-teal group-focus-visible:text-teal flex h-full w-full items-center justify-center">
                  <Image aria-hidden="true" className="h-5 w-5" />
                </div>
              )}
              {/* Revealed on hover / keyboard focus; on touch (no hover) an image keeps an
                  always-visible edit band so the thumbnail reads as changeable. */}
              <span
                aria-hidden="true"
                className={cn(
                  "absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100",
                  IMAGE_SCRIM_LIGHT,
                  hasImage && IMAGE_SCRIM_TOUCH_BAND
                )}
              >
                <Image className="size-4 pointer-coarse:size-3" />
              </span>
            </button>

            {/* Text Input */}
            <div className="min-w-0 flex-1 space-y-1">
              <label
                htmlFor={`${fieldId}-${key}`}
                className="text-label text-caption flex items-center gap-1"
              >
                <Icon aria-hidden className="text-teal h-3.5 w-3.5" />
                <span>{label}</span>
              </label>
              <Input
                id={`${fieldId}-${key}`}
                value={typeof textVal === "string" ? textVal : ""}
                onChange={(e) =>
                  onIdentityChange(key as keyof NationalIdentityData, e.target.value)
                }
                placeholder={placeholder}
                className="text-footnote h-8"
              />
            </div>
          </div>
        );
      },
      [identity, onIdentityChange, fieldId]
    );

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-6 text-left lg:grid-cols-2">
          {/* Aspirations & Expressions Card */}
          <Card>
            <div className="border-separator border-b px-6 py-4">
              <h3 className="text-label text-headline flex items-center gap-2">
                <Sparkles className="text-tint h-5 w-5" />
                National Motto & Expressions
              </h3>
            </div>
            <CardContent className="space-y-4 p-6">
              {/* National Motto (Primary) */}
              <div className="space-y-2">
                <label
                  htmlFor={`${fieldId}-motto`}
                  className="text-label text-body flex items-center gap-2 font-medium"
                >
                  <Sparkles className="text-label-secondary h-4 w-4" />
                  National Motto
                </label>
                <p className="text-label-secondary text-footnote leading-tight">
                  The primary rallying cry or constitutional motto of your people
                </p>
                <Input
                  id={`${fieldId}-motto`}
                  value={identity.motto || ""}
                  onChange={(e) => onIdentityChange("motto", e.target.value)}
                  placeholder="e.g. Liberty, Equality, Fraternity • E pluribus unum"
                />
              </div>

              {/* Native Language Motto (Streamlined Inline Sub-field) */}
              <div className="bg-surface-secondary rounded-row space-y-2 p-3">
                <label
                  htmlFor={`${fieldId}-mottoNative`}
                  className="text-caption text-label flex items-center gap-2"
                >
                  <Globe className="h-3.5 w-3.5" />
                  <span>Native / Historical Language Motto (Optional)</span>
                </label>
                <Input
                  id={`${fieldId}-mottoNative`}
                  value={identity.mottoNative || ""}
                  onChange={(e) => onIdentityChange("mottoNative", e.target.value)}
                  placeholder="e.g. Liberté, égalité, fraternité"
                  className="text-footnote h-8 italic"
                />
              </div>

              {/* National Anthem */}
              <div className="space-y-2">
                <label
                  htmlFor={`${fieldId}-nationalAnthem`}
                  className="text-label text-body flex items-center gap-2 font-medium"
                >
                  <Music className="text-label-secondary h-4 w-4" />
                  National Anthem
                </label>
                <p className="text-label-secondary text-footnote leading-tight">
                  Title of the solemn or celebratory state anthem
                </p>
                <Input
                  id={`${fieldId}-nationalAnthem`}
                  value={identity.nationalAnthem || ""}
                  onChange={(e) => onIdentityChange("nationalAnthem", e.target.value)}
                  placeholder="e.g. The Star-Spangled Banner, La Marseillaise..."
                />
              </div>

              {/* Primary Religion */}
              <div className="space-y-2">
                <label
                  htmlFor={`${fieldId}-nationalReligion`}
                  className="text-label text-body flex items-center gap-2 font-medium"
                >
                  <Heart className="text-label-secondary h-4 w-4" />
                  Primary / State Religion
                </label>
                <p className="text-label-secondary text-footnote leading-tight">
                  Major religious tradition or secular constitutional designation
                </p>
                <Input
                  id={`${fieldId}-nationalReligion`}
                  value={identity.nationalReligion || ""}
                  onChange={(e) => onIdentityChange("nationalReligion", e.target.value)}
                  placeholder="e.g. Secular, Christianity, Islam, Buddhism, Pluralist..."
                />
              </div>

              {/* National Day & Sport Grid */}
              <div className="border-separator grid grid-cols-1 gap-4 border-t pt-2 sm:grid-cols-2">
                <div className="space-y-2">
                  <label
                    htmlFor={`${fieldId}-nationalDay`}
                    className="text-label text-body flex items-center gap-2 font-medium"
                  >
                    <span>National Day</span>
                  </label>
                  <Input
                    id={`${fieldId}-nationalDay`}
                    value={identity.nationalDay || ""}
                    onChange={(e) => onIdentityChange("nationalDay", e.target.value)}
                    placeholder="e.g. July 4th, Dec 1"
                  />
                </div>

                <div className="space-y-2">
                  <label
                    htmlFor={`${fieldId}-nationalSport`}
                    className="text-label text-body flex items-center gap-2 font-medium"
                  >
                    <Trophy className="text-label-secondary h-3.5 w-3.5" />
                    <span>National Sport</span>
                  </label>
                  <Input
                    id={`${fieldId}-nationalSport`}
                    value={identity.nationalSport || ""}
                    onChange={(e) => onIdentityChange("nationalSport", e.target.value)}
                    placeholder="e.g. Football, Cricket"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Languages & Currency Card */}
          <Card className="overflow-visible">
            <div className="border-separator border-b px-6 py-4">
              <h3 className="text-label text-headline flex items-center gap-2">
                <Languages className="text-indigo h-5 w-5" />
                Languages & Currency
              </h3>
              <p className="text-label-secondary text-footnote mt-0.5 leading-tight">
                Official languages, lingua franca, and national currency.
              </p>
            </div>
            <CardContent className="space-y-4 p-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <IdentityAutocomplete
                  fieldName="officialLanguages"
                  label="Primary Official Language"
                  value={String(identity.officialLanguages || "")}
                  onChange={(val) => onIdentityChange("officialLanguages", val)}
                  placeholder="e.g. English, French, Eldorian"
                  icon={Languages}
                  iconClassName="text-indigo"
                  defaultSuggestions={POPULAR_LANGUAGES}
                  size="sm"
                  onSave={onFieldSave}
                />

                <IdentityAutocomplete
                  fieldName="nationalLanguage"
                  label="National / Lingua Franca"
                  value={String(identity.nationalLanguage || "")}
                  onChange={(val) => onIdentityChange("nationalLanguage", val)}
                  placeholder="e.g. Regional tongue or dialect"
                  icon={Languages}
                  iconClassName="text-indigo"
                  defaultSuggestions={POPULAR_LANGUAGES}
                  size="sm"
                  onSave={onFieldSave}
                />
              </div>

              {/* Currency Selector */}
              <div className="border-separator space-y-4 border-t pt-4">
                <CurrencyAutocomplete
                  fieldName="currency"
                  value={String(identity.currency || "")}
                  onChange={handleCurrencyChange}
                  placeholder="Select or enter sovereign currency"
                  currencySymbol={identity.currencySymbol || "$"}
                />

                {identity.currency && !getCurrencyInfo(identity.currency).isISO && (
                  <div className="animate-in fade-in slide-in-from-top-1 bg-surface-secondary rounded-row flex items-center justify-between p-3">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <CurrencyIcon
                          code={identity.currency}
                          symbol={identity.currencySymbol || "$"}
                          className="text-indigo h-4 w-4"
                        />
                        <label
                          htmlFor={`${fieldId}-currencySymbol`}
                          className="text-caption text-label font-semibold"
                        >
                          Custom Currency Symbol
                        </label>
                      </div>
                      <p className="text-label-secondary text-footnote">
                        Symbol placed before amounts (e.g. ₮, ℳ, ©, Cr)
                      </p>
                    </div>
                    <Input
                      id={`${fieldId}-currencySymbol`}
                      value={identity.currencySymbol || "$"}
                      onChange={handleCurrencySymbolChange}
                      placeholder="$"
                      className="text-headline h-8 max-w-20 text-center"
                    />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Heritage Symbols Progressive Disclosure Card */}
        <Card>
          <div className="border-separator border-b px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-label text-headline flex items-center gap-2">
                  <Star className="text-teal h-5 w-5" />
                  Cultural Heritage & National Emblems
                </h3>
                <p className="text-label-secondary text-footnote mt-0.5 leading-tight">
                  Fauna, flora, founding figures, and cherished national motifs
                </p>
              </div>

              <Button type="button" variant="ghost" size="sm" onClick={handleToggleShowAll}>
                <span>{showAllMotifs ? "Show Essentials" : "Show All 10 Emblems"}</span>
                {showAllMotifs ? <ChevronUp aria-hidden /> : <ChevronDown aria-hidden />}
              </Button>
            </div>
          </div>
          <CardContent className="space-y-4 p-6">
            {/* Core 4 Symbols Grid */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {CORE_HERITAGE_SYMBOLS.map(renderSymbolCard)}
              {visibleAdditionalSymbols.map(renderSymbolCard)}
            </div>

            {/* Progressive Motif Add Tray */}
            {unrevealedSymbols.length > 0 && !showAllMotifs && (
              <div className="border-separator space-y-2 border-t pt-3">
                <div className="flex items-center justify-between">
                  <span className="text-label-secondary text-caption">
                    Add More Cultural Motifs:
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {unrevealedSymbols.map((sym) => {
                    const Icon = sym.icon;
                    return (
                      <Button
                        key={sym.key}
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => handleRevealMotif(sym.key)}
                      >
                        <Plus aria-hidden className="text-tint" />
                        <Icon aria-hidden />
                        <span>{sym.shortLabel}</span>
                      </Button>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Media Search Modal */}
        {imagePickerField && (
          <MediaSearchModal
            isOpen={true}
            onClose={() => setImagePickerField(null)}
            onImageSelect={handleImageSelect}
          />
        )}
      </div>
    );
  },
  (prevProps, nextProps) => {
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
