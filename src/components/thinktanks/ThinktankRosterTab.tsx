"use client";

import React, { useState } from "react";
import { Search, User, Crown, Shield } from "iconoir-react";
import { Input } from "~/components/ui/input";
import { EmptyState } from "~/components/ui/empty-state";
import { Badge } from "~/components/ui/badge";

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
  members: Member[];
  currentUserId: string;
}

function RoleBadge({ role }: { role: string }) {
  switch (role.toLowerCase()) {
    case "owner":
      return (
        <Badge variant="warning">
          <Crown /> Owner
        </Badge>
      );
    case "admin":
      return (
        <Badge variant="secondary">
          <Shield /> Admin
        </Badge>
      );
    default:
      return <Badge variant="outline">Member</Badge>;
  }
}

function matchesQuery(member: Member, query: string) {
  const { user } = member;
  return [
    user?.displayName,
    user?.country?.name,
    user?.forumUsername,
    user?.wikiUsername,
    member.userId,
    member.role,
  ].some((field) => field?.toLowerCase().includes(query));
}

function memberIdentity(member: Member) {
  const { user } = member;
  const country = user?.country;
  const displayName =
    user?.displayName ||
    country?.name ||
    user?.forumUsername ||
    user?.wikiUsername ||
    `User ${member.userId.slice(-6)}`;

  const subtitle =
    country?.name && country.name !== displayName
      ? `${country.flag ? country.flag + " " : ""}${country.name}`
      : user?.forumUsername
        ? `@${user.forumUsername}`
        : country?.name || null;

  return { displayName, subtitle };
}

function MemberCard({ member, isSelf }: { member: Member; isSelf: boolean }) {
  const { user } = member;
  const country = user?.country;
  const { displayName, subtitle } = memberIdentity(member);

  return (
    <div className="bg-surface-secondary rounded-row flex items-center justify-between p-3">
      <div className="flex min-w-0 items-center gap-3">
        <div className="border-separator bg-tint-fill text-tint rounded-control flex size-10 shrink-0 items-center justify-center overflow-hidden border">
          {user?.avatarUrl ? (
            <img src={user.avatarUrl} alt={displayName} className="h-full w-full object-cover" />
          ) : country?.flag ? (
            <span className="text-title-3">{country.flag}</span>
          ) : (
            <User className="h-5 w-5" />
          )}
        </div>

        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-headline text-label truncate">{displayName}</span>
            {isSelf && <span className="text-caption text-tint font-semibold">(You)</span>}
          </div>
          {subtitle && <p className="text-footnote text-label-secondary truncate">{subtitle}</p>}
          <div className="mt-1 flex items-center gap-2">
            <RoleBadge role={member.role} />
          </div>
        </div>
      </div>

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
}

export function ThinktankRosterTab({ members, currentUserId }: ThinktankRosterTabProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const query = searchQuery.trim().toLowerCase();
  const filteredMembers = query ? members.filter((m) => matchesQuery(m, query)) : members;

  return (
    <div className="mx-auto max-w-5xl space-y-5 p-4 md:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-title-3 text-label">Members ({members.length})</h2>
          <p className="text-footnote text-label-secondary">
            Members and administrators of this group.
          </p>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="text-label-secondary absolute top-1/2 left-2 h-3.5 w-3.5 -translate-y-1/2" />
          <Input
            placeholder="Search roster..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-surface pl-8"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filteredMembers.length === 0 ? (
          <EmptyState
            compact
            className="col-span-full py-16"
            icon={<User />}
            title="No matching members found"
            message="Try a different search."
          />
        ) : (
          filteredMembers.map((member) => (
            <MemberCard
              key={member.id || member.userId}
              member={member}
              isSelf={member.userId === currentUserId}
            />
          ))
        )}
      </div>
    </div>
  );
}
