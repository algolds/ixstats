"use client";

import { Button } from "~/components/ui/button";
import { useTransition } from "react";
import Link from "next/link";
import {
  WhiteFlag as Flag,
  Type as TypeIcon,
  FloppyDisk as Save,
  Xmark as X,
  MediaImage as ImageIcon,
  ScaleFrameEnlarge as Scale,
  Refresh as RefreshCw,
  OpenNewWindow as ExternalLink,
  SystemRestart as Loader2,
  Upload,
} from "iconoir-react";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { useProfileSettings } from "../../_hooks/useProfileSettings";
import { UnifiedCountryFlag } from "~/components/shared/flags/UnifiedCountryFlag";
import { SettingsHeader } from "../SettingsHeader";
import { SettingsGroup, SettingsRow, SettingsSelectRow } from "../primitives";
import { Input } from "~/components/ui/input";
import { getCountryPath } from "~/lib/utils";
import { soundEffects } from "~/lib/sound/cuelume";

interface CountryNationPanelProps {
  country: {
    flagUrl: string | null | undefined;
    id: string;
    name: string;
    economicTier: string | null;
    currentPopulation: number | null;
    currentGdpPerCapita: number | null;
    slug?: string | null;
  };
  membershipTier?: string;
  roleDisplayName?: string;
}

export function CountryNationPanel({
  country,
  membershipTier: _membershipTier,
  roleDisplayName: _roleDisplayName,
}: CountryNationPanelProps) {
  const notify = useNotify();
  const utils = api.useUtils();
  const [isPending, startTransition] = useTransition();

  // Profile hooks
  const {
    isEditingCountry,
    newCountryName,
    flagUploadMode,
    uploadedFlagUrl,
    isUploadingFlag,
    setIsEditingCountry,
    setNewCountryName,
    setFlagUploadMode,
    setUploadedFlagUrl,
    updateCountryNameMutation,
    updateCountryFlagMutation,
    handleUpdateCountryName,
    handleFlagUpload,
    handleFlagSave,
  } = useProfileSettings({
    userProfileCountryId: country.id,
  });

  // Geo Bundle query
  const { data: geoBundle, refetch: refetchGeo } = api.countryGeo.getCountryGeoBundle.useQuery(
    { countryId: country.id },
    { enabled: Boolean(country.id), refetchOnWindowFocus: false }
  );

  // Mutations
  const updateModeMutation = api.countryGeo.updateGeoRollupMode.useMutation({
    onSuccess: () => {
      notify.success("Map sync mode updated");
      void refetchGeo();
    },
    onError: (err) => notify.error(err.message || "Failed to update sync mode"),
  });

  const rebaseMutation = api.countryGeo.rebaseNationalFromGeography.useMutation({
    onSuccess: () => {
      notify.success("National baseline rebased from map");
      void refetchGeo();
      void utils.countries.invalidate();
      void utils.countryGeo.invalidate();
      void utils.users.invalidate();
    },
    onError: (err) => notify.error(err.message || "Failed to rebase national stats"),
  });

  const currentMode = geoBundle?.country?.geoRollupMode || "hybrid";
  const rollups = geoBundle?.rollups;

  const handleModeChange = (newMode: string) => {
    startTransition(async () => {
      await updateModeMutation.mutateAsync({
        countryId: country.id,
        mode: newMode as "hybrid" | "top-down" | "bottom-up",
      });
    });
  };

  const handleRebase = () => {
    if (rollups && rollups.subdivisionPopulationSum === 0 && rollups.cityPopulationSum === 0) {
      notify.error("No mapped subdivisions or cities found to rebase from.");
      return;
    }
    rebaseMutation.mutate({ countryId: country.id });
  };

  return (
    <div className="space-y-6">
      <SettingsHeader
        title="MyCountry settings"
        category="MyCountry"
        description="Country name, flag and how map data feeds national statistics."
      />

      {/* Flag */}
      <SettingsGroup title="National symbols" description="The flag shown across IxStats.">
        <SettingsRow
          label="National flag"
          description="Shown on your country page, the map and leaderboards"
          icon={Flag}
          glyphClass="bg-muted/60 text-foreground"
        >
          <div className="flex items-center gap-3">
            <div className="border-border/60 bg-muted/60 relative flex h-8 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border shadow-2xs">
              <UnifiedCountryFlag
                countryName={country.name}
                flagUrl={country.flagUrl}
                className="h-full w-full object-cover"
              />
            </div>
            <Button
              type="button"
              onClick={() => {
                soundEffects.press();
                setFlagUploadMode(!flagUploadMode);
              }}
              data-cuelume-press="soft"
              variant="secondary"
              size="sm"
            >
              {flagUploadMode ? "Cancel" : "Change flag"}
            </Button>
          </div>
        </SettingsRow>

        {flagUploadMode && (
          <div className="border-border/40 space-y-4 border-t p-4">
            <div className="flex flex-col items-center gap-4 sm:flex-row">
              <label
                htmlFor="flag-upload-input"
                className="border-border/60 hover:border-border hover:bg-muted/20 flex w-full flex-1 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-4 text-center transition-[color,background-color,border-color,box-shadow,opacity,transform]"
              >
                {isUploadingFlag ? (
                  <div className="text-muted-foreground flex items-center gap-2 text-xs font-semibold">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Uploading flag image...</span>
                  </div>
                ) : (
                  <>
                    <Upload className="text-muted-foreground mb-1 h-5 w-5" />
                    <span className="text-foreground text-xs font-semibold">
                      Choose a flag image to upload
                    </span>
                    <span className="text-muted-foreground mt-0.5 text-xs">
                      PNG, JPG, SVG or WEBP up to 5MB
                    </span>
                  </>
                )}
                <input
                  id="flag-upload-input"
                  type="file"
                  accept="image/png,image/jpeg,image/svg+xml,image/webp"
                  onChange={handleFlagUpload}
                  disabled={isUploadingFlag}
                  className="hidden"
                />
              </label>

              {uploadedFlagUrl && (
                <div className="flex flex-col items-center gap-2">
                  <div className="border-border/60 bg-muted/60 relative h-16 w-24 overflow-hidden rounded-lg border shadow-xs">
                    <img
                      src={uploadedFlagUrl}
                      alt="Flag preview"
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <span className="text-muted-foreground text-xs font-semibold">Preview</span>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                onClick={() => {
                  soundEffects.press();
                  setFlagUploadMode(false);
                  setUploadedFlagUrl(null);
                }}
                variant="secondary"
                size="sm"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleFlagSave}
                disabled={!uploadedFlagUrl || updateCountryFlagMutation.isPending}
                variant="default"
                size="sm"
              >
                {updateCountryFlagMutation.isPending ? "Saving..." : "Save flag"}
              </Button>
            </div>
          </div>
        )}
      </SettingsGroup>

      {/* Country identity */}
      <SettingsGroup title="Country identity" description="Your country name and its page.">
        <SettingsRow
          label="Country name"
          description="Used across treaties, country pages and diplomatic tables"
          icon={TypeIcon}
          glyphClass="bg-muted/60 text-foreground"
        >
          {isEditingCountry ? (
            <div className="flex items-center gap-2">
              <Input
                value={newCountryName}
                onChange={(e) => setNewCountryName(e.target.value)}
                placeholder="Enter country name"
                className="h-8 w-44 text-xs font-semibold"
                autoFocus
              />
              <Button
                type="button"
                onClick={handleUpdateCountryName}
                disabled={updateCountryNameMutation.isPending || !newCountryName.trim()}
                data-cuelume-press="soft"
                variant="default"
                size="icon-sm"
              >
                <Save className="h-3.5 w-3.5" />
              </Button>
              <Button
                type="button"
                onClick={() => {
                  soundEffects.press();
                  setIsEditingCountry(false);
                }}
                data-cuelume-press="soft"
                variant="secondary"
                size="icon-sm"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-foreground text-xs font-bold">{country.name}</span>
              <Button
                type="button"
                onClick={() => {
                  soundEffects.press();
                  setNewCountryName(country.name);
                  setIsEditingCountry(true);
                }}
                data-cuelume-press="soft"
                variant="secondary"
                size="sm"
              >
                Rename
              </Button>
            </div>
          )}
        </SettingsRow>

        <SettingsRow
          label="Country page"
          description="Your factbook and national statistics"
          icon={ImageIcon}
          glyphClass="bg-muted/60 text-foreground"
        >
          <Button asChild variant="secondary" size="sm">
            <Link
              href={getCountryPath({ id: country.id, name: country.name, slug: country.slug })}
              data-cuelume-press="soft"
            >
              <span>Open country page</span>
              <ExternalLink className="h-3 w-3 opacity-60" />
            </Link>
          </Button>
        </SettingsRow>
      </SettingsGroup>

      {/* Map sync */}
      <SettingsGroup
        title="Geography and map sync"
        description="How map features roll up into national figures."
      >
        <SettingsSelectRow
          id="geo-sync-mode"
          label="Map rollup mode"
          description="How map data sets national population and GDP"
          icon={Scale}
          glyphClass="bg-muted/60 text-foreground"
          value={currentMode}
          onValueChange={handleModeChange}
          disabled={isPending || updateModeMutation.isPending}
          options={[
            {
              value: "hybrid",
              label: "Hybrid (recommended)",
              description: "Balances your national targets with local map density",
            },
            {
              value: "top-down",
              label: "Top-down",
              description: "National statistics are distributed down to the map",
            },
            {
              value: "bottom-up",
              label: "Bottom-up",
              description: "Map subdivisions and cities set the national totals",
            },
          ]}
        />

        <SettingsRow
          label="Rebase from map"
          description={
            rollups
              ? `Current map total: ${Number(rollups.subdivisionPopulationSum ?? 0).toLocaleString()} citizens (${Math.round((rollups.populationCoverage ?? 0) * 100)}% coverage)`
              : "Reset national baseline statistics from your map"
          }
          icon={RefreshCw}
          glyphClass="bg-muted/60 text-foreground"
        >
          <Button
            type="button"
            onClick={handleRebase}
            disabled={rebaseMutation.isPending}
            data-cuelume-press="soft"
            variant="secondary"
            size="sm"
          >
            <RefreshCw className={`h-3 w-3 ${rebaseMutation.isPending ? "animate-spin" : ""}`} />
            <span>{rebaseMutation.isPending ? "Rebasing..." : "Rebase stats"}</span>
          </Button>
        </SettingsRow>
      </SettingsGroup>
    </div>
  );
}
