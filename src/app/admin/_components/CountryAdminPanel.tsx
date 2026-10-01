import React, { useState, useMemo } from "react";
import { api } from "~/trpc/react";
import { ALL_REALMS } from "~/lib/realms/realm-ids";
import { Card } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Skeleton } from "~/components/ui/skeleton";
import { Checkbox } from "~/components/ui/checkbox";
import {
  Group as Users,
  EditPencil as Edit3,
  FloppyDisk as Save,
  Xmark as X,
  CheckCircle,
  WarningCircle as AlertCircle,
  Search,
  Refresh as RefreshCw,
  EyeClosed as EyeOff,
} from "iconoir-react";
import { useBulkFlagCache } from "~/hooks/useUnifiedFlags";
import { useNotify } from "~/hooks/useNotify";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "~/components/ui/table";

export function CountryAdminPanel() {
  const notify = useNotify();
  // Fetch all countries
  const { data, isLoading, error, refetch } = api.countries.getAll.useQuery({
    limit: 1000,
    realm: ALL_REALMS,
  });
  const [search, setSearch] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editData, setEditData] = useState<any>({});
  const [saveStatus, setSaveStatus] = useState<{
    id: string;
    status: "saving" | "success" | "error" | null;
    error?: string;
  } | null>(null);

  // Mutation for updating country
  const updateMutation = api.countries.update.useMutation();

  // Prepare country list
  const countries = useMemo(() => {
    if (!data?.countries) return [];
    let arr = data.countries;
    if (search.trim()) {
      const term = search.toLowerCase();
      arr = arr.filter(
        (c: any) =>
          c.name.toLowerCase().includes(term) ||
          (c.continent || "").toLowerCase().includes(term) ||
          (c.region || "").toLowerCase().includes(term)
      );
    }
    return arr;
  }, [data, search]);

  // Bulk flag cache
  const countryNames = useMemo(() => countries.map((c: any) => c.name), [countries]);
  const { flagUrls, isLoading: flagsLoading } = useBulkFlagCache(countryNames);

  // Handlers
  const handleEdit = (country: any) => {
    setEditId(country.id);
    setEditData({ ...country });
    setSaveStatus(null);
  };
  const handleCancel = () => {
    setEditId(null);
    setEditData({});
    setSaveStatus(null);
  };
  const handleChange = (field: string, value: any) => {
    setEditData((prev: any) => ({ ...prev, [field]: value }));
  };
  const handleSave = async () => {
    if (!editId) return;
    setSaveStatus({ id: editId, status: "saving" });
    try {
      const { name, continent, region, currentPopulation, currentGdpPerCapita, currentTotalGdp } =
        editData;
      await updateMutation.mutateAsync({
        id: editId,
        name,
        continent,
        region,
        currentPopulation,
        currentGdpPerCapita,
        currentTotalGdp,
      });
      setSaveStatus({ id: editId, status: "success" });
      setEditId(null);
      setEditData({});
      void refetch();
    } catch (err: any) {
      setSaveStatus({ id: editId, status: "error", error: err?.message || "Failed to save" });
    }
  };

  const handleVisibilityToggle = async (
    countryId: string,
    field: "hideDiplomaticOps" | "hideStratcommIntel",
    currentValue: boolean
  ) => {
    try {
      await updateMutation.mutateAsync({
        id: countryId,
        [field]: !currentValue,
      });
      notify.success("Profile visibility updated");
      void refetch();
    } catch (err: any) {
      notify.error(`Failed to update: ${err?.message || "Unknown error"}`);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <Card className="p-8">
        <div className="mb-6 flex items-center gap-3">
          <Users className="text-tint h-6 w-6" />
          <h2 className="text-title-1">Country Admin</h2>
        </div>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="p-6">
              <Skeleton className="mb-2 h-6 w-3/4" />
              <Skeleton className="mb-4 h-4 w-1/2" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
                <Skeleton className="h-4 w-full" />
              </div>
            </Card>
          ))}
        </div>
      </Card>
    );
  }
  if (error) {
    return (
      <Card className="p-8">
        <div className="mb-6 flex items-center gap-3">
          <AlertCircle className="text-red h-6 w-6" />
          <h2 className="text-title-1 text-red">Country Admin</h2>
        </div>
        <div className="text-red">Error loading countries: {error.message}</div>
      </Card>
    );
  }

  return (
    <Card className="p-8">
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <Users className="text-tint h-6 w-6" />
          <h2 className="text-title-1">Country Admin</h2>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="text-label-secondary absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform" />
            <Input
              type="text"
              placeholder="Search countries..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-64 pl-10"
            />
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Flag</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Continent</TableHead>
            <TableHead>Region</TableHead>
            <TableHead className="text-right">Population</TableHead>
            <TableHead className="text-right">GDP p.c.</TableHead>
            <TableHead className="text-right">Total GDP</TableHead>
            <TableHead className="text-center">Tier</TableHead>
            <TableHead className="text-center" title="Hide Diplomatic Ops Tab">
              <div className="flex items-center justify-center gap-1">
                <EyeOff className="h-3 w-3" />
                <span className="text-footnote">Dipl</span>
              </div>
            </TableHead>
            <TableHead className="text-center" title="Hide StratComm Intel Tab">
              <div className="flex items-center justify-center gap-1">
                <EyeOff className="h-3 w-3" />
                <span className="text-footnote">Strat</span>
              </div>
            </TableHead>
            <TableHead className="text-center">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {countries.map((country: any) => {
            const isEditing = editId === country.id;
            const flagUrl = flagUrls[country.name] || null;
            return (
              <TableRow key={country.id} className={isEditing ? "bg-blue/10" : "hover:bg-fill-4"}>
                <TableCell className="p-2">
                  {flagsLoading ? (
                    <Skeleton className="rounded-control-sm h-6 w-10" />
                  ) : flagUrl ? (
                    <img
                      src={flagUrl}
                      alt={country.name}
                      className="rounded-control-sm h-6 w-10 border object-cover"
                    />
                  ) : (
                    <div className="bg-fill-3 text-label-secondary rounded-control-sm text-footnote flex h-6 w-10 items-center justify-center">
                      N/A
                    </div>
                  )}
                </TableCell>
                <TableCell className="p-2 font-medium">
                  {isEditing ? (
                    <Input
                      value={editData.name}
                      onChange={(e) => handleChange("name", e.target.value)}
                    />
                  ) : (
                    country.name
                  )}
                </TableCell>
                <TableCell className="p-2">
                  {isEditing ? (
                    <Input
                      value={editData.continent || ""}
                      onChange={(e) => handleChange("continent", e.target.value)}
                    />
                  ) : (
                    country.continent || "—"
                  )}
                </TableCell>
                <TableCell className="p-2">
                  {isEditing ? (
                    <Input
                      value={editData.region || ""}
                      onChange={(e) => handleChange("region", e.target.value)}
                    />
                  ) : (
                    country.region || "—"
                  )}
                </TableCell>
                <TableCell className="p-2 text-right">
                  {isEditing ? (
                    <Input
                      type="number"
                      value={editData.currentPopulation}
                      onChange={(e) => handleChange("currentPopulation", Number(e.target.value))}
                    />
                  ) : (
                    Math.round(country.currentPopulation ?? 0).toLocaleString() || "—"
                  )}
                </TableCell>
                <TableCell className="p-2 text-right">
                  {isEditing ? (
                    <Input
                      type="number"
                      value={editData.currentGdpPerCapita}
                      onChange={(e) => handleChange("currentGdpPerCapita", Number(e.target.value))}
                    />
                  ) : (
                    country.currentGdpPerCapita?.toLocaleString() || "—"
                  )}
                </TableCell>
                <TableCell className="p-2 text-right">
                  {isEditing ? (
                    <Input
                      type="number"
                      value={editData.currentTotalGdp}
                      onChange={(e) => handleChange("currentTotalGdp", Number(e.target.value))}
                    />
                  ) : (
                    country.currentTotalGdp?.toLocaleString() || "—"
                  )}
                </TableCell>
                <TableCell className="p-2 text-center">
                  <Badge variant="secondary">{country.economicTier || "—"}</Badge>
                </TableCell>
                <TableCell className="p-2 text-center">
                  <Checkbox
                    checked={country.hideDiplomaticOps || false}
                    onCheckedChange={() =>
                      handleVisibilityToggle(
                        country.id,
                        "hideDiplomaticOps",
                        country.hideDiplomaticOps || false
                      )
                    }
                    disabled={updateMutation.isPending}
                    title="Hide Diplomatic Operations tab"
                  />
                </TableCell>
                <TableCell className="p-2 text-center">
                  <Checkbox
                    checked={country.hideStratcommIntel || false}
                    onCheckedChange={() =>
                      handleVisibilityToggle(
                        country.id,
                        "hideStratcommIntel",
                        country.hideStratcommIntel || false
                      )
                    }
                    disabled={updateMutation.isPending}
                    title="Hide StratComm Intelligence tab"
                  />
                </TableCell>
                <TableCell className="p-2 text-center">
                  {isEditing ? (
                    <div className="flex justify-center gap-2">
                      <Button size="sm" onClick={handleSave} disabled={updateMutation.isPending}>
                        {updateMutation.isPending ? (
                          <Save className="h-4 w-4 animate-spin" />
                        ) : (
                          <Save className="h-4 w-4" />
                        )}{" "}
                        Save
                      </Button>
                      <Button size="sm" variant="outline" onClick={handleCancel}>
                        <X className="h-4 w-4" /> Cancel
                      </Button>
                    </div>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => handleEdit(country)}>
                      <Edit3 className="h-4 w-4" /> Edit
                    </Button>
                  )}
                  {saveStatus &&
                    saveStatus.id === country.id &&
                    saveStatus.status === "success" && (
                      <span className="text-green ml-2">
                        <CheckCircle className="inline h-4 w-4" /> Saved
                      </span>
                    )}
                  {saveStatus && saveStatus.id === country.id && saveStatus.status === "error" && (
                    <span className="text-red ml-2">
                      <AlertCircle className="inline h-4 w-4" /> {saveStatus.error}
                    </span>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      {countries.length === 0 && (
        <div className="text-label-secondary py-12 text-center">No countries found.</div>
      )}
    </Card>
  );
}
