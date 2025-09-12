"use client";

import React, { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '~/lib/utils';
import { 
  Send, 
  Image, 
  Smile, 
  Hash, 
  AtSign, 
  Globe, 
  Users, 
  Lock, 
  X, 
  AlertCircle,
  Loader2
} from 'lucide-react';
import { Button } from '~/components/ui/button';
import { Textarea } from '~/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '~/components/ui/avatar';
import { Badge } from '~/components/ui/badge';
import { api } from '~/trpc/react';
import { toast } from 'sonner';

interface PostComposerProps {
  account: {
    id: string;
    username: string;
    displayName: string;
    accountType: 'government' | 'media' | 'citizen';
    profileImageUrl?: string;
  };
  onPost: (post: any) => void;
  replyTo?: {
    id: string;
    account: {
      username: string;
      displayName: string;
    };
    content: string;
  };
  onCancel?: () => void;
  placeholder?: string;
  maxLength?: number;
  compact?: boolean;
}

const VISIBILITY_OPTIONS = {
  public: { icon: Globe, label: 'Public', description: 'Anyone can see this post' },
  private: { icon: Lock, label: 'Private', description: 'Only you and mentioned users can see this' },
  unlisted: { icon: AtSign, label: 'Mentioned only', description: 'Only mentioned accounts can see this' }
};

export function PostComposer({
  account,
  onPost,
  replyTo,
  onCancel,
  placeholder = "What's happening?",
  maxLength = 280,
  compact = false
}: PostComposerProps) {
  const [content, setContent] = useState(replyTo ? `@${replyTo.account.username} ` : '');
  const [visibility, setVisibility] = useState<'public' | 'private' | 'unlisted'>('public');
  const [showVisibilityMenu, setShowVisibilityMenu] = useState(false);
  const [isExpanded, setIsExpanded] = useState(!!replyTo);
  const [mentionQuery, setMentionQuery] = useState('');
  const { data: mentionResults, isLoading: isLoadingMentions } = { data: [], isLoading: false }; // Disabled until searchAccounts endpoint exists
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const createPostMutation = api.thinkpages.createPost.useMutation();

  const charactersRemaining = maxLength - content.length;
  const canPost = content.trim().length > 0 && charactersRemaining >= 0;

  const handlePost = useCallback(async () => {
    if (!canPost) return;

    const mentions = content.match(/@(\w+)/g)?.map(m => m.substring(1)) || [];
    const hashtags = content.match(/#(\w+)/g)?.map(h => h.substring(1)) || [];

    try {
      const newPost = await createPostMutation.mutateAsync({
        userId: account.id,
        content: content.trim(),
        visibility,
        parentPostId: replyTo?.id,
        mentions,
        hashtags,
      });
      toast.success('Post created successfully!');
      onPost(newPost);
      setContent(replyTo ? `@${replyTo.account.username} ` : '');
      setVisibility('public');
      setIsExpanded(false);
    } catch (error: any) {
      toast.error(error.message || 'Failed to create post');
    }
  }, [content, visibility, canPost, onPost, replyTo, account.id, createPostMutation]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handlePost();
    }
  }, [handlePost]);

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  const getAccountTypeColor = (accountType: string) => {
    switch (accountType) {
      case 'government': return 'text-amber-500 bg-amber-500/20';
      case 'media': return 'text-blue-500 bg-blue-500/20';
      case 'citizen': return 'text-green-500 bg-green-500/20';
      default: return 'text-gray-500 bg-gray-500/20';
    }
  };

  const insertText = (text: string) => {
    if (textareaRef.current) {
      const start = textareaRef.current.selectionStart;
      const end = textareaRef.current.selectionEnd;
      const newContent = content.substring(0, start) + text + content.substring(end);
      setContent(newContent);
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          textareaRef.current.selectionStart = start + text.length;
          textareaRef.current.selectionEnd = start + text.length;
        }
      }, 0);
    }
  };

  const VisibilityIcon = VISIBILITY_OPTIONS[visibility].icon;

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    setContent(newContent);

    const cursorPosition = e.target.selectionStart;
    const textBeforeCursor = newContent.substring(0, cursorPosition);
    const mentionMatch = textBeforeCursor.match(/@(\w*)$/);

    if (mentionMatch) {
      setMentionQuery(mentionMatch[1] ?? '');
    } else {
      setMentionQuery('');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg transition-all",
        compact ? "p-3" : "p-4"
      )}
    >
      {replyTo && (
        <div className="mb-4 p-3 bg-muted/20 rounded-lg border border-muted/20">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm text-muted-foreground">
              Replying to @{replyTo.account.username}
            </div>
            {onCancel && (
              <button
                onClick={onCancel}
                className="p-1 hover:bg-white/10 rounded-full transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <div className="text-sm text-muted-foreground line-clamp-2">
            {replyTo.content}
          </div>
        </div>
      )}

      <div className="flex gap-3">
        <Avatar className={compact ? "h-8 w-8" : "h-10 w-10"}>
          <AvatarImage src={account.profileImageUrl} />
          <AvatarFallback className={getAccountTypeColor(account.accountType)}>
            {getInitials(account.displayName)}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span className="font-medium">{account.displayName}</span>
            <span className="text-muted-foreground text-sm">@{account.username}</span>
            <Badge className={cn("text-xs", getAccountTypeColor(account.accountType))}>
              {account.accountType}
            </Badge>
          </div>

          <div className="relative">
            <Textarea
              ref={textareaRef}
              value={content}
              onChange={handleContentChange}
              onFocus={() => setIsExpanded(true)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              maxLength={maxLength}
              className={cn(
                "min-h-[60px] resize-none border-0 bg-transparent p-0 text-base placeholder:text-muted-foreground focus-visible:ring-0",
                isExpanded && "min-h-[100px]"
              )}
            />
            {mentionQuery && (
              <div className="absolute z-10 w-full bg-background border border-border rounded-lg shadow-lg mt-1">
                {isLoadingMentions && <div className="p-2">Loading...</div>}
                {mentionResults?.map((account: any) => (
                  <button
                    key={account.id}
                    onClick={() => {
                      const newContent = content.replace(/@(\w+)$/, `@${account.username} `);
                      setContent(newContent);
                      setMentionQuery('');
                    }}
                    className="w-full text-left p-2 hover:bg-muted"
                  >
                    <div className="flex items-center gap-2">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={account.profileImageUrl ?? undefined} />
                        <AvatarFallback>{account.displayName.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-semibold">{account.displayName}</div>
                        <div className="text-sm text-muted-foreground">@{account.username}</div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <AnimatePresence>
            {charactersRemaining <= 50 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className={cn(
                  "flex items-center gap-2 mt-2 text-sm",
                  charactersRemaining < 0 ? "text-red-500" : charactersRemaining <= 20 ? "text-orange-500" : "text-yellow-500"
                )}
              >
                <AlertCircle className="h-4 w-4" />
                <span>{charactersRemaining} characters remaining</span>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-4"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <button
                        onClick={() => setShowVisibilityMenu(!showVisibilityMenu)}
                        className="flex items-center gap-1 px-3 py-1 bg-muted/20 hover:bg-muted/40 rounded-full text-sm transition-colors"
                      >
                        <VisibilityIcon className="h-4 w-4" />
                        <span>{VISIBILITY_OPTIONS[visibility].label}</span>
                      </button>

                      <AnimatePresence>
                        {showVisibilityMenu && (
                          <motion.div
                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 10, scale: 0.95 }}
                            className="absolute top-full left-0 mt-2 w-64 bg-background border border-border rounded-lg shadow-lg z-50"
                          >
                            {Object.entries(VISIBILITY_OPTIONS).map(([key, option]) => {
                              const Icon = option.icon;
                              return (
                                <button
                                  key={key}
                                  onClick={() => {
                                    setVisibility(key as any);
                                    setShowVisibilityMenu(false);
                                  }}
                                  className={cn(
                                    "w-full flex items-center gap-3 p-3 text-left hover:bg-muted/50 transition-colors",
                                    key === visibility && "bg-muted/30"
                                  )}
                                >
                                  <Icon className="h-4 w-4" />
                                  <div>
                                    <div className="font-medium">{option.label}</div>
                                    <div className="text-sm text-muted-foreground">{option.description}</div>
                                  </div>
                                </button>
                              );
                            })}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    <button onClick={() => insertText('#')} className="p-2 hover:bg-muted/20 rounded-full transition-colors text-muted-foreground">
                      <Hash className="h-4 w-4" />
                    </button>
                    <button onClick={() => insertText('@')} className="p-2 hover:bg-muted/20 rounded-full transition-colors text-muted-foreground">
                      <AtSign className="h-4 w-4" />
                    </button>
                    <button className="p-2 hover:bg-muted/20 rounded-full transition-colors text-muted-foreground">
                      <Image className="h-4 w-4" />
                    </button>
                    <button className="p-2 hover:bg-muted/20 rounded-full transition-colors text-muted-foreground">
                      <Smile className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="flex items-center gap-3">
                    {charactersRemaining <= 50 && (
                      <div className={cn(
                        "text-sm font-medium",
                        charactersRemaining < 0 ? "text-red-500" : "text-muted-foreground"
                      )}>
                        {charactersRemaining}
                      </div>
                    )}
                    <Button
                      onClick={handlePost}
                      disabled={!canPost || createPostMutation.isPending}
                      size="sm"
                      className="flex items-center gap-2"
                    >
                      {createPostMutation.isPending && <Loader2 className="animate-spin h-4 w-4 mr-2" />}<Send className="h-4 w-4" />
                      {replyTo ? 'Reply' : 'Post'}
                    </Button>
                  </div>
                </div>

                <div className="mt-2 text-xs text-muted-foreground">
                  Press Ctrl+Enter to post
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {!isExpanded && content.trim().length > 0 && (
            <div className="flex justify-end mt-2">
              <Button
                onClick={handlePost}
                disabled={!canPost || createPostMutation.isPending}
                size="sm"
                className="flex items-center gap-2"
              >
                {createPostMutation.isPending && <Loader2 className="animate-spin h-4 w-4 mr-2" />}<Send className="h-4 w-4" />
                Post
              </Button>
            </div>
          )}
        </div>
      </div>

      {showVisibilityMenu && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowVisibilityMenu(false)}
        />
      )}
    </motion.div>
  );
}