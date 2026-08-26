"use client";

import React, { useState } from "react";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Badge } from "~/components/ui/badge";
import { Textarea } from "~/components/ui/textarea";
import { Skeleton } from "~/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "~/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { ColorPickerInput } from "~/components/ui/color-picker";
import { cn } from "~/lib/utils";
import { Popover, PopoverTrigger, PopoverContent } from "~/components/ui/popover";
import { NavArrowDown as ChevronDown, Plus, EditPencil as Edit2, ClockRotateRight as History, Sparks as Sparkles, Database, Shield, Coins, Dashboard as Gauge, SystemRestart as Loader2, SwitchOff as ToggleLeft, SwitchOn as ToggleRight } from "iconoir-react";
import { ICON_MAP } from "~/components/vault/sections/marketplace/VaultStoreTab";

export function VaultStoreControl() {
  const notify = useNotify();
  const utils = api.useUtils();

  // Queries
  const { data: items, isLoading, refetch: _refetch } = api.vault.adminListStoreItemsAll.useQuery();

  // Dialog States
  const [isOpen, setIsOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any | null>(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [iconSearch, setIconSearch] = useState("");
  const [isIconPopoverOpen, setIsIconPopoverOpen] = useState(false);

  // Form Fields
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    price: 0,
    icon: "Sparkles",
    glowColor: "rgba(245,158,11,0.35)",
    quality: "COMMON",
    badgeText: "Upgrade",
    category: "cosmetics",
    isActive: true,
    // Effects — what the item actually does once owned/equipped.
    cosmeticKind: "avatarGlow" as "avatarGlow" | "neonFrame" | "chatBadge",
    effectColor: "#f59e0b",
    effectIcon: "Crown",
    yieldBoostPct: 0, // % bonus to passive income
    cardCapacity: 0, // extra card slots
    loreTokens: 0, // extra lore tokens
  });

  // Price History Query
  const { data: priceHistory, isLoading: isHistoryLoading } =
    api.vault.adminGetPriceHistory.useQuery(
      { itemId: selectedItemId || "" },
      { enabled: !!selectedItemId }
    );

  // Mutations
  const createMutation = api.vault.adminCreateStoreItem.useMutation({
    onSuccess: () => {
      notify.success("Success", "Store item created successfully");
      setIsOpen(false);
      resetForm();
      void utils.vault.adminListStoreItemsAll.invalidate();
      void utils.vault.listStoreItems.invalidate();
    },
    onError: (err) => notify.error("Creation Failed", err.message),
  });

  const updateMutation = api.vault.adminUpdateStoreItem.useMutation({
    onSuccess: () => {
      notify.success("Success", "Store item updated successfully");
      setIsOpen(false);
      resetForm();
      void utils.vault.adminListStoreItemsAll.invalidate();
      void utils.vault.listStoreItems.invalidate();
    },
    onError: (err) => notify.error("Update Failed", err.message),
  });

  const deleteMutation = api.vault.adminDeleteStoreItem.useMutation({
    onSuccess: () => {
      notify.success("Success", "Store item toggled successfully");
      void utils.vault.adminListStoreItemsAll.invalidate();
      void utils.vault.listStoreItems.invalidate();
    },
    onError: (err) => notify.error("Toggle Failed", err.message),
  });

  // Resets
  const resetForm = () => {
    setEditingItem(null);
    setFormData({
      name: "",
      description: "",
      price: 0,
      icon: "Sparkles",
      glowColor: "rgba(245,158,11,0.35)",
      quality: "COMMON",
      badgeText: "Upgrade",
      category: "cosmetics",
      isActive: true,
      cosmeticKind: "avatarGlow",
      effectColor: "#f59e0b",
      effectIcon: "Crown",
      yieldBoostPct: 0,
      cardCapacity: 0,
      loreTokens: 0,
    });
  };

  const handleOpenCreate = () => {
    resetForm();
    setIsOpen(true);
  };

  const handleOpenEdit = (item: any) => {
    setEditingItem(item);
    const effects = (item.effects ?? {}) as any;
    const cust = effects.customizations ?? {};
    const perks = effects.perks ?? {};
    const cosmeticKind: "avatarGlow" | "neonFrame" | "chatBadge" = cust.chatBadge
      ? "chatBadge"
      : cust.neonFrame
        ? "neonFrame"
        : "avatarGlow";
    const activeCust = cust[cosmeticKind] ?? {};
    setFormData({
      name: item.name,
      description: item.description || "",
      price: item.price,
      icon: item.icon,
      glowColor: item.glowColor || "rgba(245,158,11,0.35)",
      quality: item.quality,
      badgeText: item.badgeText || "",
      category: item.category,
      isActive: item.isActive,
      cosmeticKind,
      effectColor: activeCust.color || "#f59e0b",
      effectIcon: activeCust.icon || "Crown",
      yieldBoostPct: typeof perks.yieldBoost === "number" ? Math.round(perks.yieldBoost * 100) : 0,
      cardCapacity: typeof perks.cardCapacity === "number" ? perks.cardCapacity : 0,
      loreTokens: typeof perks.loreTokens === "number" ? perks.loreTokens : 0,
    });
    setIsOpen(true);
  };

  // Assemble the effects JSON the rest of the app reads (useActiveCosmetics for
  // rendering, vault-service getPurchasedItemsEffects for perks/yield).
  const buildEffects = (): Record<string, any> | undefined => {
    if (formData.category === "upgrades") {
      const perks: Record<string, number> = {};
      if (formData.yieldBoostPct) perks.yieldBoost = formData.yieldBoostPct / 100;
      if (formData.cardCapacity) perks.cardCapacity = formData.cardCapacity;
      if (formData.loreTokens) perks.loreTokens = formData.loreTokens;
      return Object.keys(perks).length ? { perks } : undefined;
    }
    const customizations: Record<string, any> = {};
    if (formData.cosmeticKind === "avatarGlow") {
      customizations.avatarGlow = {
        enabled: true,
        color: formData.effectColor,
        intensity: "15px",
      };
    } else if (formData.cosmeticKind === "neonFrame") {
      customizations.neonFrame = { enabled: true, color: formData.effectColor, style: "pulse" };
    } else if (formData.cosmeticKind === "chatBadge") {
      customizations.chatBadge = {
        enabled: true,
        icon: formData.effectIcon,
        color: formData.effectColor,
      };
    }
    return Object.keys(customizations).length ? { customizations } : undefined;
  };

  const handleOpenHistory = (itemId: string) => {
    setSelectedItemId(itemId);
    setIsHistoryOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const {
      // strip UI-only effect fields; they are folded into `effects`
      cosmeticKind: _ck,
      effectColor: _ec,
      effectIcon: _ei,
      yieldBoostPct: _yb,
      cardCapacity: _cc,
      loreTokens: _lt,
      ...base
    } = formData;
    const payload = { ...base, effects: buildEffects() ?? null };
    if (editingItem) {
      updateMutation.mutate({ id: editingItem.id, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const handleToggleActive = (item: any) => {
    deleteMutation.mutate({
      id: item.id,
      hardDelete: false,
    });
  };

  const getQualityBadge = (quality: string) => {
    const map: Record<string, string> = {
      LEGENDARY: "border-amber-500/20 bg-amber-500/5 text-amber-500",
      EPIC: "border-purple-500/20 bg-purple-500/5 text-purple-500",
      RARE: "border-blue-500/20 bg-blue-500/5 text-blue-500",
      COMMON: "border-slate-500/20 bg-slate-500/5 text-slate-400",
    };
    return map[quality] || map.COMMON;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-foreground text-lg font-bold">Store Inventory</h3>
          <p className="text-muted-foreground text-xs">
            Manage active shop cosmetics and dynamic system account upgrades.
          </p>
        </div>
        <Button
          onClick={handleOpenCreate}
          size="sm"
          className="bg-emerald-600 font-semibold text-white hover:bg-emerald-700"
        >
          <Plus className="mr-1.5 h-4 w-4" /> Create Item
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-lg" />
          ))}
        </div>
      ) : !items || items.length === 0 ? (
        <div className="text-muted-foreground border-border/40 bg-card/20 rounded-xl border py-12 text-center">
          No items found in the database. Seeding standard items...
        </div>
      ) : (
        <div className="border-border/40 bg-card/10 overflow-x-auto rounded-xl border">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead className="w-12 text-center">Icon</TableHead>
                <TableHead>Item Details</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Quality / Badge</TableHead>
                <TableHead className="text-right">Price (IxC)</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-center">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item: any) => {
                const IconComponent = ICON_MAP[item.icon] || Sparkles;
                return (
                  <TableRow key={item.id} className="hover:bg-muted/20 transition-colors">
                    <TableCell className="text-center">
                      <div className="border-border/50 inline-flex rounded-lg border bg-black/20 p-2 text-slate-200">
                        <IconComponent className="h-5 w-5 text-amber-500" />
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-foreground font-semibold">{item.name}</div>
                      <div className="text-muted-foreground max-w-sm truncate text-[10px]">
                        {item.description || "No description provided."}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-[10px] capitalize">
                        {item.category}
                      </Badge>
                    </TableCell>
                    <TableCell className="space-y-1">
                      <div className="flex gap-1.5">
                        <Badge
                          variant="outline"
                          className={`px-1.5 py-0 text-[9px] uppercase ${getQualityBadge(
                            item.quality
                          )}`}
                        >
                          {item.quality}
                        </Badge>
                        {item.badgeText && (
                          <Badge
                            variant="outline"
                            className="bg-slate-550/10 text-muted-foreground border-slate-500/20 px-1.5 py-0 text-[9px]"
                          >
                            {item.badgeText}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono font-bold text-amber-600 dark:text-amber-400">
                      {item.price.toLocaleString()} IxC
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge
                        variant={item.isActive ? "default" : "secondary"}
                        className={`text-[9px] ${
                          item.isActive
                            ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/15"
                            : "border-slate-500/20 bg-slate-500/10 text-slate-400 hover:bg-slate-500/15"
                        }`}
                      >
                        {item.isActive ? "Active" : "Disabled"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <Button
                          size="icon"
                          variant="outline"
                          onClick={() => handleOpenEdit(item)}
                          className="h-8 w-8 text-slate-400 hover:text-white"
                          title="Edit Item"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="outline"
                          onClick={() => handleOpenHistory(item.id)}
                          className="h-8 w-8 text-slate-400 hover:text-white"
                          title="Price History Ledger"
                        >
                          <History className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="outline"
                          onClick={() => handleToggleActive(item)}
                          className={`h-8 w-8 border-none ${
                            item.isActive
                              ? "text-emerald-500 hover:text-emerald-400"
                              : "text-slate-500 hover:text-slate-400"
                          }`}
                          title={item.isActive ? "Disable Item" : "Enable Item"}
                        >
                          {item.isActive ? (
                            <ToggleRight className="h-5 w-5" />
                          ) : (
                            <ToggleLeft className="h-5 w-5" />
                          )}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="border-border/50 bg-popover/98 text-foreground max-w-lg shadow-2xl backdrop-blur-md dark:bg-slate-900/98">
          <DialogHeader>
            <DialogTitle className="text-foreground">
              {editingItem ? `Edit Store Item: ${editingItem.name}` : "Create Store Item"}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSave} className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="item-name">Item Name</Label>
                <Input
                  id="item-name"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Neon Profile Border"
                  className="bg-background border-border/40 text-foreground"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="item-category">Category</Label>
                <Select
                  value={formData.category}
                  onValueChange={(val) => setFormData({ ...formData, category: val })}
                >
                  <SelectTrigger className="bg-background border-border/40 text-foreground">
                    <SelectValue placeholder="Select Category" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border/50 text-foreground">
                    <SelectItem value="cosmetics">Cosmetics</SelectItem>
                    <SelectItem value="upgrades">Upgrades</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="item-desc">Description</Label>
              <Textarea
                id="item-desc"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Details of custom upgrades, tokens or glowing effects..."
                className="bg-background border-border/40 text-foreground min-h-16 resize-none"
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="item-price">Price (IxC)</Label>
                <Input
                  id="item-price"
                  type="number"
                  min={0}
                  required
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })}
                  className="bg-background border-border/40 text-foreground font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="item-quality">Quality</Label>
                <Select
                  value={formData.quality}
                  onValueChange={(val) => setFormData({ ...formData, quality: val })}
                >
                  <SelectTrigger className="bg-background border-border/40 text-foreground">
                    <SelectValue placeholder="Select Quality" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border/50 text-foreground">
                    <SelectItem value="COMMON">Common</SelectItem>
                    <SelectItem value="RARE">Rare</SelectItem>
                    <SelectItem value="EPIC">Epic</SelectItem>
                    <SelectItem value="LEGENDARY">Legendary</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="item-badge">Badge Label</Label>
                <Input
                  id="item-badge"
                  value={formData.badgeText}
                  onChange={(e) => setFormData({ ...formData, badgeText: e.target.value })}
                  placeholder="e.g. Card Border"
                  className="bg-background border-border/40 text-foreground"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="item-icon">Icon Select</Label>
                <Popover open={isIconPopoverOpen} onOpenChange={setIsIconPopoverOpen}>
                  <PopoverTrigger
                    id="item-icon"
                    className="bg-background border-border/40 text-foreground hover:bg-muted/30 flex h-9 w-full cursor-pointer items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm font-normal transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      {(() => {
                        const IconComponent = ICON_MAP[formData.icon] || Sparkles;
                        return (
                          <IconComponent className="text-amber-550 h-4 w-4 shrink-0 dark:text-amber-400" />
                        );
                      })()}
                      <span>{formData.icon}</span>
                    </div>
                    <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
                  </PopoverTrigger>
                  <PopoverContent className="bg-popover border-border/50 text-foreground w-72 p-3">
                    <div className="space-y-3">
                      <Input
                        placeholder="Search icons..."
                        value={iconSearch}
                        onChange={(e) => setIconSearch(e.target.value)}
                        className="bg-background/50 border-border/40 h-8 text-xs"
                        autoFocus
                      />
                      <div className="thin-scrollbar grid max-h-48 [scrollbar-width:thin] grid-cols-5 gap-1.5 overflow-y-auto pr-1">
                        {Object.keys(ICON_MAP)
                          .filter((name) => name.toLowerCase().includes(iconSearch.toLowerCase()))
                          .map((iconName) => {
                            const IconComponent = ICON_MAP[iconName] || Sparkles;
                            const isSelected = formData.icon === iconName;
                            return (
                              <button
                                key={iconName}
                                type="button"
                                title={iconName}
                                onClick={() => {
                                  setFormData({ ...formData, icon: iconName });
                                  setIsIconPopoverOpen(false);
                                  setIconSearch("");
                                }}
                                className={cn(
                                  "border-border/30 text-foreground hover:bg-muted/50 flex h-9 w-9 items-center justify-center rounded-lg border p-0 transition-all duration-150 hover:scale-105",
                                  isSelected
                                    ? "border-amber-500/50 bg-amber-500/15 text-amber-500"
                                    : "bg-background/20"
                                )}
                              >
                                <IconComponent className="h-4 w-4" />
                              </button>
                            );
                          })}
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="item-glow">Glow Color CSS</Label>
                <ColorPickerInput
                  value={formData.glowColor}
                  onChange={(val) => setFormData({ ...formData, glowColor: val })}
                />
              </div>
            </div>

            {/* Effects editor — defines what the item actually does */}
            <div className="border-border/40 bg-muted/20 space-y-3 rounded-lg border p-3">
              <Label className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                {formData.category === "upgrades" ? "Upgrade Perks" : "Cosmetic Effect"}
              </Label>

              {formData.category === "upgrades" ? (
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="fx-yield">Yield Boost (%)</Label>
                    <Input
                      id="fx-yield"
                      type="number"
                      min={0}
                      step={1}
                      value={formData.yieldBoostPct}
                      onChange={(e) =>
                        setFormData({ ...formData, yieldBoostPct: Number(e.target.value) })
                      }
                      className="bg-background border-border/40 text-foreground font-mono"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="fx-cards">Card Capacity (+)</Label>
                    <Input
                      id="fx-cards"
                      type="number"
                      min={0}
                      value={formData.cardCapacity}
                      onChange={(e) =>
                        setFormData({ ...formData, cardCapacity: Number(e.target.value) })
                      }
                      className="bg-background border-border/40 text-foreground font-mono"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="fx-lore">Lore Tokens (+)</Label>
                    <Input
                      id="fx-lore"
                      type="number"
                      min={0}
                      value={formData.loreTokens}
                      onChange={(e) =>
                        setFormData({ ...formData, loreTokens: Number(e.target.value) })
                      }
                      className="bg-background border-border/40 text-foreground font-mono"
                    />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="fx-kind">Effect Type</Label>
                    <Select
                      value={formData.cosmeticKind}
                      onValueChange={(val) =>
                        setFormData({
                          ...formData,
                          cosmeticKind: val as typeof formData.cosmeticKind,
                        })
                      }
                    >
                      <SelectTrigger className="bg-background border-border/40 text-foreground">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-popover border-border/50 text-foreground">
                        <SelectItem value="avatarGlow">Avatar Glow</SelectItem>
                        <SelectItem value="neonFrame">Neon Frame</SelectItem>
                        <SelectItem value="chatBadge">Chat Badge</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="fx-color">Effect Color</Label>
                    <ColorPickerInput
                      value={formData.effectColor}
                      onChange={(val) => setFormData({ ...formData, effectColor: val })}
                    />
                  </div>
                  {formData.cosmeticKind === "chatBadge" && (
                    <div className="space-y-1.5">
                      <Label htmlFor="fx-badge-icon">Badge Icon</Label>
                      <Input
                        id="fx-badge-icon"
                        value={formData.effectIcon}
                        onChange={(e) => setFormData({ ...formData, effectIcon: e.target.value })}
                        placeholder="e.g. Crown"
                        className="bg-background border-border/40 text-foreground"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            <DialogFooter className="border-border/40 mt-6 border-t pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsOpen(false)}
                className="border-border/50 hover:bg-muted text-foreground"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
                className="bg-emerald-600 font-semibold text-white hover:bg-emerald-700"
              >
                {createMutation.isPending || updateMutation.isPending ? (
                  <>
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Saving...
                  </>
                ) : (
                  "Save Item"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Price History Ledger Dialog */}
      <Dialog open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
        <DialogContent className="border-border/50 bg-popover/98 text-foreground max-w-md shadow-2xl backdrop-blur-md dark:bg-slate-900/98">
          <DialogHeader>
            <DialogTitle className="text-foreground flex items-center gap-2">
              <History className="h-5 w-5 text-amber-500" />
              Price History Ledger
            </DialogTitle>
          </DialogHeader>

          <div className="py-2">
            {isHistoryLoading ? (
              <div className="space-y-2 py-4">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full rounded" />
                ))}
              </div>
            ) : !priceHistory || priceHistory.length === 0 ? (
              <p className="text-muted-foreground py-6 text-center text-xs">
                No pricing edits have been recorded for this item.
              </p>
            ) : (
              <div className="border-border/40 bg-muted/20 max-h-60 overflow-hidden overflow-y-auto rounded-lg border">
                <Table>
                  <TableHeader className="bg-muted/40">
                    <TableRow>
                      <TableHead>Changed Date</TableHead>
                      <TableHead className="text-right">Price</TableHead>
                      <TableHead className="text-right">Admin</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {priceHistory.map((hist: any) => (
                      <TableRow key={hist.id}>
                        <TableCell className="text-muted-foreground text-[10px]">
                          {new Date(hist.changedAt).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs font-bold text-amber-500">
                          {hist.price.toLocaleString()} IxC
                        </TableCell>
                        <TableCell className="text-muted-foreground max-w-[100px] truncate text-right text-[10px]">
                          {hist.adminId.substring(0, 8)}...
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
          <DialogFooter className="border-border/40 mt-4 border-t pt-2">
            <Button onClick={() => setIsHistoryOpen(false)} variant="secondary" className="text-xs">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
