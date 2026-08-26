"use client";

import React, { useState, useMemo } from "react";
import {
  Search,
  User,
  Crown,
  Shield,
  MoreHoriz,
  Spark,
} from "iconoir-react";
import { Input } from "~/components/ui/input";
import { Badge } from "~/components/ui/badge";
import { cn } from "~/lib/utils";

interface Member {
  id: string;
  userId: string;
  role: string;
  joinedAt: Date | string;
  user?: {
    id: string;
    clerkUserId: string;
    displayName?: string | null;
    avatarUrl?: string | null;
    forumUsername?: string | null;
    wikiUsername?: string | null;
    country?: {
      id: string;
      name: string;
      flag?: string | null;
    } | null;
  } | null;
}

interface ThinktankRosterTabProps {
  groupId: string;
  members: Member[];
  currentUserId: string;
  userRole?: string | null;
  onRemoveMember?: (userId: string) => void;
}

export function ThinktankRosterTab({
  groupId,
  members,
  currentUserId,
  userRole,
  onRemoveMember,
}: ThinktankRosterTabProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredMembers = useMemo(() => {
    if (!searchQuery.trim()) return members;
    const q = searchQuery.toLowerCase();
    return members.filter((m) => {
      const displayName = m.user?.displayName?.toLowerCase() || "";
      const countryName = m.user?.country?.name?.toLowerCase() || "";
      const forumUser = m.user?.forumUsername?.toLowerCase() || "";
      const wikiUser = m.user?.wikiUsername?.toLowerCase() || "";
      const userId = m.userId.toLowerCase();
      const role = m.role.toLowerCase();
      return (
        displayName.includes(q) ||
        countryName.includes(q) ||
        forumUser.includes(q) ||
        wikiUser.includes(q) ||
        userId.includes(q) ||
        role.includes(q)
      );
    });
  }, [members, searchQuery]);

  const getRoleBadge = (role: string) => {
    switch (role.toLowerCase()) {
      case "owner":
        return (
          <Badge className="border-amber-500/30 bg-amber-500/10 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
            <Crown className="mr-1 h-3 w-3" /> Owner
          </Badge>
        );
      case "admin":
        return (
          <Badge className="border-emerald-500/30 bg-emerald-500/10 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
            <Shield className="mr-1 h-3 w-3" /> Admin
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="text-[10px] font-medium text-muted-foreground border-border/40">
            Member
          </Badge>
        );
    }
  };

  const isOwnerOrAdmin = userRole === "owner" || userRole === "admin";

  return (
    <div className="mx-auto max-w-5xl space-y-5 p-4 md:p-6">
      {/* Search and Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-bold text-foreground tracking-tight">
            Members ({members.length})
          </h2>
          <p className="text-xs text-muted-foreground">
            Members and administrators of this group.
          </p>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search roster..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8.5 rounded-xl bg-card/60 pl-8 text-xs border-border/40 placeholder:text-muted-foreground/60 focus-visible:ring-emerald-500/30"
          />
        </div>
      </div>

      {/* Roster Grid */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filteredMembers.length === 0 ? (
          <div className="col-span-full flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/60 py-16 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-muted/60 text-muted-foreground mb-2">
              <User className="h-5 w-5" />
            </div>
            <p className="text-xs font-semibold text-foreground">No matching members found</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Try refining your search query.</p>
          </div>
        ) : (
          filteredMembers.map((member) => {
            const country = member.user?.country;
            const isSelf = member.userId === currentUserId;
            const displayName =
              member.user?.displayName ||
              country?.name ||
              member.user?.forumUsername ||
              member.user?.wikiUsername ||
              `User ${member.userId.slice(-6)}`;

            const subtitle =
              country?.name && country.name !== displayName
                ? `${country.flag ? country.flag + " " : ""}${country.name}`
                : member.user?.forumUsername
                ? `@${member.user.forumUsername}`
                : country?.name || null;

            const avatarUrl = member.user?.avatarUrl;

            return (
              <div
                key={member.id || member.userId}
                className="flex items-center justify-between rounded-2xl border border-border/40 bg-card/60 p-3.5 shadow-sm backdrop-blur-xl transition-all duration-150 hover:border-emerald-500/30 hover:bg-card/80 dark:border-white/10 dark:bg-white/[0.02]"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {/* Avatar / Flag Icon */}
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border/50 bg-gradient-to-br from-emerald-500/10 to-teal-500/10 text-emerald-600 dark:text-emerald-400 font-bold">
                    {avatarUrl ? (
                      <img src={avatarUrl} alt={displayName} className="h-full w-full object-cover" />
                    ) : country?.flag ? (
                      <span className="text-lg">{country.flag}</span>
                    ) : (
                      <User className="h-5 w-5" />
                    )}
                  </div>

                  {/* Member Name & Subtitle */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-xs font-bold text-foreground">
                        {displayName}
                      </span>
                      {isSelf && (
                        <span className="text-[9px] font-semibold text-emerald-600 dark:text-emerald-400">
                          (You)
                        </span>
                      )}
                    </div>
                    {subtitle && (
                      <p className="truncate text-[10.5px] text-muted-foreground">
                        {subtitle}
                      </p>
                    )}
                    <div className="mt-1 flex items-center gap-2">
                      {getRoleBadge(member.role)}
                    </div>
                  </div>
                </div>

                {/* Right: Join Date & Actions */}
                <div className="flex flex-col items-end gap-1 text-[10px] text-muted-foreground shrink-0">
                  <span>
                    {new Date(member.joinedAt).toLocaleDateString(undefined, {
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
