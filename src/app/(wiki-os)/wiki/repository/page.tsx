// src/app/(wiki-os)/wiki/repository/page.tsx
import { redirect } from "next/navigation";

export default function WikiRepositoryRedirect() {
  redirect("/util/repository");
}
