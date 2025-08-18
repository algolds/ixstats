"use client";

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '~/lib/utils';
import { X, Search, Loader2, Check } from 'lucide-react';
import { Input } from '~/components/ui/input';
import { Button } from '~/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs';
import { api } from '~/trpc/react';
import { toast } from 'sonner';
import { useInView } from 'react-intersection-observer';

interface MediaSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImageSelect: (imageUrl: string) => void;
}

export function MediaSearchModal({ isOpen, onClose, onImageSelect }: MediaSearchModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'repository' | 'wiki-commons' | 'wiki'>('repository');

  const [wikiCommonsSearchQuery, setWikiCommonsSearchQuery] = useState('');
  const [wikiSearchQuery, setWikiSearchQuery] = useState('');
  const [wikiSource, setWikiSource] = useState<'ixwiki' | 'iiwiki'>('ixwiki');
  const [wikiSearchResults, setWikiSearchResults] = useState<{ path: string; name: string; url?: string; description?: string; }[]>([]);

  const { ref: repoRef, inView: repoInView } = useInView();
  const { ref: commonsRef, inView: commonsInView } = useInView();

  const { 
    data: imagesData,
    fetchNextPage: fetchNextRepoPage,
    hasNextPage: hasNextRepoPage,
    isLoading: isLoadingRepo,
    isFetchingNextPage: isFetchingNextRepoPage,
  } = api.thinkpages.searchUnsplashImages.useInfiniteQuery(
    { query: searchQuery, per_page: 12 },
    {
      getNextPageParam: (lastPage, allPages) => {
        return lastPage.length === 12 ? allPages.length + 1 : undefined;
      },
      enabled: activeTab === 'repository' && !!searchQuery
    }
  );

  const { 
    data: wikiCommonsImagesData,
    fetchNextPage: fetchNextCommonsPage,
    hasNextPage: hasNextCommonsPage,
    isLoading: isLoadingWikiCommons,
    isFetchingNextPage: isFetchingNextCommonsPage,
  } = api.thinkpages.searchWikiCommonsImages.useInfiniteQuery(
    { query: wikiCommonsSearchQuery, per_page: 12 },
    {
      getNextPageParam: (lastPage, allPages) => {
        return lastPage.length === 12 ? allPages.length + 1 : undefined;
      },
      enabled: activeTab === 'wiki-commons' && !!wikiCommonsSearchQuery
    }
  );

  const searchWikiMutation = api.thinkpages.searchWiki.useMutation({
    onSuccess: (data) => {
      setWikiSearchResults(data);
      if (data.length === 0) {
        toast.info('No images found.');
      }
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  useEffect(() => {
    if (repoInView && hasNextRepoPage) {
      fetchNextRepoPage();
    }
  }, [repoInView, hasNextRepoPage, fetchNextRepoPage]);

  useEffect(() => {
    if (commonsInView && hasNextCommonsPage) {
      fetchNextCommonsPage();
    }
  }, [commonsInView, hasNextCommonsPage, fetchNextCommonsPage]);

  useEffect(() => {
    if (isOpen) {
      // Reset state when modal opens
      setSearchQuery('');
      setSelectedImage(null);
      setWikiCommonsSearchQuery('');
      setWikiSearchQuery('');
      setWikiSearchResults([]);
      setWikiSource('ixwiki');
    }
  }, [isOpen]);

  const handleSelectImage = () => {
    if (selectedImage) {
      onImageSelect(selectedImage);
    } else {
      toast.error('Please select an image first.');
    }
  };

  const images = imagesData?.pages.flatMap(page => page) ?? [];
  const wikiCommonsImages = wikiCommonsImagesData?.pages.flatMap(page => page) ?? [];

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center hs-overlay-backdrop-open:bg-black/50">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
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
                <div className="flex-1 p-4 overflow-y-auto grid grid-cols-3 gap-4">
                  {isLoadingRepo && images.length === 0 ? (
                    <div className="col-span-3 flex justify-center items-center h-48">
                      <Loader2 className="animate-spin h-8 w-8 text-blue-400" />
                    </div>
                  ) : images.length > 0 ? (
                    <>
                      {images.map((image) => (
                        <div
                          key={image.id}
                          className={cn(
                            "relative group cursor-pointer rounded-lg overflow-hidden border-2 transition-all",
                            selectedImage === image.url ? "border-blue-500" : "border-transparent hover:border-blue-400"
                          )}
                          onClick={() => setSelectedImage(image.url)}
                        >
                          <img src={image.url} alt={image.description || "Unsplash Image"} className="w-full h-32 object-cover" />
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
                      <div ref={repoRef} className="col-span-3 flex justify-center items-center p-4">
                        {isFetchingNextRepoPage && <Loader2 className="animate-spin h-8 w-8 text-blue-400" />}
                      </div>
                    </>
                  ) : (
                    <div className="col-span-3 text-center text-muted-foreground p-8">
                      No images found. Try a different search query.
                    </div>
                  )}
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
                <div className="flex-1 p-4 overflow-y-auto grid grid-cols-3 gap-4">
                  {isLoadingWikiCommons && wikiCommonsImages.length === 0 ? (
                    <div className="col-span-3 flex justify-center items-center h-48">
                      <Loader2 className="animate-spin h-8 w-8 text-blue-400" />
                    </div>
                  ) : wikiCommonsImages.length > 0 ? (
                    <>
                      {wikiCommonsImages.map((image) => (
                        <div
                          key={image.id}
                          className={cn(
                            "relative group cursor-pointer rounded-lg overflow-hidden border-2 transition-all",
                            selectedImage === image.url ? "border-blue-500" : "border-transparent hover:border-blue-400"
                          )}
                          onClick={() => setSelectedImage(image.url)}
                        >
                          <img src={image.url} alt={image.description || "Wiki Commons Image"} className="w-full h-32 object-cover" />
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
                      <div ref={commonsRef} className="col-span-3 flex justify-center items-center p-4">
                        {isFetchingNextCommonsPage && <Loader2 className="animate-spin h-8 w-8 text-blue-400" />}
                      </div>
                    </>
                  ) : (
                    <div className="col-span-3 text-center text-muted-foreground p-8">
                      No images found. Try a different search query.
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="wiki" className="flex-1 flex flex-col data-[state=inactive]:hidden min-h-0">
                <div className="p-4 border-b border-white/10 flex items-center gap-2">
                  <Select value={wikiSource} onValueChange={(value) => setWikiSource(value as 'ixwiki' | 'iiwiki')}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Select a wiki" />
                    </SelectTrigger>
                    <SelectContent className="relative z-[80]">
                      <SelectItem value="ixwiki">ixwiki</SelectItem>
                      <SelectItem value="iiwiki">iiwiki</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    placeholder="Search for images (e.g., 'flag', 'coat of arms')..."
                    value={wikiSearchQuery}
                    onChange={(e) => setWikiSearchQuery(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && searchWikiMutation.mutate({ query: wikiSearchQuery, wiki: wikiSource })}
                    className="flex-1"
                  />
                  <Button onClick={() => searchWikiMutation.mutate({ query: wikiSearchQuery, wiki: wikiSource })} disabled={searchWikiMutation.isPending || !wikiSearchQuery.trim()}>
                    {searchWikiMutation.isPending ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <Search className="h-4 w-4 mr-2" />}Search
                  </Button>
                </div>
                <div className="flex-1 p-4 overflow-y-auto grid grid-cols-3 gap-4">
                  {searchWikiMutation.isPending ? (
                    <div className="col-span-3 flex justify-center items-center h-48">
                      <Loader2 className="animate-spin h-8 w-8 text-blue-400" />
                    </div>
                  ) : wikiSearchResults.length > 0 ? (
                    wikiSearchResults.map((image) => (
                      <div
                        key={image.path}
                        className={cn(
                          "relative group cursor-pointer rounded-lg overflow-hidden border-2 transition-all",
                          selectedImage === image.path ? "border-blue-500" : "border-transparent hover:border-blue-400"
                        )}
                        onClick={() => setSelectedImage(image.path)}
                      >
                        <img src={image.url || image.path} alt={image.name || "Wiki Image"} className="w-full h-32 object-cover" />
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-sm font-medium p-2 text-center">
                          {image.name?.replace('File:', '') || 'Wiki Image'}
                        </div>
                        {selectedImage === image.path && (
                          <div className="absolute inset-0 flex items-center justify-center bg-blue-500/50">
                            <Check className="h-8 w-8 text-white" />
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="col-span-3 text-center text-muted-foreground p-8">
                      No images found. Try a different search query.
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>

            {/* Always visible Select Image button */}
            <div className="p-4 border-t border-white/10 flex justify-end items-center">
              <Button onClick={handleSelectImage} disabled={!selectedImage}>
                Select Image
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}