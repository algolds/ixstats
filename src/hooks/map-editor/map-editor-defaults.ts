import type {
  CityFormData,
  SubdivisionFormData,
  POIFormData,
  StoryPinFormData,
  MapLabelFormData,
  PeakFormData,
  NamedRiverFormData,
  NamedLakeFormData,
} from "./editor-types";

export const DEFAULT_CITY: CityFormData = {
  name: "",
  cityType: "city",
  isNationalCapital: false,
  isSubdivisionCapital: false,
};

export const DEFAULT_SUBDIVISION: SubdivisionFormData = {
  name: "",
  type: "province",
  level: 1,
};

export const DEFAULT_POI: POIFormData = {
  name: "",
  category: "landmark",
  description: "",
};

export const DEFAULT_STORY_PIN: StoryPinFormData = {
  title: "",
  content: "",
  contentFormat: "plain",
  category: "cultural",
  importance: 0,
};

export const DEFAULT_MAP_LABEL: MapLabelFormData = {
  text: "",
  labelType: "mountain_range",
  fontSize: 14,
  color: "#374151",
  rotation: 0,
  letterSpacing: 0,
  fontWeight: "normal",
  opacity: 1,
  minZoom: 4,
  maxZoom: 18,
};

export const DEFAULT_PEAK: PeakFormData = {
  name: "",
  elevation: 0,
};

export const DEFAULT_RIVER: NamedRiverFormData = {
  name: "",
};

export const DEFAULT_LAKE: NamedLakeFormData = {
  name: "",
  waterType: "freshwater",
};
