"use client";

import { useState } from "react";
import { X, Copy, Check, ExternalLink, Download, Bookmark } from "lucide-react";
import { Button } from "~/components/ui/button";
import { api } from "~/trpc/react";
import { useUser } from "~/context/auth-context";

interface CommonsImage {
  pageid: number;
  title: string;
  thumbUrl: string;
  url: string;
  descriptionUrl: string;
  width: number;
  height: number;
  mime: string;
  description: string;
  artist: string;
  license: string;
}

interface CommonsDetailPanelProps {
  image: CommonsImage;
  onClose: () => void;
}

export function CommonsDetailPanel({ image, onClose }: CommonsDetailPanelProps) {
  const [copied, setCopied] = useState(false);
  const { user } = useUser();
  const isAuthenticated = !!user;

  const cleanTitle = image.title.replace(/^File:/, "").replace(/_/g, " ");

  const stashMutation = api.wikios.stashPage.useMutation();

  const handleCopy = () => {
    const wikitext = `[[${image.title}|thumb|${cleanTitle}]]`;
    navigator.clipboard.writeText(wikitext);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleStash = () => {
    stashMutation.mutate({ pageTitle: `commons:${image.title}` });
  };

  return (
    <div className="wikios-commons-detail">
      {/* Header */}
      <div className="wikios-commons-detail-header">
        <h3 className="wikios-commons-detail-title">{cleanTitle}</h3>
        <button onClick={onClose} className="wikios-commons-detail-close">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Preview */}
      <div className="wikios-commons-detail-preview">
        <img src={image.url} alt={cleanTitle} loading="lazy" />
      </div>

      {/* Metadata */}
      <div className="wikios-commons-detail-meta">
        <div className="wikios-commons-detail-row">
          <span className="wikios-commons-detail-label">Dimensions</span>
          <span>{image.width} × {image.height}</span>
        </div>
        {image.mime && (
          <div className="wikios-commons-detail-row">
            <span className="wikios-commons-detail-label">Type</span>
            <span>{image.mime}</span>
          </div>
        )}
        {image.artist && (
          <div className="wikios-commons-detail-row">
            <span className="wikios-commons-detail-label">Artist</span>
            <span>{image.artist}</span>
          </div>
        )}
        {image.license && (
          <div className="wikios-commons-detail-row">
            <span className="wikios-commons-detail-label">License</span>
            <span>{image.license}</span>
          </div>
        )}
        {image.description && (
          <div className="wikios-commons-detail-desc">
            <span className="wikios-commons-detail-label">Description</span>
            <p>{image.description.slice(0, 300)}{image.description.length > 300 ? "..." : ""}</p>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="wikios-commons-detail-actions">
        <Button size="sm" variant="outline" onClick={handleCopy} className="flex-1">
          {copied ? <Check className="h-3.5 w-3.5 mr-1.5" /> : <Copy className="h-3.5 w-3.5 mr-1.5" />}
          {copied ? "Copied" : "Copy Wikitext"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => window.open(image.descriptionUrl, "_blank")}
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => window.open(image.url, "_blank")}
        >
          <Download className="h-3.5 w-3.5" />
        </Button>
        {isAuthenticated && (
          <Button
            size="sm"
            variant={stashMutation.isSuccess ? "default" : "outline"}
            onClick={handleStash}
            disabled={stashMutation.isPending || stashMutation.isSuccess}
          >
            <Bookmark className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}
