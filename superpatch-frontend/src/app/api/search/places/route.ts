import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth";
import { PlacesSearchSchema, validateBody } from "@/lib/validation";

import { getEnvVar } from "@/lib/config/env";

const GOOGLE_MAPS_API_KEY = getEnvVar("GOOGLE_MAPS_API_KEY");
const PLACES_API_URL = "https://places.googleapis.com/v1/places:searchText";

// Fields to request from the API
const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.nationalPhoneNumber",
  "places.internationalPhoneNumber",
  "places.websiteUri",
  "places.rating",
  "places.userRatingCount",
  "places.businessStatus",
  "places.googleMapsUri",
  "places.location",
  "places.addressComponents",
  "nextPageToken",
].join(",");

export interface GooglePlace {
  id: string;
  displayName: { text: string; languageCode?: string };
  formattedAddress: string;
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  websiteUri?: string;
  rating?: number;
  userRatingCount?: number;
  businessStatus?: string;
  googleMapsUri?: string;
  location?: {
    latitude: number;
    longitude: number;
  };
  addressComponents?: Array<{
    longText: string;
    shortText: string;
    types: string[];
  }>;
}

export interface PlacesSearchRequest {
  query: string;
  location: {
    lat: number;
    lng: number;
    radius: number;
  };
  country: "CA" | "US";
  pageToken?: string;
  limit?: number; // Max results to return (default 20, max 100)
}

export interface PlacesSearchResponse {
  places: GooglePlace[];
  nextPageToken?: string;
  totalRequests: number;
  error?: string;
}

// Extract city and state/province from address components
function extractLocationInfo(
  addressComponents?: GooglePlace["addressComponents"]
): { city: string | null; region: string | null } {
  if (!addressComponents) return { city: null, region: null };

  let city: string | null = null;
  let region: string | null = null;

  for (const component of addressComponents) {
    if (component.types?.includes("locality")) {
      city = component.longText;
    }
    if (component.types?.includes("administrative_area_level_1")) {
      region = component.longText;
    }
  }

  return { city, region };
}

// Normalize place data for frontend consumption
function normalizePlaceData(place: GooglePlace, country: "CA" | "US") {
  const { city, region } = extractLocationInfo(place.addressComponents);

  return {
    id: place.id,
    name: place.displayName?.text || "Unknown",
    address: place.formattedAddress || "",
    city: city,
    province: region, // Works for both Canadian provinces and US states
    country: country,
    phone: place.nationalPhoneNumber || place.internationalPhoneNumber || null,
    website: place.websiteUri || null,
    rating: place.rating || null,
    review_count: place.userRatingCount || null,
    business_status: place.businessStatus || "OPERATIONAL",
    google_maps_uri: place.googleMapsUri || null,
    latitude: place.location?.latitude || null,
    longitude: place.location?.longitude || null,
  };
}

// Helper function to make a single API request
async function fetchPlacesPage(
  query: string,
  location: { lat: number; lng: number; radius: number },
  country: string,
  pageToken?: string
): Promise<{ places: GooglePlace[]; nextPageToken?: string; error?: string }> {
  const payload: Record<string, unknown> = {
    textQuery: query,
    locationBias: {
      circle: {
        center: {
          latitude: location.lat,
          longitude: location.lng,
        },
        radius: location.radius || 20000,
      },
    },
    regionCode: country || "CA",
    languageCode: "en",
    pageSize: 20, // Google's max per request
  };

  if (pageToken) {
    payload.pageToken = pageToken;
  }

  const response = await fetch(PLACES_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": GOOGLE_MAPS_API_KEY!,
      "X-Goog-FieldMask": FIELD_MASK,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[Places API] Error: ${response.status} - ${errorText}`);
    return { places: [], error: `Google Maps API error: ${response.status}` };
  }

  const data = await response.json();
  return {
    places: data.places || [],
    nextPageToken: data.nextPageToken,
  };
}

// POST /api/search/places - Search Google Maps Places API
export async function POST(request: NextRequest) {
  const auth = await requireApiAuth();
  if (!auth.authorized) return auth.response;

  try {
    // Check for API key
    if (!GOOGLE_MAPS_API_KEY) {
      return NextResponse.json(
        {
          places: [],
          error: "Google Maps API key not configured. Set GOOGLE_MAPS_API_KEY environment variable.",
        },
        { status: 500 }
      );
    }

    const body = await request.json();
    const validation = validateBody(PlacesSearchSchema, body);
    if (!validation.success) {
      return NextResponse.json(
        {
          places: [],
          error: validation.error,
        },
        { status: 400 }
      );
    }
    const { query, location, country, limit = 20 } = validation.data;
    const pageToken = body.pageToken;

    // Clamp limit between 1 and 100
    const maxResults = Math.min(Math.max(limit, 1), 100);
    
    console.log(`[Places API] Searching: "${query}" near (${location.lat}, ${location.lng}), limit: ${maxResults}`);

    // If a pageToken is provided, just fetch that single page (for manual pagination)
    if (pageToken) {
      const result = await fetchPlacesPage(query, location, country, pageToken);
      
      if (result.error) {
        return NextResponse.json({ places: [], error: result.error }, { status: 500 });
      }

      const normalizedPlaces = result.places.map((place) => normalizePlaceData(place, country));
      
      return NextResponse.json({
        places: normalizedPlaces,
        nextPageToken: result.nextPageToken,
        totalRequests: 1,
      });
    }

    // Auto-paginate to collect results up to the limit
    const allPlaces: GooglePlace[] = [];
    let nextToken: string | undefined;
    let totalRequests = 0;

    while (allPlaces.length < maxResults) {
      const result = await fetchPlacesPage(query, location, country, nextToken);
      totalRequests++;

      if (result.error) {
        // If we have some results, return them; otherwise return error
        if (allPlaces.length > 0) {
          console.log(`[Places API] Error on page ${totalRequests}, returning ${allPlaces.length} results collected so far`);
          break;
        }
        return NextResponse.json({ places: [], error: result.error }, { status: 500 });
      }

      if (result.places.length === 0) {
        // No more results available
        console.log(`[Places API] No more results available after ${totalRequests} requests`);
        break;
      }

      allPlaces.push(...result.places);
      nextToken = result.nextPageToken;

      console.log(`[Places API] Page ${totalRequests}: got ${result.places.length} places, total: ${allPlaces.length}, hasMore: ${!!nextToken}`);

      // Stop if no more pages
      if (!nextToken) {
        break;
      }

      // Safety limit: max 5 API calls per search (100 results)
      if (totalRequests >= 5) {
        console.log(`[Places API] Reached max API calls (5), stopping pagination`);
        break;
      }
    }

    // Trim to requested limit and normalize
    const trimmedPlaces = allPlaces.slice(0, maxResults);
    const normalizedPlaces = trimmedPlaces.map((place) => normalizePlaceData(place, country));
    
    // Only report hasMore if we have a token AND we trimmed results
    const hasMore = !!nextToken && allPlaces.length > maxResults;

    console.log(`[Places API] Returning ${normalizedPlaces.length} places after ${totalRequests} API calls`);

    return NextResponse.json({
      places: normalizedPlaces,
      nextPageToken: hasMore ? nextToken : undefined,
      totalRequests,
    });
  } catch (error) {
    console.error("[Places API] Error:", error);
    return NextResponse.json(
      {
        places: [],
        error: "Failed to search places",
      },
      { status: 500 }
    );
  }
}

// GET endpoint for testing/info
export async function GET() {
  const auth = await requireApiAuth();
  if (!auth.authorized) return auth.response;

  return NextResponse.json({
    status: "ok",
    message: "Google Maps Places Search API",
    configured: !!GOOGLE_MAPS_API_KEY,
    usage: {
      method: "POST",
      body: {
        query: "string (e.g., 'chiropractor')",
        location: {
          lat: "number",
          lng: "number",
          radius: "number (meters, default 20000)",
        },
        country: "'CA' | 'US'",
        pageToken: "string (optional, for pagination)",
      },
    },
  });
}
