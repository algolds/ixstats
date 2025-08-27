"use client";

import React, { useState } from 'react';
import { Input } from '~/components/ui/input';
import { Button } from '~/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select';
import { api } from '~/trpc/react';
import { toast } from 'sonner';

interface WikiSearchProps {
  onImageSelect?: (imageUrl: string) => void;
}

export function WikiSearch({ onImageSelect }: WikiSearchProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [wikiSource, setWikiSource] = useState('ixwiki');
  const [searchResults, setSearchResults] = useState<{ path: string; name: string; }[]>([]);

  const searchWikiMutation = api.thinkpages.searchWiki.useMutation({
    onSuccess: (data) => {
      setSearchResults(data as any);
      if (data.length === 0) {
        toast.info('No files found.');
      }
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleSearch = () => {
    if (!searchQuery.trim()) {
      toast.info('Please enter a search query.');
      return;
    }
    searchWikiMutation.mutate({ query: searchQuery, wiki: wikiSource as any });
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <Select value={wikiSource} onValueChange={setWikiSource}>
          <SelectTrigger>
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
        />
        <Button onClick={handleSearch} disabled={searchWikiMutation.isPending}>
          {searchWikiMutation.isPending ? 'Searching...' : 'Search'}
        </Button>
      </div>
      <div className="mt-2 space-y-2">
        {searchResults.map((file) => (
          <div key={file.path} className="flex items-center justify-between p-2 bg-neutral-800 rounded-lg">
            <p className="text-sm text-white">{file.name}</p>
            <Button size="sm" onClick={() => {
              if (onImageSelect) {
                onImageSelect(file.path);
                toast.success(`Selected ${file.name}`);
              } else {
                toast.info(`Selected ${file.name}`);
              }
            }}>Select</Button>
          </div>
        ))}
      </div>
    </div>
  );
}