"use client";

import { useState } from "react";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "~/components/ui/sheet";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Separator } from "~/components/ui/separator";
import { City as Building2, MapPin, User } from "iconoir-react";
import { CountrySearchSelect } from "./CountrySearchSelect";
import { Card } from "~/components/ui/card";

interface EmbassyCreatorSheetProps {
  countryId: string;
  countryName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
}

export function EmbassyCreatorSheet({
  countryId,
  countryName,
  open,
  onOpenChange,
  onCreated,
}: EmbassyCreatorSheetProps) {
  const notify = useNotify();
  const [hostCountryId, setHostCountryId] = useState("");
  const [hostCountryName, setHostCountryName] = useState("");
  const [embassyName, setEmbassyName] = useState("");
  const [location, setLocation] = useState("");
  const [ambassadorName, setAmbassadorName] = useState("");

  const resetForm = () => {
    setHostCountryId("");
    setHostCountryName("");
    setEmbassyName("");
    setLocation("");
    setAmbassadorName("");
  };

  const handleCountrySelect = (id: string, name: string) => {
    setHostCountryId(id);
    setHostCountryName(name);
    setEmbassyName(`${countryName} Embassy to ${name}`);
  };

  const establishEmbassy = api.diplomaticEmbassies.establishEmbassy.useMutation({
    onSuccess: () => {
      notify.success(
        "Embassy established!",
        `${embassyName} is now operational in ${hostCountryName}`
      );
      onOpenChange(false);
      resetForm();
      onCreated?.();
    },
    onError: (error) => {
      notify.error("Failed to establish embassy", error.message);
    },
  });

  const handleSubmit = () => {
    if (!hostCountryId) {
      notify.error("Please select a host country");
      return;
    }
    if (!embassyName.trim()) {
      notify.error("Embassy name is required");
      return;
    }

    establishEmbassy.mutate({
      hostCountryId,
      guestCountryId: countryId,
      name: embassyName,
      location: location || undefined,
      ambassadorName: ambassadorName || undefined,
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex flex-col gap-0 overflow-hidden p-0">
        <SheetHeader className="px-6 pt-6 pb-0">
          <SheetTitle className="flex items-center gap-2">
            <Building2 className="text-label-secondary h-5 w-5 shrink-0" />
            Establish new embassy
          </SheetTitle>
          <p className="text-label-secondary text-body">
            Establish diplomatic presence in another nation.
          </p>
        </SheetHeader>

        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
          <div>
            <Label className="text-caption mb-2 block">Host country</Label>
            <CountrySearchSelect
              value={hostCountryId}
              onSelect={handleCountrySelect}
              excludeIds={[countryId]}
              label="Host country"
            />
            {hostCountryId && (
              <p className="text-label-secondary text-body mt-2">
                Selected: <span className="text-label font-semibold">{hostCountryName}</span>
              </p>
            )}
          </div>

          <Separator />

          <div>
            <Label htmlFor="embassy-name" className="text-caption mb-2 block">
              Embassy name <span className="text-destructive">*</span>
            </Label>
            <div className="relative">
              <Building2 className="text-label-secondary absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
              <Input
                id="embassy-name"
                maxLength={120}
                value={embassyName}
                onChange={(e) => setEmbassyName(e.target.value)}
                placeholder="e.g., Embassy of [Country] in [Host]"
                className="pl-10"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="embassy-location" className="text-caption mb-2 block">
              Location (optional)
            </Label>
            <div className="relative">
              <MapPin className="text-label-secondary absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
              <Input
                id="embassy-location"
                maxLength={120}
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g., Capital City, Downtown District"
                className="pl-10"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="embassy-ambassador" className="text-caption mb-2 block">
              Ambassador (optional)
            </Label>
            <div className="relative">
              <User className="text-label-secondary absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
              <Input
                id="embassy-ambassador"
                maxLength={120}
                value={ambassadorName}
                onChange={(e) => setAmbassadorName(e.target.value)}
                placeholder="e.g., Ambassador John Smith"
                className="pl-10"
              />
            </div>
          </div>

          <Card variant="well" padding="none" className="text-label-secondary text-footnote p-2">
            The embassy opens at once and starts formal relations with the host. Both countries are
            notified, and the host can view your embassy details.
          </Card>
        </div>

        <SheetFooter className="border-separator border-t px-6 py-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              onOpenChange(false);
              resetForm();
            }}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            className="gap-2"
            onClick={handleSubmit}
            disabled={!hostCountryId || !embassyName.trim() || establishEmbassy.isPending}
          >
            <Building2 className="h-3 w-3" />
            {establishEmbassy.isPending ? "Establishing…" : "Establish embassy"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
