"use client";

import { GlobalLeadersCarousel } from "./GlobalLeadersCarousel";
import { splashGold } from "~/lib/splash/mycountry-gold";

export function SplashTwoWorlds({ topCountries }: { topCountries: Record<string, unknown>[] }) {
  return (
    <section className="mx-auto mb-16 max-w-7xl md:mb-20">
      <div className="mx-auto mb-10 max-w-2xl text-center">
        <h2 className={`text-large-title mb-3 ${splashGold.headline}`}>Top nations by GDP</h2>
        <p className="text-label-secondary text-body md:text-title-3 leading-relaxed">
          Nations ranked by total GDP. Each card links to the country&apos;s profile and wiki
          article.
        </p>
      </div>

      <GlobalLeadersCarousel countries={topCountries} />
    </section>
  );
}
