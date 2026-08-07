import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Simple file-backed cache to reduce Pexels API calls during development and improve responsiveness.
const CACHE_FILE = './.pexels_cache.json';
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours in ms
let cache: Record<string, { ts: number; data: any }> = {};
try {
  const txt = await Deno.readTextFile(CACHE_FILE);
  cache = JSON.parse(txt || '{}');
} catch (e) {
  // ignore if file doesn't exist or can't be read
}

async function writeCache() {
  try {
    await Deno.writeTextFile(CACHE_FILE, JSON.stringify(cache));
  } catch (e) {
    console.warn('Failed to write Pexels cache file', e);
  }
}

function cacheKey(query: string, perPage: number, page: number, orientation: string, size: string) {
  return `${query}::${perPage}::${page}::${orientation}::${size}`;
}

function getCached(key: string) {
  const entry = cache[key];
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL) {
    delete cache[key];
    // best-effort persist
    writeCache();
    return null;
  }
  return entry.data;
}

function setCached(key: string, data: any) {
  cache[key] = { ts: Date.now(), data };
  // persist asynchronously
  writeCache();
}

interface SearchRequest {
  query: string;
  perPage?: number;
  page?: number;
  orientation?: 'landscape' | 'portrait' | 'square';
  size?: 'large' | 'medium' | 'small';
}

interface PexelsVideo {
  id: number;
  width: number;
  height: number;
  duration: number;
  image: string;
  video_files: Array<{
    id: number;
    quality: string;
    file_type: string;
    width: number;
    height: number;
    link: string;
  }>;
  user: {
    name: string;
    url: string;
  };
}

interface StockVideo {
  id: string;
  thumbnailUrl: string;
  previewUrl: string;
  downloadUrl: string;
  duration: number;
  width: number;
  height: number;
  source: 'pexels';
  attribution: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const PEXELS_API_KEY = Deno.env.get('PEXELS_API_KEY');
    if (!PEXELS_API_KEY) {
      throw new Error('PEXELS_API_KEY is not configured');
    }

    const { 
      query, 
      perPage = 6, 
      page = 1,
      orientation = 'landscape',
      size = 'medium'
    }: SearchRequest = await req.json();

    if (!query?.trim()) {
      throw new Error('Search query is required');
    }

    console.log(`Searching Pexels for: "${query}" (page ${page}, ${perPage} results)`);

    const searchParams = new URLSearchParams({
      query: query.trim(),
      per_page: perPage.toString(),
      page: page.toString(),
      orientation,
      size,
    });

    const key = cacheKey(query.trim(), perPage, page, orientation, size);
    const cached = getCached(key);
    let data: any;
    if (cached) {
      data = cached;
      console.log('Using cached Pexels results for query:', query);
    } else {
      const response = await fetch(
        `https://api.pexels.com/videos/search?${searchParams}`,
        {
          headers: {
            'Authorization': PEXELS_API_KEY,
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Pexels API error:', response.status, errorText);
        throw new Error(`Pexels API error: ${response.status}`);
      }

      data = await response.json();
      try {
        setCached(key, data);
      } catch (e) {
        console.warn('Failed to cache Pexels results', e);
      }
    }
    
    // Transform Pexels response to our format
    const videos: StockVideo[] = (data.videos || []).map((video: PexelsVideo) => {
      // Get the best quality video file (prefer HD, fallback to SD)
      const hdFile = video.video_files.find(f => f.quality === 'hd' && f.file_type === 'video/mp4');
      const sdFile = video.video_files.find(f => f.quality === 'sd' && f.file_type === 'video/mp4');
      const bestFile = hdFile || sdFile || video.video_files[0];
      
      // Get a preview quality file
      const previewFile = sdFile || video.video_files.find(f => f.file_type === 'video/mp4') || video.video_files[0];

      return {
        id: `pexels_${video.id}`,
        thumbnailUrl: video.image,
        previewUrl: previewFile?.link || '',
        downloadUrl: bestFile?.link || '',
        duration: video.duration,
        width: bestFile?.width || video.width,
        height: bestFile?.height || video.height,
        source: 'pexels' as const,
        attribution: `Video by ${video.user.name} on Pexels`,
      };
    });

    console.log(`Found ${videos.length} videos for "${query}"`);

    return new Response(JSON.stringify({
      videos,
      totalResults: data.total_results || 0,
      page: data.page || page,
      perPage: data.per_page || perPage,
      hasMore: (data.page * data.per_page) < data.total_results,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Stock footage search error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Search failed',
      videos: [],
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
