"use client";

import {
  SystemRestart as Loader2,
  Undo as RotateCcw,
  MediaImage as ImageIcon,
  Trash as Trash2,
} from "iconoir-react";
import { Button } from "~/components/ui/button";
import { Label } from "~/components/ui/label";
import { assetUrl } from "~/lib/base-path";

interface LeagueCoverFieldProps {
  coverImage: string | null;
  loading: boolean;
  /** How many Commons suggestions are available to shuffle through. */
  suggestionCount: number;
  onShuffle: () => void;
  onBrowse: () => void;
  onRemove: () => void;
}

/** The league creator's cover image field: the current image with shuffle, browse and remove, or an empty state. */
export function LeagueCoverField({
  coverImage,
  loading,
  suggestionCount,
  onShuffle,
  onBrowse,
  onRemove,
}: LeagueCoverFieldProps) {
  return (
    <div className="space-y-2">
      <Label>League cover image</Label>

      {loading && !coverImage ? (
        <div className="border-separator bg-fill-4 rounded-control flex h-40 w-full items-center justify-center border border-dashed">
          <Loader2 className="text-label-secondary h-6 w-6 animate-spin" />
          <span className="text-label-secondary text-footnote ml-2">Fetching suggestion...</span>
        </div>
      ) : coverImage ? (
        <div className="group border-separator rounded-control relative h-40 w-full overflow-hidden border">
          <img
            src={assetUrl(coverImage) ?? undefined}
            alt="Suggested cover"
            className="h-full w-full object-cover"
          />
          <div className="duration-fast absolute inset-0 bg-black/40 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100" />
          <div className="duration-fast absolute right-3 bottom-3 flex items-center gap-2 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={onShuffle}
              disabled={suggestionCount <= 1}
            >
              <RotateCcw className="h-3 w-3" />
              Shuffle
            </Button>
            <Button type="button" variant="secondary" size="sm" onClick={onBrowse}>
              <ImageIcon className="h-3 w-3" />
              Browse
            </Button>
            <Button type="button" variant="destructive" size="sm" onClick={onRemove}>
              <Trash2 className="h-3 w-3" />
              Remove
            </Button>
          </div>
        </div>
      ) : (
        <div className="border-separator bg-fill-4 rounded-control flex h-40 w-full flex-col items-center justify-center border border-dashed p-4">
          <ImageIcon className="text-label-tertiary mb-2 h-8 w-8" />
          <p className="text-label-secondary text-footnote mb-3">No cover image selected</p>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onBrowse}>
              <ImageIcon className="h-3 w-3" />
              Browse media
            </Button>
            {suggestionCount > 0 && (
              <Button type="button" variant="outline" size="sm" onClick={onShuffle}>
                <RotateCcw className="h-3 w-3" />
                Suggest image
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
