"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import {
  Globe,
  Lock,
  Heart,
  ShareAndroid as Share2,
  EditPencil as Edit2,
  Trash as Trash2,
} from "iconoir-react";
import { IxCreditsSymbol } from "~/components/vault/IxCreditsSymbol";

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
    <Card>
      <CardHeader>
        <div className="flex flex-col items-start justify-between gap-4 lg:flex-row">
          <div className="flex-1">
            <div className="mb-2 flex items-center gap-3">
              <CardTitle className="text-title-1 text-label sm:text-large-title">{name}</CardTitle>
              {isPublic ? (
                <Globe className="text-blue h-5 w-5" />
              ) : (
                <Lock className="text-yellow h-5 w-5" />
              )}
            </div>
            <p className="text-body text-label-secondary">{description || "No description"}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onLike}
              className="bg-surface-secondary border"
            >
              <Heart className="text-red mr-2 h-4 w-4" />
              Like
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onShare}
              className="bg-surface-secondary border"
            >
              <Share2 className="mr-2 h-4 w-4" />
              Share
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onEdit}
              className="bg-surface-secondary border"
            >
              <Edit2 className="mr-2 h-4 w-4" />
              Edit
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onDelete}
              className="bg-surface-secondary text-red hover:bg-red/10 border"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="bg-surface-secondary border-separator rounded-control border p-3 sm:p-4">
            <p className="text-footnote text-label-secondary mb-1">Card Count</p>
            <p className="text-title-2 text-label sm:text-title-1">{stats.cardCount}</p>
          </div>
          <div className="bg-surface-secondary border-separator rounded-control border p-3 sm:p-4">
            <p className="text-footnote text-label-secondary mb-1">Total Value</p>
            <p className="text-title-2 text-yellow sm:text-title-1 flex items-center gap-1">
              <IxCreditsSymbol className="h-5 w-5 shrink-0" />
              {stats.totalValue.toLocaleString()}
            </p>
          </div>
          <div className="bg-surface-secondary border-separator rounded-control border p-3 sm:p-4">
            <p className="text-footnote text-label-secondary mb-1">Likes</p>
            <p className="text-title-2 text-red sm:text-title-1">{stats.likes}</p>
          </div>
          <div className="bg-surface-secondary border-separator rounded-control border p-3 sm:p-4">
            <p className="text-footnote text-label-secondary mb-1">Comments</p>
            <p className="text-title-2 text-blue sm:text-title-1">{stats.comments}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
