"use client";
// Forum member profile page.

import { useParams } from "next/navigation";
import Link from "next/link";
import {
  Calendar,
  ChatBubble as MessageSquare,
  Heart,
  Trophy,
  MapPin,
  ArrowUpRight,
} from "iconoir-react";
import { ForumLayout } from "~/components/forum/shared/ForumLayout";
import { ForumBreadcrumbs } from "~/components/forum/reader/Breadcrumbs";
import { api } from "~/trpc/react";
import { sanitizeHtml } from "~/lib/utils";
import { Badge } from "~/components/ui/badge";
import { EmptyState } from "~/components/ui/empty-state";
import { Skeleton } from "~/components/ui/skeleton";
import { Stat } from "~/components/ui/stat";
import { Card } from "~/components/ui/card";
import { PageHeader } from "~/components/shell/PageHeader";

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
          <Skeleton className="rounded-card h-24 w-full" />
          <Skeleton className="rounded-card h-40 w-full" />
        </div>
      ) : member ? (
        <div>
          <div className="bg-tint-fill text-footnote rounded-row mb-4 flex flex-wrap items-center justify-between gap-2 px-4 py-2">
            <div className="flex items-center gap-2">
              <span className="text-label font-semibold">IxnayID account:</span>
              <span className="text-label-secondary">
                Unified account profile available for @{member.username}
              </span>
            </div>
            <Link
              href={`/@${encodeURIComponent(member.username)}`}
              className="text-tint flex items-center gap-1 font-semibold hover:underline"
            >
              <span>View full profile</span>
              <ArrowUpRight className="size-3.5" />
            </Link>
          </div>

          <PageHeader title={member.username} subtitle={member.userTitle} className="-mx-2" />
          <div className="mb-4 flex items-center gap-4">
            {member.avatarUrl ? (
              <img
                src={member.avatarUrl}
                alt={member.username}
                className="border-separator h-20 w-20 rounded-full border-2 object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="bg-tint-fill text-tint text-title-1 flex size-20 items-center justify-center rounded-full">
                {member.username.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0 space-y-1">
              {member.isStaff && <Badge variant="secondary">Staff</Badge>}
              {member.location && (
                <div className="text-footnote text-label-secondary flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {member.location}
                </div>
              )}
            </div>
          </div>

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

          {member.about && (
            <Card padding="md" className="mt-4">
              <h2 className="text-headline text-label mb-2">About</h2>
              <div
                className="forum-post-content text-body"
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(member.about) }}
              />
            </Card>
          )}

          {/* Custom fields (IxStats data) */}
          {member.customFields && Object.keys(member.customFields).length > 0 && (
            <Card padding="md" className="mt-4">
              <h2 className="text-headline text-label mb-2">IxStats</h2>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(member.customFields).map(([key, value]) => (
                  <div key={key}>
                    <div className="text-footnote text-label-secondary">
                      {key.replace("ixstats_", "").replace(/_/g, " ")}
                    </div>
                    <div className="text-body text-label">{value}</div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      ) : (
        <EmptyState title="Member not found" />
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
    <Card padding="md">
      <Stat
        label={
          <span className="flex items-center gap-2">
            <Icon className="text-tint size-3.5" aria-hidden="true" />
            {label}
          </span>
        }
        value={value}
      />
    </Card>
  );
}
