import { type Metadata } from "next";
import { NewAdvertForm } from "~/components/thinkpages-forum/advert";
import { ADVERT_CATEGORY_KEY } from "~/lib/thinkpages-forum/adverts";
import { newAdvertHref, newThreadHref } from "~/lib/thinkpages-forum/links";
import { requireSignIn } from "../../../_lib/require-sign-in";

interface NewAdvertPageProps {
  searchParams: Promise<{ advert?: string | string[] }>;
}

export const metadata: Metadata = {
  title: "Advertise your realm - IxStates",
};

/** The form that starts a realm's advert in Find a Realm (a static segment, so it wins over `c/[key]/new`); signed-out visitors are sent to sign-in. */
export default async function NewAdvertPage({ searchParams }: NewAdvertPageProps) {
  const { advert } = await searchParams;
  const realm = Array.isArray(advert) ? advert[0] : advert;
  await requireSignIn(realm ? newAdvertHref(realm) : newThreadHref({ key: ADVERT_CATEGORY_KEY }));
  return <NewAdvertForm realm={realm} />;
}
