"use client";

import React, { use } from "react";
import Link from "next/link";
import { ArrowLeft, SystemRestart as Loader2 } from "iconoir-react";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Badge } from "~/components/ui/badge";
import { PersonaFollowButton } from "~/components/thinkpages/PersonaFollowButton";
import { RelativeTimestamp } from "~/components/thinkpages/post/ThinkpagesPostUtils";
import { withBasePath } from "~/lib/base-path";
import { api } from "~/trpc/react";

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
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="container mx-auto max-w-2xl px-4 py-8">
        <Card>
          <CardContent className="p-8 text-center">
            <h2 className="mb-2 text-xl font-semibold">Account not found</h2>
            <p className="text-muted-foreground mb-6">
              This account may have been deactivated or the link is incorrect.
            </p>
            <Link href={withBasePath("/thinkpages")}>
              <Button>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to ThinkPages
              </Button>
            </Link>
          </CardContent>
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
      <Link href={withBasePath("/thinkpages")}>
        <Button variant="ghost" size="sm" className="text-muted-foreground">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to ThinkPages
        </Button>
      </Link>

      <Card>
        <CardContent className="space-y-4 p-6">
          <div className="flex items-start justify-between gap-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={profile.profileImageUrl ?? ""} />
              <AvatarFallback className="text-lg font-semibold">{initials}</AvatarFallback>
            </Avatar>
            <PersonaFollowButton
              accountId={profile.id}
              username={profile.username}
              isFollowing={profile.isFollowing}
              isOwnAccount={profile.isOwnAccount}
              className="h-8 px-4 text-sm"
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold">{profile.displayName}</h1>
              {profile.verified && (
                <span className="text-sm" title="Verified">
                  ✅
                </span>
              )}
            </div>
            <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-sm">
              <span>@{profile.username}</span>
              <Badge variant="outline" className="text-xs uppercase">
                {profile.accountType === "personal" ? "personal" : profile.accountType}
              </Badge>
              {profile.country && (
                <Link
                  href={withBasePath(`/countries/${profile.country.slug ?? profile.country.id}`)}
                  className="hover:underline"
                >
                  {profile.country.name}
                </Link>
              )}
            </div>
          </div>
          {profile.bio && <p className="text-sm whitespace-pre-line">{profile.bio}</p>}
          <div className="text-muted-foreground flex gap-4 text-sm">
            <span>
              <strong className="text-foreground">{profile.followerCount}</strong> followers
            </span>
            <span>
              <strong className="text-foreground">{profile.followingCount}</strong> following
            </span>
            <span>
              <strong className="text-foreground">{profile.postCount}</strong> posts
            </span>
          </div>
        </CardContent>
      </Card>

      <section className="space-y-3">
        <h2 className="text-muted-foreground text-sm font-semibold tracking-wide uppercase">
          Recent posts
        </h2>
        {profile.posts.length === 0 ? (
          <p className="text-muted-foreground text-sm">No public posts yet.</p>
        ) : (
          profile.posts.map((post) => (
            <Link
              key={post.id}
              href={withBasePath(`/thinkpages/post/${post.id}`)}
              className="block"
            >
              <Card className="hover:bg-muted/40 transition-colors">
                <CardContent className="space-y-2 p-4">
                  <p className="line-clamp-4 text-sm whitespace-pre-line">
                    {post.content.replace(/\s*\[DiscordMsg:\d+\]\s*$/, "")}
                  </p>
                  <div className="text-muted-foreground flex items-center gap-3 text-xs">
                    <RelativeTimestamp timestamp={post.timestamp} />
                    <span>{post.reactionCount} reactions</span>
                    <span>{post.replyCount} replies</span>
                    <span>{post.repostCount} reposts</span>
                    {post.pinned && <span>Pinned</span>}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))
        )}
      </section>
    </div>
  );
}
