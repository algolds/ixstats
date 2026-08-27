"use client";

import React, { useState } from "react";
import { useOrganization, useOrganizationList } from "@clerk/nextjs";
import { Globe, NavArrowDown as ChevronDown, Check, Plus, Settings } from "iconoir-react";
import { cn } from "~/lib/utils";
import { soundEffects } from "~/lib/sound/cuelume";
import { PreText } from "~/components/ui/pretext";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";

interface InlineRealmSwitcherProps {
  onClose?: () => void;
}

/**
 * Format Clerk role string into clean, human-readable label
 * e.g., 'org:admin' -> 'Admin', 'org:member' -> 'Member'
 */
function formatRoleName(role?: string | null): string {
  if (!role) return "Member";
  const clean = role.replace(/^org:/i, "").replace(/[_-]/g, " ");
  if (clean.toLowerCase() === "admin") return "Admin";
  if (clean.toLowerCase() === "member") return "Member";
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

export function InlineRealmSwitcher({ onClose }: InlineRealmSwitcherProps) {
  const {
    organization: currentOrg,
    membership: currentMembership,
    isLoaded: isOrgLoaded,
  } = useOrganization();
  const {
    userMemberships,
    isLoaded: isListLoaded,
    setActive,
  } = useOrganizationList({
    userMemberships: {
      infinite: true,
    },
  });

  const [isOpen, setIsOpen] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);

  const memberships = userMemberships?.data ?? [];
  const currentRealmName =
    currentOrg?.name || (memberships.length > 0 ? "Select a Realm" : "No Active Realm");

  const handleSelectRealm = async (orgId: string) => {
    if (!setActive) return;
    try {
      setIsSwitching(true);
      soundEffects.press();
      await setActive({ organization: orgId });
      setIsOpen(false);
      soundEffects.ready();
    } catch (err) {
      console.error("Failed to switch realm:", err);
      soundEffects.error();
    } finally {
      setIsSwitching(false);
    }
  };

  if (!isOrgLoaded || !isListLoaded) {
    return (
      <div className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-black/[0.04] dark:hover:bg-white/[0.06]">
        <div className="bg-muted/40 h-6.5 w-6.5 animate-pulse rounded-md" />
        <div className="min-w-0 flex-1 space-y-1">
          <div className="bg-muted/40 h-3.5 w-24 animate-pulse rounded" />
          <div className="bg-muted/30 h-2.5 w-32 animate-pulse rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Normal Settings Row Trigger */}
      <button
        type="button"
        onClick={() => {
          soundEffects.toggle();
          setIsOpen(!isOpen);
        }}
        className={cn(
          "flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-all duration-150 select-none hover:bg-black/[0.04] active:scale-[0.985] dark:hover:bg-white/[0.06]",
          isOpen && "bg-black/[0.03] dark:bg-white/[0.05]"
        )}
      >
        {currentOrg?.imageUrl ? (
          <img
            src={currentOrg.imageUrl}
            alt={currentRealmName}
            className="border-border h-6.5 w-6.5 shrink-0 rounded-md border object-cover shadow-xs"
          />
        ) : (
          <div className="shrink-0 rounded-md bg-blue-500/15 p-1.5">
            <Globe className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
          </div>
        )}

        <div className="min-w-0 flex-1">
          <PreText
            className="text-foreground block truncate text-sm font-medium"
            whiteSpace="nowrap"
          >
            {currentRealmName}
          </PreText>
          <PreText className="text-muted-foreground block text-xs" whiteSpace="nowrap">
            {currentOrg
              ? `${formatRoleName(currentMembership?.role)} · Active Realm`
              : "Choose active simulation world"}
          </PreText>
        </div>

        <div className="flex items-center gap-2">
          {currentOrg && (
            <span className="border-border/80 bg-muted/50 text-muted-foreground rounded-md border px-2 py-0.5 text-[10px] font-semibold">
              {formatRoleName(currentMembership?.role)}
            </span>
          )}
          <ChevronDown
            className={cn(
              "text-muted-foreground/60 h-3.5 w-3.5 transition-transform duration-200",
              isOpen && "text-foreground rotate-180"
            )}
          />
        </div>
      </button>

      {/* Inline Indented Sub-List */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="border-border/50 mt-1 mb-1 ml-4 space-y-1 overflow-hidden border-l pl-3"
          >
            {memberships.length === 0 ? (
              <div className="text-muted-foreground px-2.5 py-2 text-xs">No realms joined yet</div>
            ) : (
              memberships.map((membership) => {
                const isSelected = currentOrg?.id === membership.organization.id;
                const orgLogo = membership.organization.imageUrl;
                return (
                  <button
                    key={membership.organization.id}
                    type="button"
                    disabled={isSwitching}
                    onClick={() => handleSelectRealm(membership.organization.id)}
                    className={cn(
                      "group flex w-full cursor-pointer items-center justify-between rounded-lg px-2.5 py-2 text-left text-xs transition-all active:scale-[0.985]",
                      isSelected
                        ? "bg-accent text-foreground font-semibold"
                        : "text-muted-foreground hover:text-foreground hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
                    )}
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      {orgLogo ? (
                        <img
                          src={orgLogo}
                          alt={membership.organization.name}
                          className="border-border h-4.5 w-4.5 shrink-0 rounded-md border object-cover shadow-xs"
                        />
                      ) : (
                        <Globe className="text-foreground h-3.5 w-3.5 shrink-0" />
                      )}
                      <span className="truncate">{membership.organization.name}</span>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <span className="border-border/60 bg-card/60 text-muted-foreground rounded border px-1.5 py-0.5 text-[9px] font-medium">
                        {formatRoleName(membership.role)}
                      </span>
                      {isSelected && <Check className="text-foreground h-3.5 w-3.5 shrink-0" />}
                    </div>
                  </button>
                );
              })
            )}

            {/* Sub Actions: Manage Current Realm & Found New Realm */}
            <div className="border-border/40 mt-1 flex items-center justify-between gap-2 border-t px-1 pt-1.5">
              {currentOrg ? (
                <Link
                  href={`/r/${currentOrg.slug || currentOrg.id}/settings`}
                  onClick={onClose}
                  className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 text-[11px] font-semibold transition-colors"
                >
                  <Settings className="h-3 w-3" />
                  <span>Settings</span>
                </Link>
              ) : (
                <div />
              )}

              <Link
                href="/realms/new"
                onClick={onClose}
                className="text-foreground flex items-center gap-1 text-[11px] font-semibold transition-colors hover:underline"
              >
                <Plus className="h-3 w-3" />
                <span>Create Realm</span>
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
