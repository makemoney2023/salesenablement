"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  Phone,
  Eye,
  UserPlus,
  MapPin,
  Star,
  Clock,
  History,
  X,
  Sparkles,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Practitioner {
  id: string;
  name: string;
  practitioner_type: string;
  address: string;
  city: string;
  province: string;
  phone?: string | null;
  rating?: number | null;
  review_count?: number | null;
}

interface CommandSearchProps {
  practitioners: Practitioner[];
  onSelect: (practitioner: Practitioner, action: "view" | "call" | "queue") => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const RECENT_SEARCHES_KEY = "campaign_recent_searches";
const MAX_RECENT_SEARCHES = 5;

export function CommandSearch({
  practitioners,
  onSelect,
  open: controlledOpen,
  onOpenChange,
}: CommandSearchProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = onOpenChange || setInternalOpen;

  // Load recent searches from localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const saved = localStorage.getItem(RECENT_SEARCHES_KEY);
      if (saved) {
        setRecentSearches(JSON.parse(saved));
      }
    } catch {
      console.error("Failed to load recent searches");
    }
  }, []);

  // Save recent search
  const saveRecentSearch = useCallback((term: string) => {
    if (!term.trim()) return;
    
    setRecentSearches((prev) => {
      const updated = [term, ...prev.filter((s) => s !== term)].slice(0, MAX_RECENT_SEARCHES);
      if (typeof window !== "undefined") {
        localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
      }
      return updated;
    });
  }, []);

  // Clear recent searches
  const clearRecentSearches = useCallback(() => {
    setRecentSearches([]);
    if (typeof window !== "undefined") {
      localStorage.removeItem(RECENT_SEARCHES_KEY);
    }
  }, []);

  // Global keyboard shortcut
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen(!open);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [open, setOpen]);

  // Filter practitioners based on search
  const filteredPractitioners = useMemo(() => {
    if (!search.trim()) return [];

    const term = search.toLowerCase();
    return practitioners
      .filter((p) => {
        return (
          p.name.toLowerCase().includes(term) ||
          p.address.toLowerCase().includes(term) ||
          p.phone?.includes(term) ||
          p.city.toLowerCase().includes(term) ||
          p.practitioner_type.toLowerCase().includes(term)
        );
      })
      .slice(0, 10);
  }, [practitioners, search]);

  // Handle selection
  const handleSelect = useCallback(
    (practitioner: Practitioner, action: "view" | "call" | "queue") => {
      saveRecentSearch(practitioner.name);
      onSelect(practitioner, action);
      setOpen(false);
      setSearch("");
    },
    [onSelect, saveRecentSearch, setOpen]
  );

  // Handle recent search click
  const handleRecentSearchClick = useCallback((term: string) => {
    setSearch(term);
  }, []);

  return (
    <>
      {/* Trigger button (can be used anywhere) */}
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center justify-between rounded-md border bg-background px-3 py-2 text-sm text-muted-foreground ring-offset-background transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 w-full max-w-sm"
      >
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4" />
          <span>Search practitioners...</span>
        </div>
        <kbd className="pointer-events-none hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
          <span className="text-xs">⌘</span>K
        </kbd>
      </button>

      {/* Command Dialog */}
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput
          placeholder="Search by name, phone, address..."
          value={search}
          onValueChange={setSearch}
        />
        <CommandList>
          <CommandEmpty>
            <div className="py-6 text-center">
              <Sparkles className="mx-auto h-8 w-8 text-muted-foreground/50 mb-2" />
              <p className="text-sm text-muted-foreground">No practitioners found.</p>
              <p className="text-xs text-muted-foreground mt-1">
                Try searching by name, phone number, or address
              </p>
            </div>
          </CommandEmpty>

          {/* Recent Searches */}
          {!search && recentSearches.length > 0 && (
            <CommandGroup heading="Recent Searches">
              {recentSearches.map((term) => (
                <CommandItem
                  key={term}
                  onSelect={() => handleRecentSearchClick(term)}
                  className="gap-2"
                >
                  <History className="h-4 w-4 text-muted-foreground" />
                  <span>{term}</span>
                </CommandItem>
              ))}
              <CommandItem
                onSelect={clearRecentSearches}
                className="gap-2 text-muted-foreground"
              >
                <X className="h-4 w-4" />
                <span>Clear recent searches</span>
              </CommandItem>
            </CommandGroup>
          )}

          {/* Search Results */}
          {search && filteredPractitioners.length > 0 && (
            <CommandGroup heading={`Results (${filteredPractitioners.length})`}>
              {filteredPractitioners.map((practitioner) => (
                <CommandItem
                  key={practitioner.id}
                  value={`${practitioner.name}-${practitioner.id}`}
                  className="flex items-start gap-3 p-2"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <span className="font-medium truncate">{practitioner.name}</span>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 flex-shrink-0">
                        {practitioner.practitioner_type}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {practitioner.city}, {practitioner.province}
                      </span>
                      {practitioner.rating && (
                        <span className="flex items-center gap-1">
                          <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                          {practitioner.rating}
                        </span>
                      )}
                      {practitioner.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {practitioner.phone}
                        </span>
                      )}
                    </div>
                  </div>
                  {/* Quick Actions */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelect(practitioner, "view");
                      }}
                      className="p-1.5 rounded-md hover:bg-muted transition-colors"
                      title="View details"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                    {practitioner.phone && (
                      <>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelect(practitioner, "call");
                          }}
                          className="p-1.5 rounded-md hover:bg-muted transition-colors text-green-600"
                          title="Call now"
                        >
                          <Phone className="h-4 w-4" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelect(practitioner, "queue");
                          }}
                          className="p-1.5 rounded-md hover:bg-muted transition-colors text-blue-600"
                          title="Add to queue"
                        >
                          <UserPlus className="h-4 w-4" />
                        </button>
                      </>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          <CommandSeparator />

          {/* Quick Actions */}
          <CommandGroup heading="Quick Actions">
            <CommandItem
              onSelect={() => {
                setOpen(false);
                // This would navigate to the practitioners tab
              }}
              className="gap-2"
            >
              <User className="h-4 w-4" />
              <span>Browse all practitioners</span>
              <CommandShortcut>P</CommandShortcut>
            </CommandItem>
            <CommandItem
              onSelect={() => {
                setOpen(false);
                // This would open the call queue
              }}
              className="gap-2"
            >
              <Clock className="h-4 w-4" />
              <span>View call queue</span>
              <CommandShortcut>Q</CommandShortcut>
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}

// Hook for using command search
export function useCommandSearch() {
  const [open, setOpen] = useState(false);

  // Global keyboard shortcut is handled in the component
  // This hook is for programmatic control
  return {
    open,
    setOpen,
    toggle: () => setOpen((prev) => !prev),
  };
}

// Compact search trigger for headers
export function CommandSearchTrigger({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors rounded-md border hover:border-primary/50"
    >
      <Search className="h-4 w-4" />
      <span className="hidden sm:inline">Search...</span>
      <kbd className="hidden sm:flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium">
        ⌘K
      </kbd>
    </button>
  );
}
