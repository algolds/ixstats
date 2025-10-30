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
    type: 'photo' | 'video' | 'document' | 'artwork' | 'recipe' | 'music';
    description: string;
    file: File;
    thumbnailUrl?: string;
  }) => void;
  onCancel: () => void;
  exchangeTitle: string;
}

export const ArtifactUploadForm = React.memo<ArtifactUploadFormProps>(({
  onSubmit,
  onCancel,
  exchangeTitle,
}) => {
  const [formData, setFormData] = useState({
    title: '',
    type: 'photo' as 'photo' | 'video' | 'document' | 'artwork' | 'recipe' | 'music',
    description: '',
    file: null as File | null
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFormData(prev => ({ ...prev, file: e.target.files![0]! }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.file) {
      toast.error('Please provide a title and file');
      return;
    }

    onSubmit({
      title: formData.title,
      type: formData.type,
      description: formData.description,
      file: formData.file,
      thumbnailUrl: formData.file ? URL.createObjectURL(formData.file) : undefined
    });
  };

  const artifactTypes = [
    { value: 'photo', label: 'Photo', icon: RiCameraLine },
    { value: 'video', label: 'Video', icon: RiMusicLine },
    { value: 'document', label: 'Document', icon: RiFileTextLine },
    { value: 'artwork', label: 'Artwork', icon: RiPaletteLine },
    { value: 'recipe', label: 'Recipe', icon: RiRestaurantLine },
    { value: 'music', label: 'Music', icon: RiMusicLine }
  ] as const;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold text-green-400 flex items-center gap-2">
          <RiCameraLine className="h-6 w-6" />
          Upload Cultural Artifact
        </h3>
        <button
          type="button"
          onClick={onCancel}
          className="p-2 text-[--intel-silver] hover:text-foreground hover:bg-white/10 rounded-lg transition-colors"
        >
          <RiCloseLine className="h-5 w-5" />
        </button>
      </div>

      <div className="glass-hierarchy-child rounded-lg p-4 border border-green-500/30">
        <div className="text-sm text-[--intel-silver] mb-1">Contributing to:</div>
        <div className="font-medium text-foreground">{exchangeTitle}</div>
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground mb-2">Artifact Title *</label>
        <input
          type="text"
          value={formData.title}
          onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
          placeholder="Traditional Festival Dance, Historic Monument..."
          className="w-full bg-white/10 dark:bg-black/20 border border-white/20 rounded-lg px-4 py-3 text-foreground placeholder:text-[--intel-silver] focus:outline-none focus:border-green-500/50"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground mb-2">Artifact Type</label>
        <div className="grid grid-cols-3 gap-2">
          {artifactTypes.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              onClick={() => setFormData(prev => ({ ...prev, type: value as any }))}
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors",
                formData.type === value
                  ? "bg-green-500/20 border-green-500/50 text-green-400"
                  : "bg-white/5 border-white/10 text-[--intel-silver] hover:bg-white/10"
              )}
            >
              <Icon className="h-4 w-4" />
              <span className="text-xs">{label}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground mb-2">Description</label>
        <textarea
          value={formData.description}
          onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
          placeholder="Describe the cultural significance of this artifact..."
          rows={4}
          className="w-full bg-white/10 dark:bg-black/20 border border-white/20 rounded-lg px-4 py-3 text-foreground placeholder:text-[--intel-silver] focus:outline-none focus:border-green-500/50 resize-none"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground mb-2">Upload File *</label>
        <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-white/20 hover:border-green-500/50 rounded-lg cursor-pointer bg-white/5 hover:bg-white/10 transition-colors">
          <div className="flex flex-col items-center justify-center pt-5 pb-6">
            <RiCameraLine className="h-8 w-8 text-[--intel-silver] mb-2" />
            <p className="text-sm text-[--intel-silver]">
              {formData.file ? formData.file.name : 'Click to upload file'}
            </p>
            <p className="text-xs text-[--intel-silver] mt-1">
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

      <div className="flex items-center justify-between pt-4 border-t border-white/10">
        <div className="text-sm text-[--intel-silver]">
          Share your culture with the world
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-[--intel-silver] hover:text-foreground hover:bg-white/10 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="flex items-center gap-2 bg-green-500/20 hover:bg-green-500/30 text-green-400 px-6 py-2 rounded-lg font-medium transition-colors"
          >
            <RiCameraLine className="h-4 w-4" />
            Upload Artifact
          </button>
        </div>
      </div>
    </form>
  );
});

ArtifactUploadForm.displayName = 'ArtifactUploadForm';
