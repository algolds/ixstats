"use client";

// src/app/labs/onoma/components/shared/UseNameDialog.tsx
// Onoma Lab — Dialog to handle "Use This Name" redirects

import {
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Eyebrow } from "~/components/ui/eyebrow";
import { FacetList, FacetListSection, FacetRow } from "~/components/ui/facet-list";

interface UseNameDialogProps {
  isOpen: boolean;
  onClose: () => void;
  name: string;
  category: NameCategory;
}

export function UseNameDialog({ isOpen, onClose, name, category }: UseNameDialogProps) {
  const router = useRouter();

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
            label: "Found a new city",
            description: "Add this city to your country's geography in the Map Editor.",
            icon: MapPin,
            href: `/mycountry?section=map-editor&action=add-city&name=${encodeURIComponent(name)}`,
          },
        ];
      case "province":
        return [
          {
            label: "Establish a subdivision",
            description: "Create a new province or federal state in the Map Editor.",
            icon: MapPin,
            href: `/mycountry?section=map-editor&action=add-subdivision&name=${encodeURIComponent(name)}`,
          },
        ];
      case "military":
        return [
          {
            label: "Commission military unit",
            description: "Form a new military brigade, battalion, or division.",
            icon: Shield,
            href: `/mycountry/defense?action=add-unit&name=${encodeURIComponent(name)}`,
          },
        ];
      case "organization":
        return [
          {
            label: "Create wiki organization page",
            description: "Write a WikiOS page documenting this guild, order, or institute.",
            icon: BookOpen,
            href: `/wiki?action=create-page&type=company&title=${encodeURIComponent(name)}`,
          },
        ];
      case "person":
        return [
          {
            label: "Create wiki character page",
            description: "Document this historical figure or leader in WikiOS.",
            icon: BookOpen,
            href: `/wiki?action=create-page&type=person&title=${encodeURIComponent(name)}`,
          },
        ];
      case "country":
        return [
          {
            label: "Found new country",
            description: "Start a new nation builder draft with this name.",
            icon: Crown,
            href: `/builder?name=${encodeURIComponent(name)}`,
          },
        ];
      case "geography":
        return [
          {
            label: "Add geographic landmark",
            description: "Place a Point of Interest (mountain, river, lake) on the map.",
            icon: Compass,
            href: `/mycountry?section=map-editor&action=add-poi&name=${encodeURIComponent(name)}`,
          },
        ];
      case "ship":
        return [
          {
            label: "Commission naval ship",
            description: "Construct a new naval vessel or military asset.",
            icon: Anchor,
            href: `/mycountry/defense?action=add-asset&name=${encodeURIComponent(name)}`,
          },
        ];
      default:
        return [
          {
            label: "Write lore page",
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
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <Eyebrow>Deploy entity name</Eyebrow>
          <DialogTitle className="text-title-3 select-all">{name}</DialogTitle>
          <DialogDescription>
            Deploy this generated name to one of the following creation forms:
          </DialogDescription>
        </DialogHeader>

        <FacetList className="max-h-96 overflow-y-auto">
          <FacetListSection>
            {targets.map((target) => {
              const Icon = target.icon;
              return (
                <FacetRow
                  key={target.href}
                  leading={
                    <span className="bg-tint-fill text-tint rounded-control-sm flex size-8 items-center justify-center">
                      <Icon className="size-4" />
                    </span>
                  }
                  title={target.label}
                  subtitle={target.description}
                  trailing={<ArrowRight className="text-label-tertiary size-4" />}
                  accessory="none"
                  onClick={() => handleSelect(target.href)}
                />
              );
            })}
          </FacetListSection>
        </FacetList>
      </DialogContent>
    </Dialog>
  );
}

export default UseNameDialog;
