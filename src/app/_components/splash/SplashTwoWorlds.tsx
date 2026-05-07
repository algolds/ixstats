"use client";

import { GlobalLeadersCarousel } from "./GlobalLeadersCarousel";
import { splashGold } from "~/lib/splash/mycountry-gold";

export function SplashTwoWorlds({
  topCountries,
}: {
  topCountries: Record<string, unknown>[];
}) {
  return (
    <section className="mx-auto mb-16 max-w-7xl md:mb-20">
      <div className="mx-auto mb-10 max-w-2xl text-center">
        <h2 className={`mb-3 text-3xl font-bold tracking-tight md:text-4xl ${splashGold.headline}`}>
          Who&apos;s ahead today
        </h2>
        <p className="text-muted-foreground text-base leading-relaxed md:text-lg">
          GDP orders the board — but every row links out to lore, flags, and the writers behind the numbers. Canon and
          spreadsheet share one address book.
        </p>
      </div>

      <GlobalLeadersCarousel countries={topCountries} />
    </section>
  );
}
