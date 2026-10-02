"use client";

import React, { use } from "react";
import Link from "next/link";
import { ArrowLeft, SystemRestart as Loader2 } from "iconoir-react";
import { Button } from "~/components/ui/button";
import { EmptyState } from "~/components/ui/empty-state";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Badge } from "~/components/ui/badge";
import { PersonaFollowButton } from "~/components/thinkpages/PersonaFollowButton";
import { RelativeTimestamp } from "~/components/thinkpages/post/ThinkpagesPostUtils";
import { withBasePath } from "~/lib/base-path";
import { api } from "~/trpc/react";
import { Card } from "~/components/ui/card";

interface ProfilePageProps {
  params: Promise<{ username: string }>;
}

/** A ThinkPages persona's public profile: who they are, real follow counts, recent posts. */
export default function PersonaProfilePage({ params }: ProfilePageProps) {
  const { username } = use(params);
  const {
    data: profile,
    isLoading,
    error,
  } = api.thinkpages.getAccountProfile.useQuery({ username }, { enabled: !!username });

  if (isLoading) {
    return (
      <div className="container mx-auto max-w-2xl px-4 py-8">
        <div className="flex min-h-[400px] items-center justify-center">
          <Loader2 className="text-label-secondary size-8 animate-spin" aria-label="Loading" />
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="container mx-auto max-w-2xl px-4 py-8">
        <Card>
          <EmptyState
            title="Account not found"
            message="This account may have been deactivated or the link is incorrect."
            action={
              <Button asChild>
                <Link href={withBasePath("/thinkpages")}>
                  <ArrowLeft aria-hidden="true" />
                  Back to ThinkPages
                </Link>
              </Button>
            }
          />
        </Card>
      </div>
    );
  }

  const initials = profile.displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="container mx-auto max-w-2xl space-y-6 px-4 py-8 pb-32">
      <Button asChild variant="ghost" size="sm">
        <Link href={withBasePath("/thinkpages")}>
          <ArrowLeft aria-hidden="true" />
          Back to ThinkPages
        </Link>
      </Button>

      <Card padding="lg" className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <Avatar className="size-16">
            <AvatarImage src={profile.profileImageUrl ?? ""} />
            <AvatarFallback className="text-title-3">{initials}</AvatarFallback>
          </Avatar>
          <PersonaFollowButton
            accountId={profile.id}
            username={profile.username}
            isFollowing={profile.isFollowing}
            isOwnAccount={profile.isOwnAccount}
            className="h-8 px-4"
          />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-title-2 text-label">{profile.displayName}</h1>
            {profile.verified && (
              <span className="text-body" title="Verified">
                ✅
              </span>
            )}
          </div>
          <div className="text-body text-label-secondary flex flex-wrap items-center gap-2">
            <span>@{profile.username}</span>
            <Badge variant="outline">
              {profile.accountType === "personal" ? "personal" : profile.accountType}
            </Badge>
            {profile.country && (
              <Link
                href={withBasePath(`/countries/${profile.country.slug ?? profile.country.id}`)}
                className="text-tint hover:underline"
              >
                {profile.country.name}
              </Link>
            )}
          </div>
        </div>
        {profile.bio && <p className="text-body text-label whitespace-pre-line">{profile.bio}</p>}
        <div className="text-body text-label-secondary flex gap-4">
          <span>
            <strong className="text-label font-semibold tabular-nums">
              {profile.followerCount}
            </strong>{" "}
            followers
          </span>
          <span>
            <strong className="text-label font-semibold tabular-nums">
              {profile.followingCount}
            </strong>{" "}
            following
          </span>
          <span>
            <strong className="text-label font-semibold tabular-nums">{profile.postCount}</strong>{" "}
            posts
          </span>
        </div>
      </Card>

      <section className="space-y-3">
        <h2 className="text-subhead text-label-secondary">Recent posts</h2>
        {profile.posts.length === 0 ? (
          <p className="text-body text-label-secondary">No public posts yet.</p>
        ) : (
          profile.posts.map((post) => (
            <Link
              key={post.id}
              href={withBasePath(`/thinkpages/post/${post.id}`)}
              className="rounded-card focus-visible:outline-tint block focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              <Card padding="md" className="space-y-2">
                <p className="text-body text-label line-clamp-4 whitespace-pre-line">
                  {post.content.replace(/\s*\[DiscordMsg:\d+\]\s*$/, "")}
                </p>
                <div className="text-footnote text-label-secondary flex items-center gap-3 tabular-nums">
                  <RelativeTimestamp timestamp={post.timestamp} />
                  <span>{post.reactionCount} reactions</span>
                  <span>{post.replyCount} replies</span>
                  <span>{post.repostCount} reposts</span>
                  {post.pinned && <span>Pinned</span>}
                </div>
              </Card>
            </Link>
          ))
        )}
      </section>
    </div>
  );
}
