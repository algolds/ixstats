"use client";

import { useState } from "react";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { useLocalActions } from "~/hooks/useLocalActions";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "~/components/ui/sheet";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Separator } from "~/components/ui/separator";
import { Building2, MapPin, User, DollarSign, Loader2, ChevronDown } from "lucide-react";

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
    .filter((c: any) => c.id !== excludeCountryId)
    .sort((a: any, b: any) => a.name.localeCompare(b.name));

  return (
    <select
      value={selectedCountryId}
      onChange={(e) => {
        const country = countries.find((c: any) => c.id === e.target.value);
        if (country) onSelect(country.id, country.name);
      }}
      className="border-input bg-background ring-offset-background focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none"
    >
      <option value="">Select a country...</option>
      {countries.map((c: any) => (
        <option key={c.id} value={c.id}>
          {c.name}
        </option>
      ))}
    </select>
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
  const { saveAction } = useLocalActions(countryId);

  const { data: costData, isLoading: costLoading } =
    api.diplomatic.calculateEstablishmentCost.useQuery(
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

  const handleSubmit = () => {
    if (!hostCountryId) {
      notify.error("Please select a host country");
      return;
    }
    if (!embassyName.trim()) {
      notify.error("Embassy name is required");
      return;
    }

    saveAction("embassy_established", {
      hostCountryId,
      hostCountryName,
      guestCountryId: countryId,
      name: embassyName,
      location: location || undefined,
      ambassadorName: ambassadorName || undefined,
    });
    notify.success(
      "Embassy established!",
      `${embassyName} is now operational in ${hostCountryName}`
    );
    onOpenChange(false);
    resetForm();
    onCreated?.();
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex flex-col p-0 sm:max-w-lg">
        <SheetHeader className="px-6 pt-6 pb-0">
          <SheetTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 flex-shrink-0 text-cyan-500" />
            Establish New Embassy
          </SheetTitle>
          <p className="text-muted-foreground text-sm">
            Establish diplomatic presence in another nation.
          </p>
        </SheetHeader>

        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
          {/* Host Country */}
          <div>
            <Label className="mb-1.5 block text-xs font-medium">Host Country</Label>
            <CountrySelector
              onSelect={handleCountrySelect}
              excludeCountryId={countryId}
              selectedCountryId={hostCountryId}
            />
            {hostCountryId && (
              <div className="mt-2 rounded-md border border-cyan-500/30 bg-cyan-500/10 p-2.5 text-sm">
                Selected:{" "}
                <span className="font-semibold text-cyan-600 dark:text-cyan-400">
                  {hostCountryName}
                </span>
              </div>
            )}
          </div>

          <Separator />

          {/* Embassy Details */}
          <div>
            <Label className="mb-1.5 block text-xs font-medium">
              Embassy Name <span className="text-destructive">*</span>
            </Label>
            <div className="relative">
              <Building2 className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
              <Input
                value={embassyName}
                onChange={(e) => setEmbassyName(e.target.value)}
                placeholder="e.g., Embassy of [Country] in [Host]"
                className="pl-10"
              />
            </div>
          </div>

          <div>
            <Label className="mb-1.5 block text-xs font-medium">Location (Optional)</Label>
            <div className="relative">
              <MapPin className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
              <Input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g., Capital City, Downtown District"
                className="pl-10"
              />
            </div>
          </div>

          <div>
            <Label className="mb-1.5 block text-xs font-medium">Ambassador (Optional)</Label>
            <div className="relative">
              <User className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
              <Input
                value={ambassadorName}
                onChange={(e) => setAmbassadorName(e.target.value)}
                placeholder="e.g., Ambassador John Smith"
                className="pl-10"
              />
            </div>
          </div>

          {/* Cost Preview */}
          {hostCountryId && (
            <>
              <Separator />
              <div>
                <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold">
                  <DollarSign className="h-3.5 w-3.5 text-cyan-500" />
                  Establishment Cost
                </h4>
                {costLoading ? (
                  <div className="text-muted-foreground flex items-center gap-2 py-4 text-sm">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Calculating...
                  </div>
                ) : costData ? (
                  <div className="border-border bg-muted/30 rounded-md border p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Total</span>
                      <span className="text-lg font-bold text-cyan-600 dark:text-cyan-400">
                        ${costData.totalCost.toLocaleString()}
                      </span>
                    </div>
                    <button
                      onClick={() => setShowCostBreakdown(!showCostBreakdown)}
                      className="text-muted-foreground hover:text-foreground mt-1 flex items-center gap-1 text-xs"
                    >
                      <ChevronDown
                        className={`h-3 w-3 transition-transform ${showCostBreakdown ? "rotate-180" : ""}`}
                      />
                      {showCostBreakdown ? "Hide" : "Show"} breakdown
                    </button>
                    {showCostBreakdown && (
                      <div className="border-border text-muted-foreground mt-2 space-y-1 border-t pt-2 text-xs">
                        <div className="flex justify-between">
                          <span>Base cost</span>
                          <span>${costData.baseCost.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Economic tier</span>
                          <span>&times;{costData.economicTierMultiplier.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Relationship</span>
                          <span>&times;{costData.relationshipMultiplier.toFixed(2)}</span>
                        </div>
                      </div>
                    )}
                    {costData.requirements && (
                      <div className="border-border text-muted-foreground mt-2 border-t pt-2 text-xs">
                        <p className="text-foreground mb-1 font-medium">Requirements:</p>
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
                  </div>
                ) : null}
              </div>
            </>
          )}

          {/* Info notice */}
          <div className="text-muted-foreground rounded-md border border-blue-500/20 bg-blue-500/5 p-2.5 text-xs">
            Both countries will be notified of the embassy establishment. The host country can view
            your embassy details.
          </div>
        </div>

        <SheetFooter className="border-border/50 border-t px-6 py-4">
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
            className="gap-1.5"
            onClick={handleSubmit}
            disabled={!hostCountryId || !embassyName.trim()}
          >
            <Building2 className="h-3 w-3" />
            Establish Embassy
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
