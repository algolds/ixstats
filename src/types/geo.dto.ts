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
