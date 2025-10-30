"use client";

import React, { useState } from "react";
import { toast } from "sonner";
import { cn } from "~/lib/utils";
import {
  RiCameraLine,
  RiCloseLine,
  RiMusicLine,
  RiFileTextLine,
  RiPaletteLine,
  RiRestaurantLine,
} from "react-icons/ri";

interface ArtifactUploadFormProps {
  onSubmit: (data: {
    title: string;
    type: "photo" | "video" | "document" | "artwork" | "recipe" | "music";
    description: string;
    file: File;
    thumbnailUrl?: string;
  }) => void;
  onCancel: () => void;
  exchangeTitle: string;
}

export const ArtifactUploadForm = React.memo<ArtifactUploadFormProps>(
  ({ onSubmit, onCancel, exchangeTitle }) => {
    const [formData, setFormData] = useState({
      title: "",
      type: "photo" as "photo" | "video" | "document" | "artwork" | "recipe" | "music",
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
        toast.error("Please provide a title and file");
        return;
      }

      onSubmit({
        title: formData.title,
        type: formData.type,
        description: formData.description,
        file: formData.file,
        thumbnailUrl: formData.file ? URL.createObjectURL(formData.file) : undefined,
      });
    };

    const artifactTypes = [
      { value: "photo", label: "Photo", icon: RiCameraLine },
      { value: "video", label: "Video", icon: RiMusicLine },
      { value: "document", label: "Document", icon: RiFileTextLine },
      { value: "artwork", label: "Artwork", icon: RiPaletteLine },
      { value: "recipe", label: "Recipe", icon: RiRestaurantLine },
      { value: "music", label: "Music", icon: RiMusicLine },
    ] as const;

    return (
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-xl font-bold text-green-400">
            <RiCameraLine className="h-6 w-6" />
            Upload Cultural Artifact
          </h3>
          <button
            type="button"
            onClick={onCancel}
            className="hover:text-foreground rounded-lg p-2 text-[--intel-silver] transition-colors hover:bg-white/10"
          >
            <RiCloseLine className="h-5 w-5" />
          </button>
        </div>

        <div className="glass-hierarchy-child rounded-lg border border-green-500/30 p-4">
          <div className="mb-1 text-sm text-[--intel-silver]">Contributing to:</div>
          <div className="text-foreground font-medium">{exchangeTitle}</div>
        </div>

        <div>
          <label className="text-foreground mb-2 block text-sm font-medium">Artifact Title *</label>
          <input
            type="text"
            value={formData.title}
            onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
            placeholder="Traditional Festival Dance, Historic Monument..."
            className="text-foreground w-full rounded-lg border border-white/20 bg-white/10 px-4 py-3 placeholder:text-[--intel-silver] focus:border-green-500/50 focus:outline-none dark:bg-black/20"
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
                onClick={() => setFormData((prev) => ({ ...prev, type: value as any }))}
                className={cn(
                  "flex items-center gap-2 rounded-lg border px-3 py-2 transition-colors",
                  formData.type === value
                    ? "border-green-500/50 bg-green-500/20 text-green-400"
                    : "border-white/10 bg-white/5 text-[--intel-silver] hover:bg-white/10"
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
            className="text-foreground w-full resize-none rounded-lg border border-white/20 bg-white/10 px-4 py-3 placeholder:text-[--intel-silver] focus:border-green-500/50 focus:outline-none dark:bg-black/20"
          />
        </div>

        <div>
          <label className="text-foreground mb-2 block text-sm font-medium">Upload File *</label>
          <label className="flex h-32 w-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-white/20 bg-white/5 transition-colors hover:border-green-500/50 hover:bg-white/10">
            <div className="flex flex-col items-center justify-center pt-5 pb-6">
              <RiCameraLine className="mb-2 h-8 w-8 text-[--intel-silver]" />
              <p className="text-sm text-[--intel-silver]">
                {formData.file ? formData.file.name : "Click to upload file"}
              </p>
              <p className="mt-1 text-xs text-[--intel-silver]">
                Photos, videos, documents, or audio files
              </p>
            </div>
            <input
              type="file"
              className="hidden"
              onChange={handleFileChange}
              accept="image/*,video/*,.pdf,.doc,.docx,audio/*"
              required
            />
          </label>
        </div>

        <div className="flex items-center justify-between border-t border-white/10 pt-4">
          <div className="text-sm text-[--intel-silver]">Share your culture with the world</div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="hover:text-foreground rounded-lg px-4 py-2 text-[--intel-silver] transition-colors hover:bg-white/10"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex items-center gap-2 rounded-lg bg-green-500/20 px-6 py-2 font-medium text-green-400 transition-colors hover:bg-green-500/30"
            >
              <RiCameraLine className="h-4 w-4" />
              Upload Artifact
            </button>
          </div>
        </div>
      </form>
    );
  }
);

ArtifactUploadForm.displayName = "ArtifactUploadForm";
