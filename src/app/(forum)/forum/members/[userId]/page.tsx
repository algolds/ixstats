// src/app/(forum)/forum/members/[userId]/page.tsx
// Forum member profile page.

"use client";

import { useParams } from "next/navigation";
import { Calendar, ChatBubble as MessageSquare, Heart, Trophy, MapPin } from "iconoir-react";
import { ForumLayout } from "~/components/forum/shared/ForumLayout";
import { ForumBreadcrumbs } from "~/components/forum/reader/Breadcrumbs";
import { api } from "~/trpc/react";

function formatDate(unixTimestamp: number): string {
  return new Date(unixTimestamp * 1000).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function MemberProfilePage() {
  const params = useParams();
  const userId = Number(params.userId);

  const { data: member, isLoading } = api.forum.getMember.useQuery(
    { userId },
    { staleTime: 60_000, enabled: !isNaN(userId) }
  );

  return (
    <ForumLayout>
      <ForumBreadcrumbs items={[{ label: member?.username ?? "Member" }]} />

      {isLoading ? (
        <div className="space-y-4">
          <div className="forum-skeleton h-24 w-full rounded-xl" />
          <div className="forum-skeleton h-40 w-full rounded-xl" />
        </div>
      ) : member ? (
        <div>
          {/* Profile header */}
          <div className="glass-forum-parent mb-4">
            <div className="flex items-start gap-4">
              {member.avatarUrl ? (
                <img
                  src={member.avatarUrl}
                  alt={member.username}
                  className="h-20 w-20 rounded-full border-2 border-[var(--forum-border)] object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-orange-500/10 text-2xl font-bold text-orange-400">
                  {member.username.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <h1 className="text-xl font-bold text-[var(--forum-text)]">{member.username}</h1>
                {member.userTitle && (
                  <p className="text-sm text-[var(--forum-accent)]">{member.userTitle}</p>
                )}
                {member.isStaff && (
                  <span className="forum-badge forum-badge-staff mt-1">Staff</span>
                )}
                {member.location && (
                  <div className="mt-1 flex items-center gap-1 text-xs text-[var(--forum-text-dim)]">
                    <MapPin className="h-3 w-3" />
                    {member.location}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard
              icon={MessageSquare}
              label="Messages"
              value={member.messageCount.toLocaleString()}
            />
            <StatCard
              icon={Heart}
              label="Reactions"
              value={member.reactionScore.toLocaleString()}
            />
            <StatCard icon={Trophy} label="Trophies" value={member.trophyPoints.toLocaleString()} />
            <StatCard icon={Calendar} label="Joined" value={formatDate(member.registerDate)} />
          </div>

          {/* About */}
          {member.about && (
            <div className="glass-forum-child mt-4 p-4">
              <h2 className="mb-2 text-sm font-semibold text-[var(--forum-text)]">About</h2>
              <div
                className="forum-post-content text-sm"
                dangerouslySetInnerHTML={{ __html: member.about }}
              />
            </div>
          )}

          {/* Custom fields (IxStats data) */}
          {member.customFields && Object.keys(member.customFields).length > 0 && (
            <div className="glass-forum-child mt-4 p-4">
              <h2 className="mb-2 text-sm font-semibold text-[var(--forum-text)]">IxStats</h2>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(member.customFields).map(([key, value]) => (
                  <div key={key}>
                    <div className="text-xs text-[var(--forum-text-dim)]">
                      {key.replace("ixstats_", "").replace(/_/g, " ")}
                    </div>
                    <div className="text-sm text-[var(--forum-text)]">{value}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="py-12 text-center">
          <h2 className="text-lg font-medium text-[var(--forum-text)]">Member not found</h2>
        </div>
      )}
    </ForumLayout>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof MessageSquare;
  label: string;
  value: string;
}) {
  return (
    <div className="glass-forum-child p-4 text-center">
      <Icon className="mx-auto mb-1 h-4 w-4 text-[var(--forum-accent)]" />
      <div className="text-sm font-semibold text-[var(--forum-text)]">{value}</div>
      <div className="text-xs text-[var(--forum-text-dim)]">{label}</div>
    </div>
  );
}
