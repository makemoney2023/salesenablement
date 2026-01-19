import { useState, useCallback } from "react";

// Enrichment data structure for caching
export interface EnrichmentData {
  practitioners: Array<{ name: string; credentials: string }>;
  emails: string[];
  phones: string[];
  services: string[];
  languages: string[];
  title?: string;
  description?: string;
}

export interface SearchPlace {
  id: string;
  name: string;
  address: string;
  city: string | null;
  province: string | null;
  country: string;
  phone: string | null;
  website: string | null;
  rating: number | null;
  review_count: number | null;
  business_status: string;
  google_maps_uri: string | null;
  latitude: number | null;
  longitude: number | null;
  practitioner_type?: string;
  // UI state
  isSelected?: boolean;
  isImported?: boolean;
  isEnriched?: boolean;
  // Cached enrichment data (preserved for import)
  enrichmentData?: EnrichmentData;
}

export interface SearchParams {
  query: string;
  location: {
    lat: number;
    lng: number;
    radius: number;
  };
  country: "CA" | "US";
  limit?: number; // Max results (default 20, max 100)
}

export interface EnrichmentResult {
  success: boolean;
  practitioners: Array<{ name: string; credentials: string }>;
  emails: string[];
  phones: string[];
  services: string[];
  languages: string[];
}

export interface ImportResult {
  imported: number;
  duplicates: number;
  errors: string[];
  importedIds: string[];
  // Enrichment stats (only set when using importAndEnrichSelected)
  enrichmentStats?: {
    attempted: number;
    enriched: number;
    failed: number;
  };
}

interface UsePlacesSearchState {
  places: SearchPlace[];
  isSearching: boolean;
  isImporting: boolean;
  isEnriching: boolean;
  error: string | null;
  hasMore: boolean;
  nextPageToken: string | null;
  totalSearches: number;
  selectedCount: number;
}

interface UsePlacesSearchReturn extends UsePlacesSearchState {
  search: (params: SearchParams, practitionerType: string) => Promise<void>;
  loadMore: () => Promise<void>;
  clearResults: () => void;
  toggleSelection: (placeId: string) => void;
  selectAll: () => void;
  deselectAll: () => void;
  importSelected: () => Promise<ImportResult>;
  importAndEnrichSelected: () => Promise<ImportResult>;
  enrichPlace: (placeId: string) => Promise<EnrichmentResult | null>;
  enrichSelected: () => Promise<void>;
  markAsImported: (placeIds: string[]) => void;
  selectedWithWebsites: number;
}

export function usePlacesSearch(): UsePlacesSearchReturn {
  const [state, setState] = useState<UsePlacesSearchState>({
    places: [],
    isSearching: false,
    isImporting: false,
    isEnriching: false,
    error: null,
    hasMore: false,
    nextPageToken: null,
    totalSearches: 0,
    selectedCount: 0,
  });

  // Store current search params for pagination
  const [currentSearchParams, setCurrentSearchParams] = useState<{
    params: SearchParams;
    practitionerType: string;
  } | null>(null);

  // Search for places
  const search = useCallback(async (params: SearchParams, practitionerType: string) => {
    setState((prev) => ({
      ...prev,
      isSearching: true,
      error: null,
      places: [], // Clear previous results
    }));

    setCurrentSearchParams({ params, practitionerType });

    try {
      const response = await fetch("/api/search/places", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });

      const data = await response.json();

      if (data.error) {
        setState((prev) => ({
          ...prev,
          isSearching: false,
          error: data.error,
        }));
        return;
      }

      // Add practitioner type to each place
      const placesWithType = (data.places || []).map((place: SearchPlace) => ({
        ...place,
        practitioner_type: practitionerType,
        isSelected: false,
        isImported: false,
        isEnriched: false,
      }));

      setState((prev) => ({
        ...prev,
        isSearching: false,
        places: placesWithType,
        hasMore: !!data.nextPageToken,
        nextPageToken: data.nextPageToken || null,
        totalSearches: prev.totalSearches + 1,
        selectedCount: 0,
      }));
    } catch (err) {
      setState((prev) => ({
        ...prev,
        isSearching: false,
        error: err instanceof Error ? err.message : "Search failed",
      }));
    }
  }, []);

  // Load more results (pagination)
  const loadMore = useCallback(async () => {
    if (!state.hasMore || !state.nextPageToken || !currentSearchParams) return;

    setState((prev) => ({ ...prev, isSearching: true }));

    try {
      const response = await fetch("/api/search/places", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...currentSearchParams.params,
          pageToken: state.nextPageToken,
        }),
      });

      const data = await response.json();

      if (data.error) {
        setState((prev) => ({
          ...prev,
          isSearching: false,
          error: data.error,
        }));
        return;
      }

      const newPlaces = (data.places || []).map((place: SearchPlace) => ({
        ...place,
        practitioner_type: currentSearchParams.practitionerType,
        isSelected: false,
        isImported: false,
        isEnriched: false,
      }));

      setState((prev) => ({
        ...prev,
        isSearching: false,
        places: [...prev.places, ...newPlaces],
        hasMore: !!data.nextPageToken,
        nextPageToken: data.nextPageToken || null,
        totalSearches: prev.totalSearches + 1,
      }));
    } catch (err) {
      setState((prev) => ({
        ...prev,
        isSearching: false,
        error: err instanceof Error ? err.message : "Failed to load more",
      }));
    }
  }, [state.hasMore, state.nextPageToken, currentSearchParams]);

  // Clear results
  const clearResults = useCallback(() => {
    setState({
      places: [],
      isSearching: false,
      isImporting: false,
      isEnriching: false,
      error: null,
      hasMore: false,
      nextPageToken: null,
      totalSearches: 0,
      selectedCount: 0,
    });
    setCurrentSearchParams(null);
  }, []);

  // Toggle selection for a place
  const toggleSelection = useCallback((placeId: string) => {
    setState((prev) => {
      const updatedPlaces = prev.places.map((p) =>
        p.id === placeId ? { ...p, isSelected: !p.isSelected } : p
      );
      const selectedCount = updatedPlaces.filter((p) => p.isSelected).length;
      return { ...prev, places: updatedPlaces, selectedCount };
    });
  }, []);

  // Select all non-imported places
  const selectAll = useCallback(() => {
    setState((prev) => {
      const updatedPlaces = prev.places.map((p) =>
        p.isImported ? p : { ...p, isSelected: true }
      );
      const selectedCount = updatedPlaces.filter((p) => p.isSelected).length;
      return { ...prev, places: updatedPlaces, selectedCount };
    });
  }, []);

  // Deselect all places
  const deselectAll = useCallback(() => {
    setState((prev) => {
      const updatedPlaces = prev.places.map((p) => ({ ...p, isSelected: false }));
      return { ...prev, places: updatedPlaces, selectedCount: 0 };
    });
  }, []);

  // Mark places as imported
  const markAsImported = useCallback((placeIds: string[]) => {
    setState((prev) => {
      const idSet = new Set(placeIds);
      const updatedPlaces = prev.places.map((p) =>
        idSet.has(p.id) ? { ...p, isImported: true, isSelected: false } : p
      );
      const selectedCount = updatedPlaces.filter((p) => p.isSelected).length;
      return { ...prev, places: updatedPlaces, selectedCount };
    });
  }, []);

  // Import selected places
  const importSelected = useCallback(async (): Promise<ImportResult> => {
    const selectedPlaces = state.places.filter((p) => p.isSelected && !p.isImported);
    
    if (selectedPlaces.length === 0) {
      return { imported: 0, duplicates: 0, errors: ["No places selected"], importedIds: [] };
    }

    setState((prev) => ({ ...prev, isImporting: true, error: null }));

    try {
      const response = await fetch("/api/search/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ practitioners: selectedPlaces }),
      });

      const result: ImportResult = await response.json();

      // Mark imported places
      if (result.importedIds.length > 0) {
        markAsImported(result.importedIds);
      }

      setState((prev) => ({
        ...prev,
        isImporting: false,
        error: result.errors.length > 0 ? result.errors.join(", ") : null,
      }));

      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Import failed";
      setState((prev) => ({
        ...prev,
        isImporting: false,
        error: errorMessage,
      }));
      return { imported: 0, duplicates: 0, errors: [errorMessage], importedIds: [] };
    }
  }, [state.places, markAsImported]);

  // Enrich a single place and cache the data
  const enrichPlace = useCallback(async (placeId: string): Promise<EnrichmentResult | null> => {
    const place = state.places.find((p) => p.id === placeId);
    if (!place?.website) return null;

    setState((prev) => ({ ...prev, isEnriching: true }));

    try {
      const response = await fetch("/api/search/enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          practitionerId: place.isImported ? placeId : undefined,
          websiteUrl: place.website,
        }),
      });

      const result: EnrichmentResult & { title?: string; description?: string } = await response.json();

      // Cache enrichment data on the place object for later import
      const enrichmentData: EnrichmentData = {
        practitioners: result.practitioners || [],
        emails: result.emails || [],
        phones: result.phones || [],
        services: result.services || [],
        languages: result.languages || [],
        title: result.title,
        description: result.description,
      };

      // Mark place as enriched AND store the data
      setState((prev) => ({
        ...prev,
        isEnriching: false,
        places: prev.places.map((p) =>
          p.id === placeId ? { ...p, isEnriched: true, enrichmentData } : p
        ),
      }));

      return result;
    } catch (err) {
      setState((prev) => ({
        ...prev,
        isEnriching: false,
        error: err instanceof Error ? err.message : "Enrichment failed",
      }));
      return null;
    }
  }, [state.places]);

  // Enrich all selected places
  const enrichSelected = useCallback(async () => {
    const selectedPlaces = state.places.filter(
      (p) => p.isSelected && !p.isEnriched && p.website
    );

    if (selectedPlaces.length === 0) return;

    setState((prev) => ({ ...prev, isEnriching: true }));

    for (const place of selectedPlaces) {
      await enrichPlace(place.id);
    }

    setState((prev) => ({ ...prev, isEnriching: false }));
  }, [state.places, enrichPlace]);

  // Import and enrich selected places in one action
  // Uses Supabase Edge Function for parallel enrichment (50 concurrent)
  const importAndEnrichSelected = useCallback(async (): Promise<ImportResult> => {
    const selectedPlaces = state.places.filter((p) => p.isSelected && !p.isImported);
    
    if (selectedPlaces.length === 0) {
      return { imported: 0, duplicates: 0, errors: ["No places selected"], importedIds: [] };
    }

    setState((prev) => ({ ...prev, isImporting: true, isEnriching: true, error: null }));

    // Step 1: Import all selected places first
    let importResult: ImportResult;
    try {
      const response = await fetch("/api/search/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ practitioners: selectedPlaces }),
      });

      importResult = await response.json();
      console.log(`[usePlacesSearch] Imported ${importResult.imported} practitioners`);
    } catch (err) {
      console.error("[usePlacesSearch] Import error:", err);
      setState((prev) => ({ ...prev, isImporting: false, isEnriching: false }));
      return { imported: 0, duplicates: 0, errors: ["Import failed"], importedIds: [] };
    }

    setState((prev) => ({ ...prev, isImporting: false }));

    // Step 2: Enrich imported practitioners via Supabase Edge Function (50 concurrent)
    const practitionerIdsToEnrich = importResult.importedIds.filter((id) => {
      const place = selectedPlaces.find((p) => p.id === id);
      return place?.website; // Only enrich those with websites
    });

    // Track enrichment stats
    let enrichmentStats = {
      attempted: practitionerIdsToEnrich.length,
      enriched: 0,
      failed: practitionerIdsToEnrich.length, // Assume all fail unless we get success response
    };

    if (practitionerIdsToEnrich.length > 0) {
      console.log(`[usePlacesSearch] Triggering Edge Function enrichment for ${practitionerIdsToEnrich.length} practitioners`);
      
      try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

        if (supabaseUrl && supabaseAnonKey) {
          const enrichResponse = await fetch(`${supabaseUrl}/functions/v1/enrich-practitioners-v2`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${supabaseAnonKey}`,
            },
            body: JSON.stringify({ practitionerIds: practitionerIdsToEnrich }),
          });

          if (enrichResponse.ok) {
            const enrichResult = await enrichResponse.json();
            console.log(`[usePlacesSearch] Edge Function enrichment complete: ${enrichResult.enriched} success, ${enrichResult.failed} failed`);
            enrichmentStats = {
              attempted: practitionerIdsToEnrich.length,
              enriched: enrichResult.enriched || 0,
              failed: enrichResult.failed || 0,
            };
          } else {
            console.warn("[usePlacesSearch] Edge Function enrichment failed:", await enrichResponse.text());
          }
        }
      } catch (err) {
        console.error("[usePlacesSearch] Edge Function enrichment error:", err);
        // Don't fail the whole operation - import succeeded
      }
    }

    setState((prev) => ({ ...prev, isEnriching: false }));

    // Mark imported places in state
    if (importResult.importedIds.length > 0) {
      markAsImported(importResult.importedIds);
    }

    return {
      ...importResult,
      enrichmentStats: practitionerIdsToEnrich.length > 0 ? enrichmentStats : undefined,
    };
  }, [state.places, markAsImported]);

  // Count selected places with websites (for UI)
  const selectedWithWebsites = state.places.filter(
    (p) => p.isSelected && !p.isImported && p.website
  ).length;

  return {
    ...state,
    search,
    loadMore,
    clearResults,
    toggleSelection,
    selectAll,
    deselectAll,
    importSelected,
    importAndEnrichSelected,
    enrichPlace,
    enrichSelected,
    markAsImported,
    selectedWithWebsites,
  };
}
