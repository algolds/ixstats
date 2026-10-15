import { redirect } from "next/navigation";

interface MyCountryBuilderRedirectProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

/** Founding lives at `/builder`; old links (including `?section=import`) land there. */
export default async function MyCountryBuilderRedirect({
  searchParams,
}: MyCountryBuilderRedirectProps) {
  const params = searchParams ? await searchParams : {};
  const query = new URLSearchParams();
  if (params.section === "import") query.set("import", "1");
  if (typeof params.step === "string") query.set("step", params.step);
  const qs = query.toString();
  redirect(qs ? `/builder?${qs}` : "/builder");
}
