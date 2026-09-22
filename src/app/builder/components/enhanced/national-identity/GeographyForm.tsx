"use client";

import React, { useCallback, useMemo, useState } from "react";
import {
  Map as MapIcon,
  Clock,
  Phone,
  Wifi,
  Car,
  Calendar,
  Compass,
  MapPin,
  Sparks,
  Check,
} from "iconoir-react";
import { Input } from "~/components/ui/input";
import { FacetCard, FacetCardContent } from "~/components/ui/facet-container";
import { Badge } from "~/components/ui/badge";
import { soundEffects } from "~/lib/sound/cuelume";
import { api } from "~/trpc/react";
import { MapPickerModal } from "~/components/maps/core/MapPickerModal";
import {
  deriveIsoCode,
  deriveInternetTld,
  deriveCallingCode,
} from "./identityUtils";
import { RightDriveIcon, LeftDriveIcon } from "./DrivingSideIcons";
import type { NationalIdentityData } from "~/app/builder/lib/economy-data-service";

interface GeographyFormProps {
  identity: NationalIdentityData;
  onIdentityChange: <K extends keyof NationalIdentityData>(
    fieldOrFields: K | Partial<NationalIdentityData>,
    value?: NationalIdentityData[K]
  ) => void;
  countryId?: string;
  onFieldSave?: (fieldName: string, value: string) => void;
}

const WEEK_DAYS = [
  { value: "monday", label: "Monday", short: "Mon" },
  { value: "sunday", label: "Sunday", short: "Sun" },
  { value: "saturday", label: "Saturday", short: "Sat" },
] as const;

export const GeographyForm = React.memo(
  function GeographyForm({
    identity,
    onIdentityChange,
    countryId,
    onFieldSave,
  }: GeographyFormProps) {
    const [isMapPickerOpen, setIsMapPickerOpen] = useState(false);

    // Fetch geographic bundle for capital city coordinates
    const { data: geoBundle } = api.countryGeo.getCountryGeoBundle.useQuery(
      { countryId: countryId! },
      { enabled: Boolean(countryId) }
    );

    const capitalCity = useMemo(() => {
      if (!geoBundle?.cities) return null;
      return geoBundle.cities.find(
        (c: { isNationalCapital?: boolean; type?: string; coordinates?: [number, number] }) =>
          c.isNationalCapital || c.type === "capital"
      );
    }, [geoBundle]);

    const handleSuggestCodes = useCallback(() => {
      soundEffects.bloom();
      const countryName = identity.countryName || "";
      const derivedIso = deriveIsoCode(countryName);
      const derivedTld = deriveInternetTld(countryName, derivedIso);
      const derivedPhone = deriveCallingCode(countryName);

      onIdentityChange({
        isoCode: derivedIso,
        internetTLD: derivedTld,
        callingCode: derivedPhone,
      });

      if (derivedIso) onFieldSave?.("isoCode", derivedIso);
      if (derivedTld) onFieldSave?.("internetTLD", derivedTld);
      if (derivedPhone) onFieldSave?.("callingCode", derivedPhone);
    }, [identity.countryName, onIdentityChange, onFieldSave]);

    const handleDrivingSideSelect = useCallback(
      (side: "left" | "right") => {
        soundEffects.press();
        onIdentityChange("drivingSide", side);
        onFieldSave?.("drivingSide", side);
      },
      [onIdentityChange, onFieldSave]
    );

    const handleWeekStartDaySelect = useCallback(
      (day: string) => {
        soundEffects.press();
        onIdentityChange("weekStartDay", day);
        onFieldSave?.("weekStartDay", day);
      },
      [onIdentityChange, onFieldSave]
    );

    const handleSyncWithCapital = useCallback(() => {
      if (!capitalCity?.coordinates) return;
      soundEffects.bloom();
      const [lng, lat] = capitalCity.coordinates;
      const latStr = lat.toFixed(4);
      const lngStr = lng.toFixed(4);

      onIdentityChange({
        coordinatesLatitude: latStr,
        coordinatesLongitude: lngStr,
      });

      onFieldSave?.("coordinatesLatitude", latStr);
      onFieldSave?.("coordinatesLongitude", lngStr);
    }, [capitalCity, onIdentityChange, onFieldSave]);

    const handleConfirmCentroidPick = useCallback(
      (coords: [number, number]) => {
        soundEffects.bloom();
        const [lng, lat] = coords;
        const latStr = lat.toFixed(4);
        const lngStr = lng.toFixed(4);

        onIdentityChange({
          coordinatesLatitude: latStr,
          coordinatesLongitude: lngStr,
        });

        onFieldSave?.("coordinatesLatitude", latStr);
        onFieldSave?.("coordinatesLongitude", lngStr);
        setIsMapPickerOpen(false);
      },
      [onIdentityChange, onFieldSave]
    );

    const hasCoordinates = Boolean(
      identity.coordinatesLatitude && identity.coordinatesLongitude
    );

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-6 text-left lg:grid-cols-2">
          {/* Country Codes & Domain Card */}
          <FacetCard
            depth="base"
            theme="blue"
            className="border-blue-500/20"
            texture="chevron"
            textureOpacity={0.06}
          >
            <div className="border-border/40 border-b bg-white/[0.02] px-6 py-4 dark:bg-black/[0.1]">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-foreground flex items-center gap-2 text-base font-bold">
                    <Wifi className="h-5 w-5 text-blue-400" />
                    Country Codes & Domain
                  </h3>
                  <p className="text-muted-foreground text-xs leading-tight mt-0.5">
                    ISO code, web domain, and international calling code.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleSuggestCodes}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-blue-500/30 bg-blue-500/10 px-2.5 py-1 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-500/20 active:scale-95 transition-all"
                  title="Fill codes from country name"
                  data-cuelume-press
                >
                  <Sparks className="h-3 w-3" />
                  <span>Suggest</span>
                </button>
              </div>
            </div>

            <FacetCardContent className="space-y-4 p-6">
              <div className="grid grid-cols-3 gap-3">
                {/* ISO Code */}
                <div className="space-y-1.5">
                  <label className="text-foreground flex items-center gap-1 text-xs font-semibold">
                    <MapIcon className="h-3 w-3 text-muted-foreground" />
                    <span>ISO Code</span>
                  </label>
                  <Input
                    value={identity.isoCode || ""}
                    onChange={(e) =>
                      onIdentityChange("isoCode", e.target.value.toUpperCase())
                    }
                    placeholder="EL"
                    maxLength={3}
                    className="font-mono text-center text-sm font-bold uppercase tracking-wider"
                  />
                  <p className="text-muted-foreground text-[10px] text-center">
                    2 or 3 letters
                  </p>
                </div>

                {/* Web Domain */}
                <div className="space-y-1.5">
                  <label className="text-foreground flex items-center gap-1 text-xs font-semibold">
                    <Wifi className="h-3 w-3 text-muted-foreground" />
                    <span>Web Domain</span>
                  </label>
                  <Input
                    value={identity.internetTLD || ""}
                    onChange={(e) =>
                      onIdentityChange("internetTLD", e.target.value.toLowerCase())
                    }
                    placeholder=".el"
                    className="font-mono text-center text-sm font-bold lowercase"
                  />
                  <p className="text-muted-foreground text-[10px] text-center">
                    .el, .ix
                  </p>
                </div>

                {/* Calling Code */}
                <div className="space-y-1.5">
                  <label className="text-foreground flex items-center gap-1 text-xs font-semibold">
                    <Phone className="h-3 w-3 text-muted-foreground" />
                    <span>Calling Code</span>
                  </label>
                  <Input
                    value={identity.callingCode || ""}
                    onChange={(e) =>
                      onIdentityChange("callingCode", e.target.value)
                    }
                    placeholder="+35"
                    className="font-mono text-center text-sm font-bold"
                  />
                  <p className="text-muted-foreground text-[10px] text-center">
                    +1, +44
                  </p>
                </div>
              </div>
            </FacetCardContent>
          </FacetCard>

          {/* Civic Standards Card */}
          <FacetCard
            depth="base"
            theme="teal"
            className="z-10 !overflow-visible border-teal-500/20"
            texture="chevron"
            textureOpacity={0.06}
          >
            <div className="border-border/40 border-b bg-white/[0.02] px-6 py-4 dark:bg-black/[0.1]">
              <h3 className="text-foreground flex items-center gap-2 text-base font-bold">
                <Calendar className="h-5 w-5 text-teal-400" />
                Civic Standards
              </h3>
              <p className="text-muted-foreground text-xs leading-tight mt-0.5">
                Time zone, emergency number, and road rules.
              </p>
            </div>

            <FacetCardContent className="space-y-4 p-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-foreground flex items-center gap-1.5 text-xs font-semibold">
                    <Clock className="text-muted-foreground h-3.5 w-3.5" />
                    <span>Time Zone</span>
                  </label>
                  <Input
                    value={identity.timeZone || ""}
                    onChange={(e) => onIdentityChange("timeZone", e.target.value)}
                    placeholder="UTC-5, EST, GMT+1"
                    className="h-8 text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-foreground flex items-center gap-1.5 text-xs font-semibold">
                    <Phone className="text-muted-foreground h-3.5 w-3.5" />
                    <span>Emergency Number</span>
                  </label>
                  <Input
                    value={identity.emergencyNumber || ""}
                    onChange={(e) =>
                      onIdentityChange("emergencyNumber", e.target.value)
                    }
                    placeholder="911, 112, 999"
                    className="h-8 text-xs"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-foreground flex items-center gap-1.5 text-xs font-semibold">
                  <MapIcon className="text-muted-foreground h-3.5 w-3.5" />
                  <span>Postal Code Format</span>
                </label>
                <Input
                  value={identity.postalCodeFormat || ""}
                  onChange={(e) =>
                    onIdentityChange("postalCodeFormat", e.target.value)
                  }
                  placeholder="12345, SW1A 1AA"
                  className="h-8 text-xs font-mono"
                />
              </div>

              {/* Driving Side & Calendar Week Start */}
              <div className="border-border/20 grid grid-cols-1 gap-4 border-t pt-4 sm:grid-cols-2">
                {/* Driving Side */}
                <div className="space-y-2">
                  <label className="text-foreground flex items-center gap-1.5 text-xs font-semibold">
                    <Car className="text-muted-foreground h-3.5 w-3.5" />
                    <span>Driving Side</span>
                  </label>
                  <div className="flex rounded-lg border border-border/40 bg-muted/40 p-1">
                    <button
                      type="button"
                      onClick={() => handleDrivingSideSelect("right")}
                      className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-semibold transition-all active:scale-[0.98] ${
                        identity.drivingSide !== "left"
                          ? "border border-border/50 bg-background text-foreground shadow-xs"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                      title="Drive on the right side of the road"
                      data-cuelume-press
                    >
                      <RightDriveIcon
                        className={`h-4 w-4 shrink-0 transition-colors ${
                          identity.drivingSide !== "left"
                            ? "text-blue-500 dark:text-blue-400"
                            : "text-muted-foreground/60"
                        }`}
                      />
                      <span>Right-hand</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDrivingSideSelect("left")}
                      className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-semibold transition-all active:scale-[0.98] ${
                        identity.drivingSide === "left"
                          ? "border border-border/50 bg-background text-foreground shadow-xs"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                      title="Drive on the left side of the road"
                      data-cuelume-press
                    >
                      <LeftDriveIcon
                        className={`h-4 w-4 shrink-0 transition-colors ${
                          identity.drivingSide === "left"
                            ? "text-amber-500 dark:text-amber-400"
                            : "text-muted-foreground/60"
                        }`}
                      />
                      <span>Left-hand</span>
                    </button>
                  </div>
                </div>

                {/* Week Starts On */}
                <div className="space-y-2">
                  <label className="text-foreground flex items-center gap-1.5 text-xs font-semibold">
                    <Calendar className="text-muted-foreground h-3.5 w-3.5" />
                    <span>Week Starts On</span>
                  </label>
                  <div className="flex rounded-lg border border-border/40 bg-muted/40 p-1">
                    {WEEK_DAYS.map(({ value, label, short }) => {
                      const isSelected =
                        (identity.weekStartDay || "monday") === value;
                      return (
                        <button
                          key={value}
                          type="button"
                          onClick={() => handleWeekStartDaySelect(value)}
                          className={`flex-1 rounded-md py-1.5 text-xs font-semibold transition-all active:scale-[0.98] ${
                            isSelected
                              ? "border border-border/50 bg-background text-foreground shadow-xs"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                          title={label}
                          data-cuelume-press
                        >
                          {short}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </FacetCardContent>
          </FacetCard>
        </div>

        {/* Geographic Center Card */}
        <FacetCard
          depth="base"
          theme="neutral"
          className="border-border/40"
          texture="chevron"
          textureOpacity={0.06}
        >
          <div className="border-border/40 border-b bg-white/[0.02] px-6 py-4 dark:bg-black/[0.1]">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-foreground flex items-center gap-2 text-base font-bold">
                  <Compass className="h-5 w-5 text-amber-400" />
                  Geographic Center
                </h3>
                <p className="text-muted-foreground text-xs leading-tight mt-0.5">
                  Coordinates used to center your country on the map.
                </p>
              </div>

              {/* Capital & Map Helpers */}
              <div className="flex items-center gap-2">
                {capitalCity?.coordinates && (
                  <button
                    type="button"
                    onClick={handleSyncWithCapital}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 active:scale-95 transition-all"
                    title={`Use capital coordinates (${capitalCity.name || "Capital"})`}
                    data-cuelume-press
                  >
                    <MapPin className="h-3 w-3" />
                    <span>Use Capital Location</span>
                  </button>
                )}

                {countryId && (
                  <button
                    type="button"
                    onClick={() => {
                      soundEffects.press();
                      setIsMapPickerOpen(true);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-muted/50 px-2.5 py-1 text-xs font-semibold text-foreground hover:bg-muted active:scale-95 transition-all"
                    title="Pick coordinates on map"
                    data-cuelume-press
                  >
                    <Compass className="h-3 w-3 text-amber-400" />
                    <span>Pick on Map</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          <FacetCardContent className="space-y-4 p-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-foreground flex items-center gap-1.5 text-xs font-semibold">
                  <span>Latitude (-90° to +90°)</span>
                </label>
                <Input
                  value={identity.coordinatesLatitude || ""}
                  onChange={(e) =>
                    onIdentityChange("coordinatesLatitude", e.target.value)
                  }
                  placeholder="40.7128"
                  className="font-mono text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-foreground flex items-center gap-1.5 text-xs font-semibold">
                  <span>Longitude (-180° to +180°)</span>
                </label>
                <Input
                  value={identity.coordinatesLongitude || ""}
                  onChange={(e) =>
                    onIdentityChange("coordinatesLongitude", e.target.value)
                  }
                  placeholder="-74.0060"
                  className="font-mono text-sm"
                />
              </div>
            </div>

            {/* Status indicator */}
            <div className="flex items-center gap-2 pt-1 text-xs">
              {hasCoordinates ? (
                <Badge
                  variant="secondary"
                  className="gap-1 border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                >
                  <Check className="h-3 w-3" />
                  <span>
                    Center set: {identity.coordinatesLatitude}°,{" "}
                    {identity.coordinatesLongitude}°
                  </span>
                </Badge>
              ) : (
                <span className="text-muted-foreground text-xs">
                  Optional. If left blank, the map centers on your country&apos;s borders.
                </span>
              )}
            </div>
          </FacetCardContent>
        </FacetCard>

        {/* Map Picker Modal */}
        {countryId && isMapPickerOpen && (
          <MapPickerModal
            isOpen={isMapPickerOpen}
            onClose={() => setIsMapPickerOpen(false)}
            onConfirm={handleConfirmCentroidPick}
            countryId={countryId}
            title="Pick Geographic Center"
            initialCoordinates={
              identity.coordinatesLongitude && identity.coordinatesLatitude
                ? [
                    parseFloat(identity.coordinatesLongitude),
                    parseFloat(identity.coordinatesLatitude),
                  ]
                : null
            }
          />
        )}
      </div>
    );
  },
  (prevProps: GeographyFormProps, nextProps: GeographyFormProps) => {
    return (
      prevProps.identity.callingCode === nextProps.identity.callingCode &&
      prevProps.identity.internetTLD === nextProps.identity.internetTLD &&
      prevProps.identity.isoCode === nextProps.identity.isoCode &&
      prevProps.identity.timeZone === nextProps.identity.timeZone &&
      prevProps.identity.emergencyNumber === nextProps.identity.emergencyNumber &&
      prevProps.identity.postalCodeFormat === nextProps.identity.postalCodeFormat &&
      prevProps.identity.drivingSide === nextProps.identity.drivingSide &&
      prevProps.identity.weekStartDay === nextProps.identity.weekStartDay &&
      prevProps.identity.coordinatesLatitude === nextProps.identity.coordinatesLatitude &&
      prevProps.identity.coordinatesLongitude === nextProps.identity.coordinatesLongitude &&
      prevProps.countryId === nextProps.countryId
    );
  }
);
