"use client";

import React, { useCallback } from "react";
import { MapIcon, Clock, Phone, Wifi, Car, Calendar } from "lucide-react";
import { EnhancedNumberInput, EnhancedToggle } from "../../../primitives/enhanced";
import type { NationalIdentityData } from "~/app/builder/lib/economy-data-service";

interface GeographyFormProps {
  identity: NationalIdentityData;
  onIdentityChange: (field: keyof NationalIdentityData, value: any) => void;
}

export const GeographyForm = React.memo(function GeographyForm({ identity, onIdentityChange }: GeographyFormProps) {
  // Memoize all change handlers with empty deps since parent callback is stable
  const handleCallingCodeChange = useCallback(
    (value: any) => {
      onIdentityChange("callingCode", String(value));
    },
    []
  );

  const handleInternetTLDChange = useCallback(
    (value: any) => {
      onIdentityChange("internetTLD", String(value));
    },
    []
  );

  const handleIsoCodeChange = useCallback(
    (value: any) => {
      onIdentityChange("isoCode", String(value));
    },
    []
  );

  const handleTimeZoneChange = useCallback(
    (value: any) => {
      onIdentityChange("timeZone", String(value));
    },
    []
  );

  const handleEmergencyNumberChange = useCallback(
    (value: any) => {
      onIdentityChange("emergencyNumber", String(value));
    },
    []
  );

  const handlePostalCodeFormatChange = useCallback(
    (value: any) => {
      onIdentityChange("postalCodeFormat", String(value));
    },
    []
  );

  const handleDrivingSideChange = useCallback(
    (checked: boolean) => {
      onIdentityChange("drivingSide", checked ? "right" : "left");
    },
    []
  );

  const handleWeekStartDayChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      onIdentityChange("weekStartDay", e.target.value);
    },
    []
  );

  const handleNationalSportChange = useCallback(
    (value: any) => {
      onIdentityChange("nationalSport", String(value));
    },
    []
  );

  const handleCoordinatesLatitudeChange = useCallback(
    (value: any) => {
      onIdentityChange("coordinatesLatitude", String(value));
    },
    []
  );

  const handleCoordinatesLongitudeChange = useCallback(
    (value: any) => {
      onIdentityChange("coordinatesLongitude", String(value));
    },
    []
  );

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <EnhancedNumberInput
        label="Calling Code"
        description="International dialing code"
        value={String(identity.callingCode || "")}
        onChange={handleCallingCodeChange}
        sectionId="symbols"
        icon={Phone}
        showButtons={false}
        placeholder="+1, +44, +33..."
        acceptText={true}
      />

      <EnhancedNumberInput
        label="Internet TLD"
        description="Top-level domain"
        value={String(identity.internetTLD || "")}
        onChange={handleInternetTLDChange}
        sectionId="symbols"
        icon={Wifi}
        showButtons={false}
        placeholder=".us, .uk, .fr..."
        acceptText={true}
      />

      <EnhancedNumberInput
        label="ISO Country Code"
        description="ISO 3166-1 alpha-2 code"
        value={String(identity.isoCode || "")}
        onChange={handleIsoCodeChange}
        sectionId="symbols"
        icon={MapIcon}
        showButtons={false}
        placeholder="US, GB, FR..."
        acceptText={true}
      />

      <EnhancedNumberInput
        label="Time Zone"
        description="Primary time zone"
        value={String(identity.timeZone || "")}
        onChange={handleTimeZoneChange}
        sectionId="symbols"
        icon={Clock}
        showButtons={false}
        placeholder="UTC-5, GMT+1, PST..."
        acceptText={true}
      />

      <EnhancedNumberInput
        label="Emergency Number"
        description="Emergency services number"
        value={String(identity.emergencyNumber || "")}
        onChange={handleEmergencyNumberChange}
        sectionId="symbols"
        icon={Phone}
        showButtons={false}
        placeholder="911, 999, 112..."
        acceptText={true}
      />

      <EnhancedNumberInput
        label="Postal Code Format"
        description="Postal code pattern"
        value={String(identity.postalCodeFormat || "")}
        onChange={handlePostalCodeFormatChange}
        sectionId="symbols"
        showButtons={false}
        placeholder="12345, SW1A 1AA, etc."
        acceptText={true}
      />

      <div className="space-y-2">
        <label className="text-foreground flex items-center gap-2 text-sm font-medium">
          <Car className="h-4 w-4" />
          Driving Side
        </label>
        <EnhancedToggle
          label="Right-hand traffic"
          description="Toggle for left-hand traffic"
          checked={identity.drivingSide === "right"}
          onChange={handleDrivingSideChange}
          sectionId="symbols"
          variant="switch"
          showIcons={true}
        />
      </div>

      <div className="space-y-2">
        <label className="text-foreground flex items-center gap-2 text-sm font-medium">
          <Calendar className="h-4 w-4" />
          Week Start Day
        </label>
        <select
          value={identity.weekStartDay || "monday"}
          onChange={handleWeekStartDayChange}
          className="border-input bg-background text-foreground focus:border-ring focus:ring-ring w-full rounded-lg border px-4 py-3 transition-all duration-200 focus:ring-2 focus:outline-none"
        >
          <option value="monday">Monday</option>
          <option value="sunday">Sunday</option>
          <option value="saturday">Saturday</option>
        </select>
      </div>

      <EnhancedNumberInput
        label="National Sport"
        description="Most popular or official sport"
        value={String(identity.nationalSport || "")}
        onChange={handleNationalSportChange}
        sectionId="symbols"
        showButtons={false}
        placeholder="Football, Cricket, Hockey..."
        acceptText={true}
      />

      <div className="lg:col-span-3">
        <h5 className="text-foreground mb-4 flex items-center gap-2 text-lg font-bold">
          <MapIcon className="h-4 w-4" />
          Geographic Coordinates (Capital City)
        </h5>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <EnhancedNumberInput
            label="Latitude"
            description="North-South position (-90 to 90)"
            value={String(identity.coordinatesLatitude || "")}
            onChange={handleCoordinatesLatitudeChange}
            sectionId="symbols"
            showButtons={false}
            placeholder="40.7128"
            acceptText={true}
          />

          <EnhancedNumberInput
            label="Longitude"
            description="East-West position (-180 to 180)"
            value={String(identity.coordinatesLongitude || "")}
            onChange={handleCoordinatesLongitudeChange}
            sectionId="symbols"
            showButtons={false}
            placeholder="-74.0060"
            acceptText={true}
          />
        </div>
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison to prevent re-renders
  return (
    prevProps.identity.callingCode === nextProps.identity.callingCode &&
    prevProps.identity.internetTLD === nextProps.identity.internetTLD &&
    prevProps.identity.isoCode === nextProps.identity.isoCode &&
    prevProps.identity.timeZone === nextProps.identity.timeZone &&
    prevProps.identity.emergencyNumber === nextProps.identity.emergencyNumber &&
    prevProps.identity.postalCodeFormat === nextProps.identity.postalCodeFormat &&
    prevProps.identity.drivingSide === nextProps.identity.drivingSide &&
    prevProps.identity.weekStartDay === nextProps.identity.weekStartDay &&
    prevProps.identity.nationalSport === nextProps.identity.nationalSport &&
    prevProps.identity.coordinatesLatitude === nextProps.identity.coordinatesLatitude &&
    prevProps.identity.coordinatesLongitude === nextProps.identity.coordinatesLongitude
  );
});
