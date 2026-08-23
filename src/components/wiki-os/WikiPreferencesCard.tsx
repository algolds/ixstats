// src/components/wiki-os/WikiPreferencesCard.tsx
// Wiki & Lore settings card for user profile / settings page.
// Manages Primary Knowledge Base Sources, Autonomous Lore Scanner, Interface Integration,
// and system-level wiki engine configuration.

"use client";

import { useState, useEffect } from "react";
import { OpenBook as BookOpen, Compass } from "iconoir-react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Switch } from "~/components/ui/switch";
import { Label } from "~/components/ui/label";
import { api } from "~/trpc/react";
import { cn } from "~/lib/utils";
import { TextureOverlay } from "~/components/ui/texture-overlay";

type WikiSource = "ixwiki" | "iiwiki" | "both";
type WikiDisplayMode = "inline" | "sidebar" | "hidden";

interface WikiPreferences {
  wikiAutoScan: boolean;
  wikiSourcePriority: WikiSource;
  wikiDisplayMode: WikiDisplayMode;
}

const SOURCE_OPTIONS: { value: WikiSource; label: string; description: string }[] = [
  { value: "ixwiki", label: "IxWiki first", description: "Prefer IxWiki articles & primary canon" },
  { value: "iiwiki", label: "IIWiki first", description: "Prefer IIWiki external articles" },
  { value: "both", label: "Both (Federated)", description: "Query and federate results across both wikis" },
];

const DISPLAY_OPTIONS: { value: WikiDisplayMode; label: string; description: string }[] = [
  {
    value: "inline",
    label: "Inline with stats",
    description: "Lore sections appear seamlessly alongside nation stats",
  },
  { value: "sidebar", label: "Sidebar only", description: "Lore content in dedicated sidebar panels" },
  { value: "hidden", label: "Hidden", description: "Disable lore display entirely" },
];

export function WikiSettingsCard() {
  const utils = api.useUtils();

  const { data: preferences, isLoading } = api.users.getPreferences.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });

  const updateMutation = api.users.updateWikiPreferences.useMutation({
    onSuccess: () => {
      void utils.users.getPreferences.invalidate();
    },
  });

  const [localPrefs, setLocalPrefs] = useState<WikiPreferences>({
    wikiAutoScan: true,
    wikiSourcePriority: "ixwiki",
    wikiDisplayMode: "inline",
  });

  // Sync from server when loaded
  useEffect(() => {
    if (preferences) {
      setLocalPrefs({
        wikiAutoScan: preferences.wikiAutoScan ?? true,
        wikiSourcePriority: (preferences.wikiSourcePriority as WikiSource) ?? "ixwiki",
        wikiDisplayMode: (preferences.wikiDisplayMode as WikiDisplayMode) ?? "inline",
      });
    }
  }, [preferences]);

  function handleUpdate(patch: Partial<WikiPreferences>) {
    const updated = { ...localPrefs, ...patch };
    setLocalPrefs(updated);
    updateMutation.mutate(updated);
  }

  if (isLoading) {
    return (
      <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <BookOpen className="h-5 w-5 text-indigo-500" />
            Wiki Settings
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="bg-muted h-6 w-48 rounded" />
            <div className="bg-muted h-6 w-64 rounded" />
            <div className="bg-muted h-6 w-56 rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="facet-surface facet-refraction overflow-hidden rounded-3xl p-1 transition-all duration-500 hover:shadow-2xl">
      <div className="dark:bg-card/60 relative overflow-hidden rounded-[calc(1.5rem-1px)] bg-white/40 p-6">
        <TextureOverlay texture="paperGrain" opacity={0.03} />
        <div className="relative z-10 mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400">
              <BookOpen className="h-6 w-6" />
            </div>
            <div>
              <h2 className="dark:text-foreground text-xl font-bold text-slate-900">
                Wiki Settings
              </h2>
              <p className="text-muted-foreground text-xs font-medium">
                Configure Primary Knowledge Base Sources, Autonomous Lore Scanner, and interface integration preferences.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {/* Autonomous Lore Scanner */}
          <div className="dark:bg-secondary/50 flex items-center justify-between rounded-2xl bg-slate-50/50 p-4">
            <div>
              <Label
                htmlFor="wiki-auto-scan"
                className="dark:text-foreground text-sm font-bold text-slate-900 flex items-center gap-2"
              >
                <Compass className="h-4 w-4 text-indigo-500" />
                Autonomous Lore Scanner
              </Label>
              <p className="dark:text-muted-foreground text-xs font-medium text-slate-500">
                Auto-scan and index national lore, stats, and MediaWiki articles across IxStates
              </p>
            </div>
            <Switch
              id="wiki-auto-scan"
              checked={localPrefs.wikiAutoScan}
              onCheckedChange={(checked) => handleUpdate({ wikiAutoScan: checked })}
              disabled={updateMutation.isPending}
              className="data-[state=checked]:bg-indigo-600"
            />
          </div>

          {/* Primary Knowledge Base Source */}
          <div className="space-y-3">
            <label className="dark:text-muted-foreground block text-[10px] font-bold tracking-wider text-slate-400 uppercase">
              Primary Knowledge Base Source
            </label>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {SOURCE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleUpdate({ wikiSourcePriority: option.value })}
                  disabled={updateMutation.isPending}
                  className={cn(
                    "facet-interactive flex flex-col gap-1 rounded-2xl border p-4 text-left transition-all duration-150 cursor-pointer",
                    localPrefs.wikiSourcePriority === option.value
                      ? "dark:text-foreground border-indigo-500/50 bg-indigo-500/10 text-slate-900 shadow-inner shadow-indigo-500/5"
                      : "dark:border-border dark:bg-secondary/40 dark:text-muted-foreground dark:hover:bg-secondary border-slate-200 bg-white/30 text-slate-600 hover:bg-white"
                  )}
                >
                  <span className="text-xs font-bold tracking-widest uppercase">
                    {option.label}
                  </span>
                  <span className="text-[10px] font-medium opacity-70">{option.description}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Interface Integration */}
          <div className="space-y-3">
            <label className="dark:text-muted-foreground block text-[10px] font-bold tracking-wider text-slate-400 uppercase">
              Interface Integration
            </label>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {DISPLAY_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleUpdate({ wikiDisplayMode: option.value })}
                  disabled={updateMutation.isPending}
                  className={cn(
                    "facet-interactive flex flex-col gap-1 rounded-2xl border p-4 text-left transition-all duration-150 cursor-pointer",
                    localPrefs.wikiDisplayMode === option.value
                      ? "dark:text-foreground border-indigo-500/50 bg-indigo-500/10 text-slate-900 shadow-inner shadow-indigo-500/5"
                      : "dark:border-border dark:bg-secondary/40 dark:text-muted-foreground dark:hover:bg-secondary border-slate-200 bg-white/30 text-slate-600 hover:bg-white"
                  )}
                >
                  <span className="text-xs font-bold tracking-widest uppercase">
                    {option.label}
                  </span>
                  <span className="text-[10px] font-medium opacity-70">{option.description}</span>
                </button>
              ))}
            </div>
          </div>

          {(updateMutation.isPending || updateMutation.isError) && (
            <div className="mt-4 flex items-center justify-center">
              {updateMutation.isPending && (
                <p className="animate-pulse text-[10px] font-bold tracking-widest text-indigo-500 uppercase">
                  Synchronizing State...
                </p>
              )}
              {updateMutation.isError && (
                <p className="text-[10px] font-bold tracking-widest text-red-500 uppercase">
                  Transmission Failed
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Backwards compatibility alias
export const WikiPreferencesCard = WikiSettingsCard;
