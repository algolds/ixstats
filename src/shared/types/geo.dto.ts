export interface PointFeatureDto {
  id: string;
  name: string;
  category?: string;
  icon?: string;
  description?: string;
  wikiPageTitle?: string | null;
  countryId?: string | null;
  countryName?: string;
  countrySlug?: string;
  coordinates?: [number, number];
}

export interface CityFeatureDto extends PointFeatureDto {
  cityType: string;
  isCapital: boolean;
  population: number;
}

export interface SubdivisionFeatureDto {
  id: string;
  name: string;
  subdivisionType: string;
  level: number;
  areaSqKm: number | null;
  countryId?: string | null;
  countryName?: string;
  countrySlug?: string;
  geometry: import("geojson").Geometry;
}

export interface MapBundleDto {
  worldMap: Record<string, import("geojson").FeatureCollection>;
  features: {
    cities: import("geojson").FeatureCollection;
    pois: import("geojson").FeatureCollection;
    subdivisions: import("geojson").FeatureCollection;
  };
  capitals: import("geojson").FeatureCollection;
}

export interface CountryGeometryDto {
  id: string;
  name: string;
  geometry: import("geojson").Geometry;
  bbox: [number, number, number, number];
  areaSqKm: number;
  continent?: string | null;
  region?: string | null;
}

export interface LayerInfoItemDto {
  featureId: string;
  displayName: string;
  fillColor: string;
  countryId: string | null;
  areaSqKm: number | null;
  centroidLng: number;
  centroidLat: number;
  isClaimed: boolean;
}
