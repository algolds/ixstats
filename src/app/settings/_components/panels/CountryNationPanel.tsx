"use client";

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
import { UnifiedCountryFlag } from "~/components/ui/UnifiedCountryFlag";
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
        title="MyCountry Settings"
        category="MyCountry"
        description="Official nation metadata, national flag symbols, and map-to-national sync mode."
      />

      {/* National Flag & Symbols */}
      <SettingsGroup
        title="National Symbols"
        description="Official heraldry and flag representations displayed across IxStates."
      >
        <SettingsRow
          label="National Flag"
          description="National ensign used across dossiers, maps, and leaderboard rankings"
          icon={Flag}
          glyphClass="bg-muted/60 text-foreground"
        >
          <div className="flex items-center gap-3">
            <div className="relative flex h-8 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border/60 bg-muted/60 shadow-2xs">
              <UnifiedCountryFlag
                countryName={country.name}
                flagUrl={country.flagUrl}
                className="h-full w-full object-cover"
              />
            </div>
            <button
              type="button"
              onClick={() => {
                soundEffects.press();
                setFlagUploadMode(!flagUploadMode);
              }}
              data-cuelume-press="soft"
              className="facet-interactive rounded-xl border border-border/60 bg-secondary/80 px-3 py-1.5 text-xs font-semibold text-foreground transition-all hover:bg-secondary active:scale-[0.98]"
            >
              {flagUploadMode ? "Cancel" : "Change Flag"}
            </button>
          </div>
        </SettingsRow>

        {flagUploadMode && (
          <div className="border-t border-border/40 p-4 space-y-4">
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <label
                htmlFor="flag-upload-input"
                className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-border/60 rounded-xl p-4 cursor-pointer hover:border-border hover:bg-muted/20 transition-all text-center w-full"
              >
                {isUploadingFlag ? (
                  <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Uploading flag image...</span>
                  </div>
                ) : (
                  <>
                    <Upload className="h-5 w-5 text-muted-foreground mb-1" />
                    <span className="text-xs font-semibold text-foreground">
                      Choose a flag image to upload
                    </span>
                    <span className="text-[10px] text-muted-foreground mt-0.5">
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
                  <div className="relative h-16 w-24 overflow-hidden rounded-lg border border-border/60 bg-muted/60 shadow-xs">
                    <img
                      src={uploadedFlagUrl}
                      alt="Flag Preview"
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <span className="text-[10px] font-semibold text-muted-foreground">Preview</span>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  soundEffects.press();
                  setFlagUploadMode(false);
                  setUploadedFlagUrl(null);
                }}
                className="facet-interactive rounded-xl border border-border/60 bg-muted/40 px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted/70 hover:text-foreground active:scale-[0.98]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleFlagSave}
                disabled={!uploadedFlagUrl || updateCountryFlagMutation.isPending}
                className="facet-interactive rounded-xl bg-foreground px-3.5 py-1.5 text-xs font-semibold text-background hover:bg-foreground/90 active:scale-[0.98] disabled:opacity-50"
              >
                {updateCountryFlagMutation.isPending ? "Saving..." : "Save Flag"}
              </button>
            </div>
          </div>
        )}
      </SettingsGroup>

      {/* Country Identity */}
      <SettingsGroup
        title="Country Identity"
        description="Official nomenclature and country registry designations."
      >
        <SettingsRow
          label="State Name"
          description="Official country name used across treaties, dossiers, and diplomatic tables"
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
              <button
                type="button"
                onClick={handleUpdateCountryName}
                disabled={updateCountryNameMutation.isPending || !newCountryName.trim()}
                data-cuelume-press="soft"
                className="facet-interactive flex h-8 w-8 items-center justify-center rounded-xl bg-foreground text-background transition-all hover:bg-foreground/90 active:scale-[0.97] disabled:opacity-50"
              >
                <Save className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => {
                  soundEffects.press();
                  setIsEditingCountry(false);
                }}
                data-cuelume-press="soft"
                className="facet-interactive flex h-8 w-8 items-center justify-center rounded-xl border border-border/60 bg-muted/40 text-muted-foreground transition-all hover:bg-muted/70 hover:text-foreground active:scale-[0.97]"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-foreground">{country.name}</span>
              <button
                type="button"
                onClick={() => {
                  soundEffects.press();
                  setNewCountryName(country.name);
                  setIsEditingCountry(true);
                }}
                data-cuelume-press="soft"
                className="facet-interactive rounded-xl border border-border/60 bg-muted/30 px-2.5 py-1 text-xs font-semibold text-muted-foreground transition-all hover:bg-muted/60 hover:text-foreground active:scale-[0.98]"
              >
                Rename
              </button>
            </div>
          )}
        </SettingsRow>

        <SettingsRow
          label="Country Dossier"
          description="View your full executive factbook and national statistics"
          icon={ImageIcon}
          glyphClass="bg-muted/60 text-foreground"
        >
          <Link
            href={getCountryPath({ id: country.id, name: country.name, slug: country.slug })}
            data-cuelume-press="soft"
            className="facet-interactive flex items-center gap-1.5 rounded-xl border border-border/60 bg-muted/40 px-3 py-1.5 text-xs font-semibold text-foreground transition-all hover:bg-muted/70 active:scale-[0.98]"
          >
            <span>Open Dossier</span>
            <ExternalLink className="h-3 w-3 opacity-60" />
          </Link>
        </SettingsRow>
      </SettingsGroup>

      {/* Map Reconciliation & Geo Sync Mode */}
      <SettingsGroup
        title="Geography & Map Sync"
        description="Configure how spatial map features roll up into national metrics."
      >
        <SettingsSelectRow
          id="geo-sync-mode"
          label="Map Rollup Mode"
          description="Determines how territorial map data calculates national population and GDP"
          icon={Scale}
          glyphClass="bg-muted/60 text-foreground"
          value={currentMode}
          onValueChange={handleModeChange}
          disabled={isPending || updateModeMutation.isPending}
          options={[
            {
              value: "hybrid",
              label: "Hybrid Mode (Recommended)",
              description: "Balances executive targets with local map density",
            },
            {
              value: "top-down",
              label: "Top-Down (Macro-Driven)",
              description: "National executive stats distribute down to map tiles",
            },
            {
              value: "bottom-up",
              label: "Bottom-Up (Geometry-Driven)",
              description: "Map terrain and cities strictly calculate national totals",
            },
          ]}
        />

        <SettingsRow
          label="Rebase from Map"
          description={
            rollups
              ? `Current map total: ${Number(rollups.subdivisionPopulationSum ?? 0).toLocaleString()} citizens (${Math.round((rollups.populationCoverage ?? 0) * 100)}% coverage)`
              : "Synchronize national baseline stats directly from geographic map entities"
          }
          icon={RefreshCw}
          glyphClass="bg-muted/60 text-foreground"
        >
          <button
            type="button"
            onClick={handleRebase}
            disabled={rebaseMutation.isPending}
            data-cuelume-press="soft"
            className="facet-interactive flex items-center gap-1.5 rounded-xl border border-border/60 bg-secondary/80 px-3 py-1.5 text-xs font-semibold text-foreground transition-all hover:bg-secondary active:scale-[0.98] disabled:opacity-50"
          >
            <RefreshCw
              className={`h-3 w-3 ${rebaseMutation.isPending ? "animate-spin" : ""}`}
            />
            <span>{rebaseMutation.isPending ? "Rebasing..." : "Rebase Stats"}</span>
          </button>
        </SettingsRow>
      </SettingsGroup>
    </div>
  );
}
