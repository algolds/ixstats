import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { api } from '~/trpc/react';
import { Hash } from 'lucide-react';
import { Badge } from '~/components/ui/badge';
import { cn } from '~/lib/utils';

export function TrendingTopicsCard() {
  const { data: trendingTopics, isLoading, error } = api.thinkpages.getTrendingTopics.useQuery({
    limit: 5 // Display top 5 trending topics
  });

  if (isLoading) {
    return (
      <div className="glass-card p-6 flex items-center justify-center h-48">
        <p>Loading trending topics...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass-card p-6 flex items-center justify-center h-48 text-destructive">
        <p>Error loading trending topics: {error.message}</p>
      </div>
    );
  }

  if (!trendingTopics || trendingTopics.length === 0) {
    return (
      <div className="glass-card p-6 flex items-center justify-center h-48 text-muted-foreground">
        <p>No trending topics right now.</p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
      className="glass-card p-6 col-span-12 lg:col-span-4"
    >
      <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
        <Hash className="h-5 w-5 text-primary" />
        Trending Topics
      </h3>
      <div className="space-y-3">
        {trendingTopics.map((topic) => (
          <Link href={`/hashtags/${topic.hashtag}`} key={topic.id} className="block">
            <div className="flex items-center justify-between p-3 rounded-lg hover:bg-white/10 transition-colors">
              <div className="flex items-center gap-2">
                <span className="text-lg font-medium">#{topic.hashtag}</span>
                <Badge variant="secondary" className="text-xs">
                  {topic.postCount} posts
                </Badge>
              </div>
              <span className="text-muted-foreground text-sm">
                {topic.engagement} engagement
              </span>
            </div>
          </Link>
        ))}
      </div>
    </motion.div>
  );
}
