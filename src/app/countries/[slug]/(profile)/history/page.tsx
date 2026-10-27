import { CountryDocument } from "../../_components/CountryDocument";

/** `/countries/[slug]/history`: the country document on its History tab. */
export default function CountryHistoryPage() {
  return <CountryDocument initialTab="history" />;
}
