"use client";

import React, { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '~/lib/utils';
import { useRelativeTime } from '~/hooks/useRelativeTime';
import { 
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
  Heart,
  Edit,
  Trash2,
  Crown,
  Newspaper,
  Users,
  Repeat2,
  MessageCircle
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '~/components/ui/avatar';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { Textarea } from '~/components/ui/textarea';
import { PostActions } from './primitives/PostActions';
import { AccountIndicator } from './primitives/AccountIndicator';
import { api } from '~/trpc/react';
import { toast } from 'sonner';
import { formatContentEnhanced, extractHashtags, extractMentions } from '~/lib/text-formatter';

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

function RelativeTimestamp({ timestamp }: { timestamp: Date | string | number }) {
  const relativeTime = useRelativeTime(timestamp);
  const date = new Date(timestamp);
  const now = new Date();
  const hoursDiff = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
  
  return (
    <span 
      className="text-muted-foreground text-sm cursor-help"
      title={`IxTime: ${date.toLocaleString()}`}
    >
      {hoursDiff > 24 ? date.toLocaleDateString() : relativeTime}
    </span>
  );
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
  const [showReplies, setShowReplies] = useState(false);
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  const [showReplyComposer, setShowReplyComposer] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [showEditComposer, setShowEditComposer] = useState(false);
  const [editText, setEditText] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showFlagDialog, setShowFlagDialog] = useState(false);
  const [flagReason, setFlagReason] = useState('');

  // Close more options when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showMoreOptions) {
        setShowMoreOptions(false);
      }
    };

    if (showMoreOptions) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [showMoreOptions]);

  const addReactionMutation = api.thinkpages.addReaction.useMutation();
  const removeReactionMutation = api.thinkpages.removeReaction.useMutation();
  const createPostMutation = api.thinkpages.createPost.useMutation();
  const updatePostMutation = api.thinkpages.updatePost.useMutation();
  const deletePostMutation = api.thinkpages.deletePost.useMutation();
  const pinPostMutation = api.thinkpages.pinPost.useMutation();
  const bookmarkPostMutation = api.thinkpages.bookmarkPost.useMutation();
  const flagPostMutation = api.thinkpages.flagPost.useMutation();


  const handlePin = useCallback(async () => {
    if (!currentUserAccountId) return;
    try {
      await pinPostMutation.mutateAsync({
        postId: post.id,
        accountId: currentUserAccountId,
        pinned: !post.pinned
      });
      toast.success(post.pinned ? 'Post unpinned' : 'Post pinned');
    } catch (error: any) {
      toast.error(error.message || 'Failed to pin post');
    }
  }, [pinPostMutation, post.id, post.pinned, currentUserAccountId]);

  const handleBookmark = useCallback(async () => {
    if (!currentUserAccountId) return;
    try {
      await bookmarkPostMutation.mutateAsync({
        postId: post.id,
        userId: currentUserAccountId,
        bookmarked: true
      });
      toast.success('Post bookmarked');
    } catch (error: any) {
      toast.error(error.message || 'Failed to bookmark post');
    }
  }, [bookmarkPostMutation, post.id, currentUserAccountId]);

  const handleFlag = useCallback(() => {
    if (!currentUserAccountId) return;
    setShowFlagDialog(true);
    setShowMoreOptions(false);
  }, [currentUserAccountId]);

  const handleSubmitFlag = useCallback(async () => {
    if (!flagReason.trim()) return;
    
    try {
      await flagPostMutation.mutateAsync({
        postId: post.id,
        userId: currentUserAccountId,
        reason: flagReason
      });
      toast.success('Post flagged');
      setShowFlagDialog(false);
      setFlagReason('');
    } catch (error: any) {
      toast.error(error.message || 'Failed to flag post');
    }
  }, [flagPostMutation, post.id, currentUserAccountId, flagReason]);

  const handleEdit = useCallback(() => {
    if (!currentUserAccountId || post.account.id !== currentUserAccountId) return;
    setEditText(post.content);
    setShowEditComposer(true);
    setShowMoreOptions(false);
  }, [post.content, post.account.id, currentUserAccountId]);

  const handleSubmitEdit = useCallback(async () => {
    if (!editText.trim() || editText === post.content) {
      setShowEditComposer(false);
      return;
    }
    
    try {
      await updatePostMutation.mutateAsync({
        postId: post.id,
        accountId: currentUserAccountId,
        content: editText
      });
      toast.success('Post updated');
      setShowEditComposer(false);
    } catch (error: any) {
      toast.error(error.message || 'Failed to update post');
    }
  }, [updatePostMutation, post.id, editText, post.content, currentUserAccountId]);

  const handleDelete = useCallback(() => {
    if (!currentUserAccountId || post.account.id !== currentUserAccountId) return;
    setShowDeleteConfirm(true);
    setShowMoreOptions(false);
  }, [post.account.id, currentUserAccountId]);

  const handleConfirmDelete = useCallback(async () => {
    try {
      await deletePostMutation.mutateAsync({
        postId: post.id,
        accountId: currentUserAccountId
      });
      toast.success('Post deleted');
      setShowDeleteConfirm(false);
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete post');
    }
  }, [deletePostMutation, post.id, currentUserAccountId]);

  const handleReply = useCallback(() => {
    setShowReplyComposer(!showReplyComposer);
    if (!showReplyComposer) {
      // Enhanced @ mention with proper formatting
      const mentionText = `@${post.account.username} `;
      setReplyText(mentionText);
      // Auto-focus the reply input after a short delay
      setTimeout(() => {
        const replyInput = document.querySelector('[data-reply-input]') as HTMLTextAreaElement;
        if (replyInput) {
          replyInput.focus();
          replyInput.setSelectionRange(mentionText.length, mentionText.length);
        }
      }, 100);
    }
  }, [showReplyComposer, post.account.username]);

  const handleSubmitReply = useCallback(async () => {
    if (!replyText.trim() || !currentUserAccountId) return;
    
    try {
      // Enhanced reply with hashtag and mention extraction
      await createPostMutation.mutateAsync({
        accountId: currentUserAccountId,
        content: replyText,
        parentPostId: post.id,
        visibility: 'public',
        hashtags: extractHashtags(replyText),
        mentions: extractMentions(replyText)
      });
      toast.success('Reply posted!');
      setReplyText('');
      setShowReplyComposer(false);
    } catch (error: any) {
      toast.error(error.message || 'Failed to post reply');
    }
  }, [createPostMutation, replyText, currentUserAccountId, post.id]);


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
            <AvatarFallback className={`font-semibold ${ACCOUNT_TYPE_COLORS[post.account.accountType as keyof typeof ACCOUNT_TYPE_COLORS] || 'text-gray-500 bg-gray-500/20'}`}>
              {post.account.displayName.split(' ').map((n: string) => n[0]).join('').toUpperCase()}
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
            
            <div className={`p-1 rounded ${ACCOUNT_TYPE_COLORS[post.account.accountType as keyof typeof ACCOUNT_TYPE_COLORS] || 'text-gray-500 bg-gray-500/20'}`}>
              {React.createElement(ACCOUNT_TYPE_ICONS[post.account.accountType as keyof typeof ACCOUNT_TYPE_ICONS] || Users, { className: "h-3 w-3" })}
            </div>
            
            <span className="text-muted-foreground text-sm">
              @{post.account.username}
            </span>
            
            <span className="text-muted-foreground text-sm">·</span>
            
            <RelativeTimestamp timestamp={post.timestamp} />

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
                <div dangerouslySetInnerHTML={{ __html: formatContentEnhanced(post.repostOf.content) }} />
              </div>
            ) : (
              <div dangerouslySetInnerHTML={{ __html: formatContentEnhanced(post.content) }} />
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

          <PostActions
            postId={post.id}
            currentUserAccountId={currentUserAccountId}
            isLiked={post.reactions?.some((r: any) => r.accountId === currentUserAccountId && r.reactionType === 'like')}
            isReposted={false} // TODO: Track repost status
            likeCount={post.likeCount}
            repostCount={post.repostCount}
            replyCount={post.replyCount}
            reactions={post.reactions || []}
            reactionCounts={post.reactionCounts || {}}
            onLike={onLike}
            onRepost={onRepost}
            onReply={() => handleReply()}
            onShare={() => {
              const postUrl = `${window.location.origin}/thinkpages/post/${post.id}`;
              navigator.clipboard.writeText(postUrl);
              toast.success('Post URL copied to clipboard!');
              onShare?.(post.id);
            }}
            onReaction={onReaction}
            showCounts={true}
            size="md"
          />

          <div className="flex items-center justify-end">
            <div className="relative">
              <button 
                onClick={() => setShowMoreOptions(!showMoreOptions)}
                className="p-2 text-muted-foreground hover:text-foreground hover:bg-white/10 rounded-full transition-colors"
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>
              <AnimatePresence>
                {showMoreOptions && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.9, y: -10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: -10 }}
                    className="absolute right-0 mt-2 w-48 bg-background border border-border rounded-lg shadow-lg z-[60] backdrop-blur-sm"
                    style={{ zIndex: 60 }}
                  >
                    {currentUserAccountId === post.account.id && (
                      <>
                        <button onClick={handlePin} className="flex items-center gap-2 w-full px-4 py-2 text-left text-sm hover:bg-muted"> 
                          <Pin className="h-4 w-4" /> 
                          {post.pinned ? 'Unpin' : 'Pin'}
                        </button>
                        <button onClick={handleEdit} className="flex items-center gap-2 w-full px-4 py-2 text-left text-sm hover:bg-muted"> 
                          <Edit className="h-4 w-4" /> 
                          Edit 
                        </button>
                        <button onClick={handleDelete} className="flex items-center gap-2 w-full px-4 py-2 text-left text-sm hover:bg-muted text-destructive"> 
                          <Trash2 className="h-4 w-4" /> 
                          Delete 
                        </button>
                        <div className="border-t border-border my-1"></div>
                      </>
                    )}
                    <button onClick={handleBookmark} className="flex items-center gap-2 w-full px-4 py-2 text-left text-sm hover:bg-muted"> 
                      <Bookmark className="h-4 w-4" /> 
                      Bookmark 
                    </button>
                    <button onClick={handleFlag} className="flex items-center gap-2 w-full px-4 py-2 text-left text-sm hover:bg-muted"> 
                      <Flag className="h-4 w-4" /> 
                      Flag 
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {post.reactionCounts && Object.keys(post.reactionCounts).length > 0 && (
            <div className="flex items-center gap-2 mt-2 pt-2 border-t border-white/10">
              {Object.entries(post.reactionCounts).map(([type, count]) => {
                const Icon = REACTION_ICONS[type];
                if (!Icon || (count as number) === 0) return null;
                return (
                  <div key={type} className="flex items-center gap-1 text-sm text-muted-foreground">
                    {React.createElement(Icon, { className: "h-4 w-4" })}
                    <span>{typeof count === 'number' ? count : 0}</span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Edit Composer */}
          <AnimatePresence>
            {showEditComposer && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-3 p-3 border border-amber-500/50 rounded-lg bg-amber-500/5"
              >
                <div className="flex gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={post.account.profileImageUrl} />
                    <AvatarFallback className={`font-semibold ${ACCOUNT_TYPE_COLORS[post.account.accountType as keyof typeof ACCOUNT_TYPE_COLORS] || 'text-gray-500 bg-gray-500/20'}`}>
                      {post.account.displayName.split(' ').map((n: string) => n[0]).join('').toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2 mb-2 text-amber-600">
                      <Edit className="h-4 w-4" />
                      <span className="text-sm font-medium">Editing post</span>
                    </div>
                    <Textarea
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      placeholder="Edit your post..."
                      className="min-h-[80px] resize-none"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                          e.preventDefault();
                          handleSubmitEdit();
                        }
                        if (e.key === 'Escape') {
                          setShowEditComposer(false);
                        }
                      }}
                      autoFocus
                    />
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowEditComposer(false)}
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleSubmitEdit}
                        disabled={!editText.trim() || editText === post.content || updatePostMutation.isPending}
                        className="bg-amber-600 hover:bg-amber-700"
                      >
                        {updatePostMutation.isPending ? 'Saving...' : 'Save Changes'}
                      </Button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Reply Composer */}
          <AnimatePresence>
            {showReplyComposer && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-3 p-3 border border-border rounded-lg bg-muted/30"
              >
                <div className="flex gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback>You</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 space-y-2">
                    <Textarea
                      data-reply-input
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder={`Reply to @${post.account.username}`}
                      className="min-h-[60px] resize-none"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                          e.preventDefault();
                          handleSubmitReply();
                        }
                      }}
                    />
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowReplyComposer(false)}
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleSubmitReply}
                        disabled={!replyText.trim() || createPostMutation.isPending}
                      >
                        {createPostMutation.isPending ? 'Replying...' : 'Reply'}
                      </Button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {showThread && post.replyCount > 0 && (
            <button
              onClick={() => setShowReplies(!showReplies)}
              className="text-blue-500 hover:underline text-sm mt-2"
            >
              {showReplies ? 'Hide' : 'Show'} {post.replyCount} {post.replyCount === 1 ? 'reply' : 'replies'}
            </button>
          )}

          {/* Delete Confirmation Dialog */}
          <AnimatePresence>
            {showDeleteConfirm && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[70] flex items-center justify-center"
                onClick={() => setShowDeleteConfirm(false)}
              >
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.9, opacity: 0 }}
                  className="bg-background border border-border rounded-lg p-6 max-w-md mx-4"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-red-500/20 rounded-full">
                      <Trash2 className="h-5 w-5 text-red-500" />
                    </div>
                    <div>
                      <h3 className="font-semibold">Delete Post</h3>
                      <p className="text-sm text-muted-foreground">This action cannot be undone.</p>
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowDeleteConfirm(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={handleConfirmDelete}
                      disabled={deletePostMutation.isPending}
                    >
                      {deletePostMutation.isPending ? 'Deleting...' : 'Delete'}
                    </Button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Flag Dialog */}
          <AnimatePresence>
            {showFlagDialog && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[70] flex items-center justify-center"
                onClick={() => setShowFlagDialog(false)}
              >
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.9, opacity: 0 }}
                  className="bg-background border border-border rounded-lg p-6 max-w-md mx-4"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-orange-500/20 rounded-full">
                      <Flag className="h-5 w-5 text-orange-500" />
                    </div>
                    <div>
                      <h3 className="font-semibold">Flag Post</h3>
                      <p className="text-sm text-muted-foreground">Help us understand what's wrong.</p>
                    </div>
                  </div>
                  <Textarea
                    value={flagReason}
                    onChange={(e) => setFlagReason(e.target.value)}
                    placeholder="Why are you flagging this post?"
                    className="mb-4"
                    autoFocus
                  />
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setShowFlagDialog(false);
                        setFlagReason('');
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleSubmitFlag}
                      disabled={!flagReason.trim() || flagPostMutation.isPending}
                      className="bg-orange-600 hover:bg-orange-700"
                    >
                      {flagPostMutation.isPending ? 'Flagging...' : 'Flag Post'}
                    </Button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}
