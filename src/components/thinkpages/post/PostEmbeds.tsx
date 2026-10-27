"use client";

import { FeedPollWidget } from "~/components/shared/polls/FeedPollWidget";
import { LiveDataCard } from "../LiveDataCard";
import { PostInlineLinkPreview, getInlinePreviewLink } from "./PostInlineLinkPreview";
import type { PostState } from "./postViewTypes";

interface PostEmbedsProps {
  post: any;
  state: Pick<PostState, "visualizations" | "sportsBulletin">;
  vizSpacing: string;
}

/** Live-data cards, poll and link preview shown under a post's body. */
export function PostEmbeds({ post, state, vizSpacing }: PostEmbedsProps) {
  const { visualizations, sportsBulletin } = state;
  const previewLink = sportsBulletin ? null : getInlinePreviewLink(post.content);

  return (
    <>
      {visualizations?.length > 0 && (
        <div className={vizSpacing}>
          {visualizations.map((viz: any, index: number) => (
            <LiveDataCard
              key={viz.id || index}
              type={viz.type}
              title={viz.title}
              countryId={post.account?.countryId || post.account?.country?.id || ""}
            />
          ))}
        </div>
      )}

      {post.poll && <FeedPollWidget poll={post.poll} />}

      {previewLink && <PostInlineLinkPreview url={previewLink} />}
    </>
  );
}
