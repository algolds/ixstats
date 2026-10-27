"use client";
// src/app/admin/page.tsx

import { AdminRouter } from "./_components/AdminRouter";
import { ShellPageHeader } from "~/components/shell/ShellPageHeader";

export default function Page() {
  return (
    <>
      {/* Phone title under the new navigation shell (nothing with the flag off). */}
      <ShellPageHeader title="Admin" className="px-0 sm:px-0" />
      <AdminRouter />
    </>
  );
}
