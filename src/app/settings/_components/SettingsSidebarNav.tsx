"use client";

import { useState, useMemo } from "react";
import { User as UserIcon, Crown } from "iconoir-react";
import type { UserResource } from "@clerk/types";
import { cn } from "~/lib/utils";
import { formatMembershipTier } from "~/lib/tier-utils";
import { Badge } from "~/components/ui/badge";
import { SearchField } from "~/components/ui/search-field";
import {
  SETTINGS_SECTIONS,
  type SettingSectionId,
  type SettingSectionConfig,
} from "../_lib/sections";

interface SettingsSidebarNavProps {
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
    <aside
      className="w-full space-y-4 lg:sticky lg:top-(--shell-top-offset)"
      aria-label="Settings navigation"
    >
      {/* Profile card */}
      {user && (
        <div className="border-separator bg-surface rounded-card border p-4">
          <div className="flex items-center gap-3">
            <div className="border-separator bg-fill-3 rounded-row relative h-10 w-10 shrink-0 overflow-hidden border">
              {user.imageUrl ? (
                <img
                  src={user.imageUrl}
                  alt={user.username || "User"}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="text-label-secondary flex h-full w-full items-center justify-center">
                  <UserIcon className="h-5 w-5" />
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-headline text-label truncate">
                {user.username || user.firstName || "Diplomat"}
              </div>
              <div className="mt-0.5 flex flex-wrap items-center gap-1">
                {membershipTier &&
                  (() => {
                    const tierInfo = formatMembershipTier(membershipTier);
                    return (
                      <Badge variant={tierInfo.badgeVariant}>
                        {tierInfo.isPremium && <Crown aria-hidden />}
                        {tierInfo.label}
                      </Badge>
                    );
                  })()}
                {roleDisplayName && (
                  <Badge variant="secondary">
                    <Crown aria-hidden />
                    {roleDisplayName}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Live search */}
      <SearchField
        size="sm"
        placeholder="Search settings..."
        aria-label="Search settings"
        value={searchQuery}
        onValueChange={setSearchQuery}
      />

      {/* Grouped navigation */}
      <nav className="space-y-4">
        {categories.map(([category, items]) => (
          <div key={category} className="space-y-2">
            <h3 className="text-subhead text-label-secondary px-2">{category}</h3>

            <div className="border-separator bg-surface rounded-card space-y-0.5 border p-1">
              {items.map((item) => {
                const isActive = activeSection === item.id;
                const Icon = item.icon;

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onSelectSection(item.id)}
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "group rounded-row text-callout flex min-h-9 w-full cursor-pointer items-center justify-between px-3 py-2 text-left outline-none",
                      "duration-fast ease-out-facet transition-[color,background-color]",
                      "focus-visible:outline-tint focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-solid",
                      isActive
                        ? "bg-tint-fill text-label font-semibold"
                        : "text-label-secondary hover:bg-fill-4 hover:text-label font-medium"
                    )}
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      <div
                        className={cn(
                          "rounded-control-sm flex h-6 w-6 shrink-0 items-center justify-center",
                          item.glyphClass
                        )}
                      >
                        <Icon aria-hidden className="h-3.5 w-3.5" />
                      </div>
                      <span className="truncate">{item.label}</span>
                    </div>

                    <div
                      aria-hidden
                      className={cn(
                        "h-1.5 w-1.5 shrink-0 rounded-full",
                        isActive ? "bg-tint" : "bg-transparent"
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
