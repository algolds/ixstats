import { CountryDocument } from "../../_components/CountryDocument";

/** `/countries/[slug]/map`: the country document on its Map tab. */
export default function CountryMapPage() {
  return <CountryDocument initialTab="map" />;
}
