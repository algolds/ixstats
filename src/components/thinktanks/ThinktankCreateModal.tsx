"use client";

import React, { useState } from "react";
import { Group, Plus, Globe, Lock, MediaImage } from "iconoir-react";
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
import { ToggleGroup, ToggleGroupItem } from "~/components/ui/toggle-group";

interface ThinktankCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (groupId: string) => void;
}

export function ThinktankCreateModal({ isOpen, onClose, onCreated }: ThinktankCreateModalProps) {
  const notify = useNotify();
  const utils = api.useUtils();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Economics");
  const [type, setType] = useState<"public" | "private">("public");
  const [allowPersonaPosting, setAllowPersonaPosting] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [showMediaModal, setShowMediaModal] = useState(false);

  const updateSettingsMutation = api.thinkpages.updateGroupSettings.useMutation();

  const createMutation = api.thinkpages.createThinktank.useMutation({
    onSuccess: (newGroup) => {
      soundEffects.success();
      notify.success("Group created");
      void utils.thinkpages.getThinktanks.invalidate();

      // If multi-persona posting was toggled on, save setting
      if (allowPersonaPosting && newGroup?.id) {
        void updateSettingsMutation
          .mutateAsync({
            groupId: newGroup.id,
            allowPersonaPosting: true,
          })
          .catch(() => {});
      }

      onClose();
      if (newGroup?.id) {
        onCreated(newGroup.id);
      }
    },
    onError: (err) => {
      soundEffects.error();
      notify.error(err.message || "Failed to create group");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    soundEffects.press();
    const tags = tagsInput
      .split(",")
      .map((t) => t.trim().replace(/^#/, ""))
      .filter(Boolean);

    createMutation.mutate({
      name: name.trim(),
      description: description.trim(),
      category,
      type,
      avatar: avatarUrl.trim() || undefined,
      tags: tags.length > 0 ? tags : undefined,
    });
  };

  const categories = [
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
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="bg-tint-fill text-tint rounded-control flex size-9 items-center justify-center">
                <Group className="size-5" aria-hidden="true" />
              </div>
              <div>
                <DialogTitle className="text-title-3">Create a group</DialogTitle>
                <DialogDescription>
                  Set up a shared lore hub and discussion workspace.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            {/* Logo / Avatar Picker */}
            <div className="bg-surface-secondary rounded-row flex items-center gap-3 p-3">
              <Avatar className="border-separator rounded-control size-11 border">
                <AvatarImage src={avatarUrl || undefined} alt={name} />
                <AvatarFallback className="rounded-control bg-tint-fill text-caption text-tint">
                  {name.slice(0, 2).toUpperCase() || "TT"}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setShowMediaModal(true)}
                >
                  <MediaImage className="text-tint" />
                  {avatarUrl ? "Change Emblem" : "Select from Repository"}
                </Button>
                {avatarUrl && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setAvatarUrl("")}
                    className="text-label-secondary hover:text-label ml-2"
                  >
                    Clear
                  </Button>
                )}
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-subhead text-label">Group name</label>
              <Input
                placeholder="e.g., Grand Vandarch Lore Archive"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-subhead text-label">Description</label>
              <Textarea
                placeholder="Purpose, scope, and objectives of this group..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="min-h-[55px]"
              />
            </div>

            <div className="space-y-1">
              <label className="text-subhead text-label">Category</label>
              <ToggleGroup
                type="single"
                aria-label="Category"
                variant="pill"
                size="sm"
                disallowEmpty
                value={category}
                onValueChange={(cat) => {
                  if (cat) setCategory(cat);
                }}
              >
                {categories.map((cat) => (
                  <ToggleGroupItem key={cat} value={cat}>
                    {cat}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>

            <div className="space-y-1">
              <label className="text-subhead text-label">Tags (comma-separated)</label>
              <Input
                placeholder="treaty, economics, maritime, vandarch"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
              />
            </div>

            {/* Multi-Persona Posting Switch */}
            <div className="bg-surface-secondary rounded-row flex items-center justify-between p-3">
              <div className="flex items-center gap-2">
                <Group className="text-label-secondary size-4" aria-hidden="true" />
                <div>
                  <span className="text-subhead text-label">Enable Multi-Persona Posting</span>
                  <p className="text-label-secondary text-footnote">
                    Allow members to post as Government, Media, or Citizen personas.
                  </p>
                </div>
              </div>
              <Switch
                checked={allowPersonaPosting}
                onCheckedChange={(c) => {
                  soundEffects.press();
                  setAllowPersonaPosting(c);
                }}
              />
            </div>

            {/* Privacy Choice */}
            <div className="bg-surface-secondary rounded-row flex items-center justify-between p-3">
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
                    {type === "public" ? "Open to all users" : "Invite or approval required"}
                  </p>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  soundEffects.press();
                  setType(type === "public" ? "private" : "public");
                }}
                className="border-separator"
              >
                Toggle
              </Button>
            </div>

            <div className="border-separator flex items-center justify-end gap-2 border-t pt-3">
              <Button type="button" variant="outline" size="sm" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={createMutation.isPending || !name.trim()}>
                <Plus />
                {createMutation.isPending ? "Creating..." : "Create Group"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Media Repository Modal ── */}
      {showMediaModal && (
        <MediaSearchModal
          isOpen={showMediaModal}
          onClose={() => setShowMediaModal(false)}
          onImageSelect={(imageUrl) => {
            soundEffects.success();
            setAvatarUrl(imageUrl);
            setShowMediaModal(false);
            notify.success("Emblem selected from repository");
          }}
        />
      )}
    </>
  );
}
