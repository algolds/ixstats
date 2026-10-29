/**
 * Province importer wizard state: types, initial state and the pure reducer behind useProvinceImporter.
 *
 * The wizard step and the data each step owns form one discriminated union, so a parse result can't exist
 * without an upload, a validation report can't outlive the validate/commit steps, and "busy" and "failed"
 * are one status rather than two flags. Heavy geometry (alignment, clipping, validation) runs in the hook;
 * the reducer only stores the results.
 */

import type { Polygon, MultiPolygon } from "geojson";
import type { SvgLayerInfo, SvgCityPoint } from "~/lib/city-importer/svg-points";
import type { ConformanceResult } from "./topology";
import type {
  AffineMatrix,
  AlignmentMode,
  ImportStep,
  ManualTransform,
  ProvinceFeature,
  ReferencePoint,
  TopologyReport,
} from "./types";

export const IMPORT_STEPS: readonly ImportStep[] = [
  "upload",
  "names",
  "align",
  "snap",
  "validate",
  "commit",
];

export type ImportScope = "both" | "provinces" | "cities";

/** Choices the user makes independently of the uploaded file; they survive re-uploads. */
export interface ImporterSettings {
  importScope: ImportScope;
  importCities: boolean;
  alignmentMode: AlignmentMode;
  manualTransform: ManualTransform;
  snapTolerance: number;
  simplifyTolerance: number;
  replaceExisting: boolean;
}

export type ImporterStatus =
  { kind: "idle" } | { kind: "processing" } | { kind: "error"; message: string };

/** Provinces clipped to the border when leaving the snap step, and whether the notice is open. */
export interface ConformanceNotice {
  result: ConformanceResult;
  modalOpen: boolean;
}

/** Everything that exists only once a file has been parsed. */
export interface ImportSession {
  /** Upload record id; null when the SVG was pasted in directly */
  uploadId: string | null;
  rawSvgContent: string;
  rawProvinces: ProvinceFeature[];
  /** Provinces after alignment/snapping; empty until the first alignment */
  alignedProvinces: ProvinceFeature[];
  countryBorder: Polygon | MultiPolygon | null;
  parseLog: string[];
  detectedLayers: string[];
  referencePoints: ReferencePoint[];
  transform: AffineMatrix | null;
  /** Whether the automatic post-parse alignment has run for this file */
  autoAligned: boolean;
  conformance: ConformanceNotice | null;
  hasCities: boolean;
  cityLayers: SvgLayerInfo[];
  rawCityPoints: SvgCityPoint[];
  citiesLayerId: string;
  capitalLayerId: string;
  cityNameLayerId: string;
}

type PreValidateStep = "names" | "align" | "snap";
type ReviewStep = "validate" | "commit";

/**
 * The upload step keeps a session from an earlier parse so Next can return to it; every later step
 * requires one, and only the review steps carry a validation report.
 */
export type ImporterWizard =
  | { step: "upload"; session: ImportSession | null }
  | { step: PreValidateStep; session: ImportSession }
  | { step: ReviewStep; session: ImportSession; validationReport: TopologyReport | null };

export interface ImporterState {
  wizard: ImporterWizard;
  status: ImporterStatus;
  settings: ImporterSettings;
}

export interface ParsedCityData {
  points: SvgCityPoint[];
  layers: SvgLayerInfo[];
  detectedCitiesLayerId?: string;
  detectedCityNameLayerId?: string;
}

/** A parse result, normalized by the hook from the tRPC response. */
export interface ParsedUpload {
  uploadId: string | null;
  rawSvgContent: string;
  provinces: ProvinceFeature[];
  countryBorder: Polygon | MultiPolygon | null;
  parseLog: string[];
  detectedLayers: string[];
  cityData: ParsedCityData | null;
}

type NavigationAction =
  | { type: "stepChanged"; step: ImportStep }
  /** `clipped` is the border-conformance result when leaving the snap step, else null */
  | { type: "advanced"; clipped: ConformanceResult | null }
  | { type: "retreated" };

type StatusAction =
  | { type: "processingStarted" }
  | { type: "processingFinished" }
  | { type: "failed"; message: string };

type SettingsAction =
  | { type: "scopeChanged"; scope: ImportScope }
  | { type: "settingsChanged"; patch: Partial<Omit<ImporterSettings, "importScope">> };

type SessionAction =
  | { type: "provinceRenamed"; sourceId: string; name: string }
  | { type: "provinceIncludedToggled"; sourceId: string }
  | { type: "referencePointAdded"; point: ReferencePoint }
  | { type: "referencePointRemoved"; index: number }
  /** `provinces` is omitted when only the transform changes (cities-only manual alignment) */
  | { type: "aligned"; transform: AffineMatrix; provinces?: ProvinceFeature[]; auto?: boolean }
  | { type: "provincesReplaced"; provinces: ProvinceFeature[] }
  | {
      type: "cityLayersSelected";
      citiesLayerId: string;
      capitalLayerId?: string | undefined;
      cityNameLayerId?: string | undefined;
    }
  | { type: "cityPointsLoaded"; points: SvgCityPoint[] }
  | { type: "conformanceModalSet"; open: boolean };

export type ImporterAction =
  | NavigationAction
  | StatusAction
  | SettingsAction
  | SessionAction
  | { type: "parsed"; upload: ParsedUpload }
  | { type: "validated"; report: TopologyReport; provinces?: ProvinceFeature[] }
  | { type: "reset" };

const IDLE: ImporterStatus = { kind: "idle" };

export const DEFAULT_MANUAL_TRANSFORM: ManualTransform = {
  translate: [0, 0],
  rotate: 0,
  scale: 1,
};

export const initialImporterState: ImporterState = {
  wizard: { step: "upload", session: null },
  status: IDLE,
  settings: {
    importScope: "both",
    // "both" with no file yet means no cities to import
    importCities: false,
    alignmentMode: "auto-align",
    manualTransform: DEFAULT_MANUAL_TRANSFORM,
    snapTolerance: 0.02,
    simplifyTolerance: 0.005,
    replaceExisting: false,
  },
};

/** What "import cities" should be after the scope or the parsed file changes. */
export function importCitiesFor(scope: ImportScope, hasCities: boolean): boolean {
  if (scope === "provinces") return false;
  if (scope === "cities") return true;
  return hasCities;
}

export function createSession(upload: ParsedUpload): ImportSession {
  const cities = upload.cityData;
  return {
    uploadId: upload.uploadId,
    rawSvgContent: upload.rawSvgContent,
    rawProvinces: upload.provinces,
    alignedProvinces: [],
    countryBorder: upload.countryBorder,
    parseLog: upload.parseLog,
    detectedLayers: upload.detectedLayers,
    referencePoints: [],
    transform: null,
    autoAligned: false,
    conformance: null,
    hasCities: (cities?.points.length ?? 0) > 0,
    cityLayers: cities?.layers ?? [],
    rawCityPoints: cities?.points ?? [],
    citiesLayerId: cities?.detectedCitiesLayerId ?? "",
    capitalLayerId: "",
    cityNameLayerId: cities?.detectedCityNameLayerId ?? "",
  };
}

function clearError(status: ImporterStatus): ImporterStatus {
  return status.kind === "error" ? IDLE : status;
}

/** Move to a step, carrying the session; refuses steps past upload when nothing has been parsed. */
function enterStep(wizard: ImporterWizard, step: ImportStep): ImporterWizard {
  const { session } = wizard;
  if (step === "upload") return { step, session };
  if (!session) return wizard;
  if (step === "validate" || step === "commit") {
    const validationReport = "validationReport" in wizard ? wizard.validationReport : null;
    return { step, session, validationReport };
  }
  return { step, session };
}

function moveTo(state: ImporterState, step: ImportStep | undefined): ImporterState {
  if (!step) return state;
  const wizard = enterStep(state.wizard, step);
  if (wizard === state.wizard) return state;
  return { ...state, wizard, status: clearError(state.status) };
}

/** Store the clip made when leaving the snap step, opening the notice if anything was clipped. */
function applyClip(state: ImporterState, clipped: ConformanceResult | null): ImporterState {
  const { session } = state.wizard;
  if (state.wizard.step !== "snap" || !clipped || !session) return state;
  const conformance =
    clipped.clippedIndices.length > 0 ? { result: clipped, modalOpen: true } : session.conformance;
  const next = { ...session, alignedProvinces: clipped.provinces, conformance };
  return { ...state, wizard: { ...state.wizard, session: next } };
}

function navigate(state: ImporterState, action: NavigationAction): ImporterState {
  const index = IMPORT_STEPS.indexOf(state.wizard.step);
  if (action.type === "stepChanged") return moveTo(state, action.step);
  if (action.type === "retreated") return moveTo(state, IMPORT_STEPS[index - 1]);
  const next = IMPORT_STEPS[index + 1];
  if (!next) return state;
  return moveTo(applyClip(state, action.clipped), next);
}

function patchProvince(
  session: ImportSession,
  sourceId: string,
  patch: (p: ProvinceFeature) => ProvinceFeature
): ImportSession {
  const apply = (list: ProvinceFeature[]) =>
    list.map((p) => (p.sourceId === sourceId ? patch(p) : p));
  return {
    ...session,
    rawProvinces: apply(session.rawProvinces),
    alignedProvinces: apply(session.alignedProvinces),
  };
}

function applyAlignment(
  session: ImportSession,
  action: Extract<SessionAction, { type: "aligned" }>
): ImportSession {
  return {
    ...session,
    transform: action.transform,
    alignedProvinces: action.provinces ?? session.alignedProvinces,
    autoAligned: session.autoAligned || action.auto === true,
  };
}

function selectCityLayers(
  session: ImportSession,
  action: Extract<SessionAction, { type: "cityLayersSelected" }>
): ImportSession {
  return {
    ...session,
    citiesLayerId: action.citiesLayerId,
    capitalLayerId: action.capitalLayerId ?? session.capitalLayerId,
    cityNameLayerId: action.cityNameLayerId ?? session.cityNameLayerId,
  };
}

function editSession(session: ImportSession, action: SessionAction): ImportSession {
  switch (action.type) {
    case "provinceRenamed":
      return patchProvince(session, action.sourceId, (p) => ({ ...p, name: action.name }));
    case "provinceIncludedToggled":
      return patchProvince(session, action.sourceId, (p) => ({ ...p, included: !p.included }));
    case "referencePointAdded":
      return { ...session, referencePoints: [...session.referencePoints, action.point] };
    case "referencePointRemoved":
      return {
        ...session,
        referencePoints: session.referencePoints.filter((_, i) => i !== action.index),
      };
    case "aligned":
      return applyAlignment(session, action);
    case "provincesReplaced":
      return { ...session, alignedProvinces: action.provinces };
    case "cityLayersSelected":
      return selectCityLayers(session, action);
    case "cityPointsLoaded":
      return { ...session, rawCityPoints: action.points };
    case "conformanceModalSet":
      return session.conformance
        ? { ...session, conformance: { ...session.conformance, modalOpen: action.open } }
        : session;
  }
}

/** Session edits are no-ops before anything has been parsed. */
function updateSession(state: ImporterState, action: SessionAction): ImporterState {
  const { session } = state.wizard;
  if (!session) return state;
  return { ...state, wizard: { ...state.wizard, session: editSession(session, action) } };
}

function applyValidation(
  state: ImporterState,
  action: Extract<ImporterAction, { type: "validated" }>
): ImporterState {
  const { wizard } = state;
  if (wizard.step !== "validate" && wizard.step !== "commit") return state;
  const session = action.provinces
    ? { ...wizard.session, alignedProvinces: action.provinces }
    : wizard.session;
  return { ...state, wizard: { ...wizard, session, validationReport: action.report } };
}

function applyParse(state: ImporterState, upload: ParsedUpload): ImporterState {
  const session = createSession(upload);
  const { importScope } = state.settings;
  return {
    wizard: { step: "names", session },
    status: IDLE,
    settings: { ...state.settings, importCities: importCitiesFor(importScope, session.hasCities) },
  };
}

function changeSettings(state: ImporterState, action: SettingsAction): ImporterState {
  if (action.type === "settingsChanged") {
    return { ...state, settings: { ...state.settings, ...action.patch } };
  }
  const hasCities = state.wizard.session?.hasCities ?? false;
  const importCities = importCitiesFor(action.scope, hasCities);
  return { ...state, settings: { ...state.settings, importScope: action.scope, importCities } };
}

export function importerReducer(state: ImporterState, action: ImporterAction): ImporterState {
  switch (action.type) {
    case "reset":
      return initialImporterState;
    case "parsed":
      return applyParse(state, action.upload);
    case "validated":
      return applyValidation(state, action);
    case "processingStarted":
    case "processingFinished":
      return {
        ...state,
        status: action.type === "processingStarted" ? { kind: "processing" } : IDLE,
      };
    case "failed":
      return { ...state, status: { kind: "error", message: action.message } };
    case "scopeChanged":
    case "settingsChanged":
      return changeSettings(state, action);
    case "stepChanged":
    case "advanced":
    case "retreated":
      return navigate(state, action);
    case "aligned":
      return { ...updateSession(state, action), status: clearError(state.status) };
    case "cityPointsLoaded":
      return { ...updateSession(state, action), status: IDLE };
    default:
      return updateSession(state, action);
  }
}
