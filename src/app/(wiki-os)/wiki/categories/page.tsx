import { redirect } from "next/navigation";

export default function WikiCategoriesRedirect() {
  redirect("/util/categories");
}
