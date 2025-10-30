import React, { useState, useMemo } from "react";
import { api } from "~/trpc/react";
import { Card, CardHeader, CardTitle, CardContent } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Skeleton } from "~/components/ui/skeleton";
import { Checkbox } from "~/components/ui/checkbox";
import {
  Users,
  Globe,
  TrendingUp,
  Edit3,
  Save,
  X,
  CheckCircle,
  AlertCircle,
  Search,
  RefreshCw,
  Eye,
  EyeOff,
} from "lucide-react";
import { GlassCard } from "~/components/ui/enhanced-card";
import { useBulkFlagCache } from "~/hooks/useBulkFlagCache";
import { toast } from "sonner";

export function CountryAdminPanel() {
  // Fetch all countries
  const { data, isLoading, error, refetch } = api.countries.getAll.useQuery({ limit: 1000 });
  const [search, setSearch] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editData, setEditData] = useState<any>({});
  const [saveStatus, setSaveStatus] = useState<{
    id: string;
    status: "saving" | "success" | "error" | null;
    error?: string;
  } | null>(null);

  // Mutation for updating country
  const updateMutation = api.countries.updateCountryName.useMutation();
  const updateVisibilityMutation = api.countries.updateProfileVisibility.useMutation();

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
      await updateMutation.mutateAsync({
        countryId: editId,
        ...editData,
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
      await updateVisibilityMutation.mutateAsync({
        countryId,
        [field]: !currentValue,
      });
      toast.success(`Profile visibility updated`);
      void refetch();
    } catch (err: any) {
      toast.error(`Failed to update: ${err?.message || "Unknown error"}`);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <GlassCard className="p-8">
        <div className="mb-6 flex items-center gap-3">
          <Users className="text-primary h-6 w-6" />
          <h2 className="text-2xl font-bold">Country Admin</h2>
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
      </GlassCard>
    );
  }
  if (error) {
    return (
      <GlassCard className="p-8">
        <div className="mb-6 flex items-center gap-3">
          <AlertCircle className="h-6 w-6 text-red-500" />
          <h2 className="text-2xl font-bold text-red-600">Country Admin</h2>
        </div>
        <div className="text-red-600">Error loading countries: {error.message}</div>
      </GlassCard>
    );
  }

  return (
    <GlassCard className="p-8">
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <Users className="text-primary h-6 w-6" />
          <h2 className="text-2xl font-bold">Country Admin</h2>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform" />
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
      <div className="overflow-x-auto">
        <table className="bg-background min-w-full rounded-lg border">
          <thead>
            <tr className="bg-muted/50">
              <th className="p-2 text-left">Flag</th>
              <th className="p-2 text-left">Name</th>
              <th className="p-2 text-left">Continent</th>
              <th className="p-2 text-left">Region</th>
              <th className="p-2 text-right">Population</th>
              <th className="p-2 text-right">GDP p.c.</th>
              <th className="p-2 text-right">Total GDP</th>
              <th className="p-2 text-center">Tier</th>
              <th className="p-2 text-center" title="Hide Diplomatic Ops Tab">
                <div className="flex items-center justify-center gap-1">
                  <EyeOff className="h-3 w-3" />
                  <span className="text-xs">Dipl</span>
                </div>
              </th>
              <th className="p-2 text-center" title="Hide StratComm Intel Tab">
                <div className="flex items-center justify-center gap-1">
                  <EyeOff className="h-3 w-3" />
                  <span className="text-xs">Strat</span>
                </div>
              </th>
              <th className="p-2 text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {countries.map((country: any) => {
              const isEditing = editId === country.id;
              const flagUrl = flagUrls[country.name] || null;
              return (
                <tr
                  key={country.id}
                  className={isEditing ? "bg-blue-50 dark:bg-blue-900/20" : "hover:bg-muted/30"}
                >
                  <td className="p-2">
                    {flagsLoading ? (
                      <Skeleton className="h-6 w-10 rounded" />
                    ) : flagUrl ? (
                      <img
                        src={flagUrl}
                        alt={country.name}
                        className="h-6 w-10 rounded border object-cover"
                      />
                    ) : (
                      <div className="bg-muted text-muted-foreground flex h-6 w-10 items-center justify-center rounded text-xs">
                        N/A
                      </div>
                    )}
                  </td>
                  <td className="p-2 font-medium">
                    {isEditing ? (
                      <Input
                        value={editData.name}
                        onChange={(e) => handleChange("name", e.target.value)}
                      />
                    ) : (
                      country.name
                    )}
                  </td>
                  <td className="p-2">
                    {isEditing ? (
                      <Input
                        value={editData.continent || ""}
                        onChange={(e) => handleChange("continent", e.target.value)}
                      />
                    ) : (
                      country.continent || "—"
                    )}
                  </td>
                  <td className="p-2">
                    {isEditing ? (
                      <Input
                        value={editData.region || ""}
                        onChange={(e) => handleChange("region", e.target.value)}
                      />
                    ) : (
                      country.region || "—"
                    )}
                  </td>
                  <td className="p-2 text-right">
                    {isEditing ? (
                      <Input
                        type="number"
                        value={editData.currentPopulation}
                        onChange={(e) => handleChange("currentPopulation", Number(e.target.value))}
                      />
                    ) : (
                      country.currentPopulation?.toLocaleString() || "—"
                    )}
                  </td>
                  <td className="p-2 text-right">
                    {isEditing ? (
                      <Input
                        type="number"
                        value={editData.currentGdpPerCapita}
                        onChange={(e) =>
                          handleChange("currentGdpPerCapita", Number(e.target.value))
                        }
                      />
                    ) : (
                      country.currentGdpPerCapita?.toLocaleString() || "—"
                    )}
                  </td>
                  <td className="p-2 text-right">
                    {isEditing ? (
                      <Input
                        type="number"
                        value={editData.currentTotalGdp}
                        onChange={(e) => handleChange("currentTotalGdp", Number(e.target.value))}
                      />
                    ) : (
                      country.currentTotalGdp?.toLocaleString() || "—"
                    )}
                  </td>
                  <td className="p-2 text-center">
                    <Badge variant="secondary">{country.economicTier || "—"}</Badge>
                  </td>
                  <td className="p-2 text-center">
                    <Checkbox
                      checked={country.hideDiplomaticOps || false}
                      onCheckedChange={() =>
                        handleVisibilityToggle(
                          country.id,
                          "hideDiplomaticOps",
                          country.hideDiplomaticOps || false
                        )
                      }
                      disabled={updateVisibilityMutation.isPending}
                      title="Hide Diplomatic Operations tab"
                    />
                  </td>
                  <td className="p-2 text-center">
                    <Checkbox
                      checked={country.hideStratcommIntel || false}
                      onCheckedChange={() =>
                        handleVisibilityToggle(
                          country.id,
                          "hideStratcommIntel",
                          country.hideStratcommIntel || false
                        )
                      }
                      disabled={updateVisibilityMutation.isPending}
                      title="Hide StratComm Intelligence tab"
                    />
                  </td>
                  <td className="p-2 text-center">
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
                        <span className="ml-2 text-green-600">
                          <CheckCircle className="inline h-4 w-4" /> Saved
                        </span>
                      )}
                    {saveStatus &&
                      saveStatus.id === country.id &&
                      saveStatus.status === "error" && (
                        <span className="ml-2 text-red-600">
                          <AlertCircle className="inline h-4 w-4" /> {saveStatus.error}
                        </span>
                      )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {countries.length === 0 && (
        <div className="text-muted-foreground py-12 text-center">No countries found.</div>
      )}
    </GlassCard>
  );
}
