import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { supabaseAdmin, isSupabaseConfigured } from "@/lib/supabase";

// Types
interface Practitioner {
  id: string;
  name: string;
  practitioner_type: string;
  address: string | null;
  city: string | null;
  province: string | null;
  phone: string | null;
  website: string | null;
  rating: number | null;
  review_count: number | null;
  business_status: string | null;
  google_maps_uri: string | null;
  latitude: number | null;
  longitude: number | null;
  scraped_at: string | null;
  notes: string | null;
  enrichment?: {
    success?: boolean;
    scraped_at?: string;
    data?: {
      practitioners?: Array<{ name: string; credentials?: string }>;
      emails?: string[];
      services?: string[];
      languages?: string[];
    };
  } | null;
  enrichment_status?: string;
  enriched_at?: string | null;
}

interface PractitionerData {
  metadata: {
    total_count: number;
    scraped_at: string;
    source: string;
  };
  practitioners: Practitioner[];
}

// Cache for JSON fallback (only used if Supabase fails)
let jsonCache: Practitioner[] | null = null;
let metadataCache: { 
  countries: string[]; 
  provinces: string[]; 
  cities: Record<string, string[]>; 
  types: string[];
  provincesByCountry: Record<string, string[]>;
} | null = null;
let metadataCacheTime: number = 0;
const METADATA_CACHE_TTL = 5 * 60 * 1000; // 5 minutes TTL

// Check if practitioners table exists in Supabase
let supabaseTableExists: boolean | null = null;

async function checkSupabaseTable(): Promise<boolean> {
  if (supabaseTableExists !== null) return supabaseTableExists;
  
  if (!isSupabaseConfigured || !supabaseAdmin) {
    supabaseTableExists = false;
    return false;
  }
  
  try {
    const { error } = await supabaseAdmin
      .from('practitioners')
      .select('id')
      .limit(1);
    
    supabaseTableExists = !error;
    return supabaseTableExists;
  } catch {
    supabaseTableExists = false;
    return false;
  }
}

// Load from JSON file (fallback)
async function loadFromJSON(): Promise<Practitioner[]> {
  if (jsonCache) return jsonCache;

  const possiblePaths = [
    path.join(process.cwd(), "public", "data", "practitioners.json"),
    path.join(process.cwd(), "..", "canadian_practitioners", "all_practitioners_latest.json"),
  ];

  for (const filePath of possiblePaths) {
    try {
      if (fs.existsSync(filePath)) {
        const fileContent = fs.readFileSync(filePath, "utf-8");
        const data: PractitionerData = JSON.parse(fileContent);
        jsonCache = data.practitioners;
        console.log(`[Practitioners API] Loaded from JSON: ${filePath}`);
        return jsonCache;
      }
    } catch (error) {
      console.log(`[Practitioners API] Failed to load from ${filePath}:`, error);
    }
  }

  console.error("[Practitioners API] No practitioner data found");
  return [];
}

// Clear metadata cache
function clearMetadataCache() {
  metadataCache = null;
  metadataCacheTime = 0;
  console.log("[Practitioners API] Metadata cache cleared");
}

// Get metadata for filters
async function getMetadata(forceRefresh: boolean = false): Promise<{ 
  countries: string[]; 
  provinces: string[]; 
  cities: Record<string, string[]>; 
  types: string[];
  provincesByCountry: Record<string, string[]>;
}> {
  // Check if cache is valid (not expired and not force refresh)
  const now = Date.now();
  const cacheValid = metadataCache && (now - metadataCacheTime) < METADATA_CACHE_TTL;
  
  if (cacheValid && !forceRefresh) {
    return metadataCache!;
  }
  
  // Clear stale cache
  if (metadataCache && !cacheValid) {
    console.log("[Practitioners API] Metadata cache expired, refreshing...");
  }
  if (forceRefresh) {
    console.log("[Practitioners API] Force refresh requested");
  }

  const useSupabase = await checkSupabaseTable();
  console.log(`[Practitioners API] getMetadata: useSupabase=${useSupabase}, hasAdmin=${!!supabaseAdmin}`);
  
  if (useSupabase && supabaseAdmin) {
    try {
      // Get distinct countries using RPC function
      const { data: countryData } = await supabaseAdmin.rpc('get_distinct_countries');
      const countries = ((countryData as { country: string }[] | null) || [])
        .map((c) => c.country)
        .filter(Boolean)
        .sort();
      
      // Use RPC functions for efficient distinct value retrieval
      const provinceResult = await supabaseAdmin.rpc('get_distinct_provinces');
      const provinceData = provinceResult.data as { province: string }[] | null;
      const provinceError = provinceResult.error;
      
      console.log(`[Practitioners API] Province RPC: ${provinceData?.length || 0} rows, error=${provinceError?.message || 'none'}`);
      
      const provinces = (provinceData || [])
        .map(p => p.province)
        .filter(Boolean)
        .sort();
      
      console.log(`[Practitioners API] Provinces: ${provinces.join(', ')}`);
      
      // Get distinct types via RPC
      const typeResult = await supabaseAdmin.rpc('get_distinct_practitioner_types');
      const typeData = typeResult.data as { practitioner_type: string }[] | null;
      const typeError = typeResult.error;
      
      console.log(`[Practitioners API] Type RPC: ${typeData?.length || 0} rows, error=${typeError?.message || 'none'}`);
      
      const types = (typeData || [])
        .map(t => t.practitioner_type)
        .filter(Boolean)
        .sort();
      
      // Get cities and provinces by country
      const { data: locationData } = await supabaseAdmin
        .from('practitioners')
        .select('country, province, city')
        .not('city', 'is', null)
        .limit(50000);
      
      const typedLocationData = locationData as { country: string; province: string; city: string }[] || [];
      
      // Build cities by province
      const cities: Record<string, string[]> = {};
      for (const province of provinces) {
        const provinceCities = typedLocationData
          .filter(c => c.province === province)
          .map(c => c.city)
          .filter(Boolean);
        cities[province] = [...new Set(provinceCities)].sort();
      }
      
      // Build provinces by country
      const provincesByCountry: Record<string, string[]> = {};
      for (const country of countries) {
        const countryProvinces = typedLocationData
          .filter(c => c.country === country)
          .map(c => c.province)
          .filter(Boolean);
        provincesByCountry[country] = [...new Set(countryProvinces)].sort();
      }
      
      metadataCache = { countries, provinces, cities, types, provincesByCountry };
      metadataCacheTime = Date.now();
      console.log(`[Practitioners API] Metadata cached: ${countries.length} countries, ${provinces.length} provinces, ${Object.keys(cities).length} city groups, ${types.length} types`);
      return metadataCache;
    } catch (error) {
      console.error("[Practitioners API] Supabase metadata error, falling back to JSON:", error);
    }
  }
  
  // Fallback to JSON (no country support in legacy data)
  const practitioners = await loadFromJSON();
  const provinces = [...new Set(practitioners.map(p => p.province).filter(Boolean))].sort() as string[];
  const cities: Record<string, string[]> = {};
  for (const province of provinces) {
    const provincePractitioners = practitioners.filter(p => p.province === province);
    cities[province] = [...new Set(provincePractitioners.map(p => p.city).filter(Boolean))].sort() as string[];
  }
  const types = [...new Set(practitioners.map(p => p.practitioner_type).filter(Boolean))].sort();
  
  // Default to CA for legacy JSON data
  metadataCache = { 
    countries: ['CA'], 
    provinces, 
    cities, 
    types,
    provincesByCountry: { 'CA': provinces }
  };
  metadataCacheTime = Date.now();
  console.log(`[Practitioners API] Metadata cached from JSON: ${provinces.length} provinces, ${Object.keys(cities).length} city groups, ${types.length} types`);
  return metadataCache;
}

// POST - Create a new user-added practitioner
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate required fields
    if (!body.name || !body.phone) {
      return NextResponse.json(
        { error: "Name and phone are required" },
        { status: 400 }
      );
    }

    // Check Supabase availability
    const useSupabase = await checkSupabaseTable();
    
    if (!useSupabase || !supabaseAdmin) {
      return NextResponse.json(
        { error: "Database not available" },
        { status: 503 }
      );
    }

    // Normalize phone number for duplicate check
    const normalizedPhone = body.phone.replace(/\D/g, "");
    
    // Check if practitioner with this phone already exists
    const { data: existing } = await supabaseAdmin
      .from('practitioners')
      .select('id, name, is_user_added')
      .or(`phone.like.%${normalizedPhone.slice(-10)}%`)
      .limit(1);

    if (existing && existing.length > 0) {
      // Return existing practitioner instead of creating duplicate
      return NextResponse.json({
        practitioner: existing[0],
        created: false,
        message: "Practitioner with this phone already exists"
      });
    }

    // Generate a unique ID for the new practitioner
    const id = `user_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    // Create the practitioner record
    const newPractitioner = {
      id,
      name: body.name,
      practitioner_type: body.practitioner_type || 'Unknown',
      address: body.address || null,
      city: body.city || null,
      province: body.province || null,
      phone: body.phone,
      website: body.website || null,
      rating: null,
      review_count: null,
      business_status: 'OPERATIONAL',
      google_maps_uri: null,
      latitude: null,
      longitude: null,
      scraped_at: new Date().toISOString(),
      notes: body.notes || null,
      is_user_added: true,
    };

    // Cast to any to bypass strict type checking until types are regenerated
    const { data, error } = await supabaseAdmin
      .from('practitioners')
      .insert(newPractitioner as any)
      .select()
      .single();

    if (error) {
      console.error("[Practitioners API] Failed to create practitioner:", error);
      return NextResponse.json(
        { error: "Failed to create practitioner", details: error.message },
        { status: 500 }
      );
    }

    // Clear metadata cache since we added a new practitioner
    clearMetadataCache();

    return NextResponse.json({
      practitioner: data,
      created: true,
      message: "Practitioner created successfully"
    }, { status: 201 });

  } catch (error) {
    console.error("[Practitioners API] POST error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  
  // Allow cache busting for metadata
  if (searchParams.get("clearCache") === "true") {
    metadataCache = null;
    jsonCache = null;
    supabaseTableExists = null;
    console.log("[Practitioners API] Cache cleared");
  }
  
  // Check if requesting metadata only
  if (searchParams.get("metadata") === "true") {
    const forceRefresh = searchParams.get("refresh") === "true";
    const useSupabase = await checkSupabaseTable();
    const metadata = await getMetadata(forceRefresh);
    return NextResponse.json({
      ...metadata,
      _debug: {
        useSupabase,
        hasAdminClient: !!supabaseAdmin,
        isConfigured: isSupabaseConfigured,
        provinceCount: metadata.provinces.length,
        typeCount: metadata.types.length,
      },
      _cache: {
        refreshed: forceRefresh,
        ttl_ms: METADATA_CACHE_TTL,
        cached_at: metadataCacheTime ? new Date(metadataCacheTime).toISOString() : null,
      }
    });
  }
  
  // Clear cache endpoint (for admin use)
  if (searchParams.get("clearCache") === "true") {
    clearMetadataCache();
    return NextResponse.json({ status: "ok", message: "Cache cleared" });
  }

  // Parse parameters
  const id = searchParams.get("id");
  const country = searchParams.get("country");
  const province = searchParams.get("province");
  const city = searchParams.get("city");
  const type = searchParams.get("type");
  const types = searchParams.get("types")?.split(",").filter(Boolean);
  const search = searchParams.get("search")?.toLowerCase();
  const minRating = searchParams.get("minRating") ? parseFloat(searchParams.get("minRating")!) : null;
  const hasPhone = searchParams.get("hasPhone") === "true";
  const phoneSearch = searchParams.get("phone");
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "100");
  const offset = (page - 1) * limit;

  // Handle single practitioner lookup by ID
  if (id) {
    const useSupabase = await checkSupabaseTable();
    if (useSupabase && supabaseAdmin) {
      const { data, error } = await supabaseAdmin
        .from('practitioners')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error || !data) {
        return NextResponse.json({ practitioners: [], error: 'Practitioner not found' }, { status: 404 });
      }
      
      return NextResponse.json({ practitioners: [data], source: 'supabase' });
    }
    return NextResponse.json({ practitioners: [], error: 'Database not available' }, { status: 500 });
  }

  // Try Supabase first
  const useSupabase = await checkSupabaseTable();
  
  if (useSupabase && supabaseAdmin) {
    try {
      // Build Supabase query
      let query = supabaseAdmin
        .from('practitioners')
        .select('*', { count: 'exact' });

      // Apply filters
      if (country) {
        query = query.eq('country', country);
      }
      if (province) {
        query = query.eq('province', province);
      }
      if (city) {
        query = query.eq('city', city);
      }
      if (type) {
        // Case-insensitive match for practitioner type
        query = query.ilike('practitioner_type', type);
      }
      if (types && types.length > 0) {
        // For multiple types, use OR with ilike for case-insensitive matching
        const typeFilters = types.map(t => `practitioner_type.ilike.${t}`).join(',');
        query = query.or(typeFilters);
      }
      if (search) {
        // Use ilike for case-insensitive search
        query = query.or(`name.ilike.%${search}%,address.ilike.%${search}%,city.ilike.%${search}%`);
      }
      if (minRating !== null) {
        query = query.gte('rating', minRating);
      }
      if (hasPhone) {
        query = query.not('phone', 'is', null).neq('phone', '');
      }
      if (phoneSearch) {
        // Normalize phone for search
        const normalizedPhone = phoneSearch.replace(/\D/g, "");
        query = query.like('phone', `%${normalizedPhone.slice(-10)}%`);
      }

      // Apply pagination and ordering
      const { data, count, error } = await query
        .order('rating', { ascending: false, nullsFirst: false })
        .range(offset, offset + limit - 1);

      if (error) {
        console.error("[Practitioners API] Supabase query error:", error);
        throw error;
      }

      // Parse enrichment JSONB back to object
      const practitioners = (data || []).map((p: Record<string, unknown>) => ({
        ...p,
        enrichment: typeof p.enrichment === 'string' ? JSON.parse(p.enrichment as string) : p.enrichment,
      })) as Practitioner[];

      return NextResponse.json({
        practitioners,
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages: Math.ceil((count || 0) / limit),
          hasMore: offset + limit < (count || 0),
        },
        filters: {
          country,
          province,
          city,
          type,
          types,
          search,
          minRating,
          hasPhone,
          phone: phoneSearch,
        },
        source: 'supabase',
      });
    } catch (error) {
      console.error("[Practitioners API] Supabase failed, falling back to JSON:", error);
    }
  }

  // Fallback to JSON file
  const practitioners = await loadFromJSON();
  
  // Apply filters (client-side)
  let filtered = practitioners;

  // Note: JSON fallback is legacy Canadian data, country filter won't apply
  if (province) {
    filtered = filtered.filter(p => p.province === province);
  }
  if (city) {
    filtered = filtered.filter(p => p.city === city);
  }
  if (type) {
    // Case-insensitive match
    filtered = filtered.filter(p => p.practitioner_type?.toLowerCase() === type.toLowerCase());
  }
  if (types && types.length > 0) {
    // Case-insensitive match for multiple types
    const lowerTypes = types.map(t => t.toLowerCase());
    filtered = filtered.filter(p => lowerTypes.includes(p.practitioner_type?.toLowerCase()));
  }
  if (search) {
    filtered = filtered.filter(p => 
      p.name.toLowerCase().includes(search) ||
      p.address?.toLowerCase().includes(search) ||
      p.city?.toLowerCase().includes(search)
    );
  }
  if (minRating !== null) {
    filtered = filtered.filter(p => (p.rating || 0) >= minRating);
  }
  if (hasPhone) {
    filtered = filtered.filter(p => p.phone && p.phone.trim() !== "");
  }
  if (phoneSearch) {
    const normalizedSearch = phoneSearch.replace(/\D/g, "");
    filtered = filtered.filter(p => {
      if (!p.phone) return false;
      const normalizedPhone = p.phone.replace(/\D/g, "");
      return normalizedPhone === normalizedSearch ||
             normalizedPhone.endsWith(normalizedSearch) ||
             normalizedSearch.endsWith(normalizedPhone);
    });
  }

  const total = filtered.length;
  const paginated = filtered.slice(offset, offset + limit);

  return NextResponse.json({
    practitioners: paginated,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasMore: offset + limit < total,
    },
    filters: {
      country,
      province,
      city,
      type,
      types,
      search,
      minRating,
      hasPhone,
      phone: phoneSearch,
    },
    source: 'json',
  });
}
