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

interface ThinktankCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserId: string;
  onCreated: (groupId: string) => void;
}

export function ThinktankCreateModal({
  isOpen,
  onClose,
  currentUserId,
  onCreated,
}: ThinktankCreateModalProps) {
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
      notify.success("Group created successfully!");
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
      createdBy: currentUserId,
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
        <DialogContent className="border-border/50 bg-card/90 dark:bg-card/95 max-w-md rounded-2xl p-6 shadow-2xl backdrop-blur-2xl dark:border-white/10">
          <DialogHeader>
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <Group className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-foreground text-base font-bold">
                  Create a Group
                </DialogTitle>
                <DialogDescription className="text-muted-foreground text-xs">
                  Set up a shared lore hub and discussion workspace.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-3.5 pt-2">
            {/* Logo / Avatar Picker */}
            <div className="border-border/40 bg-muted/20 flex items-center gap-3 rounded-xl border p-2.5">
              <Avatar className="border-border/50 h-11 w-11 rounded-xl border shadow-xs">
                <AvatarImage src={avatarUrl || undefined} alt={name} />
                <AvatarFallback className="rounded-xl bg-emerald-500/10 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                  {name.slice(0, 2).toUpperCase() || "TT"}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setShowMediaModal(true)}
                  className="h-7 rounded-lg text-xs font-semibold"
                >
                  <MediaImage className="mr-1.5 h-3.5 w-3.5 text-emerald-500" />
                  {avatarUrl ? "Change Emblem" : "Select from Repository"}
                </Button>
                {avatarUrl && (
                  <button
                    type="button"
                    onClick={() => setAvatarUrl("")}
                    className="text-muted-foreground hover:text-foreground ml-2 text-[10px]"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-foreground text-xs font-semibold">Group Name</label>
              <Input
                placeholder="e.g., Grand Vandarch Lore Archive"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="bg-background/50 border-border/40 h-8.5 rounded-xl text-xs"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-foreground text-xs font-semibold">Description</label>
              <Textarea
                placeholder="Purpose, scope, and objectives of this group..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="bg-background/50 border-border/40 min-h-[55px] rounded-xl text-xs"
              />
            </div>

            <div className="space-y-1">
              <label className="text-foreground text-xs font-semibold">Category</label>
              <div className="flex flex-wrap gap-1">
                {categories.map((cat) => (
                  <button
                    type="button"
                    key={cat}
                    onClick={() => {
                      soundEffects.press();
                      setCategory(cat);
                    }}
                    className={`rounded-lg px-2 py-0.5 text-[11px] font-medium transition-all ${
                      category === cat
                        ? "bg-emerald-600 text-white shadow-sm dark:bg-emerald-500"
                        : "bg-muted/60 text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-foreground text-xs font-semibold">
                Tags (comma-separated)
              </label>
              <Input
                placeholder="treaty, economics, maritime, vandarch"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                className="bg-background/50 border-border/40 h-8.5 rounded-xl text-xs"
              />
            </div>

            {/* Multi-Persona Posting Switch */}
            <div className="flex items-center justify-between rounded-xl border border-purple-500/20 bg-purple-500/5 p-3">
              <div className="flex items-center gap-2">
                <Group className="h-4 w-4 text-purple-500" />
                <div>
                  <span className="text-foreground text-xs font-bold">
                    Enable Multi-Persona Posting
                  </span>
                  <p className="text-muted-foreground text-[10px]">
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
            <div className="border-border/40 bg-muted/20 flex items-center justify-between rounded-xl border p-3">
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
                  <p className="text-muted-foreground text-[10px]">
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
                className="border-border/40 h-7 rounded-lg text-[11px]"
              >
                Toggle
              </Button>
            </div>

            <div className="border-border/30 flex items-center justify-end gap-2 border-t pt-3">
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
                disabled={createMutation.isPending || !name.trim()}
                className="h-8.5 rounded-xl bg-emerald-600 px-4 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 active:scale-95 dark:bg-emerald-500"
              >
                <Plus className="mr-1.5 h-3.5 w-3.5" />
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
