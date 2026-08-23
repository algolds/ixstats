// src/components/wiki-os/reader/main/types.ts

export interface CategoryItem {
  name: string;
  color: string;
  desc?: string;
}

export interface RecentChangeItem {
  title: string | null;
  user: string | null;
  timestamp: string | Date | null;
  newLen?: number | null;
  oldLen?: number | null;
  comment?: string | null;
  blurb?: string | null;
  thumbnail?: string | null;
}

export interface CountrySelectItem {
  id: string;
  name: string;
  flagUrl?: string | null;
  economicTier?: string | null;
  population?: number | null;
  gdp?: number | null;
}

export interface AlmanacSpotlightData {
  title: string;
  slug: string;
  category: string;
  excerpt: string;
  thumbnail?: string | null;
  metricLabel?: string;
  metricValue?: string;
}

export interface MainPageContentProps {
  categories: readonly { name: string; color: string }[];
  recentChanges?: RecentChangeItem[] | null;
  isLoadingRecent?: boolean;
  countries?: CountrySelectItem[] | null;
  almanacSpotlight?: AlmanacSpotlightData | null;
  isLoadingAlmanac?: boolean;
}
