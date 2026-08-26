// src/app/(wiki-os)/wiki/templates/page.tsx
import { redirect } from "next/navigation";

export default function WikiTemplatesRedirect() {
  redirect("/util/templates");
}
