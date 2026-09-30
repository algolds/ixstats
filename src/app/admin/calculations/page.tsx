"use client";
// src/app/admin/calculations/page.tsx
// Deep link for the Calculation Formula Editor (the console rail pushes /admin/calculations
// client-side; this page makes the URL load directly too, e.g. from the app sidebar).

import { AdminRouter } from "../_components/AdminRouter";

export default function Page() {
  return <AdminRouter />;
}
