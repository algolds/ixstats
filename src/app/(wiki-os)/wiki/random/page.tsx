// src/app/(wiki-os)/wiki/random/page.tsx
import { redirect } from "next/navigation";

export default function WikiRandomRedirect() {
  redirect("/util/random");
}
