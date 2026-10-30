"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useNotify } from "~/hooks/useNotify";

export const ACCESS_DENIED_MESSAGE = "You don't have access to the admin console.";

/**
 * The proxy sends non-admins from /admin to `/?error=access_denied`. This says why once, then takes
 * the parameter out of the address so a reload or a shared link does not say it again.
 */
export function AccessDeniedNotice() {
  const denied = useSearchParams().get("error") === "access_denied";
  const notify = useNotify();

  useEffect(() => {
    if (!denied) return;
    // The id keeps a repeated effect run to one toast.
    notify.warning(ACCESS_DENIED_MESSAGE, undefined, { id: "admin-access-denied" });
    const url = new URL(window.location.href);
    url.searchParams.delete("error");
    window.history.replaceState(window.history.state, "", url);
  }, [denied, notify]);

  return null;
}
