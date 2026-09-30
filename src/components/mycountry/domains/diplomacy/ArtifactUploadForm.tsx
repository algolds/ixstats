"use client";

import { Camera, Cutlery, Page as FileText, MusicNote, Palette, Xmark } from "iconoir-react";

import React, { useState } from "react";
import { useNotify } from "~/hooks/useNotify";
import { cn } from "~/lib/utils";

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
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-xl font-bold text-cyan-600 dark:text-cyan-400">
            <Camera className="h-6 w-6" />
            Upload Cultural Artifact
          </h3>
          <button
            type="button"
            onClick={onCancel}
            className="hover:text-foreground rounded-lg p-2 text-muted-foreground transition-colors hover:bg-white/10"
          >
            <Xmark className="h-5 w-5" />
          </button>
        </div>

        <div className="facet-hierarchy-child rounded-lg border border-cyan-500/30 p-4">
          <div className="mb-1 text-sm text-muted-foreground">Contributing to:</div>
          <div className="text-foreground font-medium">{exchangeTitle}</div>
        </div>

        <div>
          <label className="text-foreground mb-2 block text-sm font-medium">Artifact Title *</label>
          <input
            type="text"
            value={formData.title}
            onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
            placeholder="Traditional Festival Dance, Historic Monument..."
            className="text-foreground w-full rounded-lg border border-white/20 bg-white/10 px-4 py-3 placeholder:text-muted-foreground focus:border-cyan-500/50 focus:outline-none dark:bg-black/20"
            required
          />
        </div>

        <div>
          <label className="text-foreground mb-2 block text-sm font-medium">Artifact Type</label>
          <div className="grid grid-cols-3 gap-2">
            {artifactTypes.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => setFormData((prev) => ({ ...prev, type: value }))}
                className={cn(
                  "flex items-center gap-2 rounded-lg border px-3 py-2 transition-colors",
                  formData.type === value
                    ? "border-cyan-500/50 bg-cyan-500/20 text-cyan-600 dark:text-cyan-400"
                    : "border-white/10 bg-white/5 text-muted-foreground hover:bg-white/10"
                )}
              >
                <Icon className="h-4 w-4" />
                <span className="text-xs">{label}</span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-foreground mb-2 block text-sm font-medium">Description</label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
            placeholder="Describe the cultural significance of this artifact..."
            rows={4}
            className="text-foreground w-full resize-none rounded-lg border border-white/20 bg-white/10 px-4 py-3 placeholder:text-muted-foreground focus:border-cyan-500/50 focus:outline-none dark:bg-black/20"
          />
        </div>

        <div>
          <label className="text-foreground mb-2 block text-sm font-medium">Upload File *</label>
          <label className="flex h-32 w-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-white/20 bg-white/5 transition-colors hover:border-cyan-500/50 hover:bg-white/10">
            <div className="flex flex-col items-center justify-center pt-5 pb-6">
              <Camera className="mb-2 h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                {formData.file ? formData.file.name : "Click to upload file"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                PNG, JPG, GIF, WEBP or SVG image, up to 5MB
              </p>
            </div>
            <input
              type="file"
              className="hidden"
              onChange={handleFileChange}
              accept={ACCEPTED_IMAGE_TYPES}
              required
            />
          </label>
        </div>

        <div className="flex items-center justify-between border-t border-white/10 pt-4">
          <div className="text-sm text-muted-foreground">Share your culture with the world</div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="hover:text-foreground rounded-lg px-4 py-2 text-muted-foreground transition-colors hover:bg-white/10"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 rounded-lg bg-cyan-500/20 px-6 py-2 font-medium text-cyan-600 dark:text-cyan-400 transition-colors hover:bg-cyan-500/30 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Camera className="h-4 w-4" />
              {isSubmitting ? "Uploading..." : "Upload Artifact"}
            </button>
          </div>
        </div>
      </form>
    );
  }
);

ArtifactUploadForm.displayName = "ArtifactUploadForm";
