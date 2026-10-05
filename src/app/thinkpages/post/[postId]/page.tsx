"use client";

import React, { use, useEffect, useState, useRef } from "react";
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
import { getInitials } from "~/components/thinkpages/post/ThinkpagesPostUtils";

interface PostPageProps {
  params: Promise<{
    postId: string;
  }>;
}

const BackToFeed = ({ variant = "default" }: { variant?: "default" | "ghost" }) => (
  <Button asChild variant={variant} size={variant === "ghost" ? "sm" : undefined}>
    <Link href="/thinkpages">
      <ArrowLeft aria-hidden="true" />
      Back to feed
    </Link>
  </Button>
);

function sharePostLink(
  postId: string,
  kind: "post" | "reply",
  notify: ReturnType<typeof useNotify>
) {
  const postUrl = `${window.location.origin}/thinkpages/post/${postId}`;
  if (navigator.share) {
    void navigator.share({
      title: `ThinkPages ${kind}`,
      text: `Check out this ${kind} on ThinkPages`,
      url: postUrl,
    });
  } else {
    void navigator.clipboard.writeText(postUrl);
    notify.success("Link copied to clipboard");
  }
}

interface ReplyCapsuleProps {
  account: any;
  placeholderTarget: string;
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  isPending: boolean;
  inputRef: React.RefObject<HTMLInputElement | null>;
}

/** Floating bottom composer capsule. */
function ReplyCapsule({
  account,
  placeholderTarget,
  value,
  onChange,
  onSubmit,
  isPending,
  inputRef,
}: ReplyCapsuleProps) {
  return (
    <div className="z-sticky fixed bottom-[calc(var(--shell-tabbar-height)+1.5rem)] left-[calc(50%+(var(--shell-sidebar-width)-var(--shell-inspector-width))/2)] w-full max-w-lg -translate-x-1/2 px-4">
      <div className="facet-chrome shadow-floating focus-within:outline-tint flex w-full items-center gap-3 rounded-full px-4 py-2 focus-within:outline-2 focus-within:outline-offset-2">
        <Avatar className="border-separator size-8 shrink-0 border">
          {account?.profileImageUrl ? <AvatarImage src={account.profileImageUrl} /> : null}
          <AvatarFallback className="bg-fill-3 text-caption text-label-secondary">
            {account?.displayName ? getInitials(account.displayName) : "?"}
          </AvatarFallback>
        </Avatar>

        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSubmit();
            }
          }}
          placeholder={
            account ? `Reply to @${placeholderTarget}...` : "Select or create an account to reply"
          }
          disabled={!account || isPending}
          aria-label="Reply"
          className="text-body text-label placeholder:text-label-tertiary flex-1 border-none bg-transparent py-2 focus:outline-none disabled:opacity-50"
        />

        <Button
          size="icon"
          onClick={onSubmit}
          disabled={!value.trim() || !account || isPending}
          aria-label="Send reply"
          className="size-8 shrink-0 rounded-full"
        >
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ArrowUp className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );
}

export default function PostPage({ params }: PostPageProps) {
  const { postId } = use(params);
  const { user } = useUser();
  const notify = useNotify();
  const utils = api.useUtils();
  const replyInputRef = useRef<HTMLInputElement>(null);
  const [replyText, setReplyText] = useState("");

  const { data: userProfile } = api.users.getProfile.useQuery(undefined, { enabled: !!user?.id });

  const { data: accounts } = api.thinkpages.getAccountsByCountry.useQuery(
    { countryId: userProfile?.countryId || "" },
    { enabled: !!userProfile?.countryId }
  );
  const currentAccount = accounts?.[0];

  // The post comes with its replies pre-fetched
  const {
    data: post,
    isLoading,
    error,
  } = api.thinkpages.getPost.useQuery({ postId }, { enabled: !!postId });

  // Count this view once per post per signed-in viewer per day (the server dedupes; SL-8).
  const { mutate: recordView } = api.thinkpages.recordPostView.useMutation();
  const postLoaded = Boolean(post?.id);
  useEffect(() => {
    if (postLoaded && user?.id) recordView({ postId });
  }, [postLoaded, user?.id, postId, recordView]);

  const createPostMutation = api.thinkpages.createPost.useMutation({
    onSuccess: () => {
      notify.success("Reply posted");
      setReplyText("");
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
    } catch {
      // Handled by onError
    }
  };

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
            title="Post not found"
            message="This post may have been deleted or the link is incorrect."
            action={<BackToFeed />}
          />
        </Card>
      </div>
    );
  }

  const postProps = {
    currentUserAccountId: currentAccount?.id || "",
    accounts: accounts || [],
    countryId: userProfile?.countryId || "",
    onRepost: () => notify.info("Repost shared"),
  };

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="relative z-10 container mx-auto max-w-2xl px-4 py-8 pb-32">
        <div className="mb-6">
          <BackToFeed variant="ghost" />
        </div>

        <div className="relative space-y-6">
          {/* Vertical thread connector line */}
          {replies.length > 0 && (
            <div
              aria-hidden="true"
              className="bg-separator pointer-events-none absolute top-[108px] bottom-16 left-[48px] z-0 w-0.5"
            />
          )}

          <div className="relative z-10">
            <ThinkpagesPost
              {...postProps}
              post={post}
              onReply={() => replyInputRef.current?.focus()}
              onShare={() => sharePostLink(post.id, "post", notify)}
              isHero={true}
              showThread={false}
            />
          </div>

          {replies.length > 0 && (
            <div className="relative z-10 ml-5 space-y-4">
              {replies.map((reply) => (
                <div key={reply.id}>
                  <ThinkpagesPost
                    {...postProps}
                    post={reply}
                    onReply={() => {
                      replyInputRef.current?.focus();
                      setReplyText(`@${reply.account.username} `);
                    }}
                    onShare={() => sharePostLink(reply.id, "reply", notify)}
                    compact={true}
                    showThread={false}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <ReplyCapsule
        account={currentAccount}
        placeholderTarget={post.account.username}
        value={replyText}
        onChange={setReplyText}
        onSubmit={() => void handleSubmitReply()}
        isPending={createPostMutation.isPending}
        inputRef={replyInputRef}
      />
    </div>
  );
}
