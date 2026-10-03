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
import {
  NavArrowDown as ChevronDown,
  Plus,
  EditPencil as Edit2,
  ClockRotateRight as History,
  Sparks as Sparkles,
  SystemRestart as Loader2,
  SwitchOff as ToggleLeft,
  SwitchOn as ToggleRight,
} from "iconoir-react";
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
      LEGENDARY: "border-yellow/20 bg-yellow/5 text-yellow",
      EPIC: "border-purple/20 bg-purple/5 text-purple",
      RARE: "border-blue/20 bg-blue/5 text-blue",
      COMMON: "border-separator bg-fill-3 text-label-secondary",
    };
    return map[quality] || map.COMMON;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-label text-title-3">Store inventory</h3>
          <p className="text-label-secondary text-footnote">
            Manage active shop cosmetics and dynamic system account upgrades.
          </p>
        </div>
        <Button onClick={handleOpenCreate} size="sm">
          <Plus className="mr-2 h-4 w-4" /> Create item
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="rounded-control h-12 w-full" />
          ))}
        </div>
      ) : !items || items.length === 0 ? (
        <div className="text-label-secondary border-separator bg-surface rounded-row border py-12 text-center">
          No items found in the database. Seeding standard items...
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12 text-center">Icon</TableHead>
              <TableHead>Item details</TableHead>
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
                <TableRow key={item.id}>
                  <TableCell className="text-center">
                    <div className="border-separator rounded-control bg-fill-4 text-label inline-flex border p-2">
                      <IconComponent className="text-yellow h-5 w-5" />
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-label font-semibold">{item.name}</div>
                    <div className="text-label-secondary text-footnote max-w-sm truncate">
                      {item.description || "No description provided."}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="default" className="capitalize">
                      {item.category}
                    </Badge>
                  </TableCell>
                  <TableCell className="space-y-1">
                    <div className="flex gap-2">
                      <Badge
                        variant="outline"
                        className={`text-eyebrow px-2 py-0 ${getQualityBadge(item.quality)}`}
                      >
                        {item.quality}
                      </Badge>
                      {item.badgeText && (
                        <Badge
                          variant="outline"
                          className="bg-fill-3 text-label-secondary border-separator px-2 py-0"
                        >
                          {item.badgeText}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-yellow text-right font-semibold tabular-nums">
                    {item.price.toLocaleString()} IxC
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge
                      variant={item.isActive ? "secondary" : "default"}
                      className={`text-footnote ${
                        item.isActive
                          ? "border-green/20 bg-green/10 text-green hover:bg-green/15"
                          : "border-separator bg-fill-3 text-label-secondary hover:bg-fill-4"
                      }`}
                    >
                      {item.isActive ? "Active" : "Disabled"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-2">
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={() => handleOpenEdit(item)}
                        className="w-8"
                        title="Edit item"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={() => handleOpenHistory(item.id)}
                        className="w-8"
                        title="Price history ledger"
                      >
                        <History className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={() => handleToggleActive(item)}
                        className={`h-8 w-8 border-none ${
                          item.isActive
                            ? "text-green hover:text-green"
                            : "text-label-secondary hover:text-label-secondary"
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
      )}

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingItem ? `Edit Store Item: ${editingItem.name}` : "Create Store Item"}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSave} className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="item-name">Item name</Label>
                <Input
                  id="item-name"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Neon Profile Border"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="item-category">Category</Label>
                <Select
                  value={formData.category}
                  onValueChange={(val) => setFormData({ ...formData, category: val })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cosmetics">Cosmetics</SelectItem>
                    <SelectItem value="upgrades">Upgrades</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="item-desc">Description</Label>
              <Textarea
                id="item-desc"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Details of custom upgrades, tokens or glowing effects..."
                className="min-h-16 resize-none"
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="item-price">Price (IxC)</Label>
                <Input
                  id="item-price"
                  type="number"
                  min={0}
                  required
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })}
                  className="font-mono"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="item-quality">Quality</Label>
                <Select
                  value={formData.quality}
                  onValueChange={(val) => setFormData({ ...formData, quality: val })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select quality" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="COMMON">Common</SelectItem>
                    <SelectItem value="RARE">Rare</SelectItem>
                    <SelectItem value="EPIC">Epic</SelectItem>
                    <SelectItem value="LEGENDARY">Legendary</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="item-badge">Badge label</Label>
                <Input
                  id="item-badge"
                  value={formData.badgeText}
                  onChange={(e) => setFormData({ ...formData, badgeText: e.target.value })}
                  placeholder="e.g. Card Border"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="item-icon">Icon select</Label>
                <Popover open={isIconPopoverOpen} onOpenChange={setIsIconPopoverOpen}>
                  <PopoverTrigger
                    id="item-icon"
                    className="bg-background border-separator text-label hover:bg-fill-4 rounded-control text-body flex h-9 w-full cursor-pointer items-center justify-between gap-2 border px-3 py-2 font-normal transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      {(() => {
                        const IconComponent = ICON_MAP[formData.icon] || Sparkles;
                        return <IconComponent className="text-yellow h-4 w-4 shrink-0" />;
                      })()}
                      <span>{formData.icon}</span>
                    </div>
                    <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
                  </PopoverTrigger>
                  <PopoverContent className="w-72 p-3">
                    <div className="space-y-3">
                      <Input
                        placeholder="Search icons..."
                        value={iconSearch}
                        onChange={(e) => setIconSearch(e.target.value)}
                        className="rounded-control-sm md:text-footnote h-(--control-height-sm)"
                        autoFocus
                      />
                      <div className="thin-scrollbar grid max-h-48 [scrollbar-width:thin] grid-cols-5 gap-2 overflow-y-auto pr-1">
                        {Object.keys(ICON_MAP)
                          .filter((name) => name.toLowerCase().includes(iconSearch.toLowerCase()))
                          .map((iconName) => {
                            const IconComponent = ICON_MAP[iconName] || Sparkles;
                            const isSelected = formData.icon === iconName;
                            return (
                              <Button
                                key={iconName}
                                type="button"
                                variant="secondary"
                                size="icon"
                                title={iconName}
                                aria-label={iconName}
                                aria-pressed={isSelected}
                                onClick={() => {
                                  setFormData({ ...formData, icon: iconName });
                                  setIsIconPopoverOpen(false);
                                  setIconSearch("");
                                }}
                                className={cn(
                                  "text-label",
                                  isSelected &&
                                    "bg-yellow/15 text-yellow-ink ring-yellow/50 hover:bg-yellow/20 ring-1"
                                )}
                              >
                                <IconComponent aria-hidden />
                              </Button>
                            );
                          })}
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label htmlFor="item-glow">Glow Color CSS</Label>
                <ColorPickerInput
                  value={formData.glowColor}
                  onChange={(val) => setFormData({ ...formData, glowColor: val })}
                />
              </div>
            </div>

            {/* Effects editor — defines what the item actually does */}
            <div className="border-separator bg-fill-4 rounded-control space-y-3 border p-3">
              <Label className="text-label-secondary text-subhead">
                {formData.category === "upgrades" ? "Upgrade Perks" : "Cosmetic Effect"}
              </Label>

              {formData.category === "upgrades" ? (
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
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
                      className="font-mono"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="fx-cards">Card Capacity (+)</Label>
                    <Input
                      id="fx-cards"
                      type="number"
                      min={0}
                      value={formData.cardCapacity}
                      onChange={(e) =>
                        setFormData({ ...formData, cardCapacity: Number(e.target.value) })
                      }
                      className="font-mono"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="fx-lore">Lore Tokens (+)</Label>
                    <Input
                      id="fx-lore"
                      type="number"
                      min={0}
                      value={formData.loreTokens}
                      onChange={(e) =>
                        setFormData({ ...formData, loreTokens: Number(e.target.value) })
                      }
                      className="font-mono"
                    />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="fx-kind">Effect type</Label>
                    <Select
                      value={formData.cosmeticKind}
                      onValueChange={(val) =>
                        setFormData({
                          ...formData,
                          cosmeticKind: val as typeof formData.cosmeticKind,
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="avatarGlow">Avatar glow</SelectItem>
                        <SelectItem value="neonFrame">Neon frame</SelectItem>
                        <SelectItem value="chatBadge">Chat badge</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="fx-color">Effect color</Label>
                    <ColorPickerInput
                      value={formData.effectColor}
                      onChange={(val) => setFormData({ ...formData, effectColor: val })}
                    />
                  </div>
                  {formData.cosmeticKind === "chatBadge" && (
                    <div className="space-y-2">
                      <Label htmlFor="fx-badge-icon">Badge icon</Label>
                      <Input
                        id="fx-badge-icon"
                        value={formData.effectIcon}
                        onChange={(e) => setFormData({ ...formData, effectIcon: e.target.value })}
                        placeholder="e.g. Crown"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            <DialogFooter className="border-separator mt-6 border-t pt-4">
              <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                {createMutation.isPending || updateMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...
                  </>
                ) : (
                  "Save Item"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="text-yellow h-5 w-5" />
              Price history ledger
            </DialogTitle>
          </DialogHeader>

          <div className="py-2">
            {isHistoryLoading ? (
              <div className="space-y-2 py-4">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="rounded-control-sm h-10 w-full" />
                ))}
              </div>
            ) : !priceHistory || priceHistory.length === 0 ? (
              <p className="text-label-secondary text-footnote py-6 text-center">
                No pricing edits have been recorded for this item.
              </p>
            ) : (
              <Table containerClassName="max-h-60">
                <TableHeader sticky>
                  <TableRow>
                    <TableHead>Changed date</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                    <TableHead className="text-right">Admin</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {priceHistory.map((hist: any) => (
                    <TableRow key={hist.id}>
                      <TableCell className="text-label-secondary text-footnote">
                        {new Date(hist.changedAt).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-caption text-yellow text-right tabular-nums">
                        {hist.price.toLocaleString()} IxC
                      </TableCell>
                      <TableCell className="text-label-secondary text-footnote max-w-[100px] truncate text-right">
                        {hist.adminId.substring(0, 8)}...
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
          <DialogFooter className="border-separator mt-4 border-t pt-2">
            <Button onClick={() => setIsHistoryOpen(false)} variant="secondary">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
