"use client";

import { AuthenticationGuard } from "~/components/mycountry/primitives";

export default function MyLeagueLayout({ children }: { children: React.ReactNode }) {
  return <AuthenticationGuard redirectPath="/myleague">{children}</AuthenticationGuard>;
}
