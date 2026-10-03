"use client";

import React, { useEffect, useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
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

  // Invite user state: search by ThinkPages username / display name, then pick a result.
  const [inviteInput, setInviteInput] = useState("");
  const [inviteTarget, setInviteTarget] = useState<{
    userId: string;
    username: string;
    displayName: string;
  } | null>(null);
  const [inviteQuery, setInviteQuery] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setInviteQuery(inviteInput.trim().replace(/^@/, "")), 250);
    return () => clearTimeout(t);
  }, [inviteInput]);
  const { data: inviteResults } = api.thinkpages.searchInvitableUsers.useQuery(
    { groupId, query: inviteQuery },
    { enabled: isOpen && inviteQuery.length >= 2 && !inviteTarget, staleTime: 10000 }
  );

  // Mutations
  const updateGroupMutation = api.thinkpages.updateThinktank.useMutation();
  const updateSettingsMutation = api.thinkpages.updateGroupSettings.useMutation({
    onSuccess: () => {
      soundEffects.success();
      notify.success("Group settings updated");
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
    onSuccess: (result) => {
      if (result.skipped > 0 && result.count === 0) {
        soundEffects.error();
        notify.error("This user can't be invited (their privacy settings don't allow it).");
        return;
      }
      soundEffects.success();
      notify.success(`Invitation sent to ${inviteTarget?.displayName ?? inviteInput.trim()}!`);
      setInviteInput("");
      setInviteTarget(null);
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
    if (!inviteTarget) return;

    soundEffects.press();
    inviteMutation.mutate({
      groupId,
      userIds: [inviteTarget.userId],
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
        <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="bg-tint-fill text-tint rounded-control flex size-9 items-center justify-center">
                <Settings className="size-5" aria-hidden="true" />
              </div>
              <div>
                <DialogTitle className="text-title-3">Group settings</DialogTitle>
                <DialogDescription>
                  Configure group identity, branding imagery, and member access.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <form onSubmit={handleSave} className="space-y-4 pt-2">
            {/* ── Visual Branding: Banner & Logo ── */}
            <div className="bg-surface-secondary rounded-row space-y-3 p-4">
              <div className="flex items-center justify-between">
                <span className="text-subhead text-label">Branding & artwork</span>
                <span className="text-label-secondary text-footnote">Media repository</span>
              </div>

              {/* Banner Preview */}
              <div className="border-separator bg-fill-4 rounded-control relative h-24 w-full overflow-hidden border">
                {bannerUrl ? (
                  <img src={bannerUrl} alt="Group banner" className="h-full w-full object-cover" />
                ) : (
                  <div className="text-footnote text-label-secondary flex size-full items-center justify-center">
                    No banner set
                  </div>
                )}
                <div className="absolute top-2 right-2 flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => setMediaTarget("banner")}
                    className="material-thin"
                  >
                    <MediaImage />
                    {bannerUrl ? "Change Banner" : "Choose Banner"}
                  </Button>
                  {bannerUrl && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => setBannerUrl("")}
                      className="material-thin text-label-secondary hover:text-label size-7 p-0"
                      title="Remove banner"
                    >
                      <Xmark />
                    </Button>
                  )}
                </div>
              </div>

              {/* Logo / Avatar Preview */}
              <div className="flex items-center gap-3 pt-1">
                <Avatar className="border-separator rounded-control size-12 border">
                  <AvatarImage src={avatarUrl || undefined} alt={name} />
                  <AvatarFallback className="rounded-control bg-tint-fill text-headline text-tint">
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
                    >
                      <MediaImage className="text-tint" />
                      Select logo from repository
                    </Button>
                    {avatarUrl && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => setAvatarUrl("")}
                        className="text-label-secondary hover:text-label"
                      >
                        Clear
                      </Button>
                    )}
                  </div>
                  <p className="text-label-secondary text-footnote">
                    Upload a custom emblem or choose from Wiki Commons & Unsplash.
                  </p>
                </div>
              </div>
            </div>

            {/* Name */}
            <div className="space-y-2">
              <label className="text-subhead text-label">Name</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} required />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <label className="text-subhead text-label">Description</label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="min-h-[60px]"
              />
            </div>

            {/* Category */}
            <div className="space-y-2">
              <label id="thinktank-category-label" className="text-subhead text-label">
                Category
              </label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger aria-labelledby="thinktank-category-label" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Rules & Guidelines */}
            <div className="space-y-2">
              <label className="text-subhead text-label">Rules & guidelines</label>
              <Textarea
                placeholder="Optional guidelines for posting and discussions..."
                value={rules}
                onChange={(e) => setRules(e.target.value)}
                className="min-h-[50px]"
              />
            </div>

            {/* ── Invite Users Section ── */}
            <div className="bg-surface-secondary rounded-row space-y-2 p-4">
              <div className="flex items-center gap-2">
                <Plus className="text-tint size-4" aria-hidden="true" />
                <span className="text-subhead text-label">Invite members</span>
              </div>
              <p className="text-footnote text-label-secondary">
                Search for a player by their ThinkPages username or display name, then send an
                invitation.
              </p>
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Search by username (e.g., @jane)"
                  value={
                    inviteTarget
                      ? `${inviteTarget.displayName} (@${inviteTarget.username})`
                      : inviteInput
                  }
                  onChange={(e) => {
                    setInviteTarget(null);
                    setInviteInput(e.target.value);
                  }}
                  className="flex-1"
                />
                <Button
                  type="button"
                  size="sm"
                  onClick={handleSendInvite}
                  disabled={inviteMutation.isPending || !inviteTarget}
                >
                  <Send />
                  Invite
                </Button>
              </div>
              {!inviteTarget && inviteResults && inviteResults.length > 0 && (
                <ul className="border-separator bg-surface divide-separator rounded-control max-h-40 divide-y overflow-y-auto border">
                  {inviteResults.map((u) => (
                    <li key={u.userId}>
                      <button
                        type="button"
                        onClick={() => {
                          soundEffects.press();
                          setInviteTarget({
                            userId: u.userId,
                            username: u.username,
                            displayName: u.displayName,
                          });
                        }}
                        className="hover:bg-fill-4 text-footnote flex w-full items-center gap-2 px-3 py-2 text-left"
                      >
                        <Avatar className="size-6">
                          <AvatarImage src={u.profileImageUrl || undefined} alt="" />
                          <AvatarFallback className="text-footnote">
                            {u.displayName.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-label font-medium">{u.displayName}</span>
                        <span className="text-label-secondary">@{u.username}</span>
                        {u.countryName && (
                          <span className="text-label-secondary ml-auto">{u.countryName}</span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {!inviteTarget && inviteQuery.length >= 2 && inviteResults?.length === 0 && (
                <p className="text-label-secondary text-footnote">No invitable users found.</p>
              )}
            </div>

            {/* Multi-Persona Posting Toggle (Replaced Sparkle Icon) */}
            <div className="bg-surface-secondary rounded-row space-y-2 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Group className="text-label-secondary size-4" aria-hidden="true" />
                  <span className="text-subhead text-label">Multi-Persona Posting</span>
                </div>
                <Switch
                  checked={allowPersonaPosting}
                  onCheckedChange={(checked) => {
                    soundEffects.press();
                    setAllowPersonaPosting(checked);
                  }}
                />
              </div>
              <p className="text-label-secondary text-footnote leading-relaxed">
                When enabled, members can choose to publish notes under their country's Government,
                Media, or Citizen personas. When disabled, all members post under authentic national
                accounts.
              </p>
            </div>

            {/* Privacy Toggle */}
            <div className="border-separator bg-fill-4 rounded-row flex items-center justify-between border p-4">
              <div className="flex items-center gap-2">
                {type === "public" ? (
                  <Globe className="text-label-secondary size-4" aria-hidden="true" />
                ) : (
                  <Lock className="text-label-secondary size-4" aria-hidden="true" />
                )}
                <div>
                  <span className="text-subhead text-label">
                    {type === "public" ? "Public Group" : "Private Group"}
                  </span>
                  <p className="text-label-secondary text-footnote">
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
            <div className="border-separator flex items-center justify-between border-t pt-3">
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
                className="text-red hover:bg-red/10 hover:text-red h-8.5"
              >
                <Trash />
                Delete group
              </Button>

              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" size="sm" onClick={onClose}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={updateSettingsMutation.isPending || updateGroupMutation.isPending}
                >
                  <Check />
                  Save settings
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
