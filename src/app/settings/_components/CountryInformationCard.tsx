import { useState } from "react";
import {
  Image as ImageIcon,
  Type as TypeIcon,
  Save,
  X,
  Activity,
  ArrowLeftRight,
  TrendingUp,
  Users,
  DollarSign,
} from "lucide-react";
import Link from "next/link";
import { getCountryPath } from "~/lib/utils";
import { FlagUploadSection } from "./FlagUploadSection";
import CountryFlag from "~/app/_components/CountryFlag";
import { TextureOverlay } from "~/components/ui/texture-overlay";

interface CountryInformationCardProps {
  country: {
    id: string;
    name: string;
    economicTier: string | null;
    currentPopulation: number | null;
    currentGdpPerCapita: number | null;
    currentTotalGdp?: number | null;
    populationGrowthRate?: number | null;
    adjustedGdpGrowth?: number | null;
    slug?: string | null;
  };
  uploadedFlagUrl: string | null;
  flagUploadMode: boolean;
  isEditingCountry: boolean;
  newCountryName: string;
  updateCountryNameMutation: { isPending: boolean };
  onEditCountry: () => void;
  onUpdateCountryName: () => void;
  onCancelEdit: () => void;
  onSetNewCountryName: (name: string) => void;
  onToggleFlagUpload: () => void;
  onFlagUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onFlagSave: () => void;
  onCancelFlagUpload: () => void;
  isUploadingFlag: boolean;
  updateCountryFlagMutation: { isPending: boolean };
  membershipTier?: string;
  role?: {
    name: string;
    displayName: string;
    description: string | null;
  } | null;
}

export function CountryInformationCard({
  country,
  uploadedFlagUrl,
  flagUploadMode,
  isEditingCountry,
  newCountryName,
  updateCountryNameMutation,
  onEditCountry,
  onUpdateCountryName,
  onCancelEdit,
  onSetNewCountryName,
  onToggleFlagUpload,
  onFlagUpload,
  onFlagSave,
  onCancelFlagUpload,
  isUploadingFlag,
  updateCountryFlagMutation,
  membershipTier,
  role,
}: CountryInformationCardProps) {
  const [economyView, setEconomyView] = useState<"per-capita" | "total">("per-capita");
  const [populationView, setPopulationView] = useState<"total" | "growth">("total");
  const countryPath = getCountryPath({
    id: country.id,
    name: country.name,
    slug: country.slug,
  });

  return (
    <div className="glass-surface glass-refraction group overflow-hidden rounded-3xl p-1 transition-all duration-500 hover:shadow-2xl">
      <div className="relative overflow-hidden rounded-[calc(1.5rem-1px)] bg-white/40 p-6 dark:bg-slate-900/40">
        <TextureOverlay texture="grid" opacity={0.025} />
        <div className="relative z-10 mb-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                MyCountry Account
              </h2>
            </div>
          </div>
          <Link
            href={countryPath}
            className="glass-interactive flex items-center gap-2 rounded-xl bg-white/50 px-4 py-2 text-sm font-semibold text-indigo-600 transition-all hover:bg-white dark:bg-slate-800/50 dark:text-indigo-400 dark:hover:bg-slate-800"
          >
            View MyCountry
          </Link>
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl bg-slate-50/50 p-5 dark:bg-slate-800/30">
            <label className="mb-3 block text-[10px] font-bold tracking-wider text-slate-400 uppercase dark:text-slate-500">
              Primary Country
            </label>
            {isEditingCountry ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newCountryName}
                  onChange={(e) => onSetNewCountryName(e.target.value)}
                  className="flex-1 rounded-xl border border-slate-200 bg-white/80 px-4 py-2 text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-900/80 dark:text-white"
                  placeholder={country.name}
                />
                <button
                  onClick={onUpdateCountryName}
                  disabled={updateCountryNameMutation.isPending}
                  className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500 text-white shadow-lg shadow-emerald-500/20 transition-all hover:bg-emerald-600 disabled:opacity-50"
                >
                  <Save className="h-5 w-5" />
                </button>
                <button
                  onClick={onCancelEdit}
                  className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-200 text-slate-600 transition-all hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="relative h-12 w-20 overflow-hidden rounded-lg border border-slate-200 shadow-sm dark:border-slate-700">
                    {uploadedFlagUrl ? (
                      <img
                        src={uploadedFlagUrl}
                        alt="Custom flag"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <CountryFlag
                        countryCode={country.name.substring(0, 2).toUpperCase()}
                        countryName={country.name}
                        className="h-full w-full object-cover"
                      />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
                  </div>
                  <div>
                    <p className="text-lg font-bold text-slate-900 dark:text-white">
                      {country.name}
                    </p>
                    <div className="relative z-10 mt-1 flex flex-wrap items-center gap-1.5">
                      <span className="text-[10px] font-bold tracking-tighter text-indigo-500 uppercase dark:text-indigo-400">
                        Active Player Country
                      </span>
                      {role && (
                        <span
                          className="inline-flex items-center gap-1 rounded-md border border-purple-500/20 bg-purple-500/10 px-2 py-0.5 text-[9px] font-bold text-purple-600 dark:bg-purple-400/20 dark:text-purple-400"
                          title={role.description || undefined}
                        >
                          👑 {role.displayName || role.name}
                        </span>
                      )}
                      {membershipTier && (
                        <span
                          className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[9px] font-bold ${
                            membershipTier === "premium"
                              ? "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                              : "border-slate-500/20 bg-slate-500/10 text-slate-600 dark:text-slate-400"
                          }`}
                        >
                          ✨ {membershipTier.toUpperCase()}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={onToggleFlagUpload}
                    className="flex h-9 w-9 items-center justify-center rounded-lg bg-white shadow-sm transition-all hover:scale-110 dark:bg-slate-800"
                    title="Update Insignia"
                  >
                    <ImageIcon className="h-4 w-4 text-blue-500" />
                  </button>
                  <button
                    onClick={onEditCountry}
                    className="flex h-9 w-9 items-center justify-center rounded-lg bg-white shadow-sm transition-all hover:scale-110 dark:bg-slate-800"
                    title="Rename Sovereignty"
                  >
                    <TypeIcon className="h-4 w-4 text-indigo-500" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {flagUploadMode && (
            <div className="rounded-2xl border-2 border-dashed border-slate-200 p-4 dark:border-slate-700">
              <FlagUploadSection
                uploadedFlagUrl={uploadedFlagUrl}
                isUploadingFlag={isUploadingFlag}
                updateCountryFlagMutation={updateCountryFlagMutation}
                onFlagUpload={onFlagUpload}
                onFlagSave={onFlagSave}
                onCancel={onCancelFlagUpload}
              />
            </div>
          )}

          <div className="mt-4 border-t border-slate-100 pt-6 dark:border-slate-800">
            <div className="mb-4 flex items-center gap-2">
              <Activity className="h-4 w-4 text-emerald-500" />
              <h3 className="text-sm font-bold tracking-widest text-slate-900 uppercase dark:text-white">
                MyCountry at a glance
              </h3>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="rounded-2xl bg-slate-50/50 p-4 dark:bg-slate-800/30">
                <div className="mb-2 flex items-center justify-between">
                  <label className="text-[10px] font-bold tracking-wider text-slate-400 uppercase dark:text-slate-500">
                    Economic Vitality
                  </label>
                  <TrendingUp className="h-3 w-3 text-emerald-500" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-medium text-slate-500">GDP Growth</span>
                    <span
                      className={`text-[10px] font-bold ${(country.adjustedGdpGrowth ?? 0) >= 0 ? "text-emerald-600" : "text-rose-600"}`}
                    >
                      {(country.adjustedGdpGrowth ?? 0) >= 0 ? "+" : ""}
                      {((country.adjustedGdpGrowth ?? 0) * 100).toFixed(2)}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-medium text-slate-500">Stability</span>
                    <span className="text-[10px] font-bold text-indigo-600">
                      {country.economicTier}
                    </span>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl bg-slate-50/50 p-4 dark:bg-slate-800/30">
                <div className="mb-2 flex items-center justify-between">
                  <label className="text-[10px] font-bold tracking-wider text-slate-400 uppercase dark:text-slate-500">
                    Population {populationView === "growth" ? "Expansion" : "Metrics"}
                  </label>
                  <button
                    onClick={() =>
                      setPopulationView(populationView === "total" ? "growth" : "total")
                    }
                    className="rounded-lg p-1 transition-colors hover:bg-slate-200 dark:hover:bg-slate-700"
                  >
                    <ArrowLeftRight className="h-3 w-3 text-slate-400" />
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-blue-500" />
                  <p className="text-sm font-bold text-slate-900 dark:text-white">
                    {populationView === "total"
                      ? Math.round(country.currentPopulation ?? 0).toLocaleString()
                      : `${((country.populationGrowthRate ?? 0) * 100).toFixed(2)}%`}
                    {populationView === "growth" && (
                      <span className="ml-1 text-[10px] font-medium text-slate-500">Growth</span>
                    )}
                  </p>
                </div>
              </div>

              <div className="rounded-2xl bg-slate-50/50 p-4 dark:bg-slate-800/30">
                <div className="mb-2 flex items-center justify-between">
                  <label className="text-[10px] font-bold tracking-wider text-slate-400 uppercase dark:text-slate-500">
                    Financials {economyView === "per-capita" ? "(P/C)" : "(Total)"}
                  </label>
                  <button
                    onClick={() =>
                      setEconomyView(economyView === "per-capita" ? "total" : "per-capita")
                    }
                    className="rounded-lg p-1 transition-colors hover:bg-slate-200 dark:hover:bg-slate-700"
                  >
                    <ArrowLeftRight className="h-3 w-3 text-slate-400" />
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-amber-500" />
                  <p className="text-sm font-bold text-slate-900 dark:text-white">
                    {economyView === "per-capita"
                      ? `$${(country.currentGdpPerCapita ?? 0).toLocaleString()}`
                      : `$${Math.round(country.currentTotalGdp ?? (country.currentGdpPerCapita ?? 0) * (country.currentPopulation ?? 0)).toLocaleString()}`}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
