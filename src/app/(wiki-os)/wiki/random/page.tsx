import { redirect } from "next/navigation";

export default function WikiRandomRedirect() {
  redirect("/util/random");
}
