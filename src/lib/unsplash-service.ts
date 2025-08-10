/**
 * Unsplash Service for Dynamic Country Header Images
 * Generates contextual images based on country economic/population tiers
 */

export interface UnsplashImageData {
  id: string;
  url: string;
  downloadUrl: string;
  photographer: string;
  photographerUrl: string;
  description: string | null;
}

interface UnsplashSearchParams {
  query: string;
  orientation?: 'landscape' | 'portrait' | 'squarish';
  size?: 'small' | 'regular' | 'full';
  per_page?: number;
  page?: number;
}

class UnsplashService {
  private readonly accessKey = '7f8LVq5DRx6drL_07VYMOZQnBkWs44Tp8gc3X2sguwE';
  private readonly baseUrl = 'https://api.unsplash.com';
  private readonly cache = new Map<string, { data: UnsplashImageData[]; timestamp: number }>();
  private readonly cacheTtl = 1000 * 60 * 60 * 24; // 24 hours

  /**
   * Generate search query based on country tier and characteristics
   */
  private generateSearchQuery(economicTier: string, populationTier: string, continent?: string): string {
    const economicKeywords = {
      'Extravagant': ['luxury skyline', 'modern architecture', 'advanced technology', 'prosperity'],
      'Very Strong': ['developed city', 'modern infrastructure', 'urban development', 'progress'],
      'Strong': ['growing city', 'development', 'modern buildings', 'advancement'],
      'Healthy': ['city development', 'infrastructure', 'urban growth', 'community'],
      'Developed': ['developing city', 'construction', 'growth', 'building'],
      'Developing': ['emerging market', 'development', 'construction', 'progress'],
      'Impoverished': ['rural development', 'community', 'resilience', 'growth potential']
    };

    const populationKeywords = {
      'Tier X': ['megacity', 'massive population', 'dense urban'],
      'Tier 7': ['large metropolis', 'major city', 'urban center'],
      'Tier 6': ['big city', 'metropolitan', 'urban'],
      'Tier 5': ['city skyline', 'urban area', 'developed'],
      'Tier 4': ['medium city', 'growing urban', 'development'],
      'Tier 3': ['small city', 'town development', 'community'],
      'Tier 2': ['town', 'local community', 'small urban'],
      'Tier 1': ['village', 'rural community', 'countryside']
    };

    const continentKeywords = {
      'Africa': ['african', 'saharan', 'tropical'],
      'Asia': ['asian', 'oriental', 'eastern'],
      'Europe': ['european', 'mediterranean', 'northern'],
      'North America': ['american', 'western', 'continental'],
      'South America': ['latin american', 'amazonian', 'andean'],
      'Oceania': ['pacific', 'island', 'coastal']
    };

    const economicTerms = economicKeywords[economicTier as keyof typeof economicKeywords] || ['city', 'development'];
    const populationTerms = populationKeywords[populationTier as keyof typeof populationKeywords] || ['urban'];
    const continentTerms = continent ? (continentKeywords[continent as keyof typeof continentKeywords] || []) : [];

    // Combine terms strategically
    const selectedTerms = [
      economicTerms[Math.floor(Math.random() * economicTerms.length)],
      ...continentTerms.slice(0, 1)
    ].filter(Boolean);

    return selectedTerms.join(' ');
  }

  /**
   * Fetch images from Unsplash API
   */
  private async fetchImages(params: UnsplashSearchParams): Promise<UnsplashImageData[]> {
    const cacheKey = JSON.stringify(params);
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.cacheTtl) {
      return cached.data;
    }

    const searchParams = new URLSearchParams({
      query: params.query,
      orientation: params.orientation || 'landscape',
      per_page: (params.per_page || 5).toString(),
      page: (params.page || 1).toString(),
    });

    try {
      const response = await fetch(`${this.baseUrl}/search/photos?${searchParams}`, {
        headers: {
          'Authorization': `Client-ID ${this.accessKey}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Unsplash API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const images: UnsplashImageData[] = data.results.map((photo: any) => ({
        id: photo.id,
        url: photo.urls[params.size || 'regular'],
        downloadUrl: photo.links.download_location,
        photographer: photo.user.name,
        photographerUrl: photo.user.links.html,
        description: photo.description || photo.alt_description,
      }));

      // Cache the results
      this.cache.set(cacheKey, { data: images, timestamp: Date.now() });
      
      return images;
    } catch (error) {
      console.error('Failed to fetch Unsplash images:', error);
      return this.getFallbackImages(params.query);
    }
  }

  /**
   * Get fallback images for when API fails
   */
  private getFallbackImages(query: string): UnsplashImageData[] {
    const fallbackUrls = [
      'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=1200&h=400&fit=crop&crop=entropy&auto=format',
      'https://images.unsplash.com/photo-1514565131-fce0801e5785?w=1200&h=400&fit=crop&crop=entropy&auto=format',
      'https://images.unsplash.com/photo-1480714378408-67cf0d13bc1f?w=1200&h=400&fit=crop&crop=entropy&auto=format'
    ];

    return fallbackUrls.map((url, index) => ({
      id: `fallback-${index}`,
      url,
      downloadUrl: '',
      photographer: 'Unsplash',
      photographerUrl: 'https://unsplash.com',
      description: `Fallback image for ${query}`,
    }));
  }

  /**
   * Get header image for a specific country based on its characteristics
   */
  async getCountryHeaderImage(
    economicTier: string,
    populationTier: string,
    countryName: string,
    continent?: string
  ): Promise<UnsplashImageData> {
    const query = this.generateSearchQuery(economicTier, populationTier, continent);
    
    const images = await this.fetchImages({
      query,
      orientation: 'landscape',
      size: 'regular',
      per_page: 5,
    });

    // Select image based on tier (higher tiers get first pick)
    const tierPriority = {
      'Extravagant': 0,
      'Very Strong': 0,
      'Strong': 1,
      'Healthy': 1,
      'Developed': 2,
      'Developing': 3,
      'Impoverished': 4
    };

    const imageIndex = Math.min(
      tierPriority[economicTier as keyof typeof tierPriority] || 0,
      images.length - 1
    );

    return images[imageIndex] || images[0];
  }

  /**
   * Trigger download tracking (required by Unsplash API terms)
   */
  async trackDownload(downloadUrl: string): Promise<void> {
    if (!downloadUrl) return;
    
    try {
      await fetch(downloadUrl, {
        headers: {
          'Authorization': `Client-ID ${this.accessKey}`,
        },
      });
    } catch (error) {
      console.error('Failed to track Unsplash download:', error);
    }
  }
}

export const unsplashService = new UnsplashService();
export default UnsplashService;