"use client";

import React, { useState } from "react";
import { useOrganization, useOrganizationList } from "@clerk/nextjs";
import {
  Globe,
  NavArrowDown as ChevronDown,
  Check,
  Plus,
  Settings,
} from "iconoir-react";
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
  const { userMemberships, isLoaded: isListLoaded, setActive } = useOrganizationList({
    userMemberships: {
      infinite: true,
    },
  });

  const [isOpen, setIsOpen] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);

  const memberships = userMemberships?.data ?? [];
  const currentRealmName = currentOrg?.name || (memberships.length > 0 ? "Select a Realm" : "No Active Realm");

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
      <div className="hover:bg-black/[0.04] dark:hover:bg-white/[0.06] flex w-full items-center gap-3 rounded-lg px-3 py-2.5">
        <div className="h-6.5 w-6.5 rounded-md bg-muted/40 animate-pulse" />
        <div className="space-y-1 min-w-0 flex-1">
          <div className="h-3.5 w-24 rounded bg-muted/40 animate-pulse" />
          <div className="h-2.5 w-32 rounded bg-muted/30 animate-pulse" />
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
          "hover:bg-black/[0.04] dark:hover:bg-white/[0.06] flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-all duration-150 cursor-pointer active:scale-[0.985] select-none",
          isOpen && "bg-black/[0.03] dark:bg-white/[0.05]"
        )}
      >
        {currentOrg?.imageUrl ? (
          <img
            src={currentOrg.imageUrl}
            alt={currentRealmName}
            className="h-6.5 w-6.5 rounded-md object-cover border border-border shrink-0 shadow-xs"
          />
        ) : (
          <div className="shrink-0 rounded-md bg-blue-500/15 p-1.5">
            <Globe className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
          </div>
        )}

        <div className="min-w-0 flex-1">
          <PreText className="text-foreground block text-sm font-medium truncate" whiteSpace="nowrap">
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
            <span className="rounded-md border border-border/80 bg-muted/50 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
              {formatRoleName(currentMembership?.role)}
            </span>
          )}
          <ChevronDown
            className={cn(
              "h-3.5 w-3.5 text-muted-foreground/60 transition-transform duration-200",
              isOpen && "rotate-180 text-foreground"
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
            className="ml-4 pl-3 border-l border-border/50 mt-1 mb-1 space-y-1 overflow-hidden"
          >
            {memberships.length === 0 ? (
              <div className="px-2.5 py-2 text-xs text-muted-foreground">
                No realms joined yet
              </div>
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
                      "group flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-xs transition-all cursor-pointer active:scale-[0.985]",
                      isSelected
                        ? "bg-accent text-foreground font-semibold"
                        : "hover:bg-black/[0.04] dark:hover:bg-white/[0.06] text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {orgLogo ? (
                        <img
                          src={orgLogo}
                          alt={membership.organization.name}
                          className="h-4.5 w-4.5 rounded-md object-cover border border-border shrink-0 shadow-xs"
                        />
                      ) : (
                        <Globe className="h-3.5 w-3.5 shrink-0 text-foreground" />
                      )}
                      <span className="truncate">{membership.organization.name}</span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="rounded px-1.5 py-0.5 text-[9px] font-medium border border-border/60 bg-card/60 text-muted-foreground">
                        {formatRoleName(membership.role)}
                      </span>
                      {isSelected && <Check className="h-3.5 w-3.5 text-foreground shrink-0" />}
                    </div>
                  </button>
                );
              })
            )}

            {/* Sub Actions: Manage Current Realm & Found New Realm */}
            <div className="border-t border-border/40 pt-1.5 mt-1 flex items-center justify-between gap-2 px-1">
              {currentOrg ? (
                <Link
                  href={`/r/${currentOrg.slug || currentOrg.id}/settings`}
                  onClick={onClose}
                  className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground hover:text-foreground transition-colors"
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
                className="flex items-center gap-1 text-[11px] font-semibold text-foreground hover:underline transition-colors"
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
