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
import { Button } from "~/components/ui/button";
import { SegmentedControl } from "~/components/ui/segmented-control";
import { soundEffects } from "~/lib/sound/cuelume";
import { api } from "~/trpc/react";
import { MapPickerModal } from "~/components/maps/core/MapPickerModal";
import { deriveIsoCode, deriveInternetTld, deriveCallingCode } from "./identityUtils";
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

    const hasCoordinates = Boolean(identity.coordinatesLatitude && identity.coordinatesLongitude);

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-6 text-left lg:grid-cols-2">
          {/* Country Codes & Domain Card */}
          <FacetCard className="overflow-hidden">
            <div className="border-separator border-b px-6 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-label text-headline flex items-center gap-2">
                    <Wifi className="text-blue h-5 w-5" />
                    Country Codes & Domain
                  </h3>
                  <p className="text-label-secondary text-footnote mt-0.5 leading-tight">
                    ISO code, web domain, and international calling code.
                  </p>
                </div>

                <Button
                  type="button"
                  variant="tinted"
                  size="sm"
                  onClick={handleSuggestCodes}
                  title="Fill codes from country name"
                >
                  <Sparks aria-hidden />
                  <span>Suggest</span>
                </Button>
              </div>
            </div>

            <FacetCardContent className="space-y-4 p-6">
              <div className="grid grid-cols-3 gap-3">
                {/* ISO Code */}
                <div className="space-y-1.5">
                  <label className="text-label text-caption flex items-center gap-1">
                    <MapIcon className="text-label-secondary size-3.5" />
                    <span>ISO Code</span>
                  </label>
                  <Input
                    value={identity.isoCode || ""}
                    onChange={(e) => onIdentityChange("isoCode", e.target.value.toUpperCase())}
                    placeholder="EL"
                    maxLength={3}
                    className="text-headline text-center font-mono uppercase"
                  />
                  <p className="text-label-secondary text-footnote text-center">2 or 3 letters</p>
                </div>

                {/* Web Domain */}
                <div className="space-y-1.5">
                  <label className="text-label text-caption flex items-center gap-1">
                    <Wifi className="text-label-secondary size-3.5" />
                    <span>Web Domain</span>
                  </label>
                  <Input
                    value={identity.internetTLD || ""}
                    onChange={(e) => onIdentityChange("internetTLD", e.target.value.toLowerCase())}
                    placeholder=".el"
                    className="text-headline text-center font-mono lowercase"
                  />
                  <p className="text-label-secondary text-footnote text-center">.el, .ix</p>
                </div>

                {/* Calling Code */}
                <div className="space-y-1.5">
                  <label className="text-label text-caption flex items-center gap-1">
                    <Phone className="text-label-secondary size-3.5" />
                    <span>Calling Code</span>
                  </label>
                  <Input
                    value={identity.callingCode || ""}
                    onChange={(e) => onIdentityChange("callingCode", e.target.value)}
                    placeholder="+35"
                    className="text-headline text-center font-mono"
                  />
                  <p className="text-label-secondary text-footnote text-center">+1, +44</p>
                </div>
              </div>
            </FacetCardContent>
          </FacetCard>

          {/* Civic Standards Card */}
          <FacetCard className="z-10 overflow-visible">
            <div className="border-separator border-b px-6 py-4">
              <h3 className="text-label text-headline flex items-center gap-2">
                <Calendar className="text-teal h-5 w-5" />
                Civic Standards
              </h3>
              <p className="text-label-secondary text-footnote mt-0.5 leading-tight">
                Time zone, emergency number, and road rules.
              </p>
            </div>

            <FacetCardContent className="space-y-4 p-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-label text-caption flex items-center gap-1">
                    <Clock className="text-label-secondary h-3.5 w-3.5" />
                    <span>Time Zone</span>
                  </label>
                  <Input
                    value={identity.timeZone || ""}
                    onChange={(e) => onIdentityChange("timeZone", e.target.value)}
                    placeholder="UTC-5, EST, GMT+1"
                    className="text-footnote h-8"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-label text-caption flex items-center gap-1">
                    <Phone className="text-label-secondary h-3.5 w-3.5" />
                    <span>Emergency Number</span>
                  </label>
                  <Input
                    value={identity.emergencyNumber || ""}
                    onChange={(e) => onIdentityChange("emergencyNumber", e.target.value)}
                    placeholder="911, 112, 999"
                    className="text-footnote h-8"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-label text-caption flex items-center gap-1">
                  <MapIcon className="text-label-secondary h-3.5 w-3.5" />
                  <span>Postal Code Format</span>
                </label>
                <Input
                  value={identity.postalCodeFormat || ""}
                  onChange={(e) => onIdentityChange("postalCodeFormat", e.target.value)}
                  placeholder="12345, SW1A 1AA"
                  className="text-footnote h-8 font-mono"
                />
              </div>

              {/* Driving Side & Calendar Week Start */}
              <div className="border-separator grid grid-cols-1 gap-4 border-t pt-4 sm:grid-cols-2">
                {/* Driving Side */}
                <div className="space-y-2">
                  <label className="text-label text-caption flex items-center gap-1">
                    <Car className="text-label-secondary h-3.5 w-3.5" />
                    <span>Driving Side</span>
                  </label>
                  <SegmentedControl
                    aria-label="Driving side"
                    size="sm"
                    fullWidth
                    value={identity.drivingSide === "left" ? "left" : "right"}
                    onValueChange={handleDrivingSideSelect}
                    options={[
                      {
                        value: "right",
                        label: "Right-hand",
                        icon: <RightDriveIcon />,
                      },
                      {
                        value: "left",
                        label: "Left-hand",
                        icon: <LeftDriveIcon />,
                      },
                    ]}
                  />
                </div>

                {/* Week Starts On */}
                <div className="space-y-2">
                  <label className="text-label text-caption flex items-center gap-1">
                    <Calendar className="text-label-secondary h-3.5 w-3.5" />
                    <span>Week Starts On</span>
                  </label>
                  <SegmentedControl
                    aria-label="Week starts on"
                    size="sm"
                    fullWidth
                    value={identity.weekStartDay || "monday"}
                    onValueChange={handleWeekStartDaySelect}
                    options={WEEK_DAYS.map(({ value, label, short }) => ({
                      value,
                      label: short,
                      "aria-label": label,
                    }))}
                  />
                </div>
              </div>
            </FacetCardContent>
          </FacetCard>
        </div>

        {/* Geographic Center Card */}
        <FacetCard className="overflow-hidden">
          <div className="border-separator border-b px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-label text-headline flex items-center gap-2">
                  <Compass className="text-tint h-5 w-5" />
                  Geographic Center
                </h3>
                <p className="text-label-secondary text-footnote mt-0.5 leading-tight">
                  Coordinates used to center your country on the map.
                </p>
              </div>

              {/* Capital & Map Helpers */}
              <div className="flex items-center gap-2">
                {capitalCity?.coordinates && (
                  <Button
                    type="button"
                    variant="tinted"
                    size="sm"
                    onClick={handleSyncWithCapital}
                    title={`Use capital coordinates (${capitalCity.name || "Capital"})`}
                  >
                    <MapPin aria-hidden />
                    <span>Use Capital Location</span>
                  </Button>
                )}

                {countryId && (
                  <Button
                    type="button"
                    variant="gray"
                    size="sm"
                    onClick={() => {
                      soundEffects.press();
                      setIsMapPickerOpen(true);
                    }}
                    title="Pick coordinates on map"
                  >
                    <Compass aria-hidden />
                    <span>Pick on Map</span>
                  </Button>
                )}
              </div>
            </div>
          </div>

          <FacetCardContent className="space-y-4 p-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-label text-caption flex items-center gap-1">
                  <span>Latitude (-90° to +90°)</span>
                </label>
                <Input
                  value={identity.coordinatesLatitude || ""}
                  onChange={(e) => onIdentityChange("coordinatesLatitude", e.target.value)}
                  placeholder="40.7128"
                  className="text-body font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-label text-caption flex items-center gap-1">
                  <span>Longitude (-180° to +180°)</span>
                </label>
                <Input
                  value={identity.coordinatesLongitude || ""}
                  onChange={(e) => onIdentityChange("coordinatesLongitude", e.target.value)}
                  placeholder="-74.0060"
                  className="text-body font-mono"
                />
              </div>
            </div>

            {/* Status indicator */}
            <div className="text-footnote flex items-center gap-2 pt-1">
              {hasCoordinates ? (
                <Badge variant="success" className="tabular-nums">
                  <Check className="h-3 w-3" />
                  <span>
                    Center set: {identity.coordinatesLatitude}°, {identity.coordinatesLongitude}°
                  </span>
                </Badge>
              ) : (
                <span className="text-label-secondary text-footnote">
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
