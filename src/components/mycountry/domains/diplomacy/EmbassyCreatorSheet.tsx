"use client";

import { useState } from "react";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "~/components/ui/sheet";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Separator } from "~/components/ui/separator";
import { Skeleton } from "~/components/ui/skeleton";
import { Eyebrow } from "~/components/ui/eyebrow";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  City as Building2,
  MapPin,
  User,
  Dollar as DollarSign,
  NavArrowDown as ChevronDown,
} from "iconoir-react";
import { Card } from "~/components/ui/card";

interface EmbassyCreatorSheetProps {
  countryId: string;
  countryName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
}

function CountrySelector({
  onSelect,
  excludeCountryId,
  selectedCountryId,
}: {
  onSelect: (countryId: string, countryName: string) => void;
  excludeCountryId: string;
  selectedCountryId: string;
}) {
  const { data: countriesData } = api.countries.getAll.useQuery(
    { limit: 200, offset: 0 },
    { staleTime: 5 * 60 * 1000 }
  );

  const countries = (countriesData?.countries ?? [])
    .filter((c) => c.id !== excludeCountryId)
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <Select
      value={selectedCountryId || undefined}
      onValueChange={(id) => {
        const country = countries.find((c) => c.id === id);
        if (country) onSelect(country.id, country.name);
      }}
    >
      <SelectTrigger className="w-full" aria-label="Host country">
        <SelectValue placeholder="Select a country…" />
      </SelectTrigger>
      <SelectContent className="max-h-72">
        {countries.map((c) => (
          <SelectItem key={c.id} value={c.id}>
            {c.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
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
  const [showCostBreakdown, setShowCostBreakdown] = useState(false);

  const { data: costData, isLoading: costLoading } =
    api.diplomaticEmbassies.calculateEstablishmentCost.useQuery(
      { hostCountryId, guestCountryId: countryId },
      { enabled: !!hostCountryId }
    );

  const resetForm = () => {
    setHostCountryId("");
    setHostCountryName("");
    setEmbassyName("");
    setLocation("");
    setAmbassadorName("");
    setShowCostBreakdown(false);
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
            <CountrySelector
              onSelect={handleCountrySelect}
              excludeCountryId={countryId}
              selectedCountryId={hostCountryId}
            />
            {hostCountryId && (
              <p className="text-label-secondary text-body mt-2">
                Selected: <span className="text-label font-semibold">{hostCountryName}</span>
              </p>
            )}
          </div>

          <Separator />

          <div>
            <Label className="text-caption mb-2 block">
              Embassy name <span className="text-destructive">*</span>
            </Label>
            <div className="relative">
              <Building2 className="text-label-secondary absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
              <Input
                value={embassyName}
                onChange={(e) => setEmbassyName(e.target.value)}
                placeholder="e.g., Embassy of [Country] in [Host]"
                className="pl-10"
              />
            </div>
          </div>

          <div>
            <Label className="text-caption mb-2 block">Location (Optional)</Label>
            <div className="relative">
              <MapPin className="text-label-secondary absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
              <Input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g., Capital City, Downtown District"
                className="pl-10"
              />
            </div>
          </div>

          <div>
            <Label className="text-caption mb-2 block">Ambassador (Optional)</Label>
            <div className="relative">
              <User className="text-label-secondary absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
              <Input
                value={ambassadorName}
                onChange={(e) => setAmbassadorName(e.target.value)}
                placeholder="e.g., Ambassador John Smith"
                className="pl-10"
              />
            </div>
          </div>

          {hostCountryId && (
            <>
              <Separator />
              <div>
                <Eyebrow className="mb-2 flex items-center gap-2">
                  <DollarSign className="h-3.5 w-3.5" />
                  Establishment cost
                </Eyebrow>
                {costLoading ? (
                  <Skeleton className="rounded-control h-16" aria-label="Calculating cost" />
                ) : costData ? (
                  <Card variant="inset" padding="none" className="p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-body font-medium">Total</span>
                      <span className="text-label text-title-3 tabular-nums">
                        ${costData.totalCost.toLocaleString()}
                      </span>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowCostBreakdown(!showCostBreakdown)}
                      aria-expanded={showCostBreakdown}
                      className="text-label-secondary hover:text-label mt-1 -ml-2"
                    >
                      <ChevronDown
                        className={`h-3 w-3 transition-transform ${showCostBreakdown ? "rotate-180" : ""}`}
                      />
                      {showCostBreakdown ? "Hide" : "Show"} breakdown
                    </Button>
                    {showCostBreakdown && (
                      <div className="border-separator text-label-secondary text-footnote mt-2 space-y-1 border-t pt-2">
                        <div className="flex justify-between">
                          <span>Base cost</span>
                          <span>${costData.baseCost.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Relationship</span>
                          <span>&times;{costData.relationshipMultiplier.toFixed(2)}</span>
                        </div>
                      </div>
                    )}
                    {costData.requirements && (
                      <div className="border-separator text-label-secondary text-footnote mt-2 border-t pt-2">
                        <p className="text-label mb-1 font-medium">Requirements:</p>
                        <ul className="list-inside list-disc space-y-0.5">
                          <li>Min. relationship: {costData.requirements.minimumRelationship}</li>
                          {costData.requirements.requiredDocuments.map(
                            (doc: string, idx: number) => (
                              <li key={idx}>{doc}</li>
                            )
                          )}
                        </ul>
                      </div>
                    )}
                  </Card>
                ) : null}
              </div>
            </>
          )}

          <Card variant="inset" padding="none" className="text-label-secondary text-footnote p-2">
            Both countries will be notified of the embassy establishment. The host country can view
            your embassy details.
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
            {establishEmbassy.isPending ? "Establishing..." : "Establish Embassy"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
