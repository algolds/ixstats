"use client";

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '~/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { 
  Heart, 
  MessageCircle, 
  Repeat2, 
  Share, 
  MoreHorizontal, 
  Pin, 
  Bookmark, 
  Flag, 
  Verified, 
  Smile, 
  Angry, 
  ThumbsUp, 
  ThumbsDown, 
  Flame, 
  Crown, 
  Newspaper, 
  Users,
  Loader2
} from 'lucide-react';
import { Button } from '~/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '~/components/ui/avatar';
import { Badge } from '~/components/ui/badge';
import { ReactionPopup } from './ReactionPopup';
import { api } from '~/trpc/react';
import { toast } from 'sonner';
import Linkify from 'linkify-react';
import LinkifyIt from 'linkify-it';

const linkifyIt = new LinkifyIt();
linkifyIt.add('@', {
  validate: (text, pos, self) => {
    const tail = text.slice(pos);
    if (!self.re.mention) {
      self.re.mention = new RegExp(
        '^([a-zA-Z0-9_]){1,15}(?!_)'
      );
    }
    if (self.re.mention.test(tail)) {
      if (pos > 0 && text[pos - 1] === '@') {
        return false;
      }
      return tail.match(self.re.mention)[0].length;
    }
    return 0;
  },
  normalize: match => {
    match.url = '/thinkpages/user/' + match.raw.slice(1);
  }
});
linkifyIt.add('#', {
  validate: (text, pos, self) => {
    const tail = text.slice(pos);
    if (!self.re.hashtag) {
      self.re.hashtag = new RegExp(
        '^[a-zA-Z0-9_]+(?![_])'
      );
    }
    if (self.re.hashtag.test(tail)) {
      if (pos > 0 && text[pos - 1] === '#') {
        return false;
      }
      return tail.match(self.re.hashtag)[0].length;
    }
    return 0;
  },
  normalize: match => {
    match.url = '/hashtags/' + match.raw.slice(1);
  }
});

interface ThinkpagesPostProps {
  post: any;
  currentUserAccountId: string;
  onLike?: (postId: string) => void;
  onRepost?: (postId: string) => void;
  onReply?: (postId: string) => void;
  onShare?: (postId: string) => void;
  onReaction?: (postId: string, reactionType: string) => void;
  onAccountClick?: (accountId: string) => void;
  compact?: boolean;
  showThread?: boolean;
}

const ACCOUNT_TYPE_ICONS = {
  government: Crown,
  media: Newspaper,
  citizen: Users
};

const ACCOUNT_TYPE_COLORS = {
  government: 'text-amber-500 bg-amber-500/20',
  media: 'text-blue-500 bg-blue-500/20',
  citizen: 'text-green-500 bg-green-500/20'
};

const REACTION_ICONS: { [key: string]: React.ElementType } = {
  like: Heart,
  laugh: Smile,
  angry: Angry,
  fire: Flame,
  thumbsup: ThumbsUp,
  thumbsdown: ThumbsDown
};

export function ThinkpagesPost({
  post,
  currentUserAccountId = '',
  onLike,
  onRepost,
  onReply,
  onShare,
  onReaction,
  onAccountClick,
  compact = false,
  showThread = false
}: ThinkpagesPostProps) {
  const [showReactions, setShowReactions] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [isReposted, setIsReposted] = useState(false);
  const [showReplies, setShowReplies] = useState(false);
  const [showReactionPopup, setShowReactionPopup] = useState(false);

  const addReactionMutation = api.thinkpages.addReaction.useMutation();
  const removeReactionMutation = api.thinkpages.removeReaction.useMutation();

  const AccountTypeIcon = ACCOUNT_TYPE_ICONS[post.account.accountType as keyof typeof ACCOUNT_TYPE_ICONS];
  const accountTypeColor = ACCOUNT_TYPE_COLORS[post.account.accountType as keyof typeof ACCOUNT_TYPE_COLORS];

  const handleLike = useCallback(() => {
    setIsLiked(!isLiked);
    onLike?.(post.id);
  }, [isLiked, onLike, post.id]);

  const handleRepost = useCallback(() => {
    setIsReposted(!isReposted);
    onRepost?.(post.id);
  }, [isReposted, onRepost, post.id]);

  const handleReaction = useCallback(async (reactionType: string) => {
    if (!currentUserAccountId) {
      console.warn("currentUserAccountId is not defined. Cannot perform reaction.");
      return;
    }
    const existingReaction = post.reactions.find((r: any) => r.accountId === currentUserAccountId);

    try {
      if (existingReaction && existingReaction.reactionType === reactionType) {
        await removeReactionMutation.mutateAsync({ 
          postId: post.id, 
          accountId: currentUserAccountId 
        });
      } else {
        await addReactionMutation.mutateAsync({ 
          postId: post.id, 
          accountId: currentUserAccountId,
          reactionType 
        });
      }
      onReaction?.(post.id, reactionType);
      setShowReactions(false);
    } catch (error: any) {
      toast.error(error.message || 'Failed to update reaction');
    }
  }, [addReactionMutation, removeReactionMutation, onReaction, post.id, post.reactions, currentUserAccountId]);

  const formatContent = (content: string) => {
    return (
      <Linkify options={{ 
        validate: linkifyIt.pretest.bind(linkifyIt),
        find: linkifyIt.test.bind(linkifyIt),
        normalize: linkifyIt.normalize.bind(linkifyIt),
        tagName: 'a',
        attributes: (href, type) => ({
          className: type === 'mention' ? 'text-purple-500 hover:underline' : 'text-blue-500 hover:underline',
        })
      }}>
        {content}
      </Linkify>
    );
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg transition-all hover:bg-white/10",
        compact ? "p-3" : "p-4",
        post.pinned && "border-amber-500/30 bg-amber-500/5"
      )}
    >
      {post.pinned && (
        <div className="flex items-center gap-2 mb-3 text-amber-500 text-sm">
          <Pin className="h-4 w-4" />
          <span>Pinned Post</span>
        </div>
      )}

      {post.postType === 'repost' && (
        <div className="flex items-center gap-2 mb-3 text-green-500 text-sm">
          <Repeat2 className="h-4 w-4" />
          <span>@{post.account.username} reposted</span>
        </div>
      )}

      {post.postType === 'reply' && post.parentPost && (
        <div className="flex items-center gap-2 mb-3 text-blue-500 text-sm">
          <MessageCircle className="h-4 w-4" />
          <span>Replying to @{post.parentPost.account.username}</span>
        </div>
      )}

      <div className="flex gap-3">
        <button
          onClick={() => onAccountClick?.(post.account.id)}
          className="flex-shrink-0"
        >
          <Avatar className={compact ? "h-8 w-8" : "h-10 w-10"}>
            <AvatarImage src={post.account.profileImageUrl} />
            <AvatarFallback className={accountTypeColor}>
              {getInitials(post.account.displayName)}
            </AvatarFallback>
          </Avatar>
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <button
              onClick={() => onAccountClick?.(post.account.id)}
              className="font-semibold hover:underline"
            >
              {post.account.displayName}
            </button>
            
            {post.account.verified && (
              <Verified className="h-4 w-4 text-blue-500 fill-current" />
            )}
            
            <div className={cn("p-1 rounded", accountTypeColor)}>
              <AccountTypeIcon className="h-3 w-3" />
            </div>
            
            <span className="text-muted-foreground text-sm">
              @{post.account.username}
            </span>
            
            <span className="text-muted-foreground text-sm">·</span>
            
            <span className="text-muted-foreground text-sm">
              {formatDistanceToNow(new Date(post.timestamp), { addSuffix: true })}
            </span>

            {post.trending && (
              <Badge variant="secondary" className="text-xs bg-orange-500/20 text-orange-400">
                Trending
              </Badge>
            )}
          </div>

          <div className={cn("mb-3", compact ? "text-sm" : "text-base")}>
            {post.repostOf ? (
              <div className="border-l-2 border-muted pl-3">
                <div className="text-muted-foreground text-sm mb-1">
                  @{post.repostOf.account.username} · @{post.repostOf.account.displayName}
                </div>
                <div >
                  {formatContent(post.repostOf.content)}
                </div>
              </div>
            ) : (
              <div>
                {formatContent(post.content)}
              </div>
            )}
          </div>

          {post.hashtags && post.hashtags.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-3">
              {post.hashtags.map((hashtag: string, index: number) => (
                <button
                  key={index}
                  className="text-blue-500 hover:underline text-sm"
                >
                  #{hashtag}
                </button>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => onReply?.(post.id)}
                className="flex items-center gap-1 text-muted-foreground hover:text-blue-500 transition-colors group"
              >
                <div className="p-2 rounded-full group-hover:bg-blue-500/20 transition-colors">
                  <MessageCircle className="h-4 w-4" />
                </div>
                {post.replyCount > 0 && (
                  <span className="text-sm">{post.replyCount}</span>
                )}
              </button>

              <button
                onClick={handleRepost}
                className={cn(
                  "flex items-center gap-1 transition-colors group",
                  isReposted ? "text-green-500" : "text-muted-foreground hover:text-green-500"
                )}
              >
                <div className="p-2 rounded-full group-hover:bg-green-500/20 transition-colors">
                  <Repeat2 className="h-4 w-4" />
                </div>
                {post.repostCount > 0 && (
                  <span className="text-sm">{post.repostCount}</span>
                )}
              </button>

              <div className="relative">
                <button
                  onClick={handleLike}
                  onMouseEnter={() => setShowReactionPopup(true)}
                  onMouseLeave={() => setShowReactionPopup(false)}
                  className={cn(
                    "flex items-center gap-1 transition-colors group",
                    isLiked ? "text-red-500" : "text-muted-foreground hover:text-red-500"
                  )}
                >
                  <div className="p-2 rounded-full group-hover:bg-red-500/20 transition-colors">
                    <Heart className={cn("h-4 w-4", isLiked && "fill-current")} />
                  </div>
                  {post.likeCount > 0 && (
                    <span className="text-sm">{post.likeCount}</span>
                  )}
                </button>

                <AnimatePresence>
                  {showReactionPopup && (
                    <ReactionPopup
                      reactions={post.reactions}
                      onSelectReaction={handleReaction}
                    />
                  )}
                </AnimatePresence>
              </div>

              <button
                onClick={() => onShare?.(post.id)}
                className="flex items-center gap-1 text-muted-foreground hover:text-blue-500 transition-colors group"
              >
                <div className="p-2 rounded-full group-hover:bg-blue-500/20 transition-colors">
                  <Share className="h-4 w-4" />
                </div>
              </button>
            </div>

            <button className="p-2 text-muted-foreground hover:text-foreground hover:bg-white/10 rounded-full transition-colors">
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </div>

          {post.reactionCounts && Object.keys(post.reactionCounts).length > 0 && (
            <div className="flex items-center gap-2 mt-2 pt-2 border-t border-white/10">
              {Object.entries(post.reactionCounts).map(([type, count]) => {
                const Icon = REACTION_ICONS[type];
                if (!Icon || (count as number) === 0) return null;
                return (
                  <div key={type} className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Icon className="h-4 w-4" />
                    <span>{count as any}</span>
                  </div>
                );
              })}
            </div>
          )}

          {showThread && post.replyCount > 0 && (
            <button
              onClick={() => setShowReplies(!showReplies)}
              className="text-blue-500 hover:underline text-sm mt-2"
            >
              {showReplies ? 'Hide' : 'Show'} {post.replyCount} {post.replyCount === 1 ? 'reply' : 'replies'}
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}
