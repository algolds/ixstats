import React, { useRef } from "react";
import { Label } from "~/components/ui/label";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import {
  Upload,
  SystemRestart as Loader2,
  Trash as Trash2,
  MediaImage as ImageIcon,
} from "iconoir-react";
import { cn } from "~/lib/utils";

interface LeagueBrandingTabProps {
  name: string;
  setName: (v: string) => void;
  wikiSlug: string;
  setWikiSlug: (v: string) => void;
  previewSrc: string | null;
  coverUrl: string;
  setCoverUrl: (v: string) => void;
  isUploading: boolean;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveLogo: () => void;
  onOpenMediaSearch: (target: "logo" | "cover") => void;
}

export const LeagueBrandingTab = React.memo(function LeagueBrandingTab({
  name,
  setName,
  wikiSlug,
  setWikiSlug,
  previewSrc,
  coverUrl,
  setCoverUrl,
  isUploading,
  onFileSelect,
  onRemoveLogo,
  onOpenMediaSearch,
}: LeagueBrandingTabProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-4 py-3">
      <div className="space-y-2">
        <Label htmlFor="league-name">League name</Label>
        <Input
          id="league-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Enter league name..."
          maxLength={200}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="wiki-slug">Wiki article slug</Label>
        <Input
          id="wiki-slug"
          value={wikiSlug}
          onChange={(e) => setWikiSlug(e.target.value)}
          placeholder="e.g. Liga_Ixnay"
          maxLength={100}
        />
        <p className="text-label-secondary text-footnote">
          Links this league to its IxWiki article.
        </p>
      </div>

      <div className="space-y-2">
        <Label>League logo</Label>
        <div className="flex items-start gap-4">
          <div
            className={cn(
              "rounded-row flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden border-2 border-dashed",
              previewSrc ? "border-separator bg-fill-3" : "border-separator bg-fill-4"
            )}
          >
            {previewSrc ? (
              <img src={previewSrc} alt="Logo preview" className="h-full w-full object-cover" />
            ) : (
              <span className="text-label-secondary text-footnote font-medium">No logo</span>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="text-footnote"
            >
              {isUploading ? (
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Upload className="mr-2 h-3.5 w-3.5" />
              )}
              {isUploading ? "Uploading..." : "Upload Image"}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenMediaSearch("logo")}
              className="text-footnote"
            >
              <ImageIcon className="mr-2 h-3.5 w-3.5" />
              Browse media
            </Button>
            {previewSrc && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onRemoveLogo}
                className="text-destructive"
              >
                <Trash2 className="mr-2 h-3.5 w-3.5" />
                Remove
              </Button>
            )}
            <p className="text-label-secondary text-footnote leading-tight">
              PNG, JPEG, GIF, or WebP. Max 5 MB.
            </p>
          </div>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/gif,image/webp"
          onChange={onFileSelect}
          className="hidden"
        />
      </div>

      {/* Cover Image */}
      <div className="space-y-2">
        <Label>Cover image</Label>
        <p className="text-label-secondary text-footnote leading-tight">
          Shown on the card carousel. Recommended 3:2 ratio.
        </p>
        <div className="flex items-start gap-4">
          <div
            className={cn(
              "rounded-control flex h-20 w-32 shrink-0 items-center justify-center overflow-hidden border-2 border-dashed",
              coverUrl ? "border-separator bg-fill-3" : "border-separator bg-fill-4"
            )}
          >
            {coverUrl ? (
              <img src={coverUrl} alt="Cover preview" className="h-full w-full object-cover" />
            ) : (
              <span className="text-label-secondary text-footnote font-medium">No cover</span>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenMediaSearch("cover")}
              className="text-footnote"
            >
              <ImageIcon className="mr-2 h-3.5 w-3.5" />
              Browse media
            </Button>
            {coverUrl && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setCoverUrl("")}
                className="text-destructive text-footnote"
              >
                <Trash2 className="mr-2 h-3.5 w-3.5" />
                Remove
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});
