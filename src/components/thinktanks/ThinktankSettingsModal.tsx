"use client";

import React, { useState } from "react";
import {
  Settings,
  Group,
  Trash,
  Check,
  Globe,
  Lock,
  Plus,
  Send,
  MediaImage,
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
        <DialogContent className="border-border/50 bg-card/95 dark:bg-card/95 max-h-[90vh] max-w-xl overflow-y-auto rounded-2xl p-6 shadow-2xl backdrop-blur-2xl dark:border-white/10">
          <DialogHeader>
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <Settings className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-foreground text-base font-bold">
                  Group Settings
                </DialogTitle>
                <DialogDescription className="text-muted-foreground text-xs">
                  Configure group identity, branding imagery, and member access.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <form onSubmit={handleSave} className="space-y-4 pt-2">
            {/* ── Visual Branding: Banner & Logo ── */}
            <div className="border-border/40 bg-muted/20 space-y-3 rounded-2xl border p-3.5">
              <div className="flex items-center justify-between">
                <span className="text-foreground text-xs font-bold">Branding & Artwork</span>
                <span className="text-muted-foreground text-[10px]">Media Repository</span>
              </div>

              {/* Banner Preview */}
              <div className="border-border/50 bg-muted/50 relative h-24 w-full overflow-hidden rounded-xl border">
                {bannerUrl ? (
                  <img src={bannerUrl} alt="Group banner" className="h-full w-full object-cover" />
                ) : (
                  <div className="text-muted-foreground flex h-full w-full items-center justify-center bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-transparent text-xs">
                    No banner set
                  </div>
                )}
                <div className="absolute top-2 right-2 flex items-center gap-1.5">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => setMediaTarget("banner")}
                    className="bg-background/80 h-7 rounded-lg px-2.5 text-[11px] font-semibold shadow-xs backdrop-blur-md"
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
                      className="text-muted-foreground hover:text-foreground bg-background/80 h-7 w-7 rounded-lg p-0 backdrop-blur-md"
                      title="Remove Banner"
                    >
                      <Xmark className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>

              {/* Logo / Avatar Preview */}
              <div className="flex items-center gap-3 pt-1">
                <Avatar className="border-border/50 h-12 w-12 rounded-xl border shadow-xs">
                  <AvatarImage src={avatarUrl || undefined} alt={name} />
                  <AvatarFallback className="rounded-xl bg-emerald-500/10 text-sm font-bold text-emerald-600 dark:text-emerald-400">
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
                        className="text-muted-foreground hover:text-foreground h-7 text-xs"
                      >
                        Clear
                      </Button>
                    )}
                  </div>
                  <p className="text-muted-foreground text-[10px]">
                    Upload a custom emblem or choose from Wiki Commons & Unsplash.
                  </p>
                </div>
              </div>
            </div>

            {/* Name */}
            <div className="space-y-1.5">
              <label className="text-foreground text-xs font-semibold">Name</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="bg-background/50 border-border/40 h-9 rounded-xl text-xs"
                required
              />
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <label className="text-foreground text-xs font-semibold">Description</label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="bg-background/50 border-border/40 min-h-[60px] rounded-xl text-xs"
              />
            </div>

            {/* Category */}
            <div className="space-y-1.5">
              <label className="text-foreground text-xs font-semibold">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="border-border/40 bg-background/50 text-foreground w-full rounded-xl border px-3 py-2 text-xs focus:outline-none"
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
              <label className="text-foreground text-xs font-semibold">Rules & Guidelines</label>
              <Textarea
                placeholder="Optional guidelines for posting and discussions..."
                value={rules}
                onChange={(e) => setRules(e.target.value)}
                className="bg-background/50 border-border/40 placeholder:text-muted-foreground/60 min-h-[50px] rounded-xl text-xs"
              />
            </div>

            {/* ── Invite Users Section ── */}
            <div className="border-border/40 bg-card/60 space-y-2.5 rounded-2xl border p-3.5">
              <div className="flex items-center gap-1.5">
                <Plus className="h-4 w-4 text-emerald-500" />
                <span className="text-foreground text-xs font-bold">Invite Members</span>
              </div>
              <p className="text-muted-foreground text-[11px] leading-snug">
                Send an invitation to a player or collaborator by user ID or handle.
              </p>
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Enter User ID (e.g., user_2abc...)"
                  value={inviteInput}
                  onChange={(e) => setInviteInput(e.target.value)}
                  className="bg-background/50 border-border/40 placeholder:text-muted-foreground/60 h-8.5 flex-1 rounded-xl text-xs"
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
            <div className="space-y-2 rounded-xl border border-purple-500/20 bg-purple-500/5 p-3.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Group className="h-4 w-4 text-purple-500" />
                  <span className="text-foreground text-xs font-bold">Multi-Persona Posting</span>
                </div>
                <Switch
                  checked={allowPersonaPosting}
                  onCheckedChange={(checked) => {
                    soundEffects.press();
                    setAllowPersonaPosting(checked);
                  }}
                />
              </div>
              <p className="text-muted-foreground text-[11px] leading-relaxed">
                When enabled, members can choose to publish notes under their country's Government,
                Media, or Citizen personas. When disabled, all members post under authentic national
                accounts.
              </p>
            </div>

            {/* Privacy Toggle */}
            <div className="border-border/40 bg-muted/20 flex items-center justify-between rounded-xl border p-3.5">
              <div className="flex items-center gap-2">
                {type === "public" ? (
                  <Globe className="h-4 w-4 text-emerald-500" />
                ) : (
                  <Lock className="h-4 w-4 text-amber-500" />
                )}
                <div>
                  <span className="text-foreground text-xs font-bold">
                    {type === "public" ? "Public Group" : "Private Group"}
                  </span>
                  <p className="text-muted-foreground text-[11px]">
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
            <div className="border-border/30 flex items-center justify-between border-t pt-3">
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
