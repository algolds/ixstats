"use client";

import React, { use, useState, useRef } from "react";
import { useUser } from "~/context/auth-context";
import { ArrowLeft, Loader2, ArrowUp } from "lucide-react";
import Link from "next/link";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { ThinkpagesPost } from "~/components/thinkpages/ThinkpagesPost";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { extractHashtags, extractMentions } from "~/lib/utils";

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
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        </div>
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="container mx-auto max-w-2xl px-4 py-8">
        <Card className="border-white/10 bg-slate-900/40 backdrop-blur-xl">
          <CardContent className="p-8 text-center">
            <h2 className="mb-2 text-xl font-semibold text-slate-200">Post Not Found</h2>
            <p className="mb-6 text-slate-400">
              This post may have been deleted or the link is incorrect.
            </p>
            <Link href="/thinkpages">
              <Button className="bg-blue-600 text-white hover:bg-blue-500">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Feed
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Absolute background glow circles */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute top-[20%] left-[10%] h-[450px] w-[450px] rounded-full bg-indigo-600/10 blur-[130px]" />
        <div className="absolute top-[50%] right-[10%] h-[450px] w-[450px] rounded-full bg-purple-600/10 blur-[130px]" />
      </div>

      <div className="relative z-10 container mx-auto max-w-2xl px-4 py-8 pb-32">
        {/* Back Button */}
        <div className="mb-6">
          <Link href="/thinkpages">
            <Button
              variant="ghost"
              size="sm"
              className="text-slate-400 hover:bg-white/5 hover:text-slate-200"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Feed
            </Button>
          </Link>
        </div>

        {/* Thread Structure Wrapper */}
        <div className="relative space-y-6">
          {/* Vertical Thread Connector Line */}
          {replies.length > 0 && (
            <div className="pointer-events-none absolute top-[108px] bottom-16 left-[48px] z-0 w-[2px] bg-gradient-to-b from-indigo-500/40 via-purple-500/15 to-transparent" />
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
                <div key={reply.id} className="transition-all duration-300">
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
      <div className="fixed bottom-6 left-1/2 z-50 w-full max-w-lg -translate-x-1/2 px-4">
        <div className="flex w-full items-center gap-3 rounded-full border border-white/10 bg-slate-950/75 px-4 py-2 shadow-2xl backdrop-blur-xl transition-all duration-200 focus-within:border-blue-500/50 focus-within:ring-1 focus-within:ring-blue-500/20">
          <Avatar className="h-8 w-8 shrink-0 border border-white/10">
            {currentAccount?.profileImageUrl ? (
              <AvatarImage src={currentAccount.profileImageUrl} />
            ) : null}
            <AvatarFallback className="bg-slate-800 text-xs font-semibold text-slate-400">
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
            className="flex-1 border-none bg-transparent py-1.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none disabled:opacity-50"
          />

          <Button
            size="icon"
            onClick={handleSubmitReply}
            disabled={!replyText.trim() || !currentAccount || createPostMutation.isPending}
            className="h-8 w-8 shrink-0 rounded-full bg-blue-600 text-white transition-all duration-200 hover:bg-blue-500 disabled:opacity-40"
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
