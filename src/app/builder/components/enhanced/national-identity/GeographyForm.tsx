"use client";

import React, { useCallback } from "react";
import { MapIcon, Clock, Phone, Wifi, Car, Calendar } from "lucide-react";
import { EnhancedNumberInput, EnhancedToggle, GlassSelectBox } from "../../../primitives/enhanced";
import { GlassCard, GlassCardContent } from "../../glass/GlassCard";
import type { NationalIdentityData } from "~/app/builder/lib/economy-data-service";

interface GeographyFormProps {
  identity: NationalIdentityData;
  onIdentityChange: (field: keyof NationalIdentityData, value: any) => void;
}

export const GeographyForm = React.memo(
  function GeographyForm({ identity, onIdentityChange }: GeographyFormProps) {
    // Memoize all change handlers with empty deps since parent callback is stable
    const handleCallingCodeChange = useCallback((value: any) => {
      onIdentityChange("callingCode", String(value));
    }, []);

    const handleInternetTLDChange = useCallback((value: any) => {
      onIdentityChange("internetTLD", String(value));
    }, []);

    const handleIsoCodeChange = useCallback((value: any) => {
      onIdentityChange("isoCode", String(value));
    }, []);

    const handleTimeZoneChange = useCallback((value: any) => {
      onIdentityChange("timeZone", String(value));
    }, []);

    const handleEmergencyNumberChange = useCallback((value: any) => {
      onIdentityChange("emergencyNumber", String(value));
    }, []);

    const handlePostalCodeFormatChange = useCallback((value: any) => {
      onIdentityChange("postalCodeFormat", String(value));
    }, []);

    const handleDrivingSideChange = useCallback((checked: boolean) => {
      onIdentityChange("drivingSide", checked ? "right" : "left");
    }, []);

    const handleWeekStartDayChange = useCallback((value: string) => {
      onIdentityChange("weekStartDay", value);
    }, []);

    const handleCoordinatesLatitudeChange = useCallback((value: any) => {
      onIdentityChange("coordinatesLatitude", String(value));
    }, []);

    const handleCoordinatesLongitudeChange = useCallback((value: any) => {
      onIdentityChange("coordinatesLongitude", String(value));
    }, []);

    return (
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Connectivity Card */}
        <GlassCard
          depth="base"
          theme="blue"
          className="border-blue-500/20 lg:col-span-1"
          texture="chevron"
          textureOpacity={0.06}
        >
          <div className="border-border/40 border-b bg-white/[0.02] px-6 py-4 dark:bg-black/[0.1]">
            <h3 className="text-foreground flex items-center gap-2 text-base font-bold">
              <Wifi className="h-5 w-5 text-blue-400" />
              Connectivity
            </h3>
          </div>
          <GlassCardContent className="space-y-4 p-6">
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
          </GlassCardContent>
        </GlassCard>

        {/* Civic Rules Card */}
        <GlassCard
          depth="base"
          theme="teal"
          className="border-teal-500/20 lg:col-span-2"
          texture="chevron"
          textureOpacity={0.06}
        >
          <div className="border-border/40 border-b bg-white/[0.02] px-6 py-4 dark:bg-black/[0.1]">
            <h3 className="text-foreground flex items-center gap-2 text-base font-bold">
              <Calendar className="h-5 w-5 text-emerald-400" />
              Civic Rules & Standards
            </h3>
          </div>
          <GlassCardContent className="space-y-4 p-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
            </div>

            <div className="border-border/20 grid grid-cols-1 gap-4 border-t pt-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-foreground flex items-center gap-2 text-sm font-medium">
                  <Car className="text-muted-foreground h-4 w-4" />
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
                <GlassSelectBox
                  label="Week Start Day"
                  icon={Calendar}
                  value={identity.weekStartDay || "monday"}
                  onChange={handleWeekStartDayChange}
                  options={[
                    { value: "monday", label: "Monday" },
                    { value: "sunday", label: "Sunday" },
                    { value: "saturday", label: "Saturday" },
                  ]}
                  placeholder="Select start day"
                  sectionId="symbols"
                  theme="default"
                  size="sm"
                />
              </div>
            </div>
          </GlassCardContent>
        </GlassCard>

        {/* Geographic Center Card */}
        <GlassCard
          depth="base"
          className="border-border/40 lg:col-span-3"
          texture="chevron"
          textureOpacity={0.06}
        >
          <div className="border-border/40 border-b bg-white/[0.02] px-6 py-4 dark:bg-black/[0.1]">
            <h3 className="text-foreground flex items-center gap-2 text-base font-bold">
              <MapIcon className="h-5 w-5 text-yellow-400" />
              Geography
            </h3>
          </div>
          <GlassCardContent className="p-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
          </GlassCardContent>
        </GlassCard>
      </div>
    );
  },
  (prevProps: GeographyFormProps, nextProps: GeographyFormProps) => {
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
      prevProps.identity.coordinatesLatitude === nextProps.identity.coordinatesLatitude &&
      prevProps.identity.coordinatesLongitude === nextProps.identity.coordinatesLongitude
    );
  }
);
