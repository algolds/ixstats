/**
 * useCardBackgroundImages Hook
 *
 * Manages loading and caching of Unsplash background images for intelligence cards.
 */

import { useState, useEffect } from "react";
import { unsplashService, type UnsplashImageData } from "~/lib/unsplash-service";

interface UseCardBackgroundImagesProps {
  economicTier: string;
  countryName: string;
  enabled?: boolean;
}

export const useCardBackgroundImages = ({
  economicTier,
  countryName,
  enabled = true,
}: UseCardBackgroundImagesProps) => {
  const [cardBackgroundImages, setCardBackgroundImages] = useState<{[key: string]: UnsplashImageData}>({});
  const [isLoading, setIsLoading] = useState(false);
  const [unsplashEnabled, setUnsplashEnabled] = useState(enabled);

  useEffect(() => {
    if (!unsplashEnabled || isLoading || Object.keys(cardBackgroundImages).length > 0) return;

    const loadCardBackgroundImages = async () => {
      setIsLoading(true);

      try {
        // Tier-specific keywords
        const tierKeywords = {
          'Extravagant': 'luxury modern',
          'Very Strong': 'developed advanced',
          'Strong': 'growing urban',
          'Healthy': 'city community',
          'Developed': 'developing growth',
          'Developing': 'emerging progress',
          'Impoverished': 'rural basic'
        };

        const baseTierKeyword = tierKeywords[economicTier as keyof typeof tierKeywords] || 'business';

        // Card-specific queries
        const cardQueries = {
          'economic-analysis': `${baseTierKeyword} economics finance charts graphs dashboard`,
          'demographics-analysis': `${baseTierKeyword} population people urban society demographics`,
          'development-analysis': `${baseTierKeyword} infrastructure construction development urban planning`,
          'executive-summary': `${baseTierKeyword} government leadership headquarters executive`,
          'economic-power': `${baseTierKeyword} financial markets money banking currency`,
          'demographics': `${baseTierKeyword} community people social population statistics`,
          'strategic-assessment': `${baseTierKeyword} military strategy defense intelligence analysis`,
          'labor-force': `${baseTierKeyword} workers employment labor industry workforce`,
          'geography': `${baseTierKeyword} landscape geography terrain natural environment`
        };

        const loadedImages: {[key: string]: UnsplashImageData} = {};
        const cardKeys = Object.keys(cardQueries);

        for (let i = 0; i < cardKeys.length; i++) {
          const cardKey = cardKeys[i];
          const query = cardQueries[cardKey as keyof typeof cardQueries];

          try {
            if (i > 0) {
              await new Promise(resolve => setTimeout(resolve, 800));
            }

            const images = await unsplashService.searchImages({
              query,
              orientation: 'landscape',
              size: 'regular',
              per_page: 3,
              page: Math.floor(i / 3) + 1
            });

            if (images.length > 0) {
              const imageIndex = i % images.length;
              const selectedImage = images[imageIndex];
              loadedImages[cardKey] = selectedImage;

              if (selectedImage.downloadUrl) {
                try {
                  await unsplashService.trackDownload(selectedImage.downloadUrl);
                } catch (trackError) {
                  console.warn(`Failed to track download for ${cardKey}:`, trackError);
                }
              }
            }
          } catch (error) {
            console.warn(`Failed to load image for ${cardKey}:`, error);
          }
        }

        setCardBackgroundImages(loadedImages);
      } catch (error) {
        console.error('[useCardBackgroundImages] Failed to load background images:', error);
        if (error instanceof Error && error.message.includes('403')) {
          console.warn('Unsplash API access denied - disabling background images');
          setUnsplashEnabled(false);
        }
      } finally {
        setIsLoading(false);
      }
    };

    loadCardBackgroundImages();
  }, [economicTier, countryName, isLoading, cardBackgroundImages, unsplashEnabled]);

  return {
    cardBackgroundImages,
    isLoading,
    unsplashEnabled,
  };
};
