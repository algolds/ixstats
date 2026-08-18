"use client";

import React from "react";
import { X, Settings, Sparkles, RefreshCw, Search, Check } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import { WikiPageSearch } from "~/components/mycountry/dossier/WikiPageSearch";
import type { WikiSettings } from "~/types/dossier";

interface LoreScannerPreferencesModalProps {
  isOpen: boolean;
  onClose: () => void;
  wikiSettings: WikiSettings;
  setWikiSettings: (settings: WikiSettings | ((prev: WikiSettings) => WikiSettings)) => void;
  countryName: string;
  onApplySettings: () => Promise<void>;
  isApplying: boolean;
}

export function LoreScannerPreferencesModal({
  isOpen,
  onClose,
  wikiSettings,
  setWikiSettings,
  countryName,
  onApplySettings,
  isApplying,
}: LoreScannerPreferencesModalProps) {
  const handleApply = async () => {
    await onApplySettings();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="flex max-h-[85vh] max-w-xl flex-col overflow-hidden border-white/10 bg-zinc-950/95 p-0 shadow-2xl backdrop-blur-xl">
        <DialogHeader className="flex flex-row items-center justify-between border-b border-white/10 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl border border-blue-500/25 bg-blue-500/15 p-2 text-blue-400">
              <Settings className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-foreground text-base font-extrabold tracking-wider uppercase">
                LoreScanner Preferences
              </DialogTitle>
              <p className="text-muted-foreground text-xs">
                Sync settings & manual wiki page locator for{" "}
                <strong className="text-foreground">{countryName}</strong>
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 space-y-6 overflow-y-auto p-6">
          {/* Section 1: Manual Page Finder & Sync */}
          <div className="space-y-3 rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <div className="text-foreground flex items-center gap-2 text-xs font-bold tracking-wider uppercase">
              <Search className="h-4 w-4 text-blue-400" />
              <span>Manually Search & Link Wiki Page</span>
            </div>
            <p className="text-muted-foreground text-xs leading-relaxed">
              Search WikiOS or enter custom MediaWiki page titles to link directly to this dossier.
            </p>
            <WikiPageSearch
              selectedPages={wikiSettings.customPages}
              onPagesChange={(pages: string[]) =>
                setWikiSettings((prev) => ({ ...prev, customPages: pages }))
              }
              countryName={countryName}
            />
          </div>

          {/* Section 2: LoreScanner Sources */}
          <div className="space-y-3">
            <h4 className="text-muted-foreground text-xs font-extrabold tracking-wider uppercase">
              Intelligence Data Sources
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-3 transition-colors hover:bg-white/[0.04]">
                <input
                  type="checkbox"
                  checked={wikiSettings.enableIxWiki}
                  onChange={(e) =>
                    setWikiSettings((prev) => ({ ...prev, enableIxWiki: e.target.checked }))
                  }
                  className="h-4 w-4 rounded text-blue-600 focus:ring-0"
                />
                <div>
                  <div className="text-foreground text-xs font-bold">IxWiki Engine</div>
                  <div className="text-muted-foreground text-[10px]">
                    Primary community database
                  </div>
                </div>
              </label>

              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-3 transition-colors hover:bg-white/[0.04]">
                <input
                  type="checkbox"
                  checked={wikiSettings.enableIIWiki}
                  onChange={(e) =>
                    setWikiSettings((prev) => ({ ...prev, enableIIWiki: e.target.checked }))
                  }
                  className="h-4 w-4 rounded text-blue-600 focus:ring-0"
                />
                <div>
                  <div className="text-foreground text-xs font-bold">IIWiki Integration</div>
                  <div className="text-muted-foreground text-[10px]">External alliance wiki</div>
                </div>
              </label>
            </div>
          </div>

          {/* Section 3: Automatic Topic Discovery */}
          <div className="space-y-3">
            <h4 className="text-muted-foreground text-xs font-extrabold tracking-wider uppercase">
              Automatic Topic Discovery
            </h4>
            <div className="space-y-2">
              <label className="flex cursor-pointer items-center justify-between rounded-xl border border-white/10 bg-white/[0.02] p-3 transition-colors hover:bg-white/[0.04]">
                <div>
                  <div className="text-foreground text-xs font-bold">Topic-Specific Subpages</div>
                  <div className="text-muted-foreground text-[10px]">
                    Auto-scans &quot;Economy of {countryName}&quot;, &quot;History of {countryName}
                    &quot;, etc.
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={wikiSettings.pageVariants.useTopicPages}
                  onChange={(e) =>
                    setWikiSettings((prev) => ({
                      ...prev,
                      pageVariants: {
                        ...prev.pageVariants,
                        useTopicPages: e.target.checked,
                      },
                    }))
                  }
                  className="h-4 w-4 rounded text-blue-600"
                />
              </label>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2 border-t border-white/10 bg-black/40 p-4">
          <Button variant="ghost" size="sm" onClick={onClose} className="text-xs">
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleApply}
            disabled={isApplying}
            className="gap-1.5 bg-blue-600 text-xs font-bold text-white shadow-md hover:bg-blue-500"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isApplying ? "animate-spin" : ""}`} />
            Save Preferences & Sync
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
