import { redirect } from "next/navigation";

/** The nation directory moved to My realm (/countries); exploring realms is /realms. */
export default function ExplorePage() {
  redirect("/countries");
}
