"use client";

import { useState, useEffect } from 'react';
import { flagService } from '~/lib/flag-service';
import { Button } from '~/components/ui/button';

export function FlagTestComponent() {
  const [flagUrl, setFlagUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [testCountry] = useState('Caphiria');

  const loadFlag = async () => {
    setIsLoading(true);
    try {
      console.log('[FlagTest] Loading flag for:', testCountry);
      const url = await flagService.getFlagUrl(testCountry);
      console.log('[FlagTest] Got URL:', url);
      setFlagUrl(url);
    } catch (error) {
      console.error('[FlagTest] Error:', error);
      setFlagUrl(null);
    } finally {
      setIsLoading(false);
    }
  };

  const checkCache = () => {
    const cached = flagService.getCachedFlagUrl(testCountry);
    console.log('[FlagTest] Cached URL:', cached);
    if (cached) {
      setFlagUrl(cached);
    }
  };

  useEffect(() => {
    loadFlag();
  }, []);

  return (
    <div className="p-4 border rounded-lg space-y-4">
      <h3 className="font-semibold">Flag Loading Test - {testCountry}</h3>
      
      <div className="flex gap-2">
        <Button onClick={loadFlag} disabled={isLoading}>
          {isLoading ? 'Loading...' : 'Load Flag'}
        </Button>
        <Button onClick={checkCache} variant="outline">
          Check Cache
        </Button>
      </div>

      {flagUrl && (
        <div className="space-y-2">
          <p className="text-sm">Flag URL: <code className="text-xs bg-muted px-1 py-0.5 rounded">{flagUrl}</code></p>
          <div className="border rounded p-2">
            <img 
              src={flagUrl} 
              alt={`Flag of ${testCountry}`}
              className="h-12 w-auto border"
              onLoad={() => console.log('[FlagTest] Image loaded successfully')}
              onError={(e) => {
                console.error('[FlagTest] Image failed to load');
                console.error('[FlagTest] Image src was:', (e.target as HTMLImageElement).src);
              }}
            />
          </div>
        </div>
      )}

      {!flagUrl && !isLoading && (
        <div className="text-red-500 text-sm">
          No flag URL loaded
        </div>
      )}
    </div>
  );
}