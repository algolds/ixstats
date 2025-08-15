"use client";

import { useParams } from 'next/navigation';
import { api } from '~/trpc/react';
import { ThinkpagesPost } from '~/components/thinkpages/ThinkpagesPost';
import { Loader2 } from 'lucide-react';

export default function HashtagPage() {
  const params = useParams();
  const tag = params.tag as string;

  const { data: feed, isLoading: isLoadingFeed } = api.thinkpages.getFeed.useQuery({ hashtag: tag });

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">#{tag}</h2>
      <div className="space-y-4">
        {isLoadingFeed ? (
          <div className="flex justify-center items-center p-8">
            <Loader2 className="animate-spin h-8 w-8" />
          </div>
        ) : (
          feed?.posts.map(post => (
            <ThinkpagesPost
              key={post.id}
              post={post}
              currentUserAccountId="" // This should be the current user's account ID
            />
          ))
        )}
      </div>
    </div>
  );
}
