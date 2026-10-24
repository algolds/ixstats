import { CountryDocument } from "../_components/CountryDocument";

/** `/countries/[slug]`: the country document on its Factbook tab. */
export default function CountryFactbookPage() {
  return <CountryDocument initialTab="factbook" />;
}
