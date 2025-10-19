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
  Map,
  Clock,
  Car,
  Flag,
  Music
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
  className = ""
}: NationalIdentityDisplayProps) {
  // Helper function to get the best available value
  const getValue = (nationalIdentityValue?: string | null, wikiValue?: string | null, fallback?: string | null) => {
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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Government Information */}
          {getValue(nationalIdentity?.officialName, wikiInfobox?.name) && (
            <div className="flex items-start gap-3">
              <Building className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <p className="text-xs text-muted-foreground mb-1">Official Name</p>
                <p className="font-semibold">
                  {getValue(nationalIdentity?.officialName, wikiInfobox?.name)}
                </p>
              </div>
            </div>
          )}

          {getValue(nationalIdentity?.governmentType, wikiInfobox?.government_type) && (
            <div className="flex items-start gap-3">
              <Crown className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <p className="text-xs text-muted-foreground mb-1">Government Type</p>
                <p className="font-semibold">
                  {getValue(nationalIdentity?.governmentType, wikiInfobox?.government_type)}
                </p>
              </div>
            </div>
          )}

          {/* Geographic Information */}
          {getValue(nationalIdentity?.capitalCity, wikiInfobox?.capital) && (
            <div className="flex items-start gap-3">
              <MapPin className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <p className="text-xs text-muted-foreground mb-1">Capital</p>
                <p className="font-semibold">
                  {getValue(nationalIdentity?.capitalCity, wikiInfobox?.capital)}
                </p>
              </div>
            </div>
          )}

          {getValue(nationalIdentity?.largestCity) && (
            <div className="flex items-start gap-3">
              <MapPin className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <p className="text-xs text-muted-foreground mb-1">Largest City</p>
                <p className="font-semibold">
                  {nationalIdentity?.largestCity}
                </p>
              </div>
            </div>
          )}

          {getValue(nationalIdentity?.demonym) && (
            <div className="flex items-start gap-3">
              <Users className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <p className="text-xs text-muted-foreground mb-1">Demonym</p>
                <p className="font-semibold">
                  {nationalIdentity?.demonym}
                </p>
              </div>
            </div>
          )}

          {/* Economic Information */}
          {getValue(nationalIdentity?.currency, wikiInfobox?.currency) && (
            <div className="flex items-start gap-3">
              <Globe className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <p className="text-xs text-muted-foreground mb-1">Currency</p>
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
              <FileText className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <p className="text-xs text-muted-foreground mb-1">Official Languages</p>
                <p className="font-semibold">
                  {getValue(nationalIdentity?.officialLanguages, wikiInfobox?.languages)}
                </p>
              </div>
            </div>
          )}

          {getValue(nationalIdentity?.nationalLanguage) && (
            <div className="flex items-start gap-3">
              <FileText className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <p className="text-xs text-muted-foreground mb-1">National Language</p>
                <p className="font-semibold">
                  {nationalIdentity?.nationalLanguage}
                </p>
              </div>
            </div>
          )}

          {/* Cultural Information */}
          {getValue(nationalIdentity?.nationalDay) && (
            <div className="flex items-start gap-3">
              <Calendar className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <p className="text-xs text-muted-foreground mb-1">National Day</p>
                <p className="font-semibold">
                  {nationalIdentity?.nationalDay}
                </p>
              </div>
            </div>
          )}

          {getValue(nationalIdentity?.nationalAnthem) && (
            <div className="flex items-start gap-3">
              <Music className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <p className="text-xs text-muted-foreground mb-1">National Anthem</p>
                <p className="font-semibold">
                  {nationalIdentity?.nationalAnthem}
                </p>
              </div>
            </div>
          )}

          {getValue(nationalIdentity?.nationalSport) && (
            <div className="flex items-start gap-3">
              <Heart className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <p className="text-xs text-muted-foreground mb-1">National Sport</p>
                <p className="font-semibold">
                  {nationalIdentity?.nationalSport}
                </p>
              </div>
            </div>
          )}

          {/* Technical Information */}
          {getValue(nationalIdentity?.callingCode, wikiInfobox?.calling_code) && (
            <div className="flex items-start gap-3">
              <Phone className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <p className="text-xs text-muted-foreground mb-1">Calling Code</p>
                <p className="font-semibold">
                  {getValue(nationalIdentity?.callingCode, wikiInfobox?.calling_code)}
                </p>
              </div>
            </div>
          )}

          {getValue(nationalIdentity?.internetTLD, wikiInfobox?.internetTld) && (
            <div className="flex items-start gap-3">
              <Mail className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <p className="text-xs text-muted-foreground mb-1">Internet TLD</p>
                <p className="font-semibold">
                  {getValue(nationalIdentity?.internetTLD, wikiInfobox?.internetTld)}
                </p>
              </div>
            </div>
          )}

          {getValue(nationalIdentity?.isoCode, wikiInfobox?.isoCode) && (
            <div className="flex items-start gap-3">
              <Globe className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <p className="text-xs text-muted-foreground mb-1">ISO Code</p>
                <p className="font-semibold">
                  {getValue(nationalIdentity?.isoCode, wikiInfobox?.isoCode)}
                </p>
              </div>
            </div>
          )}

          {getValue(nationalIdentity?.timeZone) && (
            <div className="flex items-start gap-3">
              <Clock className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <p className="text-xs text-muted-foreground mb-1">Time Zone</p>
                <p className="font-semibold">
                  {nationalIdentity?.timeZone}
                </p>
              </div>
            </div>
          )}

          {getValue(nationalIdentity?.drivingSide) && (
            <div className="flex items-start gap-3">
              <Car className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <p className="text-xs text-muted-foreground mb-1">Driving Side</p>
                <p className="font-semibold">
                  {nationalIdentity?.drivingSide}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* National Motto */}
        {getValue(nationalIdentity?.motto, wikiInfobox?.motto) && (
          <div className="mt-6 pt-6 border-t">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">
              National Motto
            </p>
            <p className="text-base italic text-muted-foreground border-l-4 border-primary/30 pl-4">
              &ldquo;{getValue(nationalIdentity?.motto, wikiInfobox?.motto)}&rdquo;
            </p>
            {nationalIdentity?.mottoNative && nationalIdentity.mottoNative !== nationalIdentity.motto && (
              <p className="text-sm text-muted-foreground/70 mt-2 border-l-4 border-primary/20 pl-4">
                {nationalIdentity.mottoNative}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
