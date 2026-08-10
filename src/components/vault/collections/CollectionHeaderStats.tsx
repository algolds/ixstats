"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Globe, Lock, Heart, Share2, Edit2, Trash2 } from "lucide-react";

export interface CollectionStats {
  cardCount: number;
  totalValue: number;
  likes: number;
  comments: number;
}

export interface CollectionHeaderStatsProps {
  name: string;
  description?: string | null;
  isPublic: boolean;
  stats: CollectionStats;
  onLike: () => void;
  onShare: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export function CollectionHeaderStats({
  name,
  description,
  isPublic,
  stats,
  onLike,
  onShare,
  onEdit,
  onDelete,
}: CollectionHeaderStatsProps) {
  return (
    <Card className="glass-hierarchy-parent">
      <CardHeader>
        <div className="flex flex-col items-start justify-between gap-4 lg:flex-row">
          <div className="flex-1">
            <div className="mb-2 flex items-center gap-3">
              <CardTitle className="text-2xl text-white sm:text-3xl">{name}</CardTitle>
              {isPublic ? (
                <Globe className="h-5 w-5 text-blue-400" />
              ) : (
                <Lock className="text-gold-400 h-5 w-5" />
              )}
            </div>
            <p className="text-sm text-white/70 sm:text-base">
              {description || "No description"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onLike}
              className="glass-hierarchy-child"
            >
              <Heart className="mr-2 h-4 w-4 text-pink-400" />
              Like
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onShare}
              className="glass-hierarchy-child"
            >
              <Share2 className="mr-2 h-4 w-4" />
              Share
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onEdit}
              className="glass-hierarchy-child"
            >
              <Edit2 className="mr-2 h-4 w-4" />
              Edit
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onDelete}
              className="glass-hierarchy-child text-red-400 hover:bg-red-500/10"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="glass-hierarchy-child rounded-lg p-3 sm:p-4">
            <p className="mb-1 text-xs text-white/60">Card Count</p>
            <p className="text-xl font-bold text-white sm:text-2xl">{stats.cardCount}</p>
          </div>
          <div className="glass-hierarchy-child rounded-lg p-3 sm:p-4">
            <p className="mb-1 text-xs text-white/60">Total Value</p>
            <p className="text-xl font-bold text-green-400 sm:text-2xl">
              {stats.totalValue.toLocaleString()} IxC
            </p>
          </div>
          <div className="glass-hierarchy-child rounded-lg p-3 sm:p-4">
            <p className="mb-1 text-xs text-white/60">Likes</p>
            <p className="text-xl font-bold text-pink-400 sm:text-2xl">{stats.likes}</p>
          </div>
          <div className="glass-hierarchy-child rounded-lg p-3 sm:p-4">
            <p className="mb-1 text-xs text-white/60">Comments</p>
            <p className="text-xl font-bold text-blue-400 sm:text-2xl">{stats.comments}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
