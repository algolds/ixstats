"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import {
  Building,
  Crown,
  Users,
  MapPin,
  Heart,
  Globe,
  FileText,
  Calendar,
  Phone,
  Mail,
  Clock,
  Car,
  Flag,
  Music,
  Rabbit,
  Bird,
  Fish,
  Flower2,
  UtensilsCrossed,
  Apple,
  Wine,
  Guitar,
  Star,
} from "lucide-react";
import type { CountryInfobox } from "~/lib/mediawiki-service";

type ExtendedCountryInfobox = CountryInfobox & {
  isoCode?: string | null;
};

interface NationalIdentity {
  countryName?: string | null;
  officialName?: string | null;
  governmentType?: string | null;
  motto?: string | null;
  mottoNative?: string | null;
  capitalCity?: string | null;
  largestCity?: string | null;
  demonym?: string | null;
  currency?: string | null;
  currencySymbol?: string | null;
  officialLanguages?: string | null;
  nationalLanguage?: string | null;
  nationalAnthem?: string | null;
  nationalDay?: string | null;
  callingCode?: string | null;
  internetTLD?: string | null;
  drivingSide?: string | null;
  timeZone?: string | null;
  isoCode?: string | null;
  coordinatesLatitude?: string | null;
  coordinatesLongitude?: string | null;
  emergencyNumber?: string | null;
  postalCodeFormat?: string | null;
  nationalSport?: string | null;
  nationalAnimal?: string | null;
  nationalBird?: string | null;
  nationalFish?: string | null;
  founders?: string | null;
  nationalFlower?: string | null;
  nationalDish?: string | null;
  nationalFruit?: string | null;
  nationalDrink?: string | null;
  nationalInstrument?: string | null;
  nationalSymbol?: string | null;
  nationalAnimalImage?: string | null;
  nationalBirdImage?: string | null;
  nationalFishImage?: string | null;
  foundersImage?: string | null;
  nationalFlowerImage?: string | null;
  nationalDishImage?: string | null;
  nationalFruitImage?: string | null;
  nationalDrinkImage?: string | null;
  nationalInstrumentImage?: string | null;
  nationalSymbolImage?: string | null;
  weekStartDay?: string | null;
}

interface NationalIdentityDisplayProps {
  nationalIdentity?: NationalIdentity | null;
  wikiInfobox?: ExtendedCountryInfobox | null;
  showTitle?: boolean;
  className?: string;
}

/**
 * Shared component for displaying national identity information
 * Used in both country profiles and MyCountry overview
 */
export function NationalIdentityDisplay({
  nationalIdentity,
  wikiInfobox,
  showTitle = true,
  className = "",
}: NationalIdentityDisplayProps) {
  // Helper function to get the best available value
  const getValue = (
    nationalIdentityValue?: string | null,
    wikiValue?: string | null,
    fallback?: string | null
  ) => {
    return nationalIdentityValue || wikiValue || fallback;
  };

  // Only show the component if we have some data to display
  const hasData = nationalIdentity || wikiInfobox;
  if (!hasData) {
    return null;
  }

  return (
    <Card className={`glass-hierarchy-child ${className}`}>
      {showTitle && (
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Flag className="h-5 w-5" />
            National Identity
          </CardTitle>
        </CardHeader>
      )}
      <CardContent>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Government Information */}
          {getValue(nationalIdentity?.officialName, wikiInfobox?.name) && (
            <div className="flex items-start gap-3">
              <Building className="text-primary mt-0.5 h-5 w-5" />
              <div>
                <p className="text-muted-foreground mb-1 text-xs">Official Name</p>
                <p className="font-semibold">
                  {getValue(nationalIdentity?.officialName, wikiInfobox?.name)}
                </p>
              </div>
            </div>
          )}

          {getValue(nationalIdentity?.governmentType, wikiInfobox?.government_type) && (
            <div className="flex items-start gap-3">
              <Crown className="text-primary mt-0.5 h-5 w-5" />
              <div>
                <p className="text-muted-foreground mb-1 text-xs">Government Type</p>
                <p className="font-semibold">
                  {getValue(nationalIdentity?.governmentType, wikiInfobox?.government_type)}
                </p>
              </div>
            </div>
          )}

          {/* Geographic Information */}
          {getValue(nationalIdentity?.capitalCity, wikiInfobox?.capital) && (
            <div className="flex items-start gap-3">
              <MapPin className="text-primary mt-0.5 h-5 w-5" />
              <div>
                <p className="text-muted-foreground mb-1 text-xs">Capital</p>
                <p className="font-semibold">
                  {getValue(nationalIdentity?.capitalCity, wikiInfobox?.capital)}
                </p>
              </div>
            </div>
          )}

          {getValue(nationalIdentity?.largestCity) && (
            <div className="flex items-start gap-3">
              <MapPin className="text-primary mt-0.5 h-5 w-5" />
              <div>
                <p className="text-muted-foreground mb-1 text-xs">Largest City</p>
                <p className="font-semibold">{nationalIdentity?.largestCity}</p>
              </div>
            </div>
          )}

          {getValue(nationalIdentity?.demonym) && (
            <div className="flex items-start gap-3">
              <Users className="text-primary mt-0.5 h-5 w-5" />
              <div>
                <p className="text-muted-foreground mb-1 text-xs">Demonym</p>
                <p className="font-semibold">{nationalIdentity?.demonym}</p>
              </div>
            </div>
          )}

          {/* Economic Information */}
          {getValue(nationalIdentity?.currency, wikiInfobox?.currency) && (
            <div className="flex items-start gap-3">
              <Globe className="text-primary mt-0.5 h-5 w-5" />
              <div>
                <p className="text-muted-foreground mb-1 text-xs">Currency</p>
                <p className="font-semibold">
                  {getValue(nationalIdentity?.currency, wikiInfobox?.currency)}
                  {nationalIdentity?.currencySymbol && ` (${nationalIdentity.currencySymbol})`}
                </p>
              </div>
            </div>
          )}

          {/* Language Information */}
          {getValue(nationalIdentity?.officialLanguages, wikiInfobox?.languages) && (
            <div className="flex items-start gap-3">
              <FileText className="text-primary mt-0.5 h-5 w-5" />
              <div>
                <p className="text-muted-foreground mb-1 text-xs">Official Languages</p>
                <p className="font-semibold">
                  {getValue(nationalIdentity?.officialLanguages, wikiInfobox?.languages)}
                </p>
              </div>
            </div>
          )}

          {getValue(nationalIdentity?.nationalLanguage) && (
            <div className="flex items-start gap-3">
              <FileText className="text-primary mt-0.5 h-5 w-5" />
              <div>
                <p className="text-muted-foreground mb-1 text-xs">National Language</p>
                <p className="font-semibold">{nationalIdentity?.nationalLanguage}</p>
              </div>
            </div>
          )}

          {/* Cultural Information */}
          {getValue(nationalIdentity?.nationalDay) && (
            <div className="flex items-start gap-3">
              <Calendar className="text-primary mt-0.5 h-5 w-5" />
              <div>
                <p className="text-muted-foreground mb-1 text-xs">National Day</p>
                <p className="font-semibold">{nationalIdentity?.nationalDay}</p>
              </div>
            </div>
          )}

          {getValue(nationalIdentity?.nationalAnthem) && (
            <div className="flex items-start gap-3">
              <Music className="text-primary mt-0.5 h-5 w-5" />
              <div>
                <p className="text-muted-foreground mb-1 text-xs">National Anthem</p>
                <p className="font-semibold">{nationalIdentity?.nationalAnthem}</p>
              </div>
            </div>
          )}

          {getValue(nationalIdentity?.nationalSport) && (
            <div className="flex items-start gap-3">
              <Heart className="text-primary mt-0.5 h-5 w-5" />
              <div>
                <p className="text-muted-foreground mb-1 text-xs">National Sport</p>
                <p className="font-semibold">{nationalIdentity?.nationalSport}</p>
              </div>
            </div>
          )}

          {getValue(nationalIdentity?.nationalAnimal) && (
            <div className="flex items-start gap-3">
              <Rabbit className="text-primary mt-0.5 h-5 w-5" />
              <div className="min-w-0 flex-1">
                <p className="text-muted-foreground mb-1 text-xs">National Animal(s)</p>
                <p className="font-semibold">{nationalIdentity?.nationalAnimal}</p>
              </div>
              {nationalIdentity?.nationalAnimalImage && (
                <img src={nationalIdentity.nationalAnimalImage} alt="" className="mt-0.5 h-10 w-10 shrink-0 rounded-md border object-cover" />
              )}
            </div>
          )}
          {getValue(nationalIdentity?.nationalBird) && (
            <div className="flex items-start gap-3">
              <Bird className="text-primary mt-0.5 h-5 w-5" />
              <div className="min-w-0 flex-1">
                <p className="text-muted-foreground mb-1 text-xs">National Bird(s)</p>
                <p className="font-semibold">{nationalIdentity?.nationalBird}</p>
              </div>
              {nationalIdentity?.nationalBirdImage && (
                <img src={nationalIdentity.nationalBirdImage} alt="" className="mt-0.5 h-10 w-10 shrink-0 rounded-md border object-cover" />
              )}
            </div>
          )}
          {getValue(nationalIdentity?.nationalFish) && (
            <div className="flex items-start gap-3">
              <Fish className="text-primary mt-0.5 h-5 w-5" />
              <div className="min-w-0 flex-1">
                <p className="text-muted-foreground mb-1 text-xs">National Fish</p>
                <p className="font-semibold">{nationalIdentity?.nationalFish}</p>
              </div>
              {nationalIdentity?.nationalFishImage && (
                <img src={nationalIdentity.nationalFishImage} alt="" className="mt-0.5 h-10 w-10 shrink-0 rounded-md border object-cover" />
              )}
            </div>
          )}
          {getValue(nationalIdentity?.founders) && (
            <div className="flex items-start gap-3">
              <Users className="text-primary mt-0.5 h-5 w-5" />
              <div className="min-w-0 flex-1">
                <p className="text-muted-foreground mb-1 text-xs">Founder(s)</p>
                <p className="font-semibold">{nationalIdentity?.founders}</p>
              </div>
              {nationalIdentity?.foundersImage && (
                <img src={nationalIdentity.foundersImage} alt="" className="mt-0.5 h-10 w-10 shrink-0 rounded-md border object-cover" />
              )}
            </div>
          )}
          {getValue(nationalIdentity?.nationalFlower) && (
            <div className="flex items-start gap-3">
              <Flower2 className="text-primary mt-0.5 h-5 w-5" />
              <div className="min-w-0 flex-1">
                <p className="text-muted-foreground mb-1 text-xs">National Flower(s) & Plants</p>
                <p className="font-semibold">{nationalIdentity?.nationalFlower}</p>
              </div>
              {nationalIdentity?.nationalFlowerImage && (
                <img src={nationalIdentity.nationalFlowerImage} alt="" className="mt-0.5 h-10 w-10 shrink-0 rounded-md border object-cover" />
              )}
            </div>
          )}
          {getValue(nationalIdentity?.nationalDish) && (
            <div className="flex items-start gap-3">
              <UtensilsCrossed className="text-primary mt-0.5 h-5 w-5" />
              <div className="min-w-0 flex-1">
                <p className="text-muted-foreground mb-1 text-xs">National Dish(es) & Food</p>
                <p className="font-semibold">{nationalIdentity?.nationalDish}</p>
              </div>
              {nationalIdentity?.nationalDishImage && (
                <img src={nationalIdentity.nationalDishImage} alt="" className="mt-0.5 h-10 w-10 shrink-0 rounded-md border object-cover" />
              )}
            </div>
          )}
          {getValue(nationalIdentity?.nationalFruit) && (
            <div className="flex items-start gap-3">
              <Apple className="text-primary mt-0.5 h-5 w-5" />
              <div className="min-w-0 flex-1">
                <p className="text-muted-foreground mb-1 text-xs">Fruit(s)</p>
                <p className="font-semibold">{nationalIdentity?.nationalFruit}</p>
              </div>
              {nationalIdentity?.nationalFruitImage && (
                <img src={nationalIdentity.nationalFruitImage} alt="" className="mt-0.5 h-10 w-10 shrink-0 rounded-md border object-cover" />
              )}
            </div>
          )}
          {getValue(nationalIdentity?.nationalDrink) && (
            <div className="flex items-start gap-3">
              <Wine className="text-primary mt-0.5 h-5 w-5" />
              <div className="min-w-0 flex-1">
                <p className="text-muted-foreground mb-1 text-xs">Drink(s)</p>
                <p className="font-semibold">{nationalIdentity?.nationalDrink}</p>
              </div>
              {nationalIdentity?.nationalDrinkImage && (
                <img src={nationalIdentity.nationalDrinkImage} alt="" className="mt-0.5 h-10 w-10 shrink-0 rounded-md border object-cover" />
              )}
            </div>
          )}
          {getValue(nationalIdentity?.nationalInstrument) && (
            <div className="flex items-start gap-3">
              <Guitar className="text-primary mt-0.5 h-5 w-5" />
              <div className="min-w-0 flex-1">
                <p className="text-muted-foreground mb-1 text-xs">National Instrument(s)</p>
                <p className="font-semibold">{nationalIdentity?.nationalInstrument}</p>
              </div>
              {nationalIdentity?.nationalInstrumentImage && (
                <img src={nationalIdentity.nationalInstrumentImage} alt="" className="mt-0.5 h-10 w-10 shrink-0 rounded-md border object-cover" />
              )}
            </div>
          )}
          {getValue(nationalIdentity?.nationalSymbol) && (
            <div className="flex items-start gap-3">
              <Star className="text-primary mt-0.5 h-5 w-5" />
              <div className="min-w-0 flex-1">
                <p className="text-muted-foreground mb-1 text-xs">Other Symbol(s)</p>
                <p className="font-semibold">{nationalIdentity?.nationalSymbol}</p>
              </div>
              {nationalIdentity?.nationalSymbolImage && (
                <img src={nationalIdentity.nationalSymbolImage} alt="" className="mt-0.5 h-10 w-10 shrink-0 rounded-md border object-cover" />
              )}
            </div>
          )}

          {/* Technical Information */}
          {getValue(nationalIdentity?.callingCode, wikiInfobox?.calling_code) && (
            <div className="flex items-start gap-3">
              <Phone className="text-primary mt-0.5 h-5 w-5" />
              <div>
                <p className="text-muted-foreground mb-1 text-xs">Calling Code</p>
                <p className="font-semibold">
                  {getValue(nationalIdentity?.callingCode, wikiInfobox?.calling_code)}
                </p>
              </div>
            </div>
          )}

          {getValue(nationalIdentity?.internetTLD, wikiInfobox?.internetTld) && (
            <div className="flex items-start gap-3">
              <Mail className="text-primary mt-0.5 h-5 w-5" />
              <div>
                <p className="text-muted-foreground mb-1 text-xs">Internet TLD</p>
                <p className="font-semibold">
                  {getValue(nationalIdentity?.internetTLD, wikiInfobox?.internetTld)}
                </p>
              </div>
            </div>
          )}

          {getValue(nationalIdentity?.isoCode, wikiInfobox?.isoCode) && (
            <div className="flex items-start gap-3">
              <Globe className="text-primary mt-0.5 h-5 w-5" />
              <div>
                <p className="text-muted-foreground mb-1 text-xs">ISO Code</p>
                <p className="font-semibold">
                  {getValue(nationalIdentity?.isoCode, wikiInfobox?.isoCode)}
                </p>
              </div>
            </div>
          )}

          {getValue(nationalIdentity?.timeZone) && (
            <div className="flex items-start gap-3">
              <Clock className="text-primary mt-0.5 h-5 w-5" />
              <div>
                <p className="text-muted-foreground mb-1 text-xs">Time Zone</p>
                <p className="font-semibold">{nationalIdentity?.timeZone}</p>
              </div>
            </div>
          )}

          {getValue(nationalIdentity?.drivingSide) && (
            <div className="flex items-start gap-3">
              <Car className="text-primary mt-0.5 h-5 w-5" />
              <div>
                <p className="text-muted-foreground mb-1 text-xs">Driving Side</p>
                <p className="font-semibold">{nationalIdentity?.drivingSide}</p>
              </div>
            </div>
          )}
        </div>

        {/* National Motto */}
        {getValue(nationalIdentity?.motto, wikiInfobox?.motto) && (
          <div className="mt-6 border-t pt-6">
            <p className="text-muted-foreground mb-2 text-xs tracking-wide uppercase">
              National Motto
            </p>
            <p className="text-muted-foreground border-primary/30 border-l-4 pl-4 text-base italic">
              &ldquo;{getValue(nationalIdentity?.motto, wikiInfobox?.motto)}&rdquo;
            </p>
            {nationalIdentity?.mottoNative &&
              nationalIdentity.mottoNative !== nationalIdentity.motto && (
                <p className="text-muted-foreground/70 border-primary/20 mt-2 border-l-4 pl-4 text-sm">
                  {nationalIdentity.mottoNative}
                </p>
              )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
