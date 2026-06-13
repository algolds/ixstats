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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";

interface LeagueSettingsModalProps {
  league: {
    id: string;
    name: string;
    logo?: string | null;
    coverImage?: string | null;
    status?: string;
    tier?: number;
    promotionCount?: number;
    relegationCount?: number;
    sportPreset?: string;
    archetype?: string;
    settings?: any;
  };
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"];

export function LeagueSettingsModal({
  league,
  open,
  onOpenChange,
  onSaved,
}: LeagueSettingsModalProps) {
  const notify = useNotify();
  const utils = api.useUtils();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(league.name);
  const [logoUrl, setLogoUrl] = useState(league.logo ?? "");
  const [coverUrl, setCoverUrl] = useState(league.coverImage ?? "");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [mediaSearchFor, setMediaSearchFor] = useState<"logo" | "cover" | null>(null);

  // New settings states
  const [status, setStatus] = useState(league.status ?? "active");
  const [tier, setTier] = useState(league.tier ?? 1);
  const [promotionCount, setPromotionCount] = useState(league.promotionCount ?? 3);
  const [relegationCount, setRelegationCount] = useState(league.relegationCount ?? 3);

  // Archetype specific settings
  const initialSettings = (league.settings as Record<string, any>) || {};
  const [divisions, setDivisions] = useState<number>(initialSettings.divisions ?? 2);
  const [raceCount, setRaceCount] = useState<number>(initialSettings.raceCount ?? 20);
  const [weightClassesRaw, setWeightClassesRaw] = useState<string>(
    Array.isArray(initialSettings.weightClasses) ? initialSettings.weightClasses.join(", ") : ""
  );

  const isDivisionConference = league.archetype === "division_conference";
  const isCircuit = league.archetype === "circuit";
  const isBoxing = league.sportPreset === "boxing";

  useEffect(() => {
    if (open) {
      setName(league.name);
      setLogoUrl(league.logo ?? "");
      setCoverUrl(league.coverImage ?? "");
      setUploadedFile(null);
      setStatus(league.status ?? "active");
      setTier(league.tier ?? 1);
      setPromotionCount(league.promotionCount ?? 3);
      setRelegationCount(league.relegationCount ?? 3);

      const currentSettings = (league.settings as Record<string, any>) || {};
      setDivisions(currentSettings.divisions ?? 2);
      setRaceCount(currentSettings.raceCount ?? 20);
      setWeightClassesRaw(
        Array.isArray(currentSettings.weightClasses) ? currentSettings.weightClasses.join(", ") : ""
      );
    }
  }, [open, league]);

  const updateLeague = api.sports.updateLeague.useMutation({
    onSuccess: () => {
      notify.success("Settings Saved", "League settings updated.");
      utils.sports.getLeague.invalidate({ id: league.id });
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
      notify.error("Name Required", "League name cannot be empty.");
      return;
    }

    const updatedSettings: Record<string, any> = {
      ...((league.settings as Record<string, any>) || {}),
    };
    if (isDivisionConference) {
      updatedSettings.divisions = divisions;
    }
    if (isBoxing) {
      updatedSettings.weightClasses = weightClassesRaw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    }
    if (isCircuit) {
      updatedSettings.raceCount = raceCount;
    }

    updateLeague.mutate({
      id: league.id,
      name: name.trim(),
      logo: logoUrl || null,
      coverImage: coverUrl || null,
      status,
      tier,
      promotionCount,
      relegationCount,
      settings: updatedSettings,
    });
  };

  const previewSrc = uploadedFile ? URL.createObjectURL(uploadedFile) : logoUrl || null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            League Settings
          </DialogTitle>
          <DialogDescription>
            Edit name, branding, and competition rules for this league.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="branding" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="branding">Branding</TabsTrigger>
            <TabsTrigger value="competition">Competition</TabsTrigger>
          </TabsList>

          <TabsContent value="branding" className="space-y-4 py-3">
            <div className="space-y-2">
              <Label htmlFor="league-name">League Name</Label>
              <Input
                id="league-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter league name..."
                maxLength={200}
              />
            </div>

            <div className="space-y-2">
              <Label>League Logo</Label>
              <div className="flex items-start gap-4">
                <div
                  className={cn(
                    "flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-xl border-2 border-dashed",
                    previewSrc ? "border-border bg-muted/50" : "border-border/50 bg-muted/30"
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
                      className="text-destructive hover:text-destructive text-xs"
                    >
                      <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                      Remove
                    </Button>
                  )}
                  <p className="text-muted-foreground text-[10px] leading-tight">
                    PNG, JPEG, GIF, or WebP. Max 5 MB.
                  </p>
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
                Shown on the card carousel. Recommended 3:2 ratio.
              </p>
              <div className="flex items-start gap-4">
                <div
                  className={cn(
                    "flex h-20 w-32 shrink-0 items-center justify-center overflow-hidden rounded-lg border-2 border-dashed",
                    coverUrl ? "border-border bg-muted/50" : "border-border/50 bg-muted/30"
                  )}
                >
                  {coverUrl ? (
                    <img
                      src={coverUrl}
                      alt="Cover preview"
                      className="h-full w-full object-cover"
                    />
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
                      className="text-destructive hover:text-destructive text-xs"
                    >
                      <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                      Remove
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="competition" className="space-y-4 py-3">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="league-status">League Status</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger id="league-status" className="h-9 text-xs">
                    <SelectValue placeholder="Select status..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="paused">Paused</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="league-tier">League Tier</Label>
                <Input
                  id="league-tier"
                  type="number"
                  min={1}
                  value={tier}
                  onChange={(e) => setTier(Math.max(1, Number(e.target.value) || 1))}
                  className="h-9 text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="promotion-count">Promotion Count</Label>
                <Input
                  id="promotion-count"
                  type="number"
                  min={0}
                  value={promotionCount}
                  onChange={(e) => setPromotionCount(Math.max(0, Number(e.target.value) || 0))}
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="relegation-count">Relegation Count</Label>
                <Input
                  id="relegation-count"
                  type="number"
                  min={0}
                  value={relegationCount}
                  onChange={(e) => setRelegationCount(Math.max(0, Number(e.target.value) || 0))}
                  className="h-9 text-xs"
                />
              </div>
            </div>

            {/* Archetype / Preset Specific Settings */}
            {isDivisionConference && (
              <div className="border-border/30 space-y-2 border-t pt-3">
                <Label htmlFor="divisions-count">Divisions Count</Label>
                <Input
                  id="divisions-count"
                  type="number"
                  min={1}
                  value={divisions}
                  onChange={(e) => setDivisions(Math.max(1, Number(e.target.value) || 1))}
                  className="h-9 text-xs"
                />
                <p className="text-muted-foreground text-[10px]">
                  Configures the number of divisions within the league's conference.
                </p>
              </div>
            )}

            {isCircuit && (
              <div className="border-border/30 space-y-2 border-t pt-3">
                <Label htmlFor="race-count">Race Count</Label>
                <Input
                  id="race-count"
                  type="number"
                  min={1}
                  value={raceCount}
                  onChange={(e) => setRaceCount(Math.max(1, Number(e.target.value) || 1))}
                  className="h-9 text-xs"
                />
                <p className="text-muted-foreground text-[10px]">
                  Configures the number of races run in a season.
                </p>
              </div>
            )}

            {isBoxing && (
              <div className="border-border/30 space-y-2 border-t pt-3">
                <Label htmlFor="weight-classes">Weight Classes (Comma Separated)</Label>
                <Input
                  id="weight-classes"
                  value={weightClassesRaw}
                  onChange={(e) => setWeightClassesRaw(e.target.value)}
                  placeholder="Heavyweight, Middleweight, Welterweight..."
                  className="h-9 text-xs"
                />
                <p className="text-muted-foreground text-[10px]">
                  Comma-separated list of weight divisions.
                </p>
              </div>
            )}
          </TabsContent>
        </Tabs>

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

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="text-xs">
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={updateLeague.isPending} className="text-xs">
            {updateLeague.isPending ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : null}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
