"use client";

import React, { useState } from "react";
import {
  Settings,
  Group,
  Shield,
  Trash,
  Check,
  Globe,
  Lock,
  User,
  Plus,
  Send,
  MediaImage,
  Refresh,
  Xmark,
} from "iconoir-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { Switch } from "~/components/ui/switch";
import { Badge } from "~/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { MediaSearchModal } from "~/components/wiki-os/media-search/MediaSearchModal";
import { api } from "~/trpc/react";
import { soundEffects } from "~/lib/sound/cuelume";
import { useNotify } from "~/hooks/useNotify";

interface ThinktankSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  groupId: string;
  initialName: string;
  initialDescription?: string | null;
  initialType: string;
  initialCategory?: string | null;
  initialAvatar?: string | null;
  initialSettings?: {
    allowPersonaPosting?: boolean;
    rules?: string;
    bannerUrl?: string;
    themeAccent?: string;
  };
  currentUserId?: string;
  onDeleteSuccess?: () => void;
}

export function ThinktankSettingsModal({
  isOpen,
  onClose,
  groupId,
  initialName,
  initialDescription,
  initialType,
  initialCategory,
  initialAvatar,
  initialSettings,
  currentUserId = "",
  onDeleteSuccess,
}: ThinktankSettingsModalProps) {
  const notify = useNotify();
  const utils = api.useUtils();

  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription || "");
  const [category, setCategory] = useState(initialCategory || "General");
  const [type, setType] = useState(initialType);
  const [avatarUrl, setAvatarUrl] = useState(initialAvatar || "");
  const [bannerUrl, setBannerUrl] = useState(initialSettings?.bannerUrl || "");
  const [allowPersonaPosting, setAllowPersonaPosting] = useState(
    Boolean(initialSettings?.allowPersonaPosting)
  );
  const [rules, setRules] = useState(initialSettings?.rules || "");

  // Media repository modal state
  const [mediaTarget, setMediaTarget] = useState<"avatar" | "banner" | null>(null);

  // Invite user state
  const [inviteInput, setInviteInput] = useState("");

  // Mutations
  const updateGroupMutation = api.thinkpages.updateThinktank.useMutation();
  const updateSettingsMutation = api.thinkpages.updateGroupSettings.useMutation({
    onSuccess: () => {
      soundEffects.success();
      notify.success("Group settings updated successfully!");
      void utils.thinkpages.getThinktankById.invalidate({ groupId });
      void utils.thinkpages.getThinktanks.invalidate();
      onClose();
    },
    onError: (err) => {
      soundEffects.error();
      notify.error(err.message || "Failed to update settings");
    },
  });

  const inviteMutation = api.thinkpages.inviteToThinktank.useMutation({
    onSuccess: () => {
      soundEffects.success();
      notify.success(`Invitation sent to ${inviteInput.trim()}!`);
      setInviteInput("");
    },
    onError: (err) => {
      soundEffects.error();
      notify.error(err.message || "Failed to send invitation");
    },
  });

  const deleteGroupMutation = api.thinkpages.deleteThinktank.useMutation({
    onSuccess: () => {
      soundEffects.release();
      notify.success("Group disbanded.");
      void utils.thinkpages.getThinktanks.invalidate();
      onClose();
      onDeleteSuccess?.();
    },
    onError: (err) => {
      soundEffects.error();
      notify.error(err.message || "Failed to delete group");
    },
  });

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    soundEffects.press();

    // 1. Update basic info & avatar
    await updateGroupMutation.mutateAsync({
      groupId,
      name: name.trim(),
      description: description.trim(),
      category,
      avatar: avatarUrl.trim() || undefined,
      type: type as any,
    });

    // 2. Update settings (including banner and multi-persona toggle)
    updateSettingsMutation.mutate({
      groupId,
      allowPersonaPosting,
      bannerUrl: bannerUrl.trim() || undefined,
      rules: rules.trim(),
    });
  };

  const handleSendInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteInput.trim()) return;

    soundEffects.press();
    inviteMutation.mutate({
      groupId,
      userIds: [inviteInput.trim()],
      invitedBy: currentUserId,
    });
  };

  const categories = [
    "General",
    "Economics",
    "Diplomacy",
    "History & Lore",
    "Military & Defense",
    "Culture & Society",
    "Science & Technology",
  ];

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto rounded-2xl border-border/50 bg-card/95 backdrop-blur-2xl p-6 shadow-2xl dark:border-white/10 dark:bg-card/95">
          <DialogHeader>
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <Settings className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-foreground">
                  Group Settings
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Configure group identity, branding imagery, and member access.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <form onSubmit={handleSave} className="space-y-4 pt-2">
            {/* ── Visual Branding: Banner & Logo ── */}
            <div className="space-y-3 rounded-2xl border border-border/40 bg-muted/20 p-3.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-foreground">Branding & Artwork</span>
                <span className="text-[10px] text-muted-foreground">Media Repository</span>
              </div>

              {/* Banner Preview */}
              <div className="relative h-24 w-full overflow-hidden rounded-xl border border-border/50 bg-muted/50">
                {bannerUrl ? (
                  <img
                    src={bannerUrl}
                    alt="Group banner"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-transparent text-xs text-muted-foreground">
                    No banner set
                  </div>
                )}
                <div className="absolute right-2 top-2 flex items-center gap-1.5">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => setMediaTarget("banner")}
                    className="h-7 rounded-lg bg-background/80 px-2.5 text-[11px] font-semibold backdrop-blur-md shadow-xs"
                  >
                    <MediaImage className="mr-1 h-3 w-3" />
                    {bannerUrl ? "Change Banner" : "Choose Banner"}
                  </Button>
                  {bannerUrl && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => setBannerUrl("")}
                      className="h-7 w-7 rounded-lg p-0 text-muted-foreground hover:text-foreground bg-background/80 backdrop-blur-md"
                      title="Remove Banner"
                    >
                      <Xmark className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>

              {/* Logo / Avatar Preview */}
              <div className="flex items-center gap-3 pt-1">
                <Avatar className="h-12 w-12 rounded-xl border border-border/50 shadow-xs">
                  <AvatarImage src={avatarUrl || undefined} alt={name} />
                  <AvatarFallback className="rounded-xl bg-emerald-500/10 text-emerald-600 font-bold text-sm dark:text-emerald-400">
                    {name.slice(0, 2).toUpperCase() || "TT"}
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setMediaTarget("avatar")}
                      className="h-7.5 rounded-lg px-2.5 text-xs font-semibold"
                    >
                      <MediaImage className="mr-1.5 h-3.5 w-3.5 text-emerald-500" />
                      Select Logo from Repository
                    </Button>
                    {avatarUrl && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => setAvatarUrl("")}
                        className="h-7 text-xs text-muted-foreground hover:text-foreground"
                      >
                        Clear
                      </Button>
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    Upload a custom emblem or choose from Wiki Commons & Unsplash.
                  </p>
                </div>
              </div>
            </div>

            {/* Name */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Name</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-9 rounded-xl text-xs bg-background/50 border-border/40"
                required
              />
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Description</label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="min-h-[60px] rounded-xl text-xs bg-background/50 border-border/40"
              />
            </div>

            {/* Category */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-xl border border-border/40 bg-background/50 px-3 py-2 text-xs text-foreground focus:outline-none"
              >
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            {/* Rules & Guidelines */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Rules & Guidelines</label>
              <Textarea
                placeholder="Optional guidelines for posting and discussions..."
                value={rules}
                onChange={(e) => setRules(e.target.value)}
                className="min-h-[50px] rounded-xl text-xs bg-background/50 border-border/40 placeholder:text-muted-foreground/60"
              />
            </div>

            {/* ── Invite Users Section ── */}
            <div className="rounded-2xl border border-border/40 bg-card/60 p-3.5 space-y-2.5">
              <div className="flex items-center gap-1.5">
                <Plus className="h-4 w-4 text-emerald-500" />
                <span className="text-xs font-bold text-foreground">Invite Members</span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-snug">
                Send an invitation to a player or collaborator by user ID or handle.
              </p>
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Enter User ID (e.g., user_2abc...)"
                  value={inviteInput}
                  onChange={(e) => setInviteInput(e.target.value)}
                  className="h-8.5 flex-1 rounded-xl text-xs bg-background/50 border-border/40 placeholder:text-muted-foreground/60"
                />
                <Button
                  type="button"
                  size="sm"
                  onClick={handleSendInvite}
                  disabled={inviteMutation.isPending || !inviteInput.trim()}
                  className="h-8.5 rounded-xl bg-emerald-600 px-3 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700 active:scale-95 dark:bg-emerald-500"
                >
                  <Send className="mr-1 h-3 w-3" />
                  Invite
                </Button>
              </div>
            </div>

            {/* Multi-Persona Posting Toggle (Replaced Sparkle Icon) */}
            <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Group className="h-4 w-4 text-purple-500" />
                  <span className="text-xs font-bold text-foreground">
                    Multi-Persona Posting
                  </span>
                </div>
                <Switch
                  checked={allowPersonaPosting}
                  onCheckedChange={(checked) => {
                    soundEffects.press();
                    setAllowPersonaPosting(checked);
                  }}
                />
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                When enabled, members can choose to publish notes under their country's Government, Media, or Citizen personas. When disabled, all members post under authentic national accounts.
              </p>
            </div>

            {/* Privacy Toggle */}
            <div className="rounded-xl border border-border/40 bg-muted/20 p-3.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                {type === "public" ? (
                  <Globe className="h-4 w-4 text-emerald-500" />
                ) : (
                  <Lock className="h-4 w-4 text-amber-500" />
                )}
                <div>
                  <span className="text-xs font-bold text-foreground">
                    {type === "public" ? "Public Group" : "Private Group"}
                  </span>
                  <p className="text-[11px] text-muted-foreground">
                    {type === "public"
                      ? "Anyone can discover and join this group."
                      : "Invite-only membership."}
                  </p>
                </div>
              </div>
              <Switch
                checked={type === "public"}
                onCheckedChange={(checked) => {
                  soundEffects.press();
                  setType(checked ? "public" : "private");
                }}
              />
            </div>

            {/* Actions & Disband */}
            <div className="flex items-center justify-between pt-3 border-t border-border/30">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (
                    confirm(
                      "Are you sure you want to delete this group? All docs and posts will be removed."
                    )
                  ) {
                    deleteGroupMutation.mutate({ groupId });
                  }
                }}
                disabled={deleteGroupMutation.isPending}
                className="h-8.5 rounded-xl text-xs text-rose-500 hover:bg-rose-500/10 hover:text-rose-600"
              >
                <Trash className="mr-1.5 h-3.5 w-3.5" />
                Delete Group
              </Button>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onClose}
                  className="h-8.5 rounded-xl text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={updateSettingsMutation.isPending || updateGroupMutation.isPending}
                  className="h-8.5 rounded-xl bg-emerald-600 px-4 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 active:scale-95 dark:bg-emerald-500"
                >
                  <Check className="mr-1.5 h-3.5 w-3.5" />
                  Save Settings
                </Button>
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Platform Media Repository Modal ── */}
      {mediaTarget && (
        <MediaSearchModal
          isOpen={Boolean(mediaTarget)}
          onClose={() => setMediaTarget(null)}
          onImageSelect={(imageUrl) => {
            soundEffects.success();
            if (mediaTarget === "avatar") {
              setAvatarUrl(imageUrl);
              notify.success("Emblem updated from repository");
            } else if (mediaTarget === "banner") {
              setBannerUrl(imageUrl);
              notify.success("Banner updated from repository");
            }
            setMediaTarget(null);
          }}
        />
      )}
    </>
  );
}
