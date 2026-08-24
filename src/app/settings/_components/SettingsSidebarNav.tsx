"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Search, Xmark, User as UserIcon, Crown } from "iconoir-react";
import type { UserResource } from "@clerk/types";
import { cn } from "~/lib/utils";
import { formatMembershipTier } from "~/lib/tier-utils";
import { SETTINGS_SECTIONS, type SettingSectionId, type SettingSectionConfig } from "../_lib/sections";

export interface SettingsSidebarNavProps {
  activeSection: SettingSectionId;
  onSelectSection: (id: SettingSectionId) => void;
  hasCountryId: boolean;
  user: UserResource | null | undefined;
  membershipTier?: string;
  roleDisplayName?: string;
}

export function SettingsSidebarNav({
  activeSection,
  onSelectSection,
  hasCountryId,
  user,
  membershipTier,
  roleDisplayName,
}: SettingsSidebarNavProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredSections = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) {
      return SETTINGS_SECTIONS.filter((s) => !s.requiresCountry || hasCountryId);
    }
    return SETTINGS_SECTIONS.filter((s) => {
      if (s.requiresCountry && !hasCountryId) return false;
      return (
        s.label.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        s.category.toLowerCase().includes(q)
      );
    });
  }, [searchQuery, hasCountryId]);

  // Group sections by category
  const categories = useMemo(() => {
    const map = new Map<string, SettingSectionConfig[]>();
    for (const section of filteredSections) {
      const existing = map.get(section.category) ?? [];
      existing.push(section);
      map.set(section.category, existing);
    }
    return Array.from(map.entries());
  }, [filteredSections]);

  return (
    <aside className="w-full space-y-4 lg:sticky lg:top-20" aria-label="Settings Navigation">
      {/* Profile Card Pill */}
      {user && (
        <div className="rounded-2xl border border-border/40 bg-card/40 p-3.5 backdrop-blur-md shadow-xs">
          <div className="flex items-center gap-3">
            <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-xl border border-border/60 bg-muted">
              {user.imageUrl ? (
                <img
                  src={user.imageUrl}
                  alt={user.username || "User"}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                  <UserIcon className="h-5 w-5" />
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-bold text-foreground">
                {user.username || user.firstName || "Diplomat"}
              </div>
              <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                {membershipTier && (() => {
                  const tierInfo = formatMembershipTier(membershipTier);
                  return (
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.2 text-[8px] font-bold tracking-tight",
                        tierInfo.badgeClass
                      )}
                    >
                      {tierInfo.isPremium && <Crown className="h-2.5 w-2.5 shrink-0" />}
                      {tierInfo.label}
                    </span>
                  );
                })()}
                {roleDisplayName && (
                  <span className="inline-flex items-center gap-1 rounded-md border border-purple-500/20 bg-purple-500/10 px-1.5 py-0.2 text-[8px] font-bold text-purple-600 dark:text-purple-400">
                    <Crown className="h-2.5 w-2.5 shrink-0" />
                    {roleDisplayName}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Live Search Input */}
      <div className="relative">
        <Search className="text-muted-foreground absolute top-2.5 left-3 h-3.5 w-3.5 pointer-events-none" />
        <input
          type="text"
          placeholder="Search settings..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full rounded-xl border border-border/40 bg-card/40 py-1.5 pr-8 pl-8.5 text-xs text-foreground placeholder:text-muted-foreground/70 focus:border-border/80 focus:outline-none backdrop-blur-md shadow-2xs"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery("")}
            className="text-muted-foreground hover:text-foreground absolute top-2.5 right-2.5 cursor-pointer"
          >
            <Xmark className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Grouped Navigation */}
      <nav className="space-y-4">
        {categories.map(([category, items]) => (
          <div key={category} className="space-y-1.5">
            <h3 className="px-2 text-[10px] font-bold tracking-wider text-muted-foreground/80 uppercase">
              {category}
            </h3>

            <div className="rounded-2xl border border-border/40 bg-card/30 p-1 backdrop-blur-md shadow-xs space-y-0.5">
              {items.map((item) => {
                const isActive = activeSection === item.id;
                const Icon = item.icon;

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onSelectSection(item.id)}
                    data-cuelume-press="soft"
                    data-cuelume-hover="tick"
                    className={cn(
                      "group flex w-full cursor-pointer items-center justify-between rounded-xl px-2.5 py-2 text-left text-xs transition-all duration-150 outline-none active:scale-[0.98]",
                      isActive
                        ? "bg-foreground/[0.08] dark:bg-foreground/[0.12] font-bold text-foreground shadow-2xs"
                        : "font-medium text-muted-foreground hover:bg-foreground/[0.04] hover:text-foreground"
                    )}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <div
                        className={cn(
                          "flex h-6 w-6 shrink-0 items-center justify-center rounded-[8px] transition-transform",
                          item.glyphClass,
                          isActive ? "scale-105" : "group-hover:scale-105"
                        )}
                      >
                        <Icon className="h-3.5 w-3.5" />
                      </div>
                      <span className="truncate">{item.label}</span>
                    </div>

                    <div
                      className={cn(
                        "h-1.5 w-1.5 rounded-full shrink-0 transition-all duration-200",
                        isActive
                          ? "bg-primary scale-125 shadow-xs"
                          : "bg-transparent group-hover:bg-muted-foreground/30"
                      )}
                    />
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
}
