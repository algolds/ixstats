"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '~/lib/utils';
import { X, Search, Loader2, Check, Download } from 'lucide-react';
import { Input } from '~/components/ui/input';
import { Button } from '~/components/ui/button';
import * as SelectPrimitive from '@radix-ui/react-select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs';
import { api } from '~/trpc/react';
import { toast } from 'sonner';
import { useInView } from 'react-intersection-observer';
import { processImageSelection, isExternalImageUrl } from '~/lib/image-download-service';
import type { BaseImageResult, WikiImageResult } from '~/types/media-search';

interface MediaSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImageSelect: (imageUrl: string) => void;
}

export function MediaSearchModal({ isOpen, onClose, onImageSelect }: MediaSearchModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'repository' | 'wiki-commons' | 'wiki'>('repository');
  const [isDownloading, setIsDownloading] = useState(false);

  const [wikiCommonsSearchQuery, setWikiCommonsSearchQuery] = useState('');
  const [wikiSearchQuery, setWikiSearchQuery] = useState('');
  const [wikiSource, setWikiSource] = useState<'ixwiki' | 'iiwiki'>('ixwiki');

  // Debounced search queries to reduce API calls
  const [debouncedRepoQuery, setDebouncedRepoQuery] = useState('');
  const [debouncedCommonsQuery, setDebouncedCommonsQuery] = useState('');
  const [debouncedWikiQuery, setDebouncedWikiQuery] = useState('');

  // Debounce search queries
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedRepoQuery(searchQuery), 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedCommonsQuery(wikiCommonsSearchQuery), 500);
    return () => clearTimeout(timer);
  }, [wikiCommonsSearchQuery]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedWikiQuery(wikiSearchQuery), 500);
    return () => clearTimeout(timer);
  }, [wikiSearchQuery]);

  const { ref: repoRef, inView: repoInView } = useInView();
  const { ref: commonsRef, inView: commonsInView } = useInView();
  const { ref: wikiRef, inView: wikiInView } = useInView();

  const [repoPage, setRepoPage] = useState(1);
  const [commonsPage, setCommonsPage] = useState(1);

  const {
    data: imagesData,
    isLoading: isLoadingRepo,
    isFetching: isFetchingNextRepoPage,
  } = api.thinkpages.searchUnsplashImages.useQuery(
    { query: debouncedRepoQuery, per_page: 6, page: repoPage },
    {
      enabled: activeTab === 'repository' && !!debouncedRepoQuery,
      staleTime: 5 * 60 * 1000, // 5 minutes cache
      refetchOnWindowFocus: false,
    }
  );

  // Memoize fetch functions to prevent infinite re-renders
  const fetchNextRepoPage = useCallback(() => setRepoPage(prev => prev + 1), []);
  const hasNextRepoPage = imagesData && imagesData.length >= 6; // Only load more if we got a full page

  const {
    data: wikiCommonsImagesData,
    isLoading: isLoadingWikiCommons,
    isFetching: isFetchingNextCommonsPage,
  } = api.thinkpages.searchWikiCommonsImages.useQuery(
    { query: debouncedCommonsQuery, per_page: 6, page: commonsPage },
    {
      enabled: activeTab === 'wiki-commons' && !!debouncedCommonsQuery,
      staleTime: 5 * 60 * 1000, // 5 minutes cache
      refetchOnWindowFocus: false,
    }
  );

  const fetchNextCommonsPage = useCallback(() => setCommonsPage(prev => prev + 1), []);
  const hasNextCommonsPage = wikiCommonsImagesData && wikiCommonsImagesData.length >= 6; // Only load more if we got a full page

  const [wikiCursor, setWikiCursor] = useState<string | undefined>(undefined);

  const {
    data: wikiData,
    isLoading: isLoadingWiki,
    isFetching: isFetchingNextWikiPage,
    refetch: refetchWiki,
  } = api.thinkpages.searchWiki.useQuery(
    { query: debouncedWikiQuery, wiki: wikiSource, limit: 30, cursor: wikiCursor },
    {
      enabled: activeTab === 'wiki' && !!debouncedWikiQuery,
      staleTime: 5 * 60 * 1000, // 5 minutes cache
      refetchOnWindowFocus: false
    }
  );

  const fetchNextWikiPage = useCallback(() => {
    if (wikiData?.nextCursor) {
      setWikiCursor(wikiData.nextCursor);
    }
  }, [wikiData?.nextCursor]);
  const hasNextWikiPage = wikiData?.hasMore ?? false;

  const wikiImages = wikiData?.images || [];

  // Throttled infinite scroll to prevent excessive API calls
  useEffect(() => {
    if (repoInView && hasNextRepoPage && !isFetchingNextRepoPage) {
      const timer = setTimeout(() => {
        fetchNextRepoPage();
      }, 300); // 300ms throttle
      return () => clearTimeout(timer);
    }
  }, [repoInView, hasNextRepoPage, isFetchingNextRepoPage, fetchNextRepoPage]);

  useEffect(() => {
    if (commonsInView && hasNextCommonsPage && !isFetchingNextCommonsPage) {
      const timer = setTimeout(() => {
        fetchNextCommonsPage();
      }, 300); // 300ms throttle
      return () => clearTimeout(timer);
    }
  }, [commonsInView, hasNextCommonsPage, isFetchingNextCommonsPage, fetchNextCommonsPage]);

  useEffect(() => {
    if (wikiInView && hasNextWikiPage && !isFetchingNextWikiPage) {
      const timer = setTimeout(() => {
        fetchNextWikiPage();
      }, 300); // 300ms throttle
      return () => clearTimeout(timer);
    }
  }, [wikiInView, hasNextWikiPage, isFetchingNextWikiPage, fetchNextWikiPage]);

  useEffect(() => {
    if (isOpen) {
      // Reset state when modal opens
      setSearchQuery('');
      setSelectedImage(null);
      setWikiCommonsSearchQuery('');
      setWikiSearchQuery('');
      setWikiSource('ixwiki');
      setDebouncedRepoQuery('');
      setDebouncedCommonsQuery('');
      setDebouncedWikiQuery('');
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
    } else {
      // Restore body scroll when modal is closed
      document.body.style.overflow = '';
    }
    
    // Cleanup on unmount
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const handleSelectImage = async () => {
    if (!selectedImage) {
      toast.error('Please select an image first.');
      return;
    }

    try {
      // Check if image needs to be downloaded
      if (isExternalImageUrl(selectedImage)) {
        setIsDownloading(true);
        toast.info('Downloading image...');

        const processedUrl = await processImageSelection(selectedImage, {
          onProgress: (message) => console.log('[MediaSearchModal]', message),
          onError: (error) => console.error('[MediaSearchModal]', error),
        });

        toast.success('Image downloaded and ready to use!');
        onImageSelect(processedUrl);
      } else {
        // Already a data URL or local path
        onImageSelect(selectedImage);
      }
      
      onClose();
    } catch (error) {
      console.error('[MediaSearchModal] Failed to process image:', error);
      toast.error('Failed to download image. Please try again.');
    } finally {
      setIsDownloading(false);
    }
  };

  const images = (imagesData ?? []) as BaseImageResult[];
  const wikiCommonsImages = (wikiCommonsImagesData ?? []) as BaseImageResult[];

  // Create portal element
  const [portalElement, setPortalElement] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setPortalElement(document.body);
    }
  }, []);

  if (!portalElement) return null;

  const modalContent = (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-4xl mx-4 max-h-[90vh] flex flex-col bg-neutral-900/50 border border-white/10 rounded-xl shadow-lg backdrop-blur-xl"
          >
            {/* Header */}
            <div className="py-4 px-6 flex justify-between items-center border-b border-white/10">
              <h3 className="font-bold text-white text-lg">Search Image Repository</h3>
              <button type="button" onClick={onClose} className="p-2 rounded-full text-neutral-400 hover:bg-white/10 transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>

            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'repository' | 'wiki-commons' | 'wiki')} className="flex flex-col flex-1 min-h-0">
              <TabsList className="grid w-full grid-cols-3 rounded-none border-b border-white/10 bg-transparent p-0">
                <TabsTrigger value="repository" className="rounded-none data-[state=active]:bg-white/10 data-[state=active]:shadow-none data-[state=active]:text-white">Repository</TabsTrigger>
                <TabsTrigger value="wiki-commons" className="rounded-none data-[state=active]:bg-white/10 data-[state=active]:shadow-none data-[state=active]:text-white">Wiki Commons</TabsTrigger>
                <TabsTrigger value="wiki" className="rounded-none data-[state=active]:bg-white/10 data-[state=active]:shadow-none data-[state=active]:text-white">Wiki</TabsTrigger>
              </TabsList>

              <TabsContent value="repository" className="flex-1 flex flex-col data-[state=inactive]:hidden min-h-0">
                {/* Search and Filters */}
                <div className="p-4 border-b border-white/10 flex items-center gap-2">
                  <Input
                    placeholder="Search images (e.g., 'nature', 'city', 'person')"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="flex-1"
                  />
                </div>

                {/* Image Results */}
                <div className="flex-1 p-4 overflow-y-auto max-h-[60vh]">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {isLoadingRepo && images.length === 0 ? (
                    <div className="col-span-2 md:col-span-3 flex justify-center items-center h-48">
                      <Loader2 className="animate-spin h-8 w-8 text-blue-400" />
                    </div>
                  ) : images.length > 0 ? (
                    <>
                      {images.map((image: BaseImageResult, index: number) => (
                        <div
                          key={`repo-${image.id}-${index}`}
                          className={cn(
                            "relative group cursor-pointer rounded-lg overflow-hidden border-2 transition-all",
                            selectedImage === image.url ? "border-blue-500" : "border-transparent hover:border-blue-400"
                          )}
                          onClick={() => setSelectedImage(image.url)}
                        >
                          <img 
                            src={image.url} 
                            alt={image.description ?? "Unsplash Image"} 
                            className="w-full h-32 object-cover"
                            loading="lazy"
                            decoding="async"
                          />
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-sm font-medium">
                            {image.photographer}
                          </div>
                          {selectedImage === image.url && (
                            <div className="absolute inset-0 flex items-center justify-center bg-blue-500/50">
                              <Check className="h-8 w-8 text-white" />
                            </div>
                          )}
                        </div>
                      ))}
                      <div ref={repoRef} className="col-span-2 md:col-span-3 flex justify-center items-center p-4">
                        {isFetchingNextRepoPage && <Loader2 className="animate-spin h-8 w-8 text-blue-400" />}
                      </div>
                    </>
                  ) : (
                    <div className="col-span-2 md:col-span-3 text-center text-muted-foreground p-8">
                      No images found. Try a different search query.
                    </div>
                  )}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="wiki-commons" className="flex-1 flex flex-col data-[state=inactive]:hidden min-h-0">
                {/* Search and Filters */}
                <div className="p-4 border-b border-white/10 flex items-center gap-2">
                  <Input
                    placeholder="Search Wiki Commons images (e.g., 'flag of Germany', 'Eiffel Tower')"
                    value={wikiCommonsSearchQuery}
                    onChange={(e) => setWikiCommonsSearchQuery(e.target.value)}
                    className="flex-1"
                  />
                </div>

                {/* Image Results */}
                <div className="flex-1 p-4 overflow-y-auto max-h-[60vh]">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {isLoadingWikiCommons && wikiCommonsImages.length === 0 ? (
                    <div className="col-span-2 md:col-span-3 flex justify-center items-center h-48">
                      <Loader2 className="animate-spin h-8 w-8 text-blue-400" />
                    </div>
                  ) : wikiCommonsImages.length > 0 ? (
                    <>
                      {wikiCommonsImages.map((image: BaseImageResult, index: number) => (
                        <div
                          key={`commons-${image.id}-${index}`}
                          className={cn(
                            "relative group cursor-pointer rounded-lg overflow-hidden border-2 transition-all",
                            selectedImage === image.url ? "border-blue-500" : "border-transparent hover:border-blue-400"
                          )}
                          onClick={() => setSelectedImage(image.url)}
                        >
                          <img 
                            src={image.url} 
                            alt={image.description ?? "Wiki Commons Image"} 
                            className="w-full h-32 object-cover"
                            loading="lazy"
                            decoding="async"
                          />
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-sm font-medium">
                            {image.photographer}
                          </div>
                          {selectedImage === image.url && (
                            <div className="absolute inset-0 flex items-center justify-center bg-blue-500/50">
                              <Check className="h-8 w-8 text-white" />
                            </div>
                          )}
                        </div>
                      ))}
                      <div ref={commonsRef} className="col-span-2 md:col-span-3 flex justify-center items-center p-4">
                        {isFetchingNextCommonsPage && <Loader2 className="animate-spin h-8 w-8 text-blue-400" />}
                      </div>
                    </>
                  ) : (
                    <div className="col-span-2 md:col-span-3 text-center text-muted-foreground p-8">
                      No images found. Try a different search query.
                    </div>
                  )}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="wiki" className="flex-1 flex flex-col data-[state=inactive]:hidden min-h-0">
                <div className="p-4 border-b border-white/10 flex items-center gap-2">
                  <SelectPrimitive.Root value={wikiSource} onValueChange={(value) => setWikiSource(value as 'ixwiki' | 'iiwiki')}>
                    <SelectPrimitive.Trigger className="flex h-10 w-[180px] items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">
                      <SelectPrimitive.Value placeholder="Select a wiki" />
                      <SelectPrimitive.Icon asChild>
                        <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 opacity-50">
                          <path d="m4.93179 5.43179c.20264-.20264.53153-.20264.73417 0L8 7.76576l2.33404-2.33397c.20264-.20264.53153-.20264.73417 0 .20264.20264.20264.53153 0 .73417L8.36708 8.56794c-.20264.20264-.53153.20264-.73417 0L5.29289 6.22612c-.20264-.20264-.20264-.53153 0-.73433Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd"></path>
                        </svg>
                      </SelectPrimitive.Icon>
                    </SelectPrimitive.Trigger>
                    <SelectPrimitive.Portal>
                      <SelectPrimitive.Content
                        className="relative z-50 max-h-96 min-w-[8rem] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2"
                        position="popper"
                        side="bottom"
                        align="start"
                      >
                        <SelectPrimitive.Viewport className="p-1 h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)]">
                          <SelectPrimitive.Item
                            value="ixwiki"
                            className="relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
                          >
                            <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                              <SelectPrimitive.ItemIndicator>
                                <Check className="h-4 w-4" />
                              </SelectPrimitive.ItemIndicator>
                            </span>
                            <SelectPrimitive.ItemText>ixwiki</SelectPrimitive.ItemText>
                          </SelectPrimitive.Item>
                          <SelectPrimitive.Item
                            value="iiwiki"
                            className="relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
                          >
                            <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                              <SelectPrimitive.ItemIndicator>
                                <Check className="h-4 w-4" />
                              </SelectPrimitive.ItemIndicator>
                            </span>
                            <SelectPrimitive.ItemText>
                              <span>iiwiki</span>
                              <span className="text-xs text-yellow-500 ml-2">(Limited - Cloudflare protected)</span>
                            </SelectPrimitive.ItemText>
                          </SelectPrimitive.Item>
                        </SelectPrimitive.Viewport>
                      </SelectPrimitive.Content>
                    </SelectPrimitive.Portal>
                  </SelectPrimitive.Root>
                  <Input
                    placeholder="Search for images (e.g., 'flag', 'coat of arms', 'juan kerr')..."
                    value={wikiSearchQuery}
                    onChange={(e) => setWikiSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && refetchWiki()}
                    className="flex-1"
                  />
                  <Button onClick={() => refetchWiki()} disabled={isLoadingWiki || !debouncedWikiQuery.trim()}>
                    {isLoadingWiki ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <Search className="h-4 w-4 mr-2" />}Search
                  </Button>
                </div>
                <div className="flex-1 p-4 overflow-y-auto max-h-[60vh]">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {isLoadingWiki ? (
                    <div className="col-span-2 md:col-span-3 flex justify-center items-center h-48">
                      <Loader2 className="animate-spin h-8 w-8 text-blue-400" />
                    </div>
                  ) : wikiImages.length > 0 ? (
                    <>
                      {wikiImages.map((image: WikiImageResult, index: number) => (
                        <div
                          key={`wiki-${image.path}-${index}`}
                          className={cn(
                            "relative group cursor-pointer rounded-lg overflow-hidden border-2 transition-all",
                            selectedImage === image.path ? "border-blue-500" : "border-transparent hover:border-blue-400"
                          )}
                          onClick={() => setSelectedImage(image.path)}
                        >
                          <img 
                            src={image.url ?? image.path} 
                            alt={image.name ?? "Wiki Image"} 
                            className="w-full h-32 object-cover"
                            loading="lazy"
                            decoding="async"
                          />
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-sm font-medium p-2 text-center">
                            {image.name?.replace('File:', '') ?? 'Wiki Image'}
                          </div>
                          {selectedImage === image.path && (
                            <div className="absolute inset-0 flex items-center justify-center bg-blue-500/50">
                              <Check className="h-8 w-8 text-white" />
                            </div>
                          )}
                        </div>
                      ))}
                      
                      {/* Infinite Scroll Trigger */}
                      {hasNextWikiPage && (
                        <div ref={wikiRef} className="col-span-2 md:col-span-3 flex justify-center py-4">
                          {isFetchingNextWikiPage ? (
                            <Loader2 className="animate-spin h-6 w-6 text-blue-400" />
                          ) : (
                            <Button variant="outline" size="sm" onClick={() => fetchNextWikiPage()}>
                              Load More Images
                            </Button>
                          )}
                        </div>
                      )}
                    </>
                  ) : debouncedWikiQuery ? (
                    <div className="col-span-2 md:col-span-3 text-center text-muted-foreground p-8">
                      No images found for "{debouncedWikiQuery}". Try a different search query.
                    </div>
                  ) : (
                    <div className="col-span-2 md:col-span-3 text-center text-muted-foreground p-8">
                      Enter a search query to find images from {wikiSource}.
                    </div>
                  )}
                  </div>
                </div>
              </TabsContent>
            </Tabs>

            {/* Always visible Select Image button */}
            <div className="p-4 border-t border-white/10 flex justify-end items-center gap-3">
              {isDownloading && (
                <div className="flex items-center gap-2 text-sm text-blue-400">
                  <Download className="h-4 w-4 animate-bounce" />
                  <span>Downloading image...</span>
                </div>
              )}
              <Button 
                onClick={handleSelectImage} 
                disabled={!selectedImage || isDownloading}
              >
                {isDownloading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Downloading...
                  </>
                ) : (
                  'Select Image'
                )}
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );

  return createPortal(modalContent, portalElement);
}