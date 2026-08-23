"use client";

import { Coins, Crown as Gem, Shield, ScaleFrameEnlarge as Scale, Palette, Bell, Link as Link2, WhiteFlag as Flag, OpenBook as BookOpen, User, Settings } from "iconoir-react";
import {
  CutoutCard,
  CutoutCardContent,
  CutoutCorner,
  cutoutCardSurfaceClassName,
} from "~/components/ui/cutout-card";
import { cn } from "~/lib/utils";

export interface SettingsQuickNavProps {
  showVault: boolean;
  setShowVault: (show: boolean | ((prev: boolean) => boolean)) => void;
  showPrivacy: boolean;
  setShowPrivacy: (show: boolean | ((prev: boolean) => boolean)) => void;
  showPreferences: boolean;
  setShowPreferences: (show: boolean | ((prev: boolean) => boolean)) => void;
  showNotifications: boolean;
  setShowNotifications: (show: boolean | ((prev: boolean) => boolean)) => void;
  showLore: boolean;
  setShowLore: (show: boolean | ((prev: boolean) => boolean)) => void;
  showThinkpages: boolean;
  setShowThinkpages: (show: boolean | ((prev: boolean) => boolean)) => void;
  showIxnayID: boolean;
  setShowIxnayID: (show: boolean | ((prev: boolean) => boolean)) => void;
  showGeoReconciliation: boolean;
  setShowGeoReconciliation: (show: boolean | ((prev: boolean) => boolean)) => void;
  showNSCards: boolean;
  setShowNSCards: (show: boolean | ((prev: boolean) => boolean)) => void;
  hasCountryId: boolean;
}

export function SettingsQuickNav({
  showVault,
  setShowVault,
  showPrivacy,
  setShowPrivacy,
  showPreferences,
  setShowPreferences,
  showNotifications,
  setShowNotifications,
  showLore,
  setShowLore,
  showThinkpages,
  setShowThinkpages,
  showIxnayID,
  setShowIxnayID,
  showGeoReconciliation,
  setShowGeoReconciliation,
  showNSCards,
  setShowNSCards,
  hasCountryId,
}: SettingsQuickNavProps) {
  return (
    <div className="h-fit lg:sticky lg:top-6 lg:col-span-4">
      <CutoutCard
        className={cn(cutoutCardSurfaceClassName, "w-full overflow-hidden rounded-xl")}
        trackPointerHover={false}
        texture="dots"
        textureOpacity={0.06}
      >
        {/* Cutout tab header */}
        <div className="relative bg-indigo-500/10 px-4 pt-3.5 pb-5">
          <div className="text-card-foreground flex items-center gap-2 text-sm font-bold">
            <Settings className="h-4 w-4 text-indigo-500" />
            Account Settings
          </div>
          <CutoutCorner className="text-card absolute -bottom-px left-0" size={16} />
          <CutoutCorner
            className="text-card absolute right-0 -bottom-px -scale-x-100"
            size={16}
          />
        </div>

        <CutoutCardContent className="space-y-2 p-4 pt-2">
          <button
            onClick={() => {
              const next = !showVault;
              setShowVault(next);
              if (next)
                setTimeout(
                  () =>
                    document
                      .getElementById("vault-section")
                      ?.scrollIntoView({ behavior: "smooth", block: "start" }),
                  100
                );
            }}
            className={cn(
              "group flex w-full cursor-pointer items-center justify-between rounded-lg border-0 bg-transparent px-3 py-2 text-left text-xs transition-colors outline-none hover:bg-white/5",
              showVault
                ? "bg-white/10 font-bold text-slate-900 dark:bg-white/5 dark:text-white"
                : "font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            )}
          >
            <div className="flex items-center">
              <Coins
                className={cn(
                  "mr-3 h-4 w-4 shrink-0 transition-colors",
                  showVault ? "text-amber-500" : "text-slate-400"
                )}
              />
              Vault Upgrades & Rewards
            </div>
            <div
              className={cn(
                "h-1.5 w-1.5 rounded-full transition-all",
                showVault
                  ? "scale-110 animate-pulse bg-amber-500"
                  : "bg-slate-300 dark:bg-slate-700"
              )}
            />
          </button>

          <button
            onClick={() => {
              const wasOpen = showVault;
              setShowVault(true);
              setTimeout(
                () =>
                  document
                    .getElementById("cosmetics-section")
                    ?.scrollIntoView({ behavior: "smooth", block: "start" }),
                wasOpen ? 50 : 200
              );
            }}
            className={cn(
              "group flex w-full cursor-pointer items-center justify-between rounded-lg border-0 bg-transparent px-3 py-2 text-left text-xs transition-colors outline-none hover:bg-white/5",
              showVault
                ? "font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                : "font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            )}
          >
            <div className="flex items-center">
              <Gem className="mr-3 h-4 w-4 shrink-0 text-purple-500" />
              Cosmetics Preferences
            </div>
            <div className="h-1.5 w-1.5 rounded-full bg-slate-300 dark:bg-slate-700" />
          </button>

          <button
            onClick={() => {
              const next = !showPrivacy;
              setShowPrivacy(next);
              if (next)
                setTimeout(
                  () =>
                    document
                      .getElementById("privacy-section")
                      ?.scrollIntoView({ behavior: "smooth", block: "start" }),
                  100
                );
            }}
            className={cn(
              "group flex w-full cursor-pointer items-center justify-between rounded-lg border-0 bg-transparent px-3 py-2 text-left text-xs transition-colors outline-none hover:bg-white/5",
              showPrivacy
                ? "bg-white/10 font-bold text-slate-900 dark:bg-white/5 dark:text-white"
                : "font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            )}
          >
            <div className="flex items-center">
              <Shield
                className={cn(
                  "mr-3 h-4 w-4 shrink-0 transition-colors",
                  showPrivacy ? "text-purple-500" : "text-slate-400"
                )}
              />
              Privacy & Security
            </div>
            <div
              className={cn(
                "h-1.5 w-1.5 rounded-full transition-all",
                showPrivacy
                  ? "scale-110 animate-pulse bg-purple-500"
                  : "bg-slate-300 dark:bg-slate-700"
              )}
            />
          </button>

          {hasCountryId && (
            <button
              onClick={() => {
                const next = !showGeoReconciliation;
                setShowGeoReconciliation(next);
                if (next)
                  setTimeout(
                    () =>
                      document
                        .getElementById("geo-reconciliation-section")
                        ?.scrollIntoView({ behavior: "smooth", block: "start" }),
                    100
                  );
              }}
              className={cn(
                "group flex w-full cursor-pointer items-center justify-between rounded-lg border-0 bg-transparent px-3 py-2 text-left text-xs transition-colors outline-none hover:bg-white/5",
                showGeoReconciliation
                  ? "bg-white/10 font-bold text-slate-900 dark:bg-white/5 dark:text-white"
                  : "font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              )}
            >
              <div className="flex items-center">
                <Scale
                  className={cn(
                    "mr-3 h-4 w-4 shrink-0 transition-colors",
                    showGeoReconciliation ? "text-indigo-500" : "text-slate-400"
                  )}
                />
                Geographic Reconciliation
              </div>
              <div
                className={cn(
                  "h-1.5 w-1.5 rounded-full transition-all",
                  showGeoReconciliation
                    ? "scale-110 animate-pulse bg-indigo-500"
                    : "bg-slate-300 dark:bg-slate-700"
                )}
              />
            </button>
          )}

          <button
            onClick={() => {
              const next = !showPreferences;
              setShowPreferences(next);
              if (next)
                setTimeout(
                  () =>
                    document
                      .getElementById("interface-section")
                      ?.scrollIntoView({ behavior: "smooth", block: "start" }),
                  100
                );
            }}
            className={cn(
              "group flex w-full cursor-pointer items-center justify-between rounded-lg border-0 bg-transparent px-3 py-2 text-left text-xs transition-colors outline-none hover:bg-white/5",
              showPreferences
                ? "bg-white/10 font-bold text-slate-900 dark:bg-white/5 dark:text-white"
                : "font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            )}
          >
            <div className="flex items-center">
              <Palette
                className={cn(
                  "mr-3 h-4 w-4 shrink-0 transition-colors",
                  showPreferences ? "text-indigo-500" : "text-slate-400"
                )}
              />
              Appearance & Preferences
            </div>
            <div
              className={cn(
                "h-1.5 w-1.5 rounded-full transition-all",
                showPreferences
                  ? "scale-110 animate-pulse bg-indigo-500"
                  : "bg-slate-300 dark:bg-slate-700"
              )}
            />
          </button>

          <button
            onClick={() => {
              const next = !showNotifications;
              setShowNotifications(next);
              if (next)
                setTimeout(
                  () =>
                    document
                      .getElementById("notifications-section")
                      ?.scrollIntoView({ behavior: "smooth", block: "start" }),
                  100
                );
            }}
            className={cn(
              "group flex w-full cursor-pointer items-center justify-between rounded-lg border-0 bg-transparent px-3 py-2 text-left text-xs transition-colors outline-none hover:bg-white/5",
              showNotifications
                ? "bg-white/10 font-bold text-slate-900 dark:bg-white/5 dark:text-white"
                : "font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            )}
          >
            <div className="flex items-center">
              <Bell
                className={cn(
                  "mr-3 h-4 w-4 shrink-0 transition-colors",
                  showNotifications ? "text-amber-500" : "text-slate-400"
                )}
              />
              Notification Preferences
            </div>
            <div
              className={cn(
                "h-1.5 w-1.5 rounded-full transition-all",
                showNotifications
                  ? "scale-110 animate-pulse bg-amber-500"
                  : "bg-slate-300 dark:bg-slate-700"
              )}
            />
          </button>

          <button
            onClick={() => {
              const next = !showIxnayID;
              setShowIxnayID(next);
              if (next)
                setTimeout(
                  () =>
                    document
                      .getElementById("ixnayid-section")
                      ?.scrollIntoView({ behavior: "smooth", block: "start" }),
                  100
                );
            }}
            className={cn(
              "group flex w-full cursor-pointer items-center justify-between rounded-lg border-0 bg-transparent px-3 py-2 text-left text-xs transition-colors outline-none hover:bg-white/5",
              showIxnayID
                ? "bg-white/10 font-bold text-slate-900 dark:bg-white/5 dark:text-white"
                : "font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            )}
          >
            <div className="flex items-center">
              <Link2
                className={cn(
                  "mr-3 h-4 w-4 shrink-0 transition-colors",
                  showIxnayID ? "text-blue-500" : "text-slate-400"
                )}
              />
              IxnayID Identity
            </div>
            <div
              className={cn(
                "h-1.5 w-1.5 rounded-full transition-all",
                showIxnayID
                  ? "scale-110 animate-pulse bg-blue-500"
                  : "bg-slate-300 dark:bg-slate-700"
              )}
            />
          </button>

          <button
            onClick={() => {
              const next = !showNSCards;
              setShowNSCards(next);
              if (next)
                setTimeout(
                  () =>
                    document
                      .getElementById("ns-cards-section")
                      ?.scrollIntoView({ behavior: "smooth", block: "start" }),
                  100
                );
            }}
            className={cn(
              "group flex w-full cursor-pointer items-center justify-between rounded-lg border-0 bg-transparent px-3 py-2 text-left text-xs transition-colors outline-none hover:bg-white/5",
              showNSCards
                ? "bg-white/10 font-bold text-slate-900 dark:bg-white/5 dark:text-white"
                : "font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            )}
          >
            <div className="flex items-center">
              <Flag
                className={cn(
                  "mr-3 h-4 w-4 shrink-0 transition-colors",
                  showNSCards ? "text-emerald-500" : "text-slate-400"
                )}
              />
              NationStates Cards
            </div>
            <div
              className={cn(
                "h-1.5 w-1.5 rounded-full transition-all",
                showNSCards
                  ? "scale-110 animate-pulse bg-emerald-500"
                  : "bg-slate-300 dark:bg-slate-700"
              )}
            />
          </button>

          <button
            onClick={() => {
              const next = !showLore;
              setShowLore(next);
              if (next)
                setTimeout(
                  () =>
                    document
                      .getElementById("wiki-settings-section")
                      ?.scrollIntoView({ behavior: "smooth", block: "start" }),
                  100
                );
            }}
            className={cn(
              "group flex w-full cursor-pointer items-center justify-between rounded-lg border-0 bg-transparent px-3 py-2 text-left text-xs transition-colors outline-none hover:bg-white/5",
              showLore
                ? "bg-white/10 font-bold text-slate-900 dark:bg-white/5 dark:text-white"
                : "font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            )}
          >
            <div className="flex items-center">
              <BookOpen
                className={cn(
                  "mr-3 h-4 w-4 shrink-0 transition-colors",
                  showLore ? "text-blue-500" : "text-slate-400"
                )}
              />
              Wiki Settings
            </div>
            <div
              className={cn(
                "h-1.5 w-1.5 rounded-full transition-all",
                showLore
                  ? "scale-110 animate-pulse bg-blue-500"
                  : "bg-slate-300 dark:bg-slate-700"
              )}
            />
          </button>

          <button
            onClick={() => {
              const next = !showThinkpages;
              setShowThinkpages(next);
              if (next)
                setTimeout(
                  () =>
                    document
                      .getElementById("thinkpages-section")
                      ?.scrollIntoView({ behavior: "smooth", block: "start" }),
                  100
                );
            }}
            className={cn(
              "group flex w-full cursor-pointer items-center justify-between rounded-lg border-0 bg-transparent px-3 py-2 text-left text-xs transition-colors outline-none hover:bg-white/5",
              showThinkpages
                ? "bg-white/10 font-bold text-slate-900 dark:bg-white/5 dark:text-white"
                : "font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            )}
          >
            <div className="flex items-center">
              <User
                className={cn(
                  "mr-3 h-4 w-4 shrink-0 transition-colors",
                  showThinkpages ? "text-purple-500" : "text-slate-400"
                )}
              />
              Thinkpages Preferences
            </div>
            <div
              className={cn(
                "h-1.5 w-1.5 rounded-full transition-all",
                showThinkpages
                  ? "scale-110 animate-pulse bg-purple-500"
                  : "bg-slate-300 dark:bg-slate-700"
              )}
            />
          </button>
        </CutoutCardContent>
      </CutoutCard>
    </div>
  );
}
