"use client";

import { useState, useRef, useEffect } from "react";
import dynamic from "next/dynamic";
import { Settings, Upload, Loader2, Trash2, ImageIcon } from "lucide-react";

const MediaSearchModal = dynamic(
  () => import("~/components/MediaSearchModal").then((m) => m.MediaSearchModal),
  { ssr: false }
);
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { cn } from "~/lib/utils";
import { withBasePath } from "~/lib/base-path";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "~/components/ui/dialog";

interface TeamSettingsModalProps {
  team: {
    id: string;
    name: string;
    logo?: string | null;
    coverImage?: string | null;
    color: string;
  };
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"];

export function TeamSettingsModal({
  team,
  open,
  onOpenChange,
  onSaved,
}: TeamSettingsModalProps) {
  const notify = useNotify();
  const utils = api.useUtils();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(team.name);
  const [logoUrl, setLogoUrl] = useState(team.logo ?? "");
  const [coverUrl, setCoverUrl] = useState(team.coverImage ?? "");
  const [color, setColor] = useState(team.color);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [mediaSearchFor, setMediaSearchFor] = useState<"logo" | "cover" | null>(null);

  useEffect(() => {
    if (open) {
      setName(team.name);
      setLogoUrl(team.logo ?? "");
      setCoverUrl(team.coverImage ?? "");
      setColor(team.color);
      setUploadedFile(null);
    }
  }, [open, team]);

  const updateTeam = api.sports.updateTeam.useMutation({
    onSuccess: () => {
      notify.success("Settings Saved", "Club settings updated.");
      utils.sports.getTeam.invalidate({ id: team.id });
      utils.sports.getMyClubOverview.invalidate({ teamId: team.id });
      onSaved?.();
      onOpenChange(false);
    },
    onError: (err) => {
      notify.error("Save Failed", err.message);
    },
  });

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!ALLOWED_TYPES.includes(file.type)) {
      notify.error("Invalid File", "Please select a PNG, JPEG, GIF, or WebP image.");
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      notify.error("File Too Large", "Image must be under 5 MB.");
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch(withBasePath("/api/upload/image"), {
        method: "POST",
        body: formData,
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: "Upload failed" }));
        throw new Error(err.error ?? "Upload failed");
      }
      const result = (await response.json()) as { url: string };
      setLogoUrl(result.url);
      setUploadedFile(file);
    } catch (err) {
      notify.error("Upload Failed", err instanceof Error ? err.message : "Could not upload image.");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleRemoveLogo = () => {
    setLogoUrl("");
    setUploadedFile(null);
  };

  const handleSave = () => {
    if (!name.trim()) {
      notify.error("Name Required", "Club name cannot be empty.");
      return;
    }
    updateTeam.mutate({
      id: team.id,
      name: name.trim(),
      color: color.trim() || "#3b82f6",
      logo: logoUrl || null,
      coverImage: coverUrl || null,
    });
  };

  const previewSrc = uploadedFile ? URL.createObjectURL(uploadedFile) : logoUrl || null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Club Settings
          </DialogTitle>
          <DialogDescription>Edit branding and appearance details for your club.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="club-name">Club Name</Label>
            <Input
              id="club-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter club name..."
              maxLength={200}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="club-color">Primary Color</Label>
            <div className="flex items-center gap-2">
              <Input
                id="club-color"
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="h-9 w-12 cursor-pointer p-1"
              />
              <Input
                type="text"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                placeholder="#3b82f6"
                className="h-9 flex-1 font-mono text-xs"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Club Logo</Label>
            <div className="flex items-start gap-4">
              <div
                className={cn(
                  "flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border-2 border-dashed",
                  previewSrc
                    ? "border-border bg-muted/50"
                    : "border-border/50 bg-muted/30"
                )}
              >
                {previewSrc ? (
                  <img
                    src={previewSrc}
                    alt="Logo preview"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="text-muted-foreground text-[10px] font-medium">No logo</span>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="text-xs"
                >
                  {isUploading ? (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Upload className="mr-1.5 h-3.5 w-3.5" />
                  )}
                  {isUploading ? "Uploading..." : "Upload Image"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setMediaSearchFor("logo")}
                  className="text-xs"
                >
                  <ImageIcon className="mr-1.5 h-3.5 w-3.5" />
                  Browse Media
                </Button>
                {previewSrc && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleRemoveLogo}
                    className="text-xs text-destructive hover:text-destructive"
                  >
                    <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                    Remove
                  </Button>
                )}
              </div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/gif,image/webp"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>

          {/* Cover Image */}
          <div className="space-y-2">
            <Label>Cover Image</Label>
            <p className="text-muted-foreground text-[10px] leading-tight">
              Shown as the background banner for your club.
            </p>
            <div className="flex items-start gap-4">
              <div
                className={cn(
                  "flex h-20 w-32 shrink-0 items-center justify-center overflow-hidden rounded-lg border-2 border-dashed",
                  coverUrl
                    ? "border-border bg-muted/50"
                    : "border-border/50 bg-muted/30"
                )}
              >
                {coverUrl ? (
                  <img src={coverUrl} alt="Cover preview" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-muted-foreground text-[10px] font-medium">No cover</span>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setMediaSearchFor("cover")}
                  className="text-xs"
                >
                  <ImageIcon className="mr-1.5 h-3.5 w-3.5" />
                  Browse Media
                </Button>
                {coverUrl && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setCoverUrl("")}
                    className="text-xs text-destructive hover:text-destructive"
                  >
                    <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                    Remove
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>

        {mediaSearchFor && (
          <MediaSearchModal
            isOpen={!!mediaSearchFor}
            onClose={() => setMediaSearchFor(null)}
            onImageSelect={(url) => {
              if (mediaSearchFor === "logo") {
                setLogoUrl(url);
                setUploadedFile(null);
              } else {
                setCoverUrl(url);
              }
              setMediaSearchFor(null);
            }}
          />
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="text-xs">
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={updateTeam.isPending} className="text-xs">
            {updateTeam.isPending ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : null}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
