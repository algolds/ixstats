"use client";

import Link from "next/link";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Checkbox } from "~/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "~/components/ui/tabs";
import {
  ArrowLeft,
  Building2,
  Plus,
  Network,
  BarChart3,
  Search,
} from "lucide-react";
import {
  COMPONENT_CATEGORIES,
  COMPLEXITY_LEVELS,
} from "~/lib/admin/government-component-transforms";

interface GovernmentComponentsHeaderProps {
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  categoryFilter: string;
  setCategoryFilter: (cat: string) => void;
  complexityFilter: string;
  setComplexityFilter: (comp: string) => void;
  showActiveOnly: boolean;
  setShowActiveOnly: (active: boolean) => void;
  onOpenAddDialog: () => void;
  onOpenSynergyMatrix: () => void;
}

export function GovernmentComponentsHeader({
  searchTerm,
  setSearchTerm,
  categoryFilter,
  setCategoryFilter,
  complexityFilter,
  setComplexityFilter,
  showActiveOnly,
  setShowActiveOnly,
  onOpenAddDialog,
  onOpenSynergyMatrix,
}: GovernmentComponentsHeaderProps) {
  return (
    <div className="glass-card-parent mb-6 rounded-xl border-2 border-[--intel-gold]/20 bg-gradient-to-br from-[--intel-gold]/5 via-transparent to-[--intel-gold]/10 p-6">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/admin">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Admin
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            <div className="rounded-xl border border-[--intel-gold]/20 bg-[--intel-gold]/10 p-3">
              <Building2 className="h-6 w-6 text-[--intel-gold]" />
            </div>
            <div>
              <h1 className="text-foreground text-2xl font-bold md:text-3xl">
                Government Components
              </h1>
              <p className="text-muted-foreground text-sm">
                Manage atomic government components and synergy relationships
              </p>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={onOpenAddDialog}
            className="bg-[--intel-gold]/20 text-[--intel-gold] hover:bg-[--intel-gold]/30"
            size="sm"
          >
            <Plus className="mr-2 h-4 w-4" />
            <span className="hidden sm:inline">Add Component</span>
            <span className="sm:hidden">Add</span>
          </Button>
          <Button variant="outline" onClick={onOpenSynergyMatrix} size="sm">
            <Network className="mr-2 h-4 w-4" />
            <span className="hidden lg:inline">Synergy Matrix</span>
            <span className="lg:hidden">Synergy</span>
          </Button>
          <Button variant="outline" size="sm" className="hidden md:flex">
            <BarChart3 className="mr-2 h-4 w-4" />
            Analytics
          </Button>
        </div>
      </div>

      {/* Category Tabs */}
      <Tabs value={categoryFilter} onValueChange={setCategoryFilter} className="mb-4">
        <TabsList className="scrollbar-hide flex gap-2 overflow-x-auto border-b border-white/10 pb-2">
          <TabsTrigger value="all">All</TabsTrigger>
          {Object.keys(COMPONENT_CATEGORIES).map((category) => (
            <TabsTrigger key={category} value={category}>
              {category}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* Filter Bar */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
        <div className="relative sm:col-span-2 md:col-span-2">
          <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform" />
          <Input
            placeholder="Search components..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        <Select value={complexityFilter} onValueChange={setComplexityFilter}>
          <SelectTrigger>
            <SelectValue placeholder="Complexity" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Complexity</SelectItem>
            {COMPLEXITY_LEVELS.map((complexity) => (
              <SelectItem key={complexity} value={complexity}>
                {complexity}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-2">
          <Checkbox
            id="activeOnly"
            checked={showActiveOnly}
            onCheckedChange={(checked) => setShowActiveOnly(checked as boolean)}
          />
          <label htmlFor="activeOnly" className="text-foreground cursor-pointer text-sm">
            Show active only
          </label>
        </div>
      </div>
    </div>
  );
}
