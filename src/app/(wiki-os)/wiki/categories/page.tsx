// src/app/(wiki-os)/wiki/categories/page.tsx
import { redirect } from "next/navigation";

export default function WikiCategoriesRedirect() {
  redirect("/util/categories");
}
