"use client";

import React, { useState, useEffect } from 'react';
import { Input } from '~/components/ui/input';
import { Button } from '~/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select';
import { api } from '~/trpc/react';
import { toast } from 'sonner';
import { cn } from '~/lib/utils';
import { Loader2, Check } from 'lucide-react';
import { useInView } from 'react-intersection-observer';

interface WikiSearchProps {
  onImageSelect?: (imageUrl: string) => void;
}

export function WikiSearch({ onImageSelect }: WikiSearchProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeQuery, setActiveQuery] = useState('');
  const [wikiSource, setWikiSource] = useState<'ixwiki' | 'iiwiki'>('ixwiki');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const { ref: bottomRef, inView } = useInView();

  const { 
    data, 
    isLoading, 
    fetchNextPage, 
    hasNextPage, 
    isFetchingNextPage 
  } = api.thinkpages.searchWiki.useInfiniteQuery(
    { query: activeQuery, wiki: wikiSource, limit: 30 },
    {
      enabled: !!activeQuery,
      getNextPageParam: (lastPage) => lastPage.nextCursor,
    }
  );

  const handleSearch = () => {
    if (!searchQuery.trim()) {
      toast.info('Please enter a search query.');
      return;
    }
    setActiveQuery(searchQuery);
  };

  const handleWikiChange = (value: string) => {
    if (value === 'ixwiki' || value === 'iiwiki') {
      setWikiSource(value);
    }
  };

  const handleImageClick = (imageUrl: string) => {
    setSelectedImage(imageUrl);
    if (onImageSelect) {
      onImageSelect(imageUrl);
      toast.success('Image selected!');
    }
  };

  // Infinite scroll - load more when scrolling to bottom
  useEffect(() => {
    if (inView && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Flatten all pages into single array
  const allImages = data?.pages.flatMap(page => page.images) || [];

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <Select value={wikiSource} onValueChange={handleWikiChange}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Select a wiki" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ixwiki">ixwiki</SelectItem>
            <SelectItem value="iiwiki">iiwiki (Limited)</SelectItem>
          </SelectContent>
        </Select>
        <Input 
          placeholder="Search for images (e.g., 'juan kerr', 'flag')..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
          className="flex-1"
        />
        <Button onClick={handleSearch} disabled={isLoading || !searchQuery.trim()}>
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Search'}
        </Button>
      </div>
      <div className="mt-2 max-h-80 overflow-y-auto">
        <div className="grid grid-cols-3 gap-2">
          {isLoading ? (
            <div className="col-span-3 flex justify-center items-center h-32">
              <Loader2 className="animate-spin h-6 w-6 text-blue-400" />
            </div>
          ) : allImages.length > 0 ? (
            <>
              {allImages.map((file: any, index: number) => (
                <div
                  key={`${file.path}-${index}`}
                  className={cn(
                    "relative group cursor-pointer rounded-lg overflow-hidden border-2 transition-all",
                    selectedImage === file.path ? "border-blue-500" : "border-transparent hover:border-blue-400"
                  )}
                  onClick={() => handleImageClick(file.path)}
                >
                  <img 
                    src={file.url || file.path} 
                    alt={file.name} 
                    className="w-full h-24 object-cover"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-medium p-1 text-center">
                    {file.name?.replace('File:', '')}
                  </div>
                  {selectedImage === file.path && (
                    <div className="absolute inset-0 flex items-center justify-center bg-blue-500/50">
                      <Check className="h-6 w-6 text-white" />
                    </div>
                  )}
                </div>
              ))}
              
              {/* Load More Trigger */}
              {hasNextPage && (
                <div ref={bottomRef} className="col-span-3 flex justify-center py-2">
                  {isFetchingNextPage ? (
                    <Loader2 className="animate-spin h-5 w-5 text-blue-400" />
                  ) : (
                    <Button variant="outline" size="sm" onClick={() => fetchNextPage()}>
                      Load More Images
                    </Button>
                  )}
                </div>
              )}
            </>
          ) : activeQuery ? (
            <div className="col-span-3 text-center text-muted-foreground p-6">
              No images found for "{activeQuery}". Try a different search query.
            </div>
          ) : (
            <div className="col-span-3 text-center text-muted-foreground p-6">
              Enter a search query to find images from {wikiSource}.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
