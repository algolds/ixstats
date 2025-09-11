"use client";

import React, { useState } from 'react';
import { Input } from '~/components/ui/input';
import { Button } from '~/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select';
import { api } from '~/trpc/react';
import { toast } from 'sonner';
import { cn } from '~/lib/utils';
import { Loader2, Check, Search } from 'lucide-react';

interface WikiImageSearchProps {
  onImageSelect: (imageUrl: string) => void;
  selectedImage: string | null;
  setSelectedImage: (imageUrl: string | null) => void;
}

export function WikiImageSearch({ onImageSelect, selectedImage, setSelectedImage }: WikiImageSearchProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [wikiSource, setWikiSource] = useState('ixwiki');

  const { mutate: searchWiki, data: searchResults, isPending: isLoading } = api.thinkpages.searchWiki.useMutation();

  const handleSearch = () => {
    if (!searchQuery.trim()) {
      toast.info('Please enter a search query.');
      return;
    }
    searchWiki({ query: searchQuery, wiki: wikiSource as "ixwiki" | "iiwiki" });
  };

  return (
    <div className="flex flex-col flex-1">
      <div className="p-4 border-b border-white/10 flex items-center gap-2">
        <Select value={wikiSource} onValueChange={setWikiSource}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Select a wiki" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ixwiki">ixwiki</SelectItem>
            <SelectItem value="iiwiki">iiwiki</SelectItem>
          </SelectContent>
        </Select>
        <Input 
          placeholder="Search for a file..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
          className="flex-1"
        />
        <Button onClick={handleSearch} disabled={isLoading || !searchQuery.trim()}>
          {isLoading ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <Search className="h-4 w-4 mr-2" />}Search
        </Button>
      </div>
      <div className="flex-1 p-4 overflow-y-auto grid grid-cols-3 gap-4">
        {isLoading ? (
          <div className="col-span-3 flex justify-center items-center h-48">
            <Loader2 className="animate-spin h-8 w-8 text-blue-400" />
          </div>
        ) : searchResults && searchResults.length > 0 ? (
          searchResults.map((file: any) => (
            <div
              key={file.path}
              className={cn(
                "relative group cursor-pointer rounded-lg overflow-hidden border-2 transition-all",
                selectedImage === file.path ? "border-blue-500" : "border-transparent hover:border-blue-400"
              )}
              onClick={() => setSelectedImage(file.path)}
            >
              <img src={file.path} alt={file.name} className="w-full h-32 object-cover" />
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-sm font-medium">
                {file.name}
              </div>
              {selectedImage === file.path && (
                <div className="absolute inset-0 flex items-center justify-center bg-blue-500/50">
                  <Check className="h-8 w-8 text-white" />
                </div>
              )}
            </div>
          ))
        ) : (
          <div className="col-span-3 text-center text-muted-foreground p-8">
            No files found. Try a different search query.
          </div>
        )}
      </div>
    </div>
  );
}