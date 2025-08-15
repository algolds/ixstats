"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '~/lib/utils';
import { X, Search, Loader2, Check } from 'lucide-react';
import { Input } from '~/components/ui/input';
import { Button } from '~/components/ui/button';
import { api } from '~/trpc/react';
import { toast } from 'sonner';

interface UnsplashImageSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImageSelect: (imageUrl: string) => void;
}

export function UnsplashImageSearchModal({ isOpen, onClose, onImageSelect }: UnsplashImageSearchModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const { data: images, isLoading, isFetching, refetch } = api.thinkpages.searchUnsplashImages.useQuery(
    { query: searchQuery, page, per_page: 12 }, // Fetch 12 images per page
    { enabled: !!searchQuery, keepPreviousData: true } // Only enable query if search query exists
  );

  useEffect(() => {
    if (isOpen) {
      // Reset state when modal opens
      setSearchQuery('');
      setPage(1);
      setSelectedImage(null);
    }
  }, [isOpen]);

  const handleSearch = () => {
    setPage(1); // Reset to first page on new search
    refetch();
  };

  const handleSelectImage = () => {
    if (selectedImage) {
      onImageSelect(selectedImage);
    } else {
      toast.error('Please select an image first.');
    }
  };

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
              <h3 className="font-bold text-white text-lg">Search Image Repository (Unsplash)</h3>
              <button type="button" onClick={onClose} className="p-2 rounded-full text-neutral-400 hover:bg-white/10 transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Search and Filters */}
            <div className="p-4 border-b border-white/10 flex items-center gap-2">
              <Input
                placeholder="Search images (e.g., 'nature', 'city', 'person')"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => { if (e.key === 'Enter') handleSearch(); }}
                className="flex-1"
              />
              <Button onClick={handleSearch} disabled={isLoading || isFetching || !searchQuery.trim()}>
                {isLoading || isFetching ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <Search className="h-4 w-4 mr-2" />}Search
              </Button>
            </div>

            {/* Image Results */}
            <div className="flex-1 p-4 overflow-y-auto grid grid-cols-3 gap-4">
              {isLoading || isFetching ? (
                <div className="col-span-3 flex justify-center items-center h-48">
                  <Loader2 className="animate-spin h-8 w-8 text-blue-400" />
                </div>
              ) : images && images.length > 0 ? (
                images.map((image) => (
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
                ))
              ) : (
                <div className="col-span-3 text-center text-muted-foreground p-8">
                  No images found. Try a different search query.
                </div>
              )}
            </div>

            {/* Pagination and Select Button */}
            <div className="p-4 border-t border-white/10 flex justify-between items-center">
              <Button
                onClick={() => setPage(prev => Math.max(1, prev - 1))}
                disabled={page === 1 || isLoading || isFetching}
                variant="outline"
              >
                Previous
              </Button>
              <span className="text-sm text-white">Page {page}</span>
              <Button
                onClick={() => setPage(prev => prev + 1)}
                disabled={!images || images.length < 12 || isLoading || isFetching} // Assuming 12 per page
                variant="outline"
              >
                Next
              </Button>
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