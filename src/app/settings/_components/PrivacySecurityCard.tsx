import { useState, useEffect } from "react";
import Link from "next/link";
import { Shield, Lock, RefreshCw, Database, Key, FileText, ExternalLink } from "lucide-react";
import { Switch } from "~/components/ui/switch";
import { Label } from "~/components/ui/label";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { TextureOverlay } from "~/components/ui/texture-overlay";
import { useClerk } from "@clerk/nextjs";
import { useConsentManager, useConsentDialogTrigger } from "@c15t/nextjs";

interface PrivacySecurityCardProps {
  countryId?: string | null;
  initialHideDiplomatic?: boolean;
  initialHideStratcomm?: boolean;
}

export function PrivacySecurityCard({
  countryId,
  initialHideDiplomatic = false,
  initialHideStratcomm = false,
}: PrivacySecurityCardProps) {
  const notify = useNotify();
  const utils = api.useUtils();
  const clerk = useClerk();

  const { consents, consentCategories } = useConsentManager();
  const { openDialog } = useConsentDialogTrigger();

  // Queries
  const { data: preferences, isLoading: prefsLoading } = api.users.getPreferences.useQuery(
    undefined,
    {
      refetchOnWindowFocus: false,
    }
  );

  // Mutations
  const updateCountryMutation = api.countries.update.useMutation({
    onSuccess: () => {
      notify.success("Country visibility settings synchronized.");
      void utils.users.getProfile.invalidate();
    },
    onError: (err) => {
      notify.error("Synchronization failed", err.message);
    },
  });

  const updatePrefsMutation = api.users.updateWikiPreferences.useMutation({
    onSuccess: () => {
      notify.success("User intelligence scanning preferences updated.");
      void utils.users.getPreferences.invalidate();
    },
  });

  // Local State
  const [hideDiplomatic, setHideDiplomatic] = useState(initialHideDiplomatic);
  const [hideStratcomm, setHideStratcomm] = useState(initialHideStratcomm);
  const [autoScan, setAutoScan] = useState(true);

  // Sync from props and query
  useEffect(() => {
    setHideDiplomatic(initialHideDiplomatic);
  }, [initialHideDiplomatic]);

  useEffect(() => {
    setHideStratcomm(initialHideStratcomm);
  }, [initialHideStratcomm]);

  useEffect(() => {
    if (preferences) {
      setAutoScan(preferences.wikiAutoScan ?? true);
    }
  }, [preferences]);

  const handleCountryToggle = async (
    field: "hideDiplomaticOps" | "hideStratcommIntel",
    current: boolean
  ) => {
    if (!countryId) {
      notify.error("Privacy Error", "No active country claim associated with this session.");
      return;
    }

    // Optimistic UI updates
    if (field === "hideDiplomaticOps") setHideDiplomatic(!current);
    if (field === "hideStratcommIntel") setHideStratcomm(!current);

    updateCountryMutation.mutate({
      id: countryId,
      [field]: !current,
    });
  };

  const handlePrefsToggle = (checked: boolean) => {
    setAutoScan(checked);
    updatePrefsMutation.mutate({
      wikiAutoScan: checked,
    });
  };

  const handleClearCache = () => {
    localStorage.removeItem("settings:active-cosmetics");
    localStorage.removeItem("settings:active-upgrades");
    notify.success(
      "Client Preferences Cleared",
      "Reset active cosmetics and upgrades to defaults."
    );
    window.dispatchEvent(new Event("cosmetics-updated"));
    window.dispatchEvent(new Event("upgrades-updated"));
    // reload or reset state in other card since state is local in VaultSettingsCard
    setTimeout(() => window.location.reload(), 800);
  };

  return (
    <div className="glass-surface glass-refraction overflow-hidden rounded-3xl p-1 transition-all duration-500 hover:shadow-2xl">
      <div className="relative overflow-hidden rounded-[calc(1.5rem-1px)] bg-white/40 p-5 dark:bg-slate-900/40">
        <TextureOverlay texture="triangular" opacity={0.02} />

        {/* Card Header */}
        <div className="relative z-10 mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/10 text-purple-600 dark:bg-purple-500/20 dark:text-purple-400">
              <Shield className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                Privacy & Security
              </h2>
            </div>
          </div>
        </div>

        {/* Visibility and security controls grid */}
        <div className="relative z-10 space-y-4">
          {/* Public Profile Discoverability */}
          <div className="flex items-center justify-between rounded-2xl bg-slate-50/50 p-4 dark:bg-slate-800/30">
            <div className="mr-4">
              <Label
                htmlFor="hide-diplomatic"
                className="text-sm font-bold text-slate-900 dark:text-white"
              >
                Global Discoverability
              </Label>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Prevent your user account and player country from appearing in directories, lists,
                and public searches.
              </p>
            </div>
            <Switch
              id="hide-diplomatic"
              checked={hideDiplomatic}
              onCheckedChange={() => handleCountryToggle("hideDiplomaticOps", hideDiplomatic)}
              disabled={updateCountryMutation.isPending || !countryId}
              className="data-[state=checked]:bg-purple-600"
            />
          </div>

          {/* Audit Telemetry Opt-Out */}
          <div className="flex items-center justify-between rounded-2xl bg-slate-50/50 p-4 dark:bg-slate-800/30">
            <div className="mr-4">
              <Label
                htmlFor="hide-stratcomm"
                className="text-sm font-bold text-slate-900 dark:text-white"
              >
                Performance Telemetry Opt-Out
              </Label>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Restrict tracking of client stability logs, diagnostic usage metrics, and interface
                latency statistics.
              </p>
            </div>
            <Switch
              id="hide-stratcomm"
              checked={hideStratcomm}
              onCheckedChange={() => handleCountryToggle("hideStratcommIntel", hideStratcomm)}
              disabled={updateCountryMutation.isPending || !countryId}
              className="data-[state=checked]:bg-purple-600"
            />
          </div>

          {/* Auto wiki scanning */}
          <div className="flex items-center justify-between rounded-2xl bg-slate-50/50 p-4 dark:bg-slate-800/30">
            <div className="mr-4">
              <Label
                htmlFor="privacy-auto-scan"
                className="text-sm font-bold text-slate-900 dark:text-white"
              >
                Autonomous Intelligence Scanner
              </Label>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Allow background crawlers to scan for relevant wiki articles and update your Lore
                index.
              </p>
            </div>
            <Switch
              id="privacy-auto-scan"
              checked={autoScan}
              onCheckedChange={handlePrefsToggle}
              disabled={prefsLoading || updatePrefsMutation.isPending}
              className="data-[state=checked]:bg-purple-600"
            />
          </div>

          {/* Cookie & Consent Preferences (c15t) */}
          <div className="flex items-center justify-between rounded-2xl bg-slate-50/50 p-4 dark:bg-slate-800/30">
            <div className="mr-4">
              <Label className="text-sm font-bold text-slate-900 dark:text-white">
                Cookie & Consent Preferences
              </Label>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Manage your cookie preferences, check your active consent statuses, or modify your
                opt-in categories.
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {consentCategories?.map((category) => {
                  const isGranted = consents?.[category];
                  return (
                    <span
                      key={category}
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold capitalize ${
                        isGranted
                          ? "bg-green-500/10 text-green-600 dark:bg-green-500/20 dark:text-green-400"
                          : "bg-slate-500/10 text-slate-600 dark:bg-slate-500/20 dark:text-slate-400"
                      }`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${isGranted ? "bg-green-500" : "bg-slate-400"}`}
                      />
                      {category}
                    </span>
                  );
                })}
              </div>
            </div>
            <button
              onClick={() => openDialog()}
              className="glass-interactive flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200/50 bg-white/50 px-3 py-2 text-xs font-bold text-slate-700 transition-all hover:bg-white dark:border-slate-700/50 dark:bg-slate-800/50 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <Lock className="h-3.5 w-3.5" />
              Manage Preferences
            </button>
          </div>

          {/* Security Credentials & MFA Console */}
          <div className="flex items-center justify-between rounded-2xl bg-slate-50/50 p-4 dark:bg-slate-800/30">
            <div className="mr-4">
              <Label className="text-sm font-bold text-slate-900 dark:text-white">
                Account Credentials & MFA
              </Label>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Configure your authentication password, manage Multi-Factor Authentication (MFA),
                and inspect active sessions.
              </p>
            </div>
            <button
              onClick={() => clerk.openUserProfile()}
              className="glass-interactive flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200/50 bg-white/50 px-3 py-2 text-xs font-bold text-slate-700 transition-all hover:bg-white dark:border-slate-700/50 dark:bg-slate-800/50 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <Key className="h-3.5 w-3.5" />
              Open Console
            </button>
          </div>

          {/* Legal Documents & Data Rights */}
          <div className="flex flex-col justify-between gap-4 rounded-2xl bg-slate-50/50 p-4 sm:flex-row sm:items-center dark:bg-slate-800/30">
            <div>
              <Label className="text-sm font-bold text-slate-900 dark:text-white">
                Legal &amp; Privacy Rights
              </Label>
              <p className="max-w-md text-xs font-medium text-slate-500 dark:text-slate-400">
                Review our platform terms, acceptable use guidelines, zero-sale privacy policy, and
                GDPR/CCPA data erasure procedures.
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Link
                href="/terms"
                className="glass-interactive inline-flex items-center gap-1 rounded-lg border border-slate-200/50 bg-white/50 px-3 py-2 text-xs font-bold text-slate-700 transition-all hover:bg-white dark:border-slate-700/50 dark:bg-slate-800/50 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <FileText className="h-3.5 w-3.5 text-amber-500" />
                Terms
              </Link>
              <Link
                href="/privacy"
                className="glass-interactive inline-flex items-center gap-1 rounded-lg border border-slate-200/50 bg-white/50 px-3 py-2 text-xs font-bold text-slate-700 transition-all hover:bg-white dark:border-slate-700/50 dark:bg-slate-800/50 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <Shield className="h-3.5 w-3.5 text-purple-500" />
                Privacy
              </Link>
            </div>
          </div>

          {/* Danger zone / clear data */}
          <div className="flex items-center justify-between border-t border-slate-100 pt-5 dark:border-slate-800">
            <div>
              <h3 className="flex items-center gap-1.5 text-xs font-bold tracking-widest text-slate-900 uppercase dark:text-white">
                <Database className="h-3.5 w-3.5 text-slate-400" />
                Data Controls
              </h3>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">
                Clear locally cached UI preferences, active upgrades, and storefront custom
                cosmetics.
              </p>
            </div>
            <button
              onClick={handleClearCache}
              className="glass-interactive flex items-center gap-1.5 rounded-lg border border-red-200/50 bg-red-500/5 px-3 py-1.5 text-xs font-bold text-red-600 transition-all hover:bg-red-500/10 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-950/20"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Reset Cache
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
