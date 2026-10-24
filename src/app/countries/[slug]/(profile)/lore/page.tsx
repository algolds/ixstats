import { CountryDocument } from "../../_components/CountryDocument";

/** `/countries/[slug]/lore`: the country document on its Lore tab. */
export default function CountryLorePage() {
  return <CountryDocument initialTab="lore" />;
}
