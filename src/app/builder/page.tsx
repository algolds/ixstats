import { redirect } from "next/navigation";

interface BuilderRedirectProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export default async function BuilderRedirectPage({ searchParams }: BuilderRedirectProps) {
  const params = searchParams ? await searchParams : {};
  const query = new URLSearchParams();
  for (const [key, val] of Object.entries(params)) {
    if (typeof val === "string") {
      query.set(key, val);
    } else if (Array.isArray(val)) {
      for (const v of val) {
        query.append(key, v);
      }
    }
  }
  const qs = query.toString();
  const target = qs ? `/mycountry/builder?${qs}` : "/mycountry/builder";
  redirect(target);
}
