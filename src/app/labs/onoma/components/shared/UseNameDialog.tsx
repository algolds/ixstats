"use client";

// src/app/labs/onoma/components/shared/UseNameDialog.tsx
// Onoma Lab — Dialog to handle "Use This Name" redirects

import { X, ArrowRight, MapPin, Shield, BookOpen, Crown, Compass, Anchor } from "lucide-react";
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
      <FacetModal className="relative w-full max-w-md border border-border/40 p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Dialog Header */}
        <div className="mb-5">
          <span className="text-[10px] font-bold text-cyan-600 dark:text-cyan-400 uppercase tracking-widest">
            Deploy Entity Name
          </span>
          <h3 className="text-lg font-black text-foreground mt-1 select-all">
            {name}
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            Deploy this generated name to one of the following creation forms:
          </p>
        </div>

        {/* Action Options */}
        <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
          {targets.map((target, idx) => {
            const Icon = target.icon;
            return (
              <button
                key={idx}
                onClick={() => handleSelect(target.href)}
                className="group w-full flex items-start gap-3 rounded-xl border border-border/40 bg-secondary/15 dark:bg-slate-900/30 p-3 text-left hover:border-cyan-500/30 hover:bg-secondary/30 dark:hover:bg-slate-900/50 transition-all duration-300"
              >
                <div className="rounded-lg bg-cyan-500/10 p-2 text-cyan-600 dark:text-cyan-400 group-hover:bg-cyan-500/20 transition-all">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-foreground group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors">
                      {target.label}
                    </span>
                    <ArrowRight className="h-4 w-4 text-muted-foreground/60 group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transform group-hover:translate-x-1 transition-all" />
                  </div>
                  <p className="text-xs leading-normal text-muted-foreground">
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
