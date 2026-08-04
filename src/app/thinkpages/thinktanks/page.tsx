import { redirect } from "next/navigation";


export default function ThinkTanksRedirect() {
  redirect("/messages/groups?tab=discover");
}
