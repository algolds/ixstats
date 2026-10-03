"use client";

import React from "react";
import { Card, CardContent } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { ChatBubble as MessageCircle, Send } from "iconoir-react";

interface CommentItem {
  id: string;
  userId: string;
  content: string;
  createdAt: Date;
}

interface CollectionCommentsTabProps {
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
      <Card className="flex flex-col gap-6 py-6">
        <CardContent className="p-4">
          <h3 className="text-title-3 text-label mb-3 font-semibold">Add a comment</h3>
          <div className="flex gap-2">
            <Input
              placeholder="Share your thoughts..."
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              className="bg-surface-secondary border-separator flex-1 border"
              maxLength={500}
            />
            <Button
              onClick={onAddComment}
              disabled={!commentText.trim() || isPending}
              className="bg-blue text-on-blue"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-footnote text-label-secondary mt-2">
            {commentText.length}/500 characters
          </p>
        </CardContent>
      </Card>

      {/* Comments list */}
      {comments && comments.length > 0 ? (
        <div className="space-y-3">
          {comments.map((comment) => (
            <Card key={comment.id} className="flex flex-col gap-6 py-6">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="flex-1">
                    <div className="mb-2 flex items-center gap-2">
                      <span className="text-headline text-label">{comment.userId}</span>
                      <span className="text-footnote text-label-secondary">
                        {new Date(comment.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-body text-label">{comment.content}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="flex flex-col gap-6 py-6">
          <CardContent className="p-12 text-center">
            <MessageCircle className="text-label-tertiary mx-auto mb-3 h-12 w-12" />
            <p className="text-label-secondary">No comments yet</p>
            <p className="text-body text-label-secondary mt-1">No comments yet.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
