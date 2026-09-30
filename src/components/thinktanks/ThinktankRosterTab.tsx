"use client";

import React, { useState, useMemo } from "react";
import {
  Search,
  User,
  Crown,
  Shield,
  // oxlint-disable-next-line eslint/no-unused-vars
  MoreHoriz,
  // oxlint-disable-next-line eslint/no-unused-vars
  Spark,
} from "iconoir-react";
import { Input } from "~/components/ui/input";
import { EmptyState } from "~/components/ui/empty-state";
import { Badge } from "~/components/ui/badge";
// oxlint-disable-next-line eslint/no-unused-vars
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
  // oxlint-disable-next-line eslint/no-unused-vars
  groupId,
  members,
  currentUserId,
  userRole,
  // oxlint-disable-next-line eslint/no-unused-vars
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
          <Badge variant="caution">
            <Crown /> Owner
          </Badge>
        );
      case "admin":
        return (
          <Badge variant="tinted">
            <Shield /> Admin
          </Badge>
        );
      default:
        return <Badge variant="outline">Member</Badge>;
    }
  };

  // oxlint-disable-next-line eslint/no-unused-vars
  const isOwnerOrAdmin = userRole === "owner" || userRole === "admin";

  return (
    <div className="mx-auto max-w-5xl space-y-5 p-4 md:p-6">
      {/* Search and Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-title-3 text-label">Members ({members.length})</h2>
          <p className="text-footnote text-label-secondary">
            Members and administrators of this group.
          </p>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="text-label-secondary absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2" />
          <Input
            placeholder="Search roster..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-surface pl-8"
          />
        </div>
      </div>

      {/* Roster Grid */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filteredMembers.length === 0 ? (
          <EmptyState
            compact
            className="col-span-full py-16"
            icon={<User />}
            title="No matching members found"
            message={"Try refining your search query."}
          />
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
                className="bg-surface-secondary rounded-row flex items-center justify-between p-3"
              >
                <div className="flex min-w-0 items-center gap-3">
                  {/* Avatar / Flag Icon */}
                  <div className="border-separator bg-tint-fill text-tint rounded-control flex size-10 shrink-0 items-center justify-center overflow-hidden border">
                    {avatarUrl ? (
                      <img
                        src={avatarUrl}
                        alt={displayName}
                        className="h-full w-full object-cover"
                      />
                    ) : country?.flag ? (
                      <span className="text-title-3">{country.flag}</span>
                    ) : (
                      <User className="h-5 w-5" />
                    )}
                  </div>

                  {/* Member Name & Subtitle */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-headline text-label truncate">{displayName}</span>
                      {isSelf && (
                        <span className="text-caption text-tint font-semibold">(You)</span>
                      )}
                    </div>
                    {subtitle && (
                      <p className="text-footnote text-label-secondary truncate">{subtitle}</p>
                    )}
                    <div className="mt-1 flex items-center gap-2">{getRoleBadge(member.role)}</div>
                  </div>
                </div>

                {/* Right: Join Date & Actions */}
                <div className="text-label-secondary text-footnote flex shrink-0 flex-col items-end gap-1">
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
