"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Search,
  ChevronDown,
  ChevronRight,
  X,
  Filter,
  MapPin,
  User,
  Star,
  Phone,
  Globe,
  RotateCcw,
  Save,
  Bookmark,
  Sparkles,
  Mail,
  Users,
  Languages,
  UserPlus,
  Ban,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CallStatus } from "@/lib/campaign-storage";

interface FilterMetadata {
  countries: string[];
  provinces: string[];
  cities: Record<string, string[]>;
  types: string[];
  provincesByCountry: Record<string, string[]>;
}

export interface FilterState {
  search: string;
  country: string;
  province: string;
  city: string;
  practitionerType: string;
  minRating: string;
  hasPhoneOnly: boolean;
  hasWebsiteOnly: boolean;
  callStatus: CallStatus[];
  minReviews: number;
  // Enrichment filters
  hasEnrichment: boolean;
  hasEmails: boolean;
  hasTeamMembers: boolean;
  isMultilingual: boolean;
  // Source filter
  showUserAddedOnly: boolean;
  // Do Not Call filter
  hideDNC: boolean;
  showDNCOnly: boolean;
}

interface FilterGroupProps {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  defaultOpen?: boolean;
  badge?: number | string;
}

function FilterGroup({ title, icon: Icon, children, defaultOpen = true, badge }: FilterGroupProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button className="flex items-center justify-between w-full py-2 px-1 text-sm font-medium hover:bg-muted/50 rounded-md transition-colors">
          <div className="flex items-center gap-2">
            <Icon className="w-4 h-4 text-muted-foreground" />
            <span>{title}</span>
            {badge !== undefined && (
              <Badge variant="secondary" className="h-5 px-1.5 text-xs">
                {badge}
              </Badge>
            )}
          </div>
          {open ? (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          )}
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-2 pb-3 space-y-3">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}

interface SavedFilter {
  id: string;
  name: string;
  filters: FilterState;
  createdAt: string;
}

interface FilterPanelProps {
  metadata: FilterMetadata | null;
  filters: FilterState;
  onFilterChange: (filters: Partial<FilterState>) => void;
  onClearAll: () => void;
}

export function FilterPanel({ metadata, filters, onFilterChange, onClearAll }: FilterPanelProps) {
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>([]);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [filterName, setFilterName] = useState("");

  // Load saved filters from localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const saved = localStorage.getItem("campaign_saved_filters");
      if (saved) {
        setSavedFilters(JSON.parse(saved));
      }
    } catch {
      console.error("Failed to load saved filters");
    }
  }, []);

  // Save filters to localStorage
  const saveCurrentFilters = () => {
    if (!filterName.trim()) return;

    const newFilter: SavedFilter = {
      id: Date.now().toString(),
      name: filterName.trim(),
      filters: { ...filters },
      createdAt: new Date().toISOString(),
    };

    const updated = [...savedFilters, newFilter];
    setSavedFilters(updated);
    if (typeof window !== "undefined") {
      localStorage.setItem("campaign_saved_filters", JSON.stringify(updated));
    }
    setFilterName("");
    setSaveDialogOpen(false);
  };

  // Delete saved filter
  const deleteSavedFilter = (id: string) => {
    const updated = savedFilters.filter((f) => f.id !== id);
    setSavedFilters(updated);
    if (typeof window !== "undefined") {
      localStorage.setItem("campaign_saved_filters", JSON.stringify(updated));
    }
  };

  // Apply saved filter
  const applySavedFilter = (saved: SavedFilter) => {
    Object.entries(saved.filters).forEach(([key, value]) => {
      onFilterChange({ [key]: value });
    });
  };

  // Get available provinces for selected country
  const availableProvinces = metadata && filters.country
    ? metadata.provincesByCountry[filters.country] || []
    : metadata?.provinces || [];

  // Get available cities for selected province
  const availableCities = metadata && filters.province
    ? metadata.cities[filters.province] || []
    : [];

  // Country display names
  const countryNames: Record<string, string> = {
    'CA': 'Canada',
    'US': 'United States',
  };

  // Count active filters
  const activeFilterCount = [
    filters.search,
    filters.country,
    filters.province,
    filters.city,
    filters.practitionerType,
    filters.minRating,
    filters.hasPhoneOnly,
    filters.hasWebsiteOnly,
    filters.callStatus.length > 0,
    filters.minReviews > 0,
    filters.hasEnrichment,
    filters.hasEmails,
    filters.hasTeamMembers,
    filters.isMultilingual,
    filters.showUserAddedOnly,
    !filters.hideDNC, // Count if DNC is NOT hidden (showing DNC)
    filters.showDNCOnly,
  ].filter(Boolean).length;

  // Call status options
  const callStatusOptions: { value: CallStatus; label: string; color: string }[] = [
    { value: "not_called", label: "Not Called", color: "bg-gray-100 text-gray-800" },
    { value: "queued", label: "Queued", color: "bg-yellow-100 text-yellow-800" },
    { value: "in_progress", label: "In Progress", color: "bg-blue-100 text-blue-800" },
    { value: "completed", label: "Completed", color: "bg-green-100 text-green-800" },
    { value: "booked", label: "Booked", color: "bg-purple-100 text-purple-800" },
    { value: "failed", label: "Failed", color: "bg-red-100 text-red-800" },
  ];

  return (
    <div className="w-full h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4" />
          <span className="font-semibold text-sm">Filters</span>
          {activeFilterCount > 0 && (
            <Badge variant="default" className="h-5 px-1.5 text-xs">
              {activeFilterCount}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearAll}
            className="h-7 text-xs"
            disabled={activeFilterCount === 0}
          >
            <RotateCcw className="w-3 h-3 mr-1" />
            Clear
          </Button>
        </div>
      </div>

      {/* Active Filters Pills */}
      {activeFilterCount > 0 && (
        <div className="py-3 flex flex-wrap gap-1.5">
          {filters.search && (
            <Badge variant="secondary" className="gap-1 pr-1">
              Search: {filters.search.substring(0, 15)}...
              <button onClick={() => onFilterChange({ search: "" })}>
                <X className="w-3 h-3" />
              </button>
            </Badge>
          )}
          {filters.country && (
            <Badge variant="secondary" className="gap-1 pr-1">
              {countryNames[filters.country] || filters.country}
              <button onClick={() => onFilterChange({ country: "", province: "", city: "" })}>
                <X className="w-3 h-3" />
              </button>
            </Badge>
          )}
          {filters.province && (
            <Badge variant="secondary" className="gap-1 pr-1">
              {filters.province}
              <button onClick={() => onFilterChange({ province: "", city: "" })}>
                <X className="w-3 h-3" />
              </button>
            </Badge>
          )}
          {filters.city && (
            <Badge variant="secondary" className="gap-1 pr-1">
              {filters.city}
              <button onClick={() => onFilterChange({ city: "" })}>
                <X className="w-3 h-3" />
              </button>
            </Badge>
          )}
          {filters.practitionerType && (
            <Badge variant="secondary" className="gap-1 pr-1">
              {filters.practitionerType}
              <button onClick={() => onFilterChange({ practitionerType: "" })}>
                <X className="w-3 h-3" />
              </button>
            </Badge>
          )}
          {filters.minRating && (
            <Badge variant="secondary" className="gap-1 pr-1">
              {filters.minRating}+ stars
              <button onClick={() => onFilterChange({ minRating: "" })}>
                <X className="w-3 h-3" />
              </button>
            </Badge>
          )}
        </div>
      )}

      {/* Filter Groups */}
      <ScrollArea className="flex-1 min-h-0 -mx-1 px-1">
        <div className="space-y-1 py-3">
          {/* Search */}
          <FilterGroup title="Search" icon={Search} defaultOpen={true}>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Name, address, phone..."
                value={filters.search}
                onChange={(e) => onFilterChange({ search: e.target.value })}
                className="pl-8 h-9"
              />
            </div>
          </FilterGroup>

          <Separator />

          {/* Location */}
          <FilterGroup title="Location" icon={MapPin} defaultOpen={true} badge={[filters.country, filters.province, filters.city].filter(Boolean).length || undefined}>
            <div className="space-y-3">
              {/* Country */}
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">Country</Label>
                <Select
                  value={filters.country || "_all"}
                  onValueChange={(v) => onFilterChange({ country: v === "_all" ? "" : v, province: "", city: "" })}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="All countries" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_all">All countries</SelectItem>
                    {metadata?.countries?.map((c) => (
                      <SelectItem key={c} value={c}>{countryNames[c] || c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {/* State/Province */}
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">State/Province</Label>
                <Select
                  value={filters.province || "_all"}
                  onValueChange={(v) => onFilterChange({ province: v === "_all" ? "" : v, city: "" })}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="All states/provinces" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_all">All states/provinces</SelectItem>
                    {availableProvinces.map((p) => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {/* City */}
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">City</Label>
                <Select
                  value={filters.city || "_all"}
                  onValueChange={(v) => onFilterChange({ city: v === "_all" ? "" : v })}
                  disabled={!filters.province}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder={filters.province ? "Select city" : "Select state/province first"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_all">All cities</SelectItem>
                    {availableCities.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </FilterGroup>

          <Separator />

          {/* Practitioner Type */}
          <FilterGroup title="Practitioner Type" icon={User} defaultOpen={true} badge={filters.practitionerType ? 1 : undefined}>
            <Select
              value={filters.practitionerType || "_all"}
              onValueChange={(v) => onFilterChange({ practitionerType: v === "_all" ? "" : v })}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="All types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">All types</SelectItem>
                {metadata?.types.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FilterGroup>

          <Separator />

          {/* Rating */}
          <FilterGroup title="Rating" icon={Star} defaultOpen={false} badge={filters.minRating ? 1 : undefined}>
            <div className="space-y-3">
              <Select
                value={filters.minRating || "_all"}
                onValueChange={(v) => onFilterChange({ minRating: v === "_all" ? "" : v })}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Any rating" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_all">Any rating</SelectItem>
                  <SelectItem value="3">3+ stars</SelectItem>
                  <SelectItem value="4">4+ stars</SelectItem>
                  <SelectItem value="4.5">4.5+ stars</SelectItem>
                </SelectContent>
              </Select>
              <div>
                <Label className="text-xs text-muted-foreground mb-2 block">
                  Min Reviews: {filters.minReviews}
                </Label>
                <Slider
                  value={[filters.minReviews]}
                  onValueChange={([v]) => onFilterChange({ minReviews: v })}
                  max={100}
                  step={5}
                  className="w-full"
                />
              </div>
            </div>
          </FilterGroup>

          <Separator />

          {/* Contact Info */}
          <FilterGroup title="Contact Info" icon={Phone} defaultOpen={false}>
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.hasPhoneOnly}
                  onChange={(e) => onFilterChange({ hasPhoneOnly: e.target.checked })}
                  className="rounded"
                />
                <Phone className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-sm">Has phone number</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.hasWebsiteOnly}
                  onChange={(e) => onFilterChange({ hasWebsiteOnly: e.target.checked })}
                  className="rounded"
                />
                <Globe className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-sm">Has website</span>
              </label>
            </div>
          </FilterGroup>

          <Separator />

          {/* Enrichment Data */}
          <FilterGroup 
            title="Enriched Data" 
            icon={Sparkles} 
            defaultOpen={false}
            badge={[filters.hasEnrichment, filters.hasEmails, filters.hasTeamMembers, filters.isMultilingual].filter(Boolean).length || undefined}
          >
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground mb-2">
                Filter clinics with enriched data from website scraping
              </p>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.hasEnrichment}
                  onChange={(e) => onFilterChange({ hasEnrichment: e.target.checked })}
                  className="rounded"
                />
                <Sparkles className="w-3.5 h-3.5 text-purple-500" />
                <span className="text-sm">Has enrichment data</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.hasEmails}
                  onChange={(e) => onFilterChange({ hasEmails: e.target.checked })}
                  className="rounded"
                />
                <Mail className="w-3.5 h-3.5 text-blue-500" />
                <span className="text-sm">Has contact emails</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.hasTeamMembers}
                  onChange={(e) => onFilterChange({ hasTeamMembers: e.target.checked })}
                  className="rounded"
                />
                <Users className="w-3.5 h-3.5 text-purple-500" />
                <span className="text-sm">Has team members</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.isMultilingual}
                  onChange={(e) => onFilterChange({ isMultilingual: e.target.checked })}
                  className="rounded"
                />
                <Languages className="w-3.5 h-3.5 text-green-500" />
                <span className="text-sm">Multilingual clinic</span>
              </label>
            </div>
          </FilterGroup>

          <Separator />

          {/* Source */}
          <FilterGroup 
            title="Source" 
            icon={UserPlus} 
            defaultOpen={false}
            badge={filters.showUserAddedOnly ? 1 : undefined}
          >
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground mb-2">
                Filter by how practitioners were added
              </p>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.showUserAddedOnly}
                  onChange={(e) => onFilterChange({ showUserAddedOnly: e.target.checked })}
                  className="rounded"
                />
                <UserPlus className="w-3.5 h-3.5 text-amber-500" />
                <span className="text-sm">User Added Only</span>
              </label>
            </div>
          </FilterGroup>

          <Separator />

          {/* Do Not Call */}
          <FilterGroup 
            title="Do Not Call" 
            icon={Ban} 
            defaultOpen={false}
            badge={filters.showDNCOnly ? 1 : (!filters.hideDNC ? 1 : undefined)}
          >
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground mb-2">
                Filter practitioners by DNC status
              </p>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.hideDNC}
                  onChange={(e) => onFilterChange({ 
                    hideDNC: e.target.checked,
                    showDNCOnly: e.target.checked ? false : filters.showDNCOnly 
                  })}
                  className="rounded"
                />
                <Ban className="w-3.5 h-3.5 text-gray-500" />
                <span className="text-sm">Hide Do Not Call</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.showDNCOnly}
                  onChange={(e) => onFilterChange({ 
                    showDNCOnly: e.target.checked,
                    hideDNC: e.target.checked ? false : filters.hideDNC 
                  })}
                  className="rounded"
                />
                <Ban className="w-3.5 h-3.5 text-red-500" />
                <span className="text-sm">Show Do Not Call Only</span>
              </label>
            </div>
          </FilterGroup>

          <Separator />

          {/* Call Status */}
          <FilterGroup
            title="Call Status"
            icon={Phone}
            defaultOpen={false}
            badge={filters.callStatus.length > 0 ? filters.callStatus.length : undefined}
          >
            <div className="space-y-1.5">
              {callStatusOptions.map((option) => (
                <label
                  key={option.value}
                  className="flex items-center gap-2 cursor-pointer py-1"
                >
                  <input
                    type="checkbox"
                    checked={filters.callStatus.includes(option.value)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        onFilterChange({ callStatus: [...filters.callStatus, option.value] });
                      } else {
                        onFilterChange({
                          callStatus: filters.callStatus.filter((s) => s !== option.value),
                        });
                      }
                    }}
                    className="rounded"
                  />
                  <Badge className={cn("text-xs", option.color)}>
                    {option.label}
                  </Badge>
                </label>
              ))}
            </div>
          </FilterGroup>

          <Separator />

          {/* Saved Filters */}
          <FilterGroup title="Saved Filters" icon={Bookmark} defaultOpen={false}>
            <div className="space-y-2">
              {savedFilters.length === 0 ? (
                <p className="text-xs text-muted-foreground">No saved filters yet</p>
              ) : (
                savedFilters.map((saved) => (
                  <div
                    key={saved.id}
                    className="flex items-center justify-between p-2 rounded-md bg-muted/50 hover:bg-muted transition-colors"
                  >
                    <button
                      onClick={() => applySavedFilter(saved)}
                      className="text-sm font-medium text-left flex-1"
                    >
                      {saved.name}
                    </button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteSavedFilter(saved.id)}
                      className="h-6 w-6 p-0"
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                ))
              )}
              {activeFilterCount > 0 && !saveDialogOpen && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSaveDialogOpen(true)}
                  className="w-full mt-2"
                >
                  <Save className="w-3 h-3 mr-1" />
                  Save Current Filters
                </Button>
              )}
              {saveDialogOpen && (
                <div className="space-y-2 p-2 border rounded-md bg-background">
                  <Input
                    placeholder="Filter name..."
                    value={filterName}
                    onChange={(e) => setFilterName(e.target.value)}
                    className="h-8"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveCurrentFilters();
                      if (e.key === "Escape") setSaveDialogOpen(false);
                    }}
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={saveCurrentFilters} className="flex-1 h-7">
                      Save
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setSaveDialogOpen(false)}
                      className="h-7"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </FilterGroup>
        </div>
      </ScrollArea>
    </div>
  );
}

// Mobile Filter Sheet Component
interface FilterSheetProps extends FilterPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  practitionerCount: number;
}

export function FilterSheet({
  open,
  onOpenChange,
  practitionerCount,
  ...props
}: FilterSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-[320px] p-0">
        <SheetHeader className="p-4 border-b">
          <SheetTitle className="flex items-center gap-2">
            <Filter className="w-4 h-4" />
            Filters
          </SheetTitle>
          <SheetDescription>
            {practitionerCount.toLocaleString()} practitioners match
          </SheetDescription>
        </SheetHeader>
        <div className="p-4 h-[calc(100vh-120px)]">
          <FilterPanel {...props} />
        </div>
      </SheetContent>
    </Sheet>
  );
}

// Trigger button for mobile filter sheet
export function FilterSheetTrigger({
  activeFilterCount,
  onClick,
}: {
  activeFilterCount: number;
  onClick: () => void;
}) {
  return (
    <Button variant="outline" size="sm" onClick={onClick} className="gap-2">
      <Filter className="w-4 h-4" />
      Filters
      {activeFilterCount > 0 && (
        <Badge variant="default" className="h-5 px-1.5 text-xs">
          {activeFilterCount}
        </Badge>
      )}
    </Button>
  );
}
