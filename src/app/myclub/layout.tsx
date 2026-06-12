"use client";

import { AuthenticationGuard } from "~/components/mycountry/primitives";

export default function MyClubLayout({ children }: { children: React.ReactNode }) {
  return <AuthenticationGuard redirectPath="/myclub">{children}</AuthenticationGuard>;
}
