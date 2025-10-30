"use client";

import React, { use } from "react";
import { useUser } from "~/context/auth-context";
import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { ThinkpagesPost } from "~/components/thinkpages/ThinkpagesPost";
import { api } from "~/trpc/react";
import { toast } from "sonner";

interface PostPageProps {
  params: Promise<{
    postId: string;
  }>;
}

export default function PostPage({ params }: PostPageProps) {
  const { postId } = use(params);
  const { user } = useUser();

  // Get user profile to determine current account
  const { data: userProfile } = api.users.getProfile.useQuery(undefined, { enabled: !!user?.id });

  // Get user's ThinkPages accounts
  const { data: accounts } = api.thinkpages.getAccountsByCountry.useQuery(
    { countryId: userProfile?.countryId || "" },
    { enabled: !!userProfile?.countryId }
  );

  // Use first account if available (or you could add account selection later)
  const currentAccount = accounts?.[0];

  // Get the specific post
  const {
    data: post,
    isLoading,
    error,
  } = api.thinkpages.getPost.useQuery({ postId }, { enabled: !!postId });

  // Get post replies
  const { data: feed } = api.thinkpages.getFeed.useQuery({ limit: 50 });

  const addReactionMutation = api.thinkpages.addReaction.useMutation({
    onSuccess: () => {
      toast.success("Reaction added!");
    },
  });

  // Filter replies to this post
  const replies = React.useMemo(() => {
    if (!feed?.posts || !postId) return [];
    return feed.posts.filter((p) => p.parentPostId === postId);
  }, [feed?.posts, postId]);

  if (isLoading) {
    return (
      <div className="container mx-auto max-w-2xl py-8">
        <div className="flex min-h-[400px] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="container mx-auto max-w-2xl py-8">
        <Card>
          <CardContent className="p-8 text-center">
            <h2 className="mb-2 text-xl font-semibold">Post Not Found</h2>
            <p className="text-muted-foreground mb-4">
              This post may have been deleted or the link is incorrect.
            </p>
            <Link href="/thinkpages">
              <Button>
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
    <div className="container mx-auto max-w-2xl py-8">
      {/* Back Button */}
      <div className="mb-4">
        <Link href="/thinkpages">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Feed
          </Button>
        </Link>
      </div>

      {/* Main Post */}
      <div className="space-y-4">
        <ThinkpagesPost
          post={post}
          currentUserAccountId={currentAccount?.id || ""}
          onLike={(postId) => {
            if (currentAccount?.id) {
              addReactionMutation.mutate({
                postId,
                accountId: currentAccount.id,
                reactionType: "like",
              });
            } else {
              toast.error("Please select an account to interact with posts");
            }
          }}
          onRepost={(postId) => {
            toast.info("Repost functionality coming soon!");
          }}
          onReply={(postId) => {
            toast.info("Reply functionality coming soon!");
          }}
          onShare={(postId) => {
            const postUrl = `${window.location.origin}/thinkpages/post/${postId}`;
            if (navigator.share) {
              navigator.share({
                title: "ThinkPages Post",
                text: "Check out this post on ThinkPages",
                url: postUrl,
              });
            } else {
              navigator.clipboard.writeText(postUrl);
              toast.success("Link copied to clipboard!");
            }
          }}
          onReaction={(postId, reactionType) => {
            if (currentAccount?.id) {
              addReactionMutation.mutate({
                postId,
                accountId: currentAccount.id,
                reactionType: reactionType as any,
              });
            } else {
              toast.error("Please select an account to react to posts");
            }
          }}
          showThread={false}
        />

        {/* Replies Section */}
        {replies.length > 0 && (
          <div className="mt-6">
            <h3 className="mb-4 text-lg font-semibold">Replies ({replies.length})</h3>
            <div className="space-y-4">
              {replies.map((reply) => (
                <ThinkpagesPost
                  key={reply.id}
                  post={reply}
                  currentUserAccountId={currentAccount?.id || ""}
                  onLike={(postId) => {
                    if (currentAccount?.id) {
                      addReactionMutation.mutate({
                        postId,
                        accountId: currentAccount.id,
                        reactionType: "like",
                      });
                    } else {
                      toast.error("Please select an account to interact with posts");
                    }
                  }}
                  onRepost={(postId) => {
                    toast.info("Repost functionality coming soon!");
                  }}
                  onReply={(postId) => {
                    toast.info("Reply functionality coming soon!");
                  }}
                  onShare={(postId) => {
                    const postUrl = `${window.location.origin}/thinkpages/post/${postId}`;
                    if (navigator.share) {
                      navigator.share({
                        title: "ThinkPages Post",
                        text: "Check out this post on ThinkPages",
                        url: postUrl,
                      });
                    } else {
                      navigator.clipboard.writeText(postUrl);
                      toast.success("Link copied to clipboard!");
                    }
                  }}
                  onReaction={(postId, reactionType) => {
                    if (currentAccount?.id) {
                      addReactionMutation.mutate({
                        postId,
                        accountId: currentAccount.id,
                        reactionType: reactionType as any,
                      });
                    } else {
                      toast.error("Please select an account to react to posts");
                    }
                  }}
                  showThread={false}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
