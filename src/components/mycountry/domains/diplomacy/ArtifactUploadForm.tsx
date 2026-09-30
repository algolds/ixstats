"use client";

import { Camera, Cutlery, Page as FileText, MusicNote, Palette, Xmark } from "iconoir-react";

import React, { useState } from "react";
import { useNotify } from "~/hooks/useNotify";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { Label } from "~/components/ui/label";

type ArtifactType = "photo" | "video" | "document" | "artwork" | "recipe" | "music";

/** What the form hands back; the parent uploads `file` and records the artifact. */
export interface ArtifactUploadData {
  title: string;
  type: ArtifactType;
  description: string;
  file: File;
}

/** The image types `/api/upload/image` accepts. */
const ACCEPTED_IMAGE_TYPES = "image/png,image/jpeg,image/gif,image/webp,image/svg+xml";

interface ArtifactUploadFormProps {
  onSubmit: (data: ArtifactUploadData) => void;
  onCancel: () => void;
  exchangeTitle: string;
  isSubmitting: boolean;
}

export const ArtifactUploadForm = React.memo<ArtifactUploadFormProps>(
  ({ onSubmit, onCancel, exchangeTitle, isSubmitting }) => {
    const notify = useNotify();
    const [formData, setFormData] = useState({
      title: "",
      type: "photo" as ArtifactType,
      description: "",
      file: null as File | null,
    });

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
        setFormData((prev) => ({ ...prev, file: e.target.files![0]! }));
      }
    };

    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (!formData.title.trim() || !formData.file) {
        notify.error("Please provide a title and file");
        return;
      }

      onSubmit({
        title: formData.title,
        type: formData.type,
        description: formData.description,
        file: formData.file,
      });
    };

    const artifactTypes = [
      { value: "photo", label: "Photo", icon: Camera },
      { value: "video", label: "Video", icon: MusicNote },
      { value: "document", label: "Document", icon: FileText },
      { value: "artwork", label: "Artwork", icon: Palette },
      { value: "recipe", label: "Recipe", icon: Cutlery },
      { value: "music", label: "Music", icon: MusicNote },
    ] as const;

    return (
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="flex items-center justify-between gap-3 pr-8">
          <h3 className="text-foreground flex items-center gap-2 text-lg font-semibold">
            <Camera className="text-muted-foreground h-5 w-5" />
            Upload Cultural Artifact
          </h3>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onCancel}
            aria-label="Cancel upload"
          >
            <Xmark className="h-5 w-5" />
          </Button>
        </div>

        <div className="bg-muted/50 rounded-xl p-4">
          <div className="text-muted-foreground mb-1 text-sm">Contributing to:</div>
          <div className="text-foreground font-medium">{exchangeTitle}</div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="artifact-title">Artifact Title *</Label>
          <Input
            id="artifact-title"
            type="text"
            value={formData.title}
            onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
            placeholder="Traditional Festival Dance, Historic Monument..."
            required
          />
        </div>

        <div className="space-y-2">
          <Label id="artifact-type-label">Artifact Type</Label>
          <div
            className="grid grid-cols-3 gap-2"
            role="group"
            aria-labelledby="artifact-type-label"
          >
            {artifactTypes.map(({ value, label, icon: Icon }) => (
              <Button
                key={value}
                type="button"
                variant={formData.type === value ? "secondary" : "outline"}
                aria-pressed={formData.type === value}
                onClick={() => setFormData((prev) => ({ ...prev, type: value }))}
                className="justify-start"
              >
                <Icon className="h-4 w-4" />
                <span className="text-xs">{label}</span>
              </Button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="artifact-description">Description</Label>
          <Textarea
            id="artifact-description"
            value={formData.description}
            onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
            placeholder="Describe the cultural significance of this artifact..."
            rows={4}
            className="resize-none"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="artifact-file">Upload File *</Label>
          <label
            htmlFor="artifact-file"
            className="border-border bg-muted/40 hover:border-ring hover:bg-muted/60 flex h-32 w-full cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed transition-colors"
          >
            <Camera className="text-muted-foreground mb-2 h-6 w-6" />
            <p className="text-muted-foreground text-sm">
              {formData.file ? formData.file.name : "Click to upload file"}
            </p>
            <p className="text-muted-foreground mt-1 text-xs">
              PNG, JPG, GIF, WEBP or SVG image, up to 5MB
            </p>
            <input
              id="artifact-file"
              type="file"
              className="sr-only"
              onChange={handleFileChange}
              accept={ACCEPTED_IMAGE_TYPES}
              required
            />
          </label>
        </div>

        <div className="border-border flex flex-wrap items-center justify-between gap-3 border-t pt-4">
          <p className="text-muted-foreground text-sm">Share your culture with the world</p>

          <div className="flex items-center gap-2">
            <Button type="button" variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              <Camera className="h-4 w-4" />
              {isSubmitting ? "Uploading…" : "Upload Artifact"}
            </Button>
          </div>
        </div>
      </form>
    );
  }
);

ArtifactUploadForm.displayName = "ArtifactUploadForm";
