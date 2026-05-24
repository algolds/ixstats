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
  Pencil,
  Trash2,
  Search,
  Package,
  EyeOff,
  Coins,
  Layers,
  Star,
  ImageIcon,
} from "lucide-react";
import { PackHolographicCover } from "~/components/cards/pack-opening/PackHolographicCover";

// ─── Pack types & rarity options ─────────────────────────────────

const PACK_TYPES = [
  { value: "BASIC", label: "Basic" },
  { value: "PREMIUM", label: "Premium" },
  { value: "ELITE", label: "Elite" },
  { value: "EVENT", label: "Event" },
  { value: "LIMITED", label: "Limited" },
];

const RARITY_OPTIONS = [
  { value: "", label: "None" },
  { value: "COMMON", label: "Common" },
  { value: "UNCOMMON", label: "Uncommon" },
  { value: "RARE", label: "Rare" },
  { value: "ULTRA_RARE", label: "Ultra Rare" },
  { value: "EPIC", label: "Epic" },
  { value: "LEGENDARY", label: "Legendary" },
];

const PACK_TYPE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  BASIC: { bg: "bg-blue-500/20", text: "text-blue-400", border: "border-blue-400/30" },
  PREMIUM: { bg: "bg-amber-500/20", text: "text-amber-400", border: "border-amber-400/30" },
  ELITE: { bg: "bg-purple-500/20", text: "text-purple-400", border: "border-purple-400/30" },
  EVENT: { bg: "bg-red-500/20", text: "text-red-400", border: "border-red-400/30" },
  LIMITED: { bg: "bg-rose-500/20", text: "text-rose-400", border: "border-rose-400/30" },
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
      guaranteedRarity: formData.guaranteedRarity || undefined,
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
        guaranteedRarity: formData.guaranteedRarity || undefined,
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
          onClick={() => {
            resetForm();
            setIsAddDialogOpen(true);
          }}
          className="bg-amber-400/20 text-amber-400 hover:bg-amber-400/30"
          size="sm"
        >
          <Plus className="mr-2 h-4 w-4" />
          Create Pack
        </Button>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative">
            <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
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
              className="text-muted-foreground cursor-pointer text-sm"
            >
              Show inactive
            </label>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {[
          { label: "Total Packs", value: stats.total, icon: Package, color: "text-blue-400" },
          { label: "Active", value: stats.active, icon: Star, color: "text-green-400" },
          {
            label: "Avg Price",
            value: `${stats.avgPrice} IxC`,
            icon: Coins,
            color: "text-amber-400",
          },
          { label: "Total Cards", value: stats.totalCards, icon: Layers, color: "text-purple-400" },
        ].map((s) => (
          <Card key={s.label} className="glass-hierarchy-child p-4">
            <div className="flex items-center gap-2">
              <s.icon className={`h-4 w-4 ${s.color}`} />
              <p className="text-muted-foreground text-sm">{s.label}</p>
            </div>
            <p className="text-foreground mt-1 text-2xl font-bold">{s.value}</p>
          </Card>
        ))}
      </div>

      {/* Pack Grid */}
      {isLoading ? (
        <div className="py-12 text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-amber-400" />
          <p className="text-muted-foreground">Loading packs...</p>
        </div>
      ) : filteredPacks.length === 0 ? (
        <Card className="glass-hierarchy-parent p-12 text-center">
          <Package className="text-muted-foreground/40 mx-auto mb-3 h-10 w-10" />
          <p className="text-muted-foreground">No packs found</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredPacks.map((pack) => {
            const colors = PACK_TYPE_COLORS[pack.packType] ?? PACK_TYPE_COLORS.BASIC!;
            return (
              <Card
                key={pack.id}
                className={`glass-hierarchy-child border p-4 transition-all hover:border-amber-400/50 ${!pack.isActive ? "opacity-60" : ""} ${colors.border}`}
              >
                <div className="mb-3 flex items-start justify-between">
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    {pack.artwork ? (
                      <img
                        src={pack.artwork}
                        alt={pack.name}
                        className="border-border h-10 w-10 shrink-0 rounded-lg border object-cover"
                      />
                    ) : (
                      <PackHolographicCover
                        packType={pack.packType}
                        guaranteedRarity={pack.guaranteedRarity}
                        size="sm"
                        className="!h-10 w-10 shrink-0 rounded-lg"
                      />
                    )}
                    <div className="min-w-0">
                      <h3 className="text-foreground line-clamp-1 font-semibold">{pack.name}</h3>
                      <Badge className={`${colors.bg} ${colors.text} text-[10px]`}>
                        {pack.packType}
                      </Badge>
                    </div>
                  </div>
                  {!pack.isActive && <EyeOff className="h-4 w-4 text-red-400" />}
                </div>

                {pack.description && (
                  <p className="text-muted-foreground mb-3 line-clamp-2 text-xs">
                    {pack.description}
                  </p>
                )}

                <div className="mb-4 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Price</span>
                    <span className="font-semibold text-amber-400">
                      {pack.priceCredits.toLocaleString()} IxC
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Cards</span>
                    <span className="text-foreground font-medium">{pack.cardCount}</span>
                  </div>
                  {pack.guaranteedRarity && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Guaranteed</span>
                      <span className="font-medium text-purple-400">{pack.guaranteedRarity}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Status</span>
                    <Badge
                      variant="outline"
                      className={
                        pack.isActive
                          ? "border-green-400/30 text-green-400"
                          : "border-red-400/30 text-red-400"
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
                    className="flex-1 text-xs"
                  >
                    <Pencil className="mr-1 h-3 w-3" />
                    Edit
                  </Button>
                  {pack.isActive && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDeactivate(pack)}
                      className="text-xs text-red-400 hover:text-red-300"
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
              <label className="text-foreground mb-1.5 block text-sm font-medium">Name *</label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Legendary Starter Pack"
              />
            </div>

            <div>
              <label className="text-foreground mb-1.5 block text-sm font-medium">
                Description
              </label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Brief description of the pack..."
                rows={2}
              />
            </div>

            <div>
              <label className="text-foreground mb-1.5 block text-sm font-medium">
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
                    className="border-border h-12 w-12 rounded-lg border object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                  <span className="text-muted-foreground text-xs">Preview</span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-foreground mb-1.5 block text-sm font-medium">
                  Pack Type *
                </label>
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
                <label className="text-foreground mb-1.5 block text-sm font-medium">
                  Price (IxC) *
                </label>
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
                <label className="text-foreground mb-1.5 block text-sm font-medium">
                  Card Count
                </label>
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
                <label className="text-foreground mb-1.5 block text-sm font-medium">
                  Guaranteed Rarity
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
                      <SelectItem key={r.value || "none"} value={r.value || "none"}>
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
              <label htmlFor="packIsActiveEdit" className="text-foreground cursor-pointer text-sm">
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
              onClick={editingPack ? handleUpdate : handleCreate}
              disabled={
                !formData.name ||
                formData.priceCredits <= 0 ||
                createMutation.isPending ||
                updateMutation.isPending
              }
              className="bg-amber-400/20 text-amber-400 hover:bg-amber-400/30"
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
