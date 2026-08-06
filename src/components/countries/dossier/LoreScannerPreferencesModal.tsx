"use client";

import React from "react";
import { X, Settings, Sparkles, RefreshCw, Search, Check } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import { WikiPageSearch } from "~/components/countries/WikiPageSearch";
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
      <DialogContent className="max-w-xl max-h-[85vh] flex flex-col p-0 overflow-hidden bg-zinc-950/95 border-white/10 backdrop-blur-xl shadow-2xl">
        <DialogHeader className="px-6 py-4 border-b border-white/10 flex flex-row items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-500/15 border border-blue-500/25 text-blue-400">
              <Settings className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-extrabold uppercase tracking-wider text-foreground">
                LoreScanner Preferences
              </DialogTitle>
              <p className="text-xs text-muted-foreground">
                Sync settings & manual wiki page locator for <strong className="text-foreground">{countryName}</strong>
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Section 1: Manual Page Finder & Sync */}
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-foreground">
              <Search className="h-4 w-4 text-blue-400" />
              <span>Manually Search & Link Wiki Page</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
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
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
              Intelligence Data Sources
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-3 cursor-pointer hover:bg-white/[0.04] transition-colors">
                <input
                  type="checkbox"
                  checked={wikiSettings.enableIxWiki}
                  onChange={(e) =>
                    setWikiSettings((prev) => ({ ...prev, enableIxWiki: e.target.checked }))
                  }
                  className="h-4 w-4 rounded text-blue-600 focus:ring-0"
                />
                <div>
                  <div className="text-xs font-bold text-foreground">IxWiki Engine</div>
                  <div className="text-[10px] text-muted-foreground">Primary community database</div>
                </div>
              </label>

              <label className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-3 cursor-pointer hover:bg-white/[0.04] transition-colors">
                <input
                  type="checkbox"
                  checked={wikiSettings.enableIiWiki}
                  onChange={(e) =>
                    setWikiSettings((prev) => ({ ...prev, enableIiWiki: e.target.checked }))
                  }
                  className="h-4 w-4 rounded text-blue-600 focus:ring-0"
                />
                <div>
                  <div className="text-xs font-bold text-foreground">IIWiki Integration</div>
                  <div className="text-[10px] text-muted-foreground">External alliance wiki</div>
                </div>
              </label>
            </div>
          </div>

          {/* Section 3: Automatic Topic Discovery */}
          <div className="space-y-3">
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
              Automatic Topic Discovery
            </h4>
            <div className="space-y-2">
              <label className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.02] p-3 cursor-pointer hover:bg-white/[0.04] transition-colors">
                <div>
                  <div className="text-xs font-bold text-foreground">Topic-Specific Subpages</div>
                  <div className="text-[10px] text-muted-foreground">
                    Auto-scans &quot;Economy of {countryName}&quot;, &quot;History of {countryName}&quot;, etc.
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
        <div className="p-4 border-t border-white/10 flex items-center justify-end gap-2 bg-black/40">
          <Button variant="ghost" size="sm" onClick={onClose} className="text-xs">
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleApply}
            disabled={isApplying}
            className="bg-blue-600 hover:bg-blue-500 text-white font-bold gap-1.5 text-xs shadow-md"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isApplying ? "animate-spin" : ""}`} />
            Save Preferences & Sync
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
