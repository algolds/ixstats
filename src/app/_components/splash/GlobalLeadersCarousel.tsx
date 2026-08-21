"use client";

import React, { useEffect, useMemo } from "react";
import { motion } from "motion/react";
import { Carousel, Card as CarouselCard } from "~/components/ui/apple-cards-carousel";
import { useFlag } from "~/hooks/useUnifiedFlags";
import { CountryShowcaseCard } from "./CountryShowcaseCard";

function CountryCarouselCard({
  country,
  index,
}: {
  country: Record<string, unknown>;
  index: number;
}) {
  const name = String(country.name ?? "");
  const { flagUrl } = useFlag(name);

  return (
    <CarouselCard
      card={{
        src: flagUrl || "/images/placeholder-flag.svg",
        title: name.replace(/_/g, " "),
        category: `#${index + 1} Global Ranking`,
        content: <CountryShowcaseCard country={country} />,
      }}
      index={index}
    />
  );
}

export function GlobalLeadersCarousel({ countries }: { countries: Record<string, unknown>[] }) {
  const carouselCards = useMemo(() => {
    return countries.map((country, idx) => (
      <CountryCarouselCard key={String(country.id ?? idx)} country={country} index={idx} />
    ));
  }, [countries]);

  if (carouselCards.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, delay: 0.15 }}
      className="min-w-0"
    >
      <Carousel items={carouselCards} />
    </motion.div>
  );
}
