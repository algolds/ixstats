"use client";

import {
  UnifiedFeedContent,
  type FeedHandlers,
} from "~/components/dashboard/sections/UnifiedFeedContent";
import { useNotify } from "~/hooks/useNotify";
import { feedShareCopy } from "~/lib/thinkpages/share-copy";

const noop = () => {};

/**
 * Rolling unified stream for the signed-out front page: ThinkPages posts, directives,
 * diplomatic events, grouped nation updates, and Wiki edits (excluding achievements).
 */
export function FrontPageFeed() {
  const notify = useNotify();

  const handleShare = () => {
    if (typeof navigator !== "undefined" && navigator.share) {
      void navigator.share({ ...feedShareCopy("post"), url: window.location.href });
    } else if (typeof navigator !== "undefined" && navigator.clipboard) {
      void navigator.clipboard.writeText(window.location.href);
      notify.success("Link copied");
    }
  };

  const feedHandlers: FeedHandlers = {
    currentUserAccountId: "",
    accounts: [],
    countryId: "",
    isOwner: false,
    onAccountSelectAction: noop,
    onAccountSettingsAction: noop,
    onCreateAccountAction: noop,
    onLikeAction: noop,
    onRepostAction: () => notify.info("Sign in to repost on ThinkPages"),
    onReactionAction: noop,
    onReplyAction: () => notify.info("Sign in to reply on ThinkPages"),
    onShareAction: handleShare,
  };

  return (
    <section aria-label="Activity stream" className="min-w-0">
      <UnifiedFeedContent activeTab="all" excludeAchievements {...feedHandlers} />
    </section>
  );
}
