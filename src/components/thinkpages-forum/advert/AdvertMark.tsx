import { RealmAvatar } from "~/app/realms/_components/RealmAvatar";

/** An advert row's mark: the realm's emblem, else its thumbnail, else the realm mark (a globe). */
export function AdvertMark({
  advert,
}: {
  advert: { emblemUrl: string | null; thumbnail: string | null };
}) {
  return <RealmAvatar thumbnail={advert.emblemUrl || advert.thumbnail} className="size-9" />;
}
