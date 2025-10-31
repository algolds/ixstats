// src/hooks/maps/index.ts
// Barrel export for map editor hooks

export { useSubdivisions, useCountrySubdivisions } from "./useSubdivisions";
export type {
  UseSubdivisionsParams,
  UseSubdivisionsResult,
  SubdivisionStatus,
  SubdivisionLevel,
} from "./useSubdivisions";

export { useCities, useCountryCities } from "./useCities";
export type {
  UseCitiesParams,
  UseCitiesResult,
  CityStatus,
  CityType,
} from "./useCities";

export { usePOIs, useCountryPOIs } from "./usePOIs";
export type {
  UsePOIsParams,
  UsePOIsResult,
  POIStatus,
  POICategory,
} from "./usePOIs";

export { useMySubmissions } from "./useMySubmissions";
export type {
  UseMySubmissionsParams,
  UseMySubmissionsResult,
  SubmissionStatus,
  EntityType,
  Submission,
} from "./useMySubmissions";

export { useMapEditor } from "./useMapEditor";
export type { UseMapEditorResult } from "./useMapEditor";
