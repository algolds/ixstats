"use client";

import React, { useState, useMemo } from "react";
import { api } from "~/trpc/react";
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
import { Checkbox } from "~/components/ui/checkbox";
import { Card } from "~/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { useNotify } from "~/hooks/useNotify";
import { Badge } from "~/components/ui/badge";
import {
  Plus,
  EditPencil as Pencil,
  Trash as Trash2,
  Search,
  Package,
  EyeClosed as EyeOff,
  Coins,
  Component as Layers,
  Star,
  MediaImage as ImageIcon,
} from "iconoir-react";
import { PackHolographicCover } from "~/components/cards/pack-opening/PackHolographicCover";
import { cn } from "~/lib/utils/cn";

// ─── Pack types & rarity options ─────────────────────────────────

const PACK_TYPES = [
  { value: "BASIC", label: "Basic" },
  { value: "PREMIUM", label: "Premium" },
  { value: "ELITE", label: "Elite" },
  { value: "EVENT", label: "Event" },
  { value: "LIMITED", label: "Limited" },
];

const RARITY_OPTIONS = [
  { value: "none", label: "None" },
  { value: "COMMON", label: "Common" },
  { value: "UNCOMMON", label: "Uncommon" },
  { value: "RARE", label: "Rare" },
  { value: "ULTRA_RARE", label: "Ultra rare" },
  { value: "EPIC", label: "Epic" },
  { value: "LEGENDARY", label: "Legendary" },
];

const PACK_TYPE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  BASIC: { bg: "bg-blue/20", text: "text-blue", border: "border-blue/30" },
  PREMIUM: { bg: "bg-yellow/20", text: "text-yellow", border: "border-yellow/30" },
  ELITE: { bg: "bg-purple/20", text: "text-purple", border: "border-purple/30" },
  EVENT: { bg: "bg-red/20", text: "text-red", border: "border-red/30" },
  LIMITED: { bg: "bg-red/20", text: "text-red", border: "border-red/30" },
};

// ─── Form data ───────────────────────────────────────────────────

interface PackFormData {
  name: string;
  description: string;
  artwork: string;
  packType: string;
  priceCredits: number;
  cardCount: number;
  guaranteedRarity: string;
  isActive: boolean;
}

const INITIAL_FORM: PackFormData = {
  name: "",
  description: "",
  artwork: "",
  packType: "BASIC",
  priceCredits: 100,
  cardCount: 5,
  guaranteedRarity: "",
  isActive: true,
};

// ─── Component ───────────────────────────────────────────────────

export function CardPacksAdmin() {
  const notify = useNotify();

  const [searchTerm, setSearchTerm] = useState("");
  const [showInactive, setShowInactive] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingPack, setEditingPack] = useState<any | null>(null);
  const [formData, setFormData] = useState<PackFormData>(INITIAL_FORM);

  const { data, isLoading, refetch } = api.cardPacks.getAllPacks.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });

  const createMutation = api.cardPacks.createPack.useMutation({
    onSuccess: () => {
      notify.success("Success", "Pack created successfully");
      void refetch();
      setIsAddDialogOpen(false);
      resetForm();
    },
    onError: (error: { message?: string }) => {
      notify.error("Error", error.message ?? "Failed to create pack");
    },
  });

  const updateMutation = api.cardPacks.updatePack.useMutation({
    onSuccess: () => {
      notify.success("Success", "Pack updated successfully");
      void refetch();
      setEditingPack(null);
      resetForm();
    },
    onError: (error: { message?: string }) => {
      notify.error("Error", error.message ?? "Failed to update pack");
    },
  });

  const deactivateMutation = api.cardPacks.deactivatePack.useMutation({
    onSuccess: () => {
      notify.success("Success", "Pack deactivated");
      void refetch();
    },
    onError: (error: { message?: string }) => {
      notify.error("Error", error.message ?? "Failed to deactivate pack");
    },
  });

  const packs = useMemo(() => data?.packs ?? [], [data?.packs]);

  const filteredPacks = useMemo(() => {
    return packs.filter((pack) => {
      if (!showInactive && !pack.isActive) return false;
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        return (
          pack.name.toLowerCase().includes(q) ||
          pack.packType.toLowerCase().includes(q) ||
          (pack.description ?? "").toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [packs, searchTerm, showInactive]);

  const stats = useMemo(() => {
    const total = packs.length;
    const active = packs.filter((p) => p.isActive).length;
    const avgPrice =
      total > 0 ? Math.round(packs.reduce((s, p) => s + p.priceCredits, 0) / total) : 0;
    const totalCards = packs.reduce((s, p) => s + p.cardCount, 0);
    return { total, active, avgPrice, totalCards };
  }, [packs]);

  const resetForm = () => setFormData(INITIAL_FORM);

  const handleCreate = () => {
    createMutation.mutate({
      name: formData.name,
      description: formData.description || undefined,
      artwork: formData.artwork || undefined,
      packType: formData.packType,
      priceCredits: formData.priceCredits,
      cardCount: formData.cardCount,
      guaranteedRarity:
        formData.guaranteedRarity === "none" ? undefined : formData.guaranteedRarity,
      isActive: formData.isActive,
    });
  };

  const handleUpdate = () => {
    if (!editingPack?.id) return;
    updateMutation.mutate({
      packId: editingPack.id,
      updates: {
        name: formData.name,
        description: formData.description || undefined,
        artwork: formData.artwork || null,
        packType: formData.packType,
        priceCredits: formData.priceCredits,
        cardCount: formData.cardCount,
        guaranteedRarity:
          formData.guaranteedRarity === "none" ? undefined : formData.guaranteedRarity,
        isActive: formData.isActive,
      },
    });
  };

  const handleEdit = (pack: any) => {
    setFormData({
      name: pack.name,
      description: pack.description ?? "",
      artwork: pack.artwork ?? "",
      packType: pack.packType,
      priceCredits: pack.priceCredits,
      cardCount: pack.cardCount,
      guaranteedRarity: pack.guaranteedRarity ?? "",
      isActive: pack.isActive,
    });
    setEditingPack(pack);
  };

  const handleDeactivate = (pack: any) => {
    if (confirm(`Deactivate "${pack.name}"? It will no longer appear in the store.`)) {
      deactivateMutation.mutate({ packId: pack.id });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header + Filter */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <Button
          variant="secondary"
          onClick={() => {
            resetForm();
            setIsAddDialogOpen(true);
          }}

          size="sm"
        >
          <Plus className="mr-2 h-4 w-4" />
          Create pack
        </Button>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative">
            <Search className="text-label-secondary absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
            <Input
              placeholder="Search packs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-64 pl-10"
            />
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="showInactivePacks"
              checked={showInactive}
              onCheckedChange={(v) => setShowInactive(v as boolean)}
            />
            <label
              htmlFor="showInactivePacks"
              className="text-label-secondary text-body cursor-pointer"
            >
              Show inactive
            </label>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {[
          { label: "Total packs", value: stats.total, icon: Package, color: "text-blue" },
          { label: "Active", value: stats.active, icon: Star, color: "text-green" },
          {
            label: "Avg price",
            value: `${stats.avgPrice} IxC`,
            icon: Coins,
            color: "text-yellow",
          },
          { label: "Total cards", value: stats.totalCards, icon: Layers, color: "text-purple" },
        ].map((s) => (
          <Card key={s.label} className="flex flex-col gap-6 p-4 py-6">
            <div className="flex items-center gap-2">
              <s.icon className={`h-4 w-4 ${s.color}`} />
              <p className="text-label-secondary text-body">{s.label}</p>
            </div>
            <p className="text-label text-title-1 mt-1">{s.value}</p>
          </Card>
        ))}
      </div>

      {/* Pack Grid */}
      {isLoading ? (
        <div className="py-12 text-center">
          <div className="border-yellow mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2" />
          <p className="text-label-secondary">Loading packs...</p>
        </div>
      ) : filteredPacks.length === 0 ? (
        <Card className="flex flex-col gap-6 p-12 py-6 text-center">
          <Package className="text-label-tertiary mx-auto mb-3 h-10 w-10" />
          <p className="text-label-secondary">No packs found</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredPacks.map((pack) => {
            const colors = PACK_TYPE_COLORS[pack.packType] ?? PACK_TYPE_COLORS.BASIC!;
            return (
              <Card
                key={pack.id}
                className={cn(
                  "flex flex-col gap-6 py-6",
                  `hover:border-yellow/50 border p-4 transition-[color,background-color,border-color,box-shadow,opacity,transform] ${!pack.isActive ? "opacity-60" : ""} ${colors.border}`
                )}
              >
                <div className="mb-3 flex items-start justify-between">
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    <PackHolographicCover
                      packType={pack.packType}
                      guaranteedRarity={pack.guaranteedRarity}
                      packArtwork={pack.artwork || undefined}
                      size="sm"
                      className="rounded-control !h-10 w-10 shrink-0"
                    />
                    <div className="min-w-0">
                      <h3 className="text-label line-clamp-1 font-semibold">{pack.name}</h3>
                      <Badge
                        className={`${colors.bg} ${colors.text} text-footnote`}
                        variant="secondary"
                      >
                        {pack.packType}
                      </Badge>
                    </div>
                  </div>
                  {!pack.isActive && <EyeOff className="text-red h-4 w-4" />}
                </div>

                {pack.description && (
                  <p className="text-label-secondary text-footnote mb-3 line-clamp-2">
                    {pack.description}
                  </p>
                )}

                <div className="mb-4 space-y-2">
                  <div className="text-footnote flex items-center justify-between">
                    <span className="text-label-secondary">Price</span>
                    <span className="text-yellow font-semibold">
                      {pack.priceCredits.toLocaleString()} IxC
                    </span>
                  </div>
                  <div className="text-footnote flex items-center justify-between">
                    <span className="text-label-secondary">Cards</span>
                    <span className="text-label font-medium">{pack.cardCount}</span>
                  </div>
                  {pack.guaranteedRarity && (
                    <div className="text-footnote flex items-center justify-between">
                      <span className="text-label-secondary">Guaranteed</span>
                      <span className="text-purple font-medium">{pack.guaranteedRarity}</span>
                    </div>
                  )}
                  <div className="text-footnote flex items-center justify-between">
                    <span className="text-label-secondary">Status</span>
                    <Badge
                      variant="outline"
                      className={
                        pack.isActive ? "border-green/30 text-green" : "border-red/30 text-red"
                      }
                    >
                      {pack.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleEdit(pack)}
                    className="flex-1"
                  >
                    <Pencil className="mr-1 h-3 w-3" />
                    Edit
                  </Button>
                  {pack.isActive && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDeactivate(pack)}
                      className="text-destructive"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog
        open={isAddDialogOpen || !!editingPack}
        onOpenChange={(open) => {
          if (!open) {
            setIsAddDialogOpen(false);
            setEditingPack(null);
            resetForm();
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingPack ? "Edit Pack" : "Create Pack"}</DialogTitle>
            <DialogDescription>
              {editingPack
                ? "Modify the pack configuration"
                : "Configure a new card pack for the store"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <label className="text-label text-body mb-2 block font-medium">Name *</label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Legendary Starter Pack"
              />
            </div>

            <div>
              <label className="text-label text-body mb-2 block font-medium">Description</label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Brief description of the pack..."
                rows={2}
              />
            </div>

            <div>
              <label className="text-label text-body mb-2 block font-medium">
                <ImageIcon className="mr-1 inline h-3.5 w-3.5" />
                Artwork URL
              </label>
              <Input
                value={formData.artwork}
                onChange={(e) => setFormData({ ...formData, artwork: e.target.value })}
                placeholder="https://... (optional pack image)"
              />
              {formData.artwork && (
                <div className="mt-2 flex items-center gap-2">
                  <img
                    src={formData.artwork}
                    alt="Pack artwork preview"
                    className="border-separator rounded-control h-12 w-12 border object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                  <span className="text-label-secondary text-footnote">Preview</span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-label text-body mb-2 block font-medium">Pack Type *</label>
                <Select
                  value={formData.packType}
                  onValueChange={(v) => setFormData({ ...formData, packType: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PACK_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-label text-body mb-2 block font-medium">Price (IxC) *</label>
                <Input
                  type="number"
                  min={1}
                  value={formData.priceCredits}
                  onChange={(e) =>
                    setFormData({ ...formData, priceCredits: parseInt(e.target.value) || 0 })
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-label text-body mb-2 block font-medium">Card count</label>
                <Input
                  type="number"
                  min={1}
                  value={formData.cardCount}
                  onChange={(e) =>
                    setFormData({ ...formData, cardCount: parseInt(e.target.value) || 5 })
                  }
                />
              </div>
              <div>
                <label className="text-label text-body mb-2 block font-medium">
                  Guaranteed rarity
                </label>
                <Select
                  value={formData.guaranteedRarity}
                  onValueChange={(v) => setFormData({ ...formData, guaranteedRarity: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    {RARITY_OPTIONS.map((r) => (
                      <SelectItem key={r.value} value={r.value}>
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="packIsActiveEdit"
                checked={formData.isActive}
                onCheckedChange={(v) => setFormData({ ...formData, isActive: v as boolean })}
              />
              <label htmlFor="packIsActiveEdit" className="text-label text-body cursor-pointer">
                Pack is Active (visible in store)
              </label>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                setIsAddDialogOpen(false);
                setEditingPack(null);
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button
              variant="secondary"
              onClick={editingPack ? handleUpdate : handleCreate}
              disabled={
                !formData.name ||
                formData.priceCredits <= 0 ||
                createMutation.isPending ||
                updateMutation.isPending
              }
            >
              {createMutation.isPending || updateMutation.isPending
                ? "Saving..."
                : editingPack
                  ? "Update Pack"
                  : "Create Pack"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
