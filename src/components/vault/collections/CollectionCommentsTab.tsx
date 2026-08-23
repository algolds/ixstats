"use client";

import React from "react";
import { Card, CardContent } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { ChatBubble as MessageCircle, Send } from "iconoir-react";

export interface CommentItem {
  id: string;
  userId: string;
  content: string;
  createdAt: Date;
}

export interface CollectionCommentsTabProps {
  commentText: string;
  setCommentText: (text: string) => void;
  onAddComment: () => void;
  isPending: boolean;
  comments?: CommentItem[];
}

export function CollectionCommentsTab({
  commentText,
  setCommentText,
  onAddComment,
  isPending,
  comments,
}: CollectionCommentsTabProps) {
  return (
    <div className="space-y-4">
      {/* Add comment */}
      <Card className="facet-hierarchy-child">
        <CardContent className="p-4">
          <h3 className="mb-3 text-lg font-semibold text-white">Add a Comment</h3>
          <div className="flex gap-2">
            <Input
              placeholder="Share your thoughts..."
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              className="facet-hierarchy-child flex-1"
              maxLength={500}
            />
            <Button
              onClick={onAddComment}
              disabled={!commentText.trim() || isPending}
              className="bg-gradient-to-r from-blue-500 to-purple-500"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
          <p className="mt-2 text-xs text-white/50">{commentText.length}/500 characters</p>
        </CardContent>
      </Card>

      {/* Comments list */}
      {comments && comments.length > 0 ? (
        <div className="space-y-3">
          {comments.map((comment) => (
            <Card key={comment.id} className="facet-hierarchy-child">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="flex-1">
                    <div className="mb-2 flex items-center gap-2">
                      <span className="text-sm font-semibold text-white">{comment.userId}</span>
                      <span className="text-xs text-white/50">
                        {new Date(comment.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-sm text-white/80">{comment.content}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="facet-hierarchy-child">
          <CardContent className="p-12 text-center">
            <MessageCircle className="mx-auto mb-3 h-12 w-12 text-white/20" />
            <p className="text-white/70">No comments yet</p>
            <p className="mt-1 text-sm text-white/50">Be the first to share your thoughts!</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
