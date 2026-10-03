import type {
  EditorFeature,
  EditorMode,
  CityFormData,
  SubdivisionFormData,
  POIFormData,
  StoryPinFormData,
  MapLabelFormData,
  PeakFormData,
  NamedRiverFormData,
  NamedLakeFormData,
} from "./editor-types";

import type { FeatureType } from "~/types/maps/editor-domain";
import { createFeatureOps } from "./feature-ops";
import { useFeatureMutations } from "./feature-mutations";
import type { EditorAction } from "./useMapHistory";

interface UseMapFeatureMutationsOptions {
  countryId: string | undefined;
  selectedFeature: EditorFeature | null;
  pendingCoordinates: [number, number] | null;
  pendingGeometry: object | null;
  cityForm: CityFormData;
  subdivisionForm: SubdivisionFormData;
  poiForm: POIFormData;
  storyPinForm: StoryPinFormData;
  mapLabelForm: MapLabelFormData;
  peakForm: PeakFormData;
  riverForm: NamedRiverFormData;
  lakeForm: NamedLakeFormData;
  resetForm: () => void;
  setMode: (mode: EditorMode) => void;
  invalidateAllMapData: () => void;
  debouncedRefetch: () => void;
  setLastSavedAt: (date: Date) => void;
  setMutationError: (err: string | null) => void;
  pushAction?: (action: EditorAction) => void;
}

export function useMapFeatureMutations({
  countryId,
  selectedFeature,
  pendingCoordinates,
  pendingGeometry,
  cityForm,
  subdivisionForm,
  poiForm,
  storyPinForm,
  mapLabelForm,
  peakForm,
  riverForm,
  lakeForm,
  resetForm,
  setMode,
  invalidateAllMapData,
  debouncedRefetch,
  setLastSavedAt,
  setMutationError,
  pushAction,
}: UseMapFeatureMutationsOptions) {
  const m = useFeatureMutations();

  const isMutating = Object.values(m).some((kind) =>
    Object.values(kind as Record<string, { isPending: boolean }>).some(
      (mutation) => mutation.isPending
    )
  );

  const onSuccess = (
    type?: "create" | "update" | "delete",
    featureType?: FeatureType,
    featureId?: string,
    description?: string,
    prev?: Record<string, string | number | boolean | object | null | undefined>,
    next?: Record<string, string | number | boolean | object | null | undefined>
  ) => {
    if (type && featureType && featureId && description) {
      pushAction?.({
        type,
        featureType,
        featureId,
        description,
        timestamp: Date.now(),
        previousData: prev,
        newData: next,
      });
    }
    resetForm();
    setMode("view");
    invalidateAllMapData();
    debouncedRefetch();
    setLastSavedAt(new Date());
    setMutationError(null);
  };

  /** Run a mutation; failures surface as the server message, else `fallback`. */
  const attempt = async (fallback: string, work: () => Promise<void>) => {
    try {
      await work();
    } catch (e) {
      setMutationError(e instanceof Error && e.message ? e.message : fallback);
    }
  };

  /** A kind of editable feature: how it is named in errors and history, and its current form. */
  const kind = <F extends object>(
    type: FeatureType,
    noun: string,
    label: string,
    form: F,
    name: (form: F) => string
  ) => ({ type, noun, label, form, name });
  type Kind<F extends object> = ReturnType<typeof kind<F>>;

  /** Fields every mutation needs; spread into its input. */
  type Scope = { countryId: string };

  /** Create at the pending point ("coordinates") or drawn shape ("geometry"). */
  const create = async <F extends object, P extends object>(
    k: Kind<F>,
    key: "coordinates" | "geometry",
    pending: P | null,
    run: (scope: Scope, pending: P) => Promise<{ id: string }>
  ) => {
    if (!countryId || !pending) return;
    await attempt(`Failed to create ${k.noun}`, async () => {
      const res = await run({ countryId }, pending);
      onSuccess("create", k.type, res.id, `Created ${k.label} "${k.name(k.form)}"`, undefined, {
        ...k.form,
        [key]: pending,
      });
    });
  };

  /** Edit the selected feature; `history` yields the previous and next states for undo/redo. */
  const edit = async <F extends object>(
    k: Kind<F>,
    override: Partial<F> | undefined,
    run: (scope: Scope, feature: EditorFeature, form: F) => Promise<unknown>,
    history: (feature: EditorFeature, form: F) => [Record<string, unknown>, Record<string, unknown>]
  ) => {
    if (!countryId || !selectedFeature) return;
    const form = { ...k.form, ...override };
    await attempt(`Failed to update ${k.noun}`, async () => {
      await run({ countryId }, selectedFeature, form);
      const [prev, next] = history(selectedFeature, form);
      onSuccess(
        "update",
        k.type,
        selectedFeature.id,
        `Updated ${k.label} "${k.name(form)}"`,
        prev,
        next
      );
    });
  };

  // History of edits to features placed at a point, a drawn region, and plain renames
  const atPoint = (feature: EditorFeature, form: object) => [
    { ...feature.properties, coordinates: feature.coordinates },
    { ...form, coordinates: feature.coordinates },
  ];
  const atShape = (feature: EditorFeature, form: { geometry?: object }) => [
    { ...feature.properties, geometry: feature.geometry },
    { ...form, geometry: feature.geometry || form.geometry },
  ];
  const renamed = (feature: EditorFeature, form: object) => [
    { ...feature.properties },
    { ...form },
  ];

  const city = kind("city", "city", "City", cityForm, (f) => f.name);
  const subdivision = kind("subdivision", "subdivision", "Region", subdivisionForm, (f) => f.name);
  const poi = kind("poi", "POI", "POI", poiForm, (f) => f.name);
  const storyPin = kind("storyPin", "story pin", "Story Pin", storyPinForm, (f) => f.title);
  const mapLabel = kind("mapLabel", "map label", "Label", mapLabelForm, (f) => f.text);
  const peak = kind("peak", "peak", "Peak", peakForm, (f) => f.name);
  const river = kind("river", "river", "River", riverForm, (f) => f.name);
  const lake = kind("lake", "lake", "Lake", lakeForm, (f) => f.name);

  const submitCity = () =>
    create(city, "coordinates", pendingCoordinates, (scope, coordinates) =>
      m.city.create.mutateAsync({
        ...scope,
        name: cityForm.name,
        cityType: cityForm.cityType,
        coordinates,
        population: cityForm.population,
        isNationalCapital: cityForm.isNationalCapital,
        isSubdivisionCapital: cityForm.isSubdivisionCapital,
        subdivisionId: cityForm.subdivisionId,
      })
    );

  const submitEditCity = (overrideForm?: Partial<CityFormData>) =>
    edit(
      city,
      overrideForm,
      (scope, feature, form) =>
        m.city.update.mutateAsync({
          ...scope,
          cityId: feature.id,
          name: form.name,
          cityType: form.cityType,
          coordinates: feature.coordinates!,
          population: form.population,
          isNationalCapital: form.isNationalCapital,
          isSubdivisionCapital: form.isSubdivisionCapital,
        }),
      atPoint
    );

  const submitSubdivision = () =>
    create(subdivision, "geometry", pendingGeometry, (scope, geometry) =>
      m.subdivision.create.mutateAsync({
        ...scope,
        name: subdivisionForm.name,
        type: subdivisionForm.type,
        level: subdivisionForm.level,
        geometry: geometry as Parameters<typeof m.subdivision.create.mutateAsync>[0]["geometry"],
        capital: subdivisionForm.capital,
        population: subdivisionForm.population,
      })
    );

  const submitEditSubdivision = (overrideForm?: Partial<SubdivisionFormData>) =>
    edit(
      subdivision,
      overrideForm,
      (scope, feature, form) =>
        m.subdivision.update.mutateAsync({
          ...scope,
          subdivisionId: feature.id,
          name: form.name,
          type: form.type,
          level: form.level,
          geometry: (feature.geometry || form.geometry) as Parameters<
            typeof m.subdivision.update.mutateAsync
          >[0]["geometry"],
          capital: form.capital,
          population: form.population,
        }),
      atShape
    );

  const submitPOI = () =>
    create(poi, "coordinates", pendingCoordinates, (scope, coordinates) =>
      m.poi.create.mutateAsync({
        ...scope,
        name: poiForm.name,
        category: poiForm.category,
        coordinates,
        description: poiForm.description,
        icon: poiForm.icon,
        wikiPageTitle: poiForm.wikiPageTitle,
      })
    );

  const submitEditPOI = (overrideForm?: Partial<POIFormData>) =>
    edit(
      poi,
      overrideForm,
      (scope, feature, form) =>
        m.poi.update.mutateAsync({
          ...scope,
          poiId: feature.id,
          name: form.name,
          category: form.category,
          coordinates: feature.coordinates!,
          description: form.description,
          icon: form.icon,
          wikiPageTitle: form.wikiPageTitle,
        }),
      atPoint
    );

  const submitStoryPin = () =>
    create(storyPin, "coordinates", pendingCoordinates, (scope, coordinates) =>
      m.storyPin.create.mutateAsync({
        ...scope,
        title: storyPinForm.title,
        coordinates,
        content: storyPinForm.content,
        ixTimeYear: storyPinForm.ixTimeYear,
        category: storyPinForm.category,
      })
    );

  const submitEditStoryPin = () =>
    edit(
      storyPin,
      undefined,
      (scope, feature, form) =>
        m.storyPin.update.mutateAsync({
          ...scope,
          pinId: feature.id,
          title: form.title,
          coordinates: feature.coordinates!,
          content: form.content,
          ixTimeYear: form.ixTimeYear,
          category: form.category,
        }),
      atPoint
    );

  const submitMapLabel = () =>
    create(mapLabel, "coordinates", pendingCoordinates, (scope, coordinates) =>
      m.mapLabel.create.mutateAsync({
        ...scope,
        text: mapLabelForm.text,
        labelType: mapLabelForm.labelType,
        coordinates,
        fontSize: mapLabelForm.fontSize,
        color: mapLabelForm.color,
      })
    );

  const submitEditMapLabel = () =>
    edit(
      mapLabel,
      undefined,
      (scope, feature, form) =>
        m.mapLabel.update.mutateAsync({
          ...scope,
          labelId: feature.id,
          text: form.text,
          labelType: form.labelType,
          coordinates: feature.coordinates!,
          fontSize: form.fontSize,
          color: form.color,
        }),
      atPoint
    );

  const submitPeak = () =>
    create(peak, "coordinates", pendingCoordinates, (scope, coordinates) =>
      m.peak.create.mutateAsync({
        ...scope,
        name: peakForm.name,
        elevation: peakForm.elevation,
        coordinates,
      })
    );

  const submitEditPeak = (overrideForm?: Partial<PeakFormData>) =>
    edit(
      peak,
      overrideForm,
      (scope, feature, form) =>
        m.peak.update.mutateAsync({
          ...scope,
          peakId: feature.id,
          name: form.name,
          elevation: form.elevation,
          coordinates: feature.coordinates!,
        }),
      atPoint
    );

  const submitRiver = () =>
    create(river, "geometry", pendingGeometry, (scope, geometry) =>
      m.river.create.mutateAsync({
        ...scope,
        name: riverForm.name,
        geometry: geometry as Parameters<typeof m.river.create.mutateAsync>[0]["geometry"],
      })
    );

  const submitEditRiver = (overrideForm?: Partial<NamedRiverFormData>) =>
    edit(
      river,
      overrideForm,
      (scope, feature, form) =>
        m.river.update.mutateAsync({ ...scope, riverId: feature.id, name: form.name }),
      renamed
    );

  const submitLake = () =>
    create(lake, "geometry", pendingGeometry, (scope, geometry) =>
      m.lake.create.mutateAsync({
        ...scope,
        name: lakeForm.name,
        geometry: geometry as Parameters<typeof m.lake.create.mutateAsync>[0]["geometry"],
      })
    );

  const submitEditLake = (overrideForm?: Partial<NamedLakeFormData>) =>
    edit(
      lake,
      overrideForm,
      (scope, feature, form) =>
        m.lake.update.mutateAsync({ ...scope, lakeId: feature.id, name: form.name }),
      renamed
    );

  const deleteFeature = async (feature: EditorFeature) => {
    if (!countryId) return;
    await attempt("Failed to delete feature", async () => {
      await createFeatureOps(m, countryId)[feature.type]?.remove(feature.id);
      onSuccess(
        "delete",
        feature.type as FeatureType,
        feature.id,
        `Deleted ${feature.type} "${feature.name}"`,
        {
          ...feature.properties,
          coordinates: feature.coordinates,
          geometry: feature.geometry,
          name: feature.name,
        }
      );
    });
  };

  return {
    isMutating,
    submitCity,
    submitEditCity,
    submitSubdivision,
    submitEditSubdivision,
    submitPOI,
    submitEditPOI,
    submitStoryPin,
    submitEditStoryPin,
    submitMapLabel,
    submitEditMapLabel,
    submitPeak,
    submitEditPeak,
    submitRiver,
    submitEditRiver,
    submitLake,
    submitEditLake,
    deleteFeature,
  };
}
