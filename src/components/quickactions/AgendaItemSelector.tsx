// src/components/quickactions/AgendaItemSelector.tsx
"use client";

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Badge } from '~/components/ui/badge';
import { ScrollArea } from '~/components/ui/scroll-area';
import {
  ChevronRight,
  Search,
  ArrowLeft,
  FileText,
  CheckCircle,
  Tag,
  Info,
  Sparkles
} from 'lucide-react';
import {
  type AgendaItemTemplate,
  agendaTaxonomy,
  searchAgendaItems,
  getAgendaItemById,
  getAgendaItemPath
} from '~/lib/agenda-taxonomy';
import { cn } from '~/lib/utils';

interface AgendaItemSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (item: AgendaItemTemplate) => void;
}

export function AgendaItemSelector({
  open,
  onOpenChange,
  onSelect
}: AgendaItemSelectorProps) {
  const [currentLevel, setCurrentLevel] = useState<AgendaItemTemplate[]>(agendaTaxonomy);
  const [breadcrumb, setBreadcrumb] = useState<AgendaItemTemplate[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItem, setSelectedItem] = useState<AgendaItemTemplate | null>(null);

  // Search results
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    return searchAgendaItems(searchQuery);
  }, [searchQuery]);

  const isSearching = searchQuery.trim().length > 0;

  const handleNavigate = (item: AgendaItemTemplate) => {
    if (item.children && item.children.length > 0) {
      // Navigate deeper
      setBreadcrumb([...breadcrumb, item]);
      setCurrentLevel(item.children);
      setSelectedItem(null);
    } else {
      // Leaf item - can be selected
      setSelectedItem(item);
    }
  };

  const handleBack = () => {
    if (breadcrumb.length === 0) return;

    const newBreadcrumb = breadcrumb.slice(0, -1);
    setBreadcrumb(newBreadcrumb);

    if (newBreadcrumb.length === 0) {
      setCurrentLevel(agendaTaxonomy);
    } else {
      const parent = newBreadcrumb[newBreadcrumb.length - 1];
      setCurrentLevel(parent!.children || agendaTaxonomy);
    }
    setSelectedItem(null);
  };

  const handleSelectFromSearch = (item: AgendaItemTemplate) => {
    setSelectedItem(item);
    setSearchQuery('');
  };

  const handleConfirmSelection = () => {
    if (selectedItem) {
      onSelect(selectedItem);
      handleReset();
      onOpenChange(false);
    }
  };

  const handleReset = () => {
    setCurrentLevel(agendaTaxonomy);
    setBreadcrumb([]);
    setSearchQuery('');
    setSelectedItem(null);
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      economic: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800',
      social: 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800',
      infrastructure: 'bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-800',
      diplomatic: 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800',
      governance: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800',
      security: 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800',
    };
    return colors[category] || 'bg-gray-500/10 text-gray-700 dark:text-gray-400 border-gray-200 dark:border-gray-800';
  };

  const getCategoryIcon = (category: string) => {
    // You can add specific icons per category if desired
    return <FileText className="h-4 w-4" />;
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      onOpenChange(isOpen);
      if (!isOpen) handleReset();
    }}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Select Agenda Item
          </DialogTitle>
          <DialogDescription>
            Browse by category or search for specific topics to add to your meeting agenda
          </DialogDescription>
        </DialogHeader>

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search agenda items... (e.g., 'taxation', 'healthcare', 'budget')"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
          {searchQuery && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="absolute right-2 top-1/2 -translate-y-1/2 h-7"
              onClick={() => setSearchQuery('')}
            >
              Clear
            </Button>
          )}
        </div>

        {/* Breadcrumb Navigation */}
        {!isSearching && breadcrumb.length > 0 && (
          <div className="flex items-center gap-2 text-sm">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleBack}
              className="flex items-center gap-1"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <div className="flex items-center gap-1 text-muted-foreground">
              <span>Home</span>
              {breadcrumb.map((item, index) => (
                <React.Fragment key={item.id}>
                  <ChevronRight className="h-4 w-4" />
                  <span className={index === breadcrumb.length - 1 ? 'text-foreground font-medium' : ''}>
                    {item.label}
                  </span>
                </React.Fragment>
              ))}
            </div>
          </div>
        )}

        {/* Main Content Area */}
        <ScrollArea className="flex-1 pr-4">
          <AnimatePresence mode="wait">
            {isSearching ? (
              // Search Results View
              <motion.div
                key="search"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-2"
              >
                {searchResults.length > 0 ? (
                  <>
                    <p className="text-sm text-muted-foreground mb-3">
                      Found {searchResults.length} result{searchResults.length !== 1 ? 's' : ''}
                    </p>
                    {searchResults.map((item) => {
                      const path = getAgendaItemPath(item.id);
                      return (
                        <motion.button
                          key={item.id}
                          type="button"
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          onClick={() => handleSelectFromSearch(item)}
                          className={cn(
                            "w-full p-4 border rounded-lg text-left transition-all hover:border-primary/50 hover:shadow-md",
                            selectedItem?.id === item.id && "border-primary bg-primary/5"
                          )}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                {getCategoryIcon(item.category)}
                                <h4 className="font-medium">{item.label}</h4>
                                {selectedItem?.id === item.id && (
                                  <CheckCircle className="h-4 w-4 text-primary flex-shrink-0" />
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground mb-2">{item.description}</p>
                              {path && path.length > 1 && (
                                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                  {path.slice(0, -1).map((p, i) => (
                                    <React.Fragment key={p.id}>
                                      {i > 0 && <ChevronRight className="h-3 w-3" />}
                                      <span>{p.label}</span>
                                    </React.Fragment>
                                  ))}
                                </div>
                              )}
                            </div>
                            <Badge variant="outline" className={cn("flex-shrink-0", getCategoryColor(item.category))}>
                              {item.category}
                            </Badge>
                          </div>
                          {item.tags && item.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {item.tags.slice(0, 4).map(tag => (
                                <Badge key={tag} variant="secondary" className="text-xs">
                                  <Tag className="h-3 w-3 mr-1" />
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </motion.button>
                      );
                    })}
                  </>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No results found for "{searchQuery}"</p>
                    <p className="text-sm mt-2">Try different keywords or browse by category</p>
                  </div>
                )}
              </motion.div>
            ) : (
              // Browse Hierarchical View
              <motion.div
                key="browse"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-2"
              >
                {currentLevel.map((item, index) => {
                  const hasChildren = item.children && item.children.length > 0;
                  const isSelectable = !hasChildren;

                  return (
                    <motion.button
                      key={item.id}
                      type="button"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      onClick={() => handleNavigate(item)}
                      className={cn(
                        "w-full p-4 border rounded-lg text-left transition-all hover:border-primary/50 hover:shadow-md group",
                        selectedItem?.id === item.id && "border-primary bg-primary/5"
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            {getCategoryIcon(item.category)}
                            <h4 className="font-medium">{item.label}</h4>
                            {isSelectable && selectedItem?.id === item.id && (
                              <CheckCircle className="h-4 w-4 text-primary flex-shrink-0" />
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">{item.description}</p>
                          {item.relatedMetrics && item.relatedMetrics.length > 0 && (
                            <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                              <Info className="h-3 w-3" />
                              <span>Affects {item.relatedMetrics.length} metric{item.relatedMetrics.length !== 1 ? 's' : ''}</span>
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-2 flex-shrink-0">
                          <Badge variant="outline" className={getCategoryColor(item.category)}>
                            {item.category}
                          </Badge>
                          {hasChildren && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground group-hover:text-primary transition-colors">
                              <span>{item.children!.length} sub-item{item.children!.length !== 1 ? 's' : ''}</span>
                              <ChevronRight className="h-4 w-4" />
                            </div>
                          )}
                        </div>
                      </div>
                      {item.tags && item.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {item.tags.slice(0, 4).map(tag => (
                            <Badge key={tag} variant="secondary" className="text-xs">
                              <Tag className="h-3 w-3 mr-1" />
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </motion.button>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </ScrollArea>

        {/* Footer with Selection */}
        {selectedItem && (
          <div className="border-t pt-4 space-y-3">
            <div className="flex items-start gap-3 p-3 bg-primary/5 border border-primary/20 rounded-lg">
              <CheckCircle className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="font-medium">Selected: {selectedItem.label}</p>
                <p className="text-sm text-muted-foreground">{selectedItem.description}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setSelectedItem(null);
                  onOpenChange(false);
                  handleReset();
                }}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleConfirmSelection}
                className="flex-1"
              >
                Add to Agenda
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
