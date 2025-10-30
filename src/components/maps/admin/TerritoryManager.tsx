/**
 * TerritoryManager Component
 * Admin interface for managing country borders with validation and approval workflow
 */

"use client";

import React, { useState, useCallback } from "react";
import type { Map as MapLibreMap } from "maplibre-gl";
import type { Feature, Polygon, MultiPolygon } from "geojson";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Separator } from "~/components/ui/separator";
import { Badge } from "~/components/ui/badge";
import { ScrollArea } from "~/components/ui/scroll-area";
import {
  AlertCircle,
  CheckCircle2,
  Save,
  X,
  Undo2,
  Redo2,
  MapPin,
  Activity,
  DollarSign,
  Users,
  AlertTriangle,
  History,
  Eye,
  EyeOff,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "~/trpc/react";
import { useBorderEditor } from "~/hooks/maps/useBorderEditor";
import { BorderEditor } from "../editing/BorderEditor";
import { formatNumber } from "~/lib/format-utils";

interface TerritoryManagerProps {
  map: MapLibreMap | null;
  isAdmin: boolean;
  currentUserId: string;
}

/**
 * Territory Manager - Admin interface for border editing
 */
export function TerritoryManager({ map, isAdmin, currentUserId }: TerritoryManagerProps) {
  const [selectedCountryId, setSelectedCountryId] = useState<string>("");
  const [changeReason, setChangeReason] = useState<string>("");
  const [showHistory, setShowHistory] = useState(false);

  // Fetch countries for selection
  const { data: countriesData } = api.geo.getCountryBorders.useQuery({});

  // Fetch selected country details
  const { data: selectedCountryData } = api.countries.getCountryById.useQuery(
    { id: selectedCountryId },
    { enabled: !!selectedCountryId }
  );

  // Border editor hook
  const {
    state: editorState,
    actions: editorActions,
    isSaving,
    canUndo,
    canRedo,
  } = useBorderEditor(map, {
    population: selectedCountryData?.currentPopulation || 0,
    gdp: selectedCountryData?.currentTotalGdp || 0,
    areaKm2: selectedCountryData?.landArea || 0,
  });

  // Border history query
  const { data: historyData } = api.geo.getBorderHistory.useQuery(
    { countryId: selectedCountryId, limit: 10 },
    { enabled: showHistory && !!selectedCountryId }
  );

  /**
   * Start editing selected country
   */
  const handleStartEditing = useCallback(() => {
    if (!selectedCountryId || !selectedCountryData) {
      toast.error("Please select a country first");
      return;
    }

    const feature: Feature<Polygon | MultiPolygon> = {
      type: "Feature",
      geometry: selectedCountryData.geometry as Polygon | MultiPolygon,
      properties: {
        id: selectedCountryData.id,
        name: selectedCountryData.name,
      },
    };

    editorActions.startEditing(selectedCountryId, selectedCountryData.name, feature);
  }, [selectedCountryId, selectedCountryData, editorActions]);

  /**
   * Save border changes
   */
  const handleSaveChanges = useCallback(async () => {
    if (!changeReason.trim()) {
      toast.error("Please provide a reason for the border change");
      return;
    }

    if (changeReason.length < 10) {
      toast.error("Reason must be at least 10 characters long");
      return;
    }

    await editorActions.saveChanges(changeReason);
    setChangeReason("");
  }, [changeReason, editorActions]);

  /**
   * Cancel editing
   */
  const handleCancelEditing = useCallback(() => {
    editorActions.cancelChanges();
    setChangeReason("");
  }, [editorActions]);

  return (
    <div className="flex h-full flex-col gap-4 p-4">
      {/* Header */}
      <Card className="glass-parent border-white/10 bg-white/5 backdrop-blur-md">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-white">Territory Manager</CardTitle>
              <CardDescription className="text-white/70">
                Manage country borders and territorial boundaries
              </CardDescription>
            </div>
            {editorState.isEditing && (
              <Badge variant="default" className="bg-blue-500">
                <Activity className="mr-1 h-3 w-3" />
                Editing Active
              </Badge>
            )}
          </div>
        </CardHeader>
      </Card>

      <Tabs defaultValue="editor" className="flex-1">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="editor">Editor</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        {/* Editor Tab */}
        <TabsContent value="editor" className="space-y-4">
          {/* Country Selection */}
          {!editorState.isEditing && (
            <Card className="glass-child border-white/10 bg-white/5">
              <CardHeader>
                <CardTitle className="text-sm text-white">Select Country</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="country-select" className="text-white">
                    Country
                  </Label>
                  <Select value={selectedCountryId} onValueChange={setSelectedCountryId}>
                    <SelectTrigger id="country-select" className="glass-interactive">
                      <SelectValue placeholder="Select a country..." />
                    </SelectTrigger>
                    <SelectContent className="glass-modal">
                      {countriesData?.countries.map((country) => (
                        <SelectItem key={country.id} value={country.id}>
                          {country.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedCountryData && (
                  <div className="space-y-2 rounded-lg border border-white/10 bg-white/5 p-3">
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-white/70">Area:</span>
                        <p className="font-medium text-white">
                          {formatNumber(selectedCountryData.landArea || 0)} km²
                        </p>
                      </div>
                      <div>
                        <span className="text-white/70">Population:</span>
                        <p className="font-medium text-white">
                          {formatNumber(selectedCountryData.currentPopulation || 0)}
                        </p>
                      </div>
                      <div>
                        <span className="text-white/70">GDP:</span>
                        <p className="font-medium text-white">
                          ${formatNumber(selectedCountryData.currentTotalGdp || 0)}B
                        </p>
                      </div>
                      <div>
                        <span className="text-white/70">Density:</span>
                        <p className="font-medium text-white">
                          {formatNumber(selectedCountryData.populationDensity || 0)}/km²
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <Button
                  onClick={handleStartEditing}
                  disabled={!selectedCountryId || !isAdmin}
                  className="w-full"
                >
                  <MapPin className="mr-2 h-4 w-4" />
                  Start Editing Borders
                </Button>

                {!isAdmin && (
                  <p className="text-sm text-red-400">
                    <AlertCircle className="mr-1 inline h-4 w-4" />
                    Admin access required to edit borders
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Editing Controls */}
          {editorState.isEditing && (
            <>
              {/* Current Status */}
              <Card className="glass-child border-white/10 bg-white/5">
                <CardHeader>
                  <CardTitle className="text-sm text-white">
                    Editing: {editorState.editingCountryName}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Validation Status */}
                  {editorState.validation && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-white/70">Validation</span>
                        {editorState.validation.isValid ? (
                          <Badge variant="default" className="bg-green-500">
                            <CheckCircle2 className="mr-1 h-3 w-3" />
                            Valid
                          </Badge>
                        ) : (
                          <Badge variant="destructive">
                            <AlertCircle className="mr-1 h-3 w-3" />
                            Invalid
                          </Badge>
                        )}
                      </div>

                      {/* Errors */}
                      {editorState.validation.errors.length > 0 && (
                        <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-2">
                          <p className="text-xs font-medium text-red-400">Errors:</p>
                          <ul className="mt-1 list-inside list-disc text-xs text-red-300">
                            {editorState.validation.errors.map((error, idx) => (
                              <li key={idx}>{error}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Warnings */}
                      {editorState.validation.warnings.length > 0 && (
                        <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/10 p-2">
                          <p className="text-xs font-medium text-yellow-400">Warnings:</p>
                          <ul className="mt-1 list-inside list-disc text-xs text-yellow-300">
                            {editorState.validation.warnings.map((warning, idx) => (
                              <li key={idx}>{warning}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Geometry Metrics */}
                  {editorState.validation?.metrics && (
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-white/70">Area:</span>
                        <p className="font-medium text-white">
                          {formatNumber(editorState.validation.metrics.areaKm2)} km²
                        </p>
                      </div>
                      <div>
                        <span className="text-white/70">Perimeter:</span>
                        <p className="font-medium text-white">
                          {formatNumber(editorState.validation.metrics.perimeterKm)} km
                        </p>
                      </div>
                      <div>
                        <span className="text-white/70">Vertices:</span>
                        <p className="font-medium text-white">
                          {formatNumber(editorState.validation.metrics.vertexCount)}
                        </p>
                      </div>
                      <div>
                        <span className="text-white/70">Rings:</span>
                        <p className="font-medium text-white">
                          {editorState.validation.metrics.ringCount}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Economic Impact */}
                  {editorState.economicImpact && (
                    <div className="space-y-2 rounded-lg border border-blue-500/20 bg-blue-500/10 p-3">
                      <p className="text-xs font-medium text-blue-400">Economic Impact Preview</p>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-white/70">Area Change:</span>
                          <p
                            className={`font-medium ${
                              editorState.economicImpact.areaChange.km2 >= 0
                                ? "text-green-400"
                                : "text-red-400"
                            }`}
                          >
                            {editorState.economicImpact.areaChange.km2 >= 0 ? "+" : ""}
                            {formatNumber(editorState.economicImpact.areaChange.km2)} km²
                            ({editorState.economicImpact.areaChange.percentChange.toFixed(1)}%)
                          </p>
                        </div>
                        <div>
                          <span className="text-white/70">Pop. Change:</span>
                          <p
                            className={`font-medium ${
                              editorState.economicImpact.populationImpact.estimatedChange >= 0
                                ? "text-green-400"
                                : "text-red-400"
                            }`}
                          >
                            {editorState.economicImpact.populationImpact.estimatedChange >= 0
                              ? "+"
                              : ""}
                            {formatNumber(
                              editorState.economicImpact.populationImpact.estimatedChange
                            )}
                          </p>
                        </div>
                        <div>
                          <span className="text-white/70">GDP Change:</span>
                          <p
                            className={`font-medium ${
                              editorState.economicImpact.economicImpact.gdpChange >= 0
                                ? "text-green-400"
                                : "text-red-400"
                            }`}
                          >
                            {editorState.economicImpact.economicImpact.gdpChange >= 0 ? "+" : ""}$
                            {formatNumber(editorState.economicImpact.economicImpact.gdpChange)}B
                          </p>
                        </div>
                        <div>
                          <span className="text-white/70">GDP/Capita:</span>
                          <p
                            className={`font-medium ${
                              editorState.economicImpact.economicImpact.gdpPerCapitaChange >= 0
                                ? "text-green-400"
                                : "text-red-400"
                            }`}
                          >
                            {editorState.economicImpact.economicImpact.gdpPerCapitaChange >= 0
                              ? "+"
                              : ""}
                            $
                            {formatNumber(
                              editorState.economicImpact.economicImpact.gdpPerCapitaChange
                            )}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Overlap Detection */}
                  {editorState.overlapDetection?.hasOverlap && (
                    <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3">
                      <p className="text-xs font-medium text-red-400">
                        <AlertTriangle className="mr-1 inline h-3 w-3" />
                        Territory Overlaps Detected
                      </p>
                      <ul className="mt-1 list-inside list-disc text-xs text-red-300">
                        {editorState.overlapDetection.overlappingCountries.map((country) => (
                          <li key={country.countryId}>
                            {country.countryName} (~{formatNumber(country.overlapAreaKm2)} km²)
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Editor Controls */}
              <Card className="glass-child border-white/10 bg-white/5">
                <CardHeader>
                  <CardTitle className="text-sm text-white">Controls</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Undo/Redo */}
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={editorActions.undo}
                      disabled={!canUndo}
                      className="flex-1"
                    >
                      <Undo2 className="mr-2 h-4 w-4" />
                      Undo
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={editorActions.redo}
                      disabled={!canRedo}
                      className="flex-1"
                    >
                      <Redo2 className="mr-2 h-4 w-4" />
                      Redo
                    </Button>
                  </div>

                  {/* Preview Toggle */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={editorActions.togglePreview}
                    className="w-full"
                  >
                    {editorState.isPreviewMode ? (
                      <>
                        <EyeOff className="mr-2 h-4 w-4" />
                        Exit Preview
                      </>
                    ) : (
                      <>
                        <Eye className="mr-2 h-4 w-4" />
                        Preview Changes
                      </>
                    )}
                  </Button>

                  <Separator className="bg-white/10" />

                  {/* Change Reason */}
                  <div className="space-y-2">
                    <Label htmlFor="change-reason" className="text-white">
                      Reason for Change *
                    </Label>
                    <Textarea
                      id="change-reason"
                      value={changeReason}
                      onChange={(e) => setChangeReason(e.target.value)}
                      placeholder="Describe the reason for this border change (min 10 characters)..."
                      rows={3}
                      className="glass-interactive resize-none"
                    />
                    <p className="text-xs text-white/70">
                      {changeReason.length}/500 characters
                      {changeReason.length < 10 && changeReason.length > 0 && (
                        <span className="text-red-400"> (minimum 10)</span>
                      )}
                    </p>
                  </div>

                  {/* Save/Cancel Buttons */}
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={handleCancelEditing}
                      disabled={isSaving}
                      className="flex-1"
                    >
                      <X className="mr-2 h-4 w-4" />
                      Cancel
                    </Button>
                    <Button
                      onClick={handleSaveChanges}
                      disabled={
                        !editorState.validation?.isValid ||
                        editorState.overlapDetection?.hasOverlap ||
                        !editorState.hasUnsavedChanges ||
                        isSaving ||
                        changeReason.length < 10
                      }
                      className="flex-1"
                    >
                      <Save className="mr-2 h-4 w-4" />
                      {isSaving ? "Saving..." : "Save Changes"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="space-y-4">
          <Card className="glass-child border-white/10 bg-white/5">
            <CardHeader>
              <CardTitle className="text-sm text-white">Border Change History</CardTitle>
              <CardDescription className="text-white/70">
                View previous territorial modifications
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!selectedCountryId ? (
                <p className="text-sm text-white/70">Select a country to view history</p>
              ) : (
                <ScrollArea className="h-[400px]">
                  {historyData?.history.map((entry) => (
                    <div
                      key={entry.id}
                      className="mb-3 rounded-lg border border-white/10 bg-white/5 p-3"
                    >
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <p className="text-sm font-medium text-white">{entry.changedBy}</p>
                          <p className="text-xs text-white/70">
                            {new Date(entry.changedAt).toLocaleDateString()}
                          </p>
                        </div>
                        <Badge
                          variant={entry.areaDeltaSqMi >= 0 ? "default" : "destructive"}
                          className="text-xs"
                        >
                          {entry.areaDeltaSqMi >= 0 ? "+" : ""}
                          {entry.percentChange?.toFixed(1)}%
                        </Badge>
                      </div>
                      <Separator className="my-2 bg-white/10" />
                      <p className="text-xs text-white/80">{entry.reason}</p>
                      <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                        <div>
                          <span className="text-white/70">Old:</span>
                          <p className="font-medium text-white">
                            {formatNumber(entry.oldAreaSqMi)} mi²
                          </p>
                        </div>
                        <div>
                          <span className="text-white/70">New:</span>
                          <p className="font-medium text-white">
                            {formatNumber(entry.newAreaSqMi)} mi²
                          </p>
                        </div>
                        <div>
                          <span className="text-white/70">Change:</span>
                          <p
                            className={`font-medium ${
                              entry.areaDeltaSqMi >= 0 ? "text-green-400" : "text-red-400"
                            }`}
                          >
                            {entry.areaDeltaSqMi >= 0 ? "+" : ""}
                            {formatNumber(entry.areaDeltaSqMi)} mi²
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}

                  {historyData?.history.length === 0 && (
                    <p className="text-sm text-white/70">No border changes recorded</p>
                  )}
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Border Editor Component */}
      {editorState.isEditing && map && (
        <BorderEditor
          map={map}
          isActive={editorState.isEditing}
          initialFeature={editorState.currentGeometry}
          onGeometryChange={editorActions.updateGeometry}
          onEditStart={() => {}}
          onEditEnd={() => {}}
          options={{
            snapping: true,
            snapDistance: 20,
            allowSelfIntersection: false,
            continueDrawing: false,
          }}
        />
      )}
    </div>
  );
}
