import type { ReactNode } from "react";
import { MyCountryRouter } from "~/components/mycountry";

/**
 * The one MyCountry router. A layout persists across the sibling section routes, so a sidebar click
 * keeps the router (and the sections it holds alive) mounted instead of rebuilding it; the section
 * pages render nothing and only set the URL the router reads.
 */
export default function MyCountryCommandLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <MyCountryRouter />
      {children}
    </>
  );
}
