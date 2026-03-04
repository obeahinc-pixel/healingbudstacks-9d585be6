import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const DRGREEN_API_URL = "https://api.drgreennft.com/api/v1";
const S3_BASE = 'https://prod-profiles-backend.s3.amazonaws.com/';

/**
 * Check if a string is valid Base64
 */
function isBase64(str: string): boolean {
  if (!str || str.length % 4 !== 0) return false;
  return /^[A-Za-z0-9+/]+=*$/.test(str);
}

/**
 * Decode Base64 string to Uint8Array
 */
function base64ToBytes(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Sign query string using HMAC-SHA256 (matching drgreen-proxy)
 * Uses decoded key bytes if the key is Base64-encoded
 */
async function signQueryString(queryString: string, secretKey: string): Promise<string> {
  const encoder = new TextEncoder();
  
  // Use decoded key bytes if key is Base64-encoded
  let keyBytes: Uint8Array;
  if (isBase64(secretKey)) {
    try {
      keyBytes = base64ToBytes(secretKey);
    } catch {
      keyBytes = encoder.encode(secretKey);
    }
  } else {
    keyBytes = encoder.encode(secretKey);
  }
  
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyBytes.buffer as ArrayBuffer,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  
  // Sign the query string
  const queryData = encoder.encode(queryString);
  const signatureBuffer = await crypto.subtle.sign("HMAC", cryptoKey, queryData);
  
  // Convert ArrayBuffer to base64 string
  const signatureBytes = new Uint8Array(signatureBuffer);
  let binary = '';
  for (let i = 0; i < signatureBytes.byteLength; i++) {
    binary += String.fromCharCode(signatureBytes[i]);
  }
  return btoa(binary);
}

/**
 * Make authenticated GET request to Dr Green API with query string signing
 */
async function drGreenRequestQuery(
  endpoint: string,
  queryParams: Record<string, string | number>
): Promise<Response> {
  const apiKey = Deno.env.get("DRGREEN_API_KEY");
  const secretKey = Deno.env.get("DRGREEN_PRIVATE_KEY");
  
  if (!apiKey || !secretKey) {
    throw new Error("Dr Green API credentials not configured");
  }
  
  // Build query string exactly like WordPress: http_build_query
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(queryParams)) {
    params.append(key, String(value));
  }
  const queryString = params.toString();
  
  // Sign the query string (not the body)
  const signature = await signQueryString(queryString, secretKey);
  
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-auth-apikey": apiKey,
    "x-auth-signature": signature,
  };
  
  const url = `${DRGREEN_API_URL}${endpoint}?${queryString}`;
  console.log(`[DrGreen API - Sync] GET ${url}`);
  console.log(`[DrGreen API] Query for signing: ${queryString}`);
  
  return fetch(url, {
    method: "GET",
    headers,
  });
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    console.log("Starting strain sync from Dr Green API...");
    
    // Parse request body for optional parameters
    let countryCode = 'PRT';
    let take = 100;
    let page = 1;
    
    try {
      const body = await req.json();
      if (body.countryCode) countryCode = body.countryCode;
      if (body.take) take = body.take;
      if (body.page) page = body.page;
    } catch {
      // No body or invalid JSON, use defaults
    }
    
    // Fetch strains from Dr Green API using query string signing (Method B)
    const queryParams: Record<string, string | number> = {
      orderBy: 'desc',
      take: take,
      page: page,
    };
    
    // Try with country code first
    console.log(`Fetching strains for country: ${countryCode}`);
    let response = await drGreenRequestQuery("/strains", { ...queryParams, countryCode });
    
    if (!response.ok) {
      // Try without country code (global catalog)
      console.log('Country-specific request failed, trying global catalog...');
      response = await drGreenRequestQuery("/strains", queryParams);
    }
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error("Dr Green API error:", response.status, errorText);
      throw new Error(`Dr Green API error: ${response.status} - ${errorText}`);
    }
    
    const data = await response.json();
    console.log(`Received ${data?.data?.strains?.length || 0} strains from Dr Green API`);
    console.log('Sample strain data:', JSON.stringify(data?.data?.strains?.[0], null, 2));
    
    if (!data?.success || !data?.data?.strains?.length) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: "No strains returned from API", 
          synced: 0,
          raw: data 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    const strains = data.data.strains;
    let syncedCount = 0;
    let errorCount = 0;
    
    for (const strain of strains) {
      try {
        // Build full image URL
        let imageUrl = null;
        if (strain.imageUrl) {
          imageUrl = strain.imageUrl.startsWith('http') 
            ? strain.imageUrl 
            : `${S3_BASE}${strain.imageUrl}`;
        } else if (strain.image) {
          imageUrl = strain.image.startsWith('http')
            ? strain.image
            : `${S3_BASE}${strain.image}`;
        }
        
        // Parse effects/feelings - handle arrays and strings
        let feelings: string[] = [];
        if (Array.isArray(strain.feelings)) {
          feelings = strain.feelings;
        } else if (typeof strain.feelings === 'string') {
          feelings = strain.feelings.split(',').map((s: string) => s.trim());
        } else if (Array.isArray(strain.effects)) {
          feelings = strain.effects;
        }
        
        // Parse flavors - handle arrays and strings
        let flavors: string[] = [];
        if (Array.isArray(strain.flavour)) {
          flavors = strain.flavour;
        } else if (typeof strain.flavour === 'string') {
          flavors = strain.flavour.split(',').map((s: string) => s.trim());
        } else if (Array.isArray(strain.flavors)) {
          flavors = strain.flavors;
        }
        
        // Parse helps_with
        let helpsWith: string[] = [];
        if (Array.isArray(strain.helpsWith)) {
          helpsWith = strain.helpsWith;
        } else if (typeof strain.helpsWith === 'string') {
          helpsWith = strain.helpsWith.split(',').map((s: string) => s.trim());
        }
        
        // Get availability from strainLocations if present
        const location = strain.strainLocations?.[0];
        const isAvailable = location?.isAvailable ?? strain.isAvailable ?? strain.availability ?? true;
        const stock = location?.stockQuantity ?? strain.stock ?? strain.stockQuantity ?? 100;
        
        // Priority: location price (fixed/local) first, then top-level
        const retailPrice = 
          parseFloat(location?.retailPrice) ||
          parseFloat(location?.pricePerGram) ||
          parseFloat(location?.pricePerUnit) ||
          parseFloat(strain.retailPrice) || 
          parseFloat(strain.pricePerGram) || 
          parseFloat(strain.pricePerUnit) || 
          parseFloat(strain.price) || 
          0;
        
        // Get THC/CBD - try multiple field names
        const thcContent = 
          parseFloat(strain.thc) || 
          parseFloat(strain.thcContent) || 
          parseFloat(strain.THC) ||
          0;
        const cbdContent = 
          parseFloat(strain.cbd) || 
          parseFloat(strain.cbdContent) || 
          parseFloat(strain.CBD) ||
          0;
        const cbgContent =
          parseFloat(strain.cbg) ||
          parseFloat(strain.cbgContent) ||
          0;
        
        // Upsert strain into local database
        const strainData = {
          id: strain.id,
          sku: strain.batchNumber || strain.sku || strain.id,
          name: strain.name,
          description: strain.description || '',
          type: strain.category || strain.type || 'Hybrid',
          thc_content: thcContent,
          cbd_content: cbdContent,
          cbg_content: cbgContent,
          retail_price: retailPrice,
          availability: isAvailable,
          stock: stock,
          image_url: imageUrl,
          feelings: feelings,
          flavors: flavors,
          helps_with: helpsWith,
          brand_name: strain.brandName || 'Dr. Green',
          is_archived: false,
          updated_at: new Date().toISOString(),
        };
        
        console.log(`Upserting strain: ${strain.name}`, strainData);
        
        const { error: upsertError } = await supabase
          .from('strains')
          .upsert(strainData, { onConflict: 'id' });
        
        if (upsertError) {
          console.error(`Error upserting strain ${strain.name}:`, upsertError);
          errorCount++;
        } else {
          console.log(`Synced strain: ${strain.name}`);
          syncedCount++;
        }
      } catch (strainError) {
        console.error(`Error processing strain ${strain.name}:`, strainError);
        errorCount++;
      }
    }
    
    console.log(`Sync complete: ${syncedCount} synced, ${errorCount} errors`);
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Synced ${syncedCount} strains from Dr Green API`,
        synced: syncedCount,
        errors: errorCount,
        total: strains.length,
        pageInfo: data?.data?.pageMetaDto
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
    
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error("Sync strains error:", error);
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
