"use client";

// src/app/labs/onoma/components/shared/UseNameDialog.tsx
// Onoma Lab — Dialog to handle "Use This Name" redirects

import {
  Xmark as X,
  ArrowRight,
  MapPin,
  Shield,
  OpenBook as BookOpen,
  Crown,
  Compass,
  SeaWaves as Anchor,
} from "iconoir-react";
import { useRouter } from "next/navigation";
import { withBasePath } from "~/lib/base-path";
import type { NameCategory } from "~/lib/onoma/types";
import { FacetModal } from "~/components/ui/facet-container";

interface UseNameDialogProps {
  isOpen: boolean;
  onClose: () => void;
  name: string;
  category: NameCategory;
}

export function UseNameDialog({ isOpen, onClose, name, category }: UseNameDialogProps) {
  const router = useRouter();

  if (!isOpen) return null;

  interface TargetOption {
    label: string;
    description: string;
    icon: any;
    href: string;
  }

  const getTargetOptions = (): TargetOption[] => {
    switch (category) {
      case "city":
        return [
          {
            label: "Found a New City",
            description: "Add this city to your country's geography in the Map Editor.",
            icon: MapPin,
            href: `/mycountry?section=map-editor&action=add-city&name=${encodeURIComponent(name)}`,
          },
        ];
      case "province":
        return [
          {
            label: "Establish a Subdivision",
            description: "Create a new province or federal state in the Map Editor.",
            icon: MapPin,
            href: `/mycountry?section=map-editor&action=add-subdivision&name=${encodeURIComponent(name)}`,
          },
        ];
      case "military":
        return [
          {
            label: "Commission Military Unit",
            description: "Form a new military brigade, battalion, or division.",
            icon: Shield,
            href: `/mycountry/defense?action=add-unit&name=${encodeURIComponent(name)}`,
          },
        ];
      case "organization":
        return [
          {
            label: "Create Wiki Organization Page",
            description: "Write a WikiOS page documenting this guild, order, or institute.",
            icon: BookOpen,
            href: `/wiki?action=create-page&type=company&title=${encodeURIComponent(name)}`,
          },
        ];
      case "person":
        return [
          {
            label: "Create Wiki Character Page",
            description: "Document this historical figure or leader in WikiOS.",
            icon: BookOpen,
            href: `/wiki?action=create-page&type=person&title=${encodeURIComponent(name)}`,
          },
        ];
      case "country":
        return [
          {
            label: "Found New Country",
            description: "Start a new nation builder draft with this name.",
            icon: Crown,
            href: `/builder?name=${encodeURIComponent(name)}`,
          },
        ];
      case "geography":
        return [
          {
            label: "Add Geographic Landmark",
            description: "Place a Point of Interest (mountain, river, lake) on the map.",
            icon: Compass,
            href: `/mycountry?section=map-editor&action=add-poi&name=${encodeURIComponent(name)}`,
          },
        ];
      case "ship":
        return [
          {
            label: "Commission Naval Ship",
            description: "Construct a new naval vessel or military asset.",
            icon: Anchor,
            href: `/mycountry/defense?action=add-asset&name=${encodeURIComponent(name)}`,
          },
        ];
      default:
        return [
          {
            label: "Write Lore Page",
            description: "Create a generic WikiOS lore page for this name.",
            icon: BookOpen,
            href: `/wiki?action=create-page&type=blank&title=${encodeURIComponent(name)}`,
          },
        ];
    }
  };

  const targets = getTargetOptions();

  const handleSelect = (href: string) => {
    onClose();
    router.push(withBasePath(href));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <FacetModal className="border-border/40 animate-in fade-in zoom-in-95 relative w-full max-w-md border p-6 shadow-2xl duration-200">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground absolute top-4 right-4 transition-colors"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Dialog Header */}
        <div className="mb-5">
          <span className="text-[10px] font-bold tracking-widest text-cyan-600 uppercase dark:text-cyan-400">
            Deploy Entity Name
          </span>
          <h3 className="text-foreground mt-1 text-lg font-black select-all">{name}</h3>
          <p className="text-muted-foreground mt-1 text-xs">
            Deploy this generated name to one of the following creation forms:
          </p>
        </div>

        {/* Action Options */}
        <div className="max-h-96 space-y-2.5 overflow-y-auto pr-1">
          {targets.map((target, idx) => {
            const Icon = target.icon;
            return (
              <button
                key={idx}
                onClick={() => handleSelect(target.href)}
                className="group border-border/40 bg-secondary/15 hover:bg-secondary/30 flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-all duration-300 hover:border-cyan-500/30 dark:bg-slate-900/30 dark:hover:bg-slate-900/50"
              >
                <div className="rounded-lg bg-cyan-500/10 p-2 text-cyan-600 transition-all group-hover:bg-cyan-500/20 dark:text-cyan-400">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-foreground text-xs font-bold transition-colors group-hover:text-cyan-600 dark:group-hover:text-cyan-400">
                      {target.label}
                    </span>
                    <ArrowRight className="text-muted-foreground/60 h-4 w-4 transform transition-all group-hover:translate-x-1 group-hover:text-cyan-600 dark:group-hover:text-cyan-400" />
                  </div>
                  <p className="text-muted-foreground text-xs leading-normal">
                    {target.description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </FacetModal>
    </div>
  );
}

export default UseNameDialog;
