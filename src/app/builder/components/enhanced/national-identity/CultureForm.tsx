"use client";

import React, { useCallback, useMemo, useState } from "react";
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
import { IdentityAutocomplete } from "./IdentityAutocomplete";
import { CurrencyAutocomplete } from "./CurrencyAutocomplete";
import { CurrencyIcon } from "./CurrencyIcon";
import { FacetCard, FacetCardContent } from "~/components/ui/facet-container";
import { soundEffects } from "~/lib/sound/cuelume";
import type { NationalIdentityData } from "~/app/builder/lib/economy-data-service";
import { getCurrencyInfo } from "~/lib/utils";
import { POPULAR_LANGUAGES } from "./identityUtils";

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
        return Boolean((typeof text === "string" && text.trim()) || (typeof img === "string" && img.trim()));
      });
    }, [showAllMotifs, revealedKeys, identity]);

    // Symbols available to be added via chips
    const unrevealedSymbols = useMemo(() => {
      return ADDITIONAL_HERITAGE_SYMBOLS.filter((sym) => {
        if (showAllMotifs) return false;
        if (revealedKeys.has(sym.key)) return false;
        const text = identity[sym.key as keyof NationalIdentityData];
        const img = identity[sym.imageKey as keyof NationalIdentityData];
        return !Boolean((typeof text === "string" && text.trim()) || (typeof img === "string" && img.trim()));
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

        return (
          <div
            key={key}
            className="flex items-center gap-3 rounded-xl border border-border/40 bg-background/50 p-3 shadow-xs transition-colors hover:border-border/80"
          >
            {/* Media Thumbnail / Picker Trigger */}
            <button
              type="button"
              onClick={() => {
                soundEffects.press();
                setImagePickerField(imageKey);
              }}
              className="group relative h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-border/50 bg-muted/40 transition-transform hover:scale-105 active:scale-95"
              title="Upload or search emblem on IxWiki"
              data-cuelume-press
            >
              {typeof imgVal === "string" && imgVal ? (
                <img
                  src={imgVal}
                  alt={label}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-muted-foreground/60 group-hover:text-teal-500">
                  <Image className="h-5 w-5" />
                </div>
              )}
              <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                <Image className="h-4 w-4 text-white" />
              </div>
            </button>

            {/* Text Input */}
            <div className="min-w-0 flex-1 space-y-1">
              <label className="text-foreground flex items-center gap-1.5 text-xs font-semibold">
                <Icon className="h-3.5 w-3.5 text-teal-400" />
                <span>{label}</span>
              </label>
              <Input
                value={typeof textVal === "string" ? textVal : ""}
                onChange={(e) =>
                  onIdentityChange(key as keyof NationalIdentityData, e.target.value)
                }
                placeholder={placeholder}
                className="h-8 text-xs"
              />
            </div>
          </div>
        );
      },
      [identity, onIdentityChange]
    );

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-6 text-left lg:grid-cols-2">
          {/* Aspirations & Expressions Card */}
          <FacetCard
            depth="base"
            theme="gold"
            className="border-amber-500/20"
            texture="chevron"
            textureOpacity={0.06}
          >
            <div className="border-border/40 border-b bg-white/[0.02] px-6 py-4 dark:bg-black/[0.1]">
              <h3 className="text-foreground flex items-center gap-2 text-base font-bold">
                <Sparkles className="h-5 w-5 text-amber-400" />
                National Motto & Expressions
              </h3>
            </div>
            <FacetCardContent className="space-y-4 p-6">
              {/* National Motto (Primary) */}
              <div className="space-y-2">
                <label className="text-foreground flex items-center gap-2 text-sm font-medium">
                  <Sparkles className="text-muted-foreground h-4 w-4" />
                  National Motto
                </label>
                <p className="text-muted-foreground text-[11px] leading-tight">
                  The primary rallying cry or constitutional motto of your people
                </p>
                <Input
                  value={identity.motto || ""}
                  onChange={(e) => onIdentityChange("motto", e.target.value)}
                  placeholder="e.g. Liberty, Equality, Fraternity • E pluribus unum"
                />
              </div>

              {/* Native Language Motto (Streamlined Inline Sub-field) */}
              <div className="space-y-2 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
                <label className="flex items-center gap-2 text-xs font-semibold text-amber-600 dark:text-amber-400">
                  <Globe className="h-3.5 w-3.5" />
                  <span>Native / Historical Language Motto (Optional)</span>
                </label>
                <Input
                  value={identity.mottoNative || ""}
                  onChange={(e) => onIdentityChange("mottoNative", e.target.value)}
                  placeholder="e.g. Liberté, égalité, fraternité"
                  className="h-8 text-xs italic"
                />
              </div>

              {/* National Anthem */}
              <div className="space-y-2">
                <label className="text-foreground flex items-center gap-2 text-sm font-medium">
                  <Music className="text-muted-foreground h-4 w-4" />
                  National Anthem
                </label>
                <p className="text-muted-foreground text-[11px] leading-tight">
                  Title of the solemn or celebratory state anthem
                </p>
                <Input
                  value={identity.nationalAnthem || ""}
                  onChange={(e) => onIdentityChange("nationalAnthem", e.target.value)}
                  placeholder="e.g. The Star-Spangled Banner, La Marseillaise..."
                />
              </div>

              {/* Primary Religion */}
              <div className="space-y-2">
                <label className="text-foreground flex items-center gap-2 text-sm font-medium">
                  <Heart className="text-muted-foreground h-4 w-4" />
                  Primary / State Religion
                </label>
                <p className="text-muted-foreground text-[11px] leading-tight">
                  Major religious tradition or secular constitutional designation
                </p>
                <Input
                  value={identity.nationalReligion || ""}
                  onChange={(e) => onIdentityChange("nationalReligion", e.target.value)}
                  placeholder="e.g. Secular, Christianity, Islam, Buddhism, Pluralist..."
                />
              </div>

              {/* National Day & Sport Grid */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 pt-2 border-t border-border/20">
                <div className="space-y-2">
                  <label className="text-foreground flex items-center gap-1.5 text-sm font-medium">
                    <span>National Day</span>
                  </label>
                  <Input
                    value={identity.nationalDay || ""}
                    onChange={(e) => onIdentityChange("nationalDay", e.target.value)}
                    placeholder="e.g. July 4th, Dec 1"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-foreground flex items-center gap-1.5 text-sm font-medium">
                    <Trophy className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>National Sport</span>
                  </label>
                  <Input
                    value={identity.nationalSport || ""}
                    onChange={(e) => onIdentityChange("nationalSport", e.target.value)}
                    placeholder="e.g. Football, Cricket"
                  />
                </div>
              </div>
            </FacetCardContent>
          </FacetCard>

          {/* Languages & Currency Card */}
          <FacetCard
            depth="base"
            theme="indigo"
            className="!overflow-visible border-indigo-500/20"
            texture="chevron"
            textureOpacity={0.06}
          >
            <div className="border-border/40 border-b bg-white/[0.02] px-6 py-4 dark:bg-black/[0.1]">
              <h3 className="text-foreground flex items-center gap-2 text-base font-bold">
                <Languages className="h-5 w-5 text-indigo-400" />
                Languages & Currency
              </h3>
              <p className="text-muted-foreground text-xs leading-tight mt-0.5">
                Official languages, lingua franca, and national currency.
              </p>
            </div>
            <FacetCardContent className="space-y-4 p-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <IdentityAutocomplete
                  fieldName="officialLanguages"
                  label="Primary Official Language"
                  value={String(identity.officialLanguages || "")}
                  onChange={(val) => onIdentityChange("officialLanguages", val)}
                  placeholder="e.g. English, French, Eldorian"
                  icon={Languages}
                  iconClassName="text-indigo-400"
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
                  iconClassName="text-indigo-400"
                  defaultSuggestions={POPULAR_LANGUAGES}
                  size="sm"
                  onSave={onFieldSave}
                />
              </div>

              {/* Currency Selector */}
              <div className="border-border/20 space-y-4 border-t pt-4">
                <CurrencyAutocomplete
                  fieldName="currency"
                  value={String(identity.currency || "")}
                  onChange={handleCurrencyChange}
                  placeholder="Select or enter sovereign currency"
                  currencySymbol={identity.currencySymbol || "$"}
                />

                {identity.currency && !getCurrencyInfo(identity.currency).isISO && (
                  <div className="animate-in fade-in slide-in-from-top-1 flex items-center justify-between rounded-lg border border-indigo-500/20 bg-indigo-500/5 p-3">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5">
                        <CurrencyIcon
                          code={identity.currency}
                          symbol={identity.currencySymbol || "$"}
                          className="h-4 w-4 text-indigo-500"
                        />
                        <label className="text-xs font-semibold text-foreground">
                          Custom Currency Symbol
                        </label>
                      </div>
                      <p className="text-muted-foreground text-[11px]">
                        Symbol placed before amounts (e.g. ₮, ℳ, ©, Cr)
                      </p>
                    </div>
                    <Input
                      value={identity.currencySymbol || "$"}
                      onChange={handleCurrencySymbolChange}
                      placeholder="$"
                      className="h-8 max-w-[80px] font-mono text-center text-sm font-bold"
                    />
                  </div>
                )}
              </div>
            </FacetCardContent>
          </FacetCard>
        </div>

        {/* Heritage Symbols Progressive Disclosure Card */}
        <FacetCard
          depth="base"
          theme="teal"
          className="border-teal-500/20"
          texture="chevron"
          textureOpacity={0.06}
        >
          <div className="border-border/40 border-b bg-white/[0.02] px-6 py-4 dark:bg-black/[0.1]">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-foreground flex items-center gap-2 text-base font-bold">
                  <Star className="h-5 w-5 text-teal-400" />
                  Cultural Heritage & National Emblems
                </h3>
                <p className="text-muted-foreground text-xs leading-tight mt-0.5">
                  Fauna, flora, founding figures, and cherished national motifs
                </p>
              </div>

              <button
                type="button"
                onClick={handleToggleShowAll}
                className="flex items-center gap-1 text-xs font-semibold text-teal-600 dark:text-teal-400 hover:underline active:scale-95 transition-all"
                data-cuelume-press
              >
                <span>{showAllMotifs ? "Show Essentials" : "Show All 10 Emblems"}</span>
                {showAllMotifs ? (
                  <ChevronUp className="h-3.5 w-3.5" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
          </div>
          <FacetCardContent className="space-y-4 p-6">
            {/* Core 4 Symbols Grid */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {CORE_HERITAGE_SYMBOLS.map(renderSymbolCard)}
              {visibleAdditionalSymbols.map(renderSymbolCard)}
            </div>

            {/* Progressive Motif Add Tray */}
            {unrevealedSymbols.length > 0 && !showAllMotifs && (
              <div className="border-border/20 pt-3 border-t space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground text-[11px] font-medium">
                    Add More Cultural Motifs:
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {unrevealedSymbols.map((sym) => {
                    const Icon = sym.icon;
                    return (
                      <button
                        key={sym.key}
                        type="button"
                        onClick={() => handleRevealMotif(sym.key)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-border/40 bg-background/50 px-2.5 py-1 text-xs font-medium text-muted-foreground hover:border-teal-500/40 hover:bg-teal-500/10 hover:text-teal-600 dark:hover:text-teal-400 active:scale-[0.97] transition-all"
                        data-cuelume-press
                      >
                        <Plus className="h-3 w-3 text-teal-500" />
                        <Icon className="h-3 w-3 opacity-70" />
                        <span>{sym.shortLabel}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </FacetCardContent>
        </FacetCard>

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
