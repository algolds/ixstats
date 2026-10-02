"use client";

import React, { use, useState, useRef } from "react";
import { useUser } from "~/context/auth-context";
import { ArrowLeft, SystemRestart as Loader2, ArrowUp } from "iconoir-react";
import Link from "next/link";
import { Button } from "~/components/ui/button";
import { EmptyState } from "~/components/ui/empty-state";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { ThinkpagesPost } from "~/components/thinkpages/ThinkpagesPost";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { extractHashtags, extractMentions } from "~/lib/utils";
import { Card } from "~/components/ui/card";

interface PostPageProps {
  params: Promise<{
    postId: string;
  }>;
}

export default function PostPage({ params }: PostPageProps) {
  const { postId } = use(params);
  const { user } = useUser();
  const notify = useNotify();
  const replyInputRef = useRef<HTMLInputElement>(null);
  const [replyText, setReplyText] = useState("");

  // Get user profile to determine current account
  const { data: userProfile } = api.users.getProfile.useQuery(undefined, { enabled: !!user?.id });

  // Get user's ThinkPages accounts
  const { data: accounts } = api.thinkpages.getAccountsByCountry.useQuery(
    { countryId: userProfile?.countryId || "" },
    { enabled: !!userProfile?.countryId }
  );

  // Use first account if available
  const currentAccount = accounts?.[0];

  // Get the specific post (which includes pre-fetched replies)
  const {
    data: post,
    isLoading,
    error,
  } = api.thinkpages.getPost.useQuery({ postId }, { enabled: !!postId });

  const utils = api.useUtils();

  // Mutation for creating replies
  const createPostMutation = api.thinkpages.createPost.useMutation({
    onSuccess: () => {
      notify.success("Reply posted!");
      setReplyText("");
      // Invalidate the post query to fetch new replies instantly
      void utils.thinkpages.getPost.invalidate({ postId });
      void utils.thinkpages.getFeed.invalidate();
    },
    onError: (err) => {
      notify.error(err.message || "Failed to post reply");
    },
  });

  const handleSubmitReply = async () => {
    if (!replyText.trim() || !currentAccount?.id) return;
    try {
      await createPostMutation.mutateAsync({
        accountId: currentAccount.id,
        content: replyText,
        parentPostId: postId,
        visibility: "public",
        hashtags: extractHashtags(replyText),
        mentions: extractMentions(replyText),
      });
    } catch (_e) {
      // Handled by onError
    }
  };

  // Source replies directly from the fetched post object
  const replies = (post?.replies || []) as any[];

  if (isLoading) {
    return (
      <div className="container mx-auto max-w-2xl px-4 py-8">
        <div className="flex min-h-[400px] items-center justify-center">
          <Loader2 className="text-label-secondary size-8 animate-spin" aria-label="Loading" />
        </div>
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="container mx-auto max-w-2xl px-4 py-8">
        <Card>
          <EmptyState
            title="Post Not Found"
            message="This post may have been deleted or the link is incorrect."
            action={
              <Button asChild>
                <Link href="/thinkpages">
                  <ArrowLeft aria-hidden="true" />
                  Back to Feed
                </Link>
              </Button>
            }
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="relative z-10 container mx-auto max-w-2xl px-4 py-8 pb-32">
        {/* Back Button */}
        <div className="mb-6">
          <Button asChild variant="ghost" size="sm">
            <Link href="/thinkpages">
              <ArrowLeft aria-hidden="true" />
              Back to Feed
            </Link>
          </Button>
        </div>

        {/* Thread Structure Wrapper */}
        <div className="relative space-y-6">
          {/* Vertical Thread Connector Line */}
          {replies.length > 0 && (
            <div
              aria-hidden="true"
              className="bg-separator pointer-events-none absolute top-[108px] bottom-16 left-[48px] z-0 w-0.5"
            />
          )}

          {/* Main Hero Post */}
          <div className="relative z-10">
            <ThinkpagesPost
              post={post}
              currentUserAccountId={currentAccount?.id || ""}
              accounts={accounts || []}
              countryId={userProfile?.countryId || ""}
              onRepost={() => {
                notify.info("Repost shared");
              }}
              onReply={() => {
                replyInputRef.current?.focus();
              }}
              onShare={() => {
                const postUrl = `${window.location.origin}/thinkpages/post/${post.id}`;
                if (navigator.share) {
                  navigator.share({
                    title: "ThinkPages Post",
                    text: "Check out this post on ThinkPages",
                    url: postUrl,
                  });
                } else {
                  navigator.clipboard.writeText(postUrl);
                  notify.success("Link copied to clipboard!");
                }
              }}
              isHero={true}
              showThread={false}
            />
          </div>

          {/* Replies Section */}
          {replies.length > 0 && (
            <div className="relative z-10 ml-5 space-y-4">
              {replies.map((reply: any) => (
                <div key={reply.id}>
                  <ThinkpagesPost
                    post={reply}
                    currentUserAccountId={currentAccount?.id || ""}
                    accounts={accounts || []}
                    countryId={userProfile?.countryId || ""}
                    onRepost={() => {
                      notify.info("Repost shared");
                    }}
                    onReply={() => {
                      replyInputRef.current?.focus();
                      setReplyText(`@${reply.account.username} `);
                    }}
                    onShare={() => {
                      const postUrl = `${window.location.origin}/thinkpages/post/${reply.id}`;
                      if (navigator.share) {
                        navigator.share({
                          title: "ThinkPages Reply",
                          text: "Check out this reply on ThinkPages",
                          url: postUrl,
                        });
                      } else {
                        navigator.clipboard.writeText(postUrl);
                        notify.success("Link copied to clipboard!");
                      }
                    }}
                    compact={true}
                    showThread={false}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Floating Bottom Composer Capsule */}
      <div className="z-sticky fixed bottom-[calc(var(--shell-tabbar-height)+1.5rem)] left-[calc(50%+var(--shell-sidebar-width)/2)] w-full max-w-lg -translate-x-1/2 px-4">
        <div className="material-regular shadow-floating focus-within:outline-tint flex w-full items-center gap-3 rounded-full px-4 py-2 focus-within:outline-2 focus-within:outline-offset-2">
          <Avatar className="border-separator size-8 shrink-0 border">
            {currentAccount?.profileImageUrl ? (
              <AvatarImage src={currentAccount.profileImageUrl} />
            ) : null}
            <AvatarFallback className="bg-fill-3 text-caption text-label-secondary">
              {currentAccount?.displayName
                ? currentAccount.displayName
                    .split(" ")
                    .map((n: string) => n[0])
                    .join("")
                    .toUpperCase()
                : "?"}
            </AvatarFallback>
          </Avatar>

          <input
            ref={replyInputRef}
            type="text"
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void handleSubmitReply();
              }
            }}
            placeholder={
              currentAccount
                ? `Reply to @${post.account.username}...`
                : "Select or create an account to reply"
            }
            disabled={!currentAccount || createPostMutation.isPending}
            aria-label="Reply"
            className="text-body text-label placeholder:text-label-tertiary flex-1 border-none bg-transparent py-2 focus:outline-none disabled:opacity-50"
          />

          <Button
            size="icon"
            onClick={handleSubmitReply}
            disabled={!replyText.trim() || !currentAccount || createPostMutation.isPending}
            aria-label="Send reply"
            className="size-8 shrink-0 rounded-full"
          >
            {createPostMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ArrowUp className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
