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

// Histogram cache for thumbnails (persisted to file)
const HIST_FILE = './.pexels_histograms.json';
let histCache: Record<string, { ts: number; hist: number[] }> = {};
try {
  const txt2 = await Deno.readTextFile(HIST_FILE);
  histCache = JSON.parse(txt2 || '{}');
} catch (e) {
  // ignore
}

async function writeHistCache() {
  try {
    await Deno.writeTextFile(HIST_FILE, JSON.stringify(histCache));
  } catch (e) {
    console.warn('Failed to write Pexels hist cache file', e);
  }
}

function getHistogramFor(id: string) {
  const entry = histCache[id];
  if (!entry) return null;
  // don't expire histograms aggressively
  return entry.hist;
}

function setHistogramFor(id: string, hist: number[]) {
  histCache[id] = { ts: Date.now(), hist };
  writeHistCache();
}

interface SearchRequest {
  action?: string; // 'search' or 'upload_hist'
  query?: string;
  perPage?: number;
  page?: number;
  orientation?: 'landscape' | 'portrait' | 'square';
  size?: 'large' | 'medium' | 'small';
  // when uploading histogram
  id?: string;
  histogram?: number[];
  // optional style profile for re-ranking
  styleProfile?: { histogram?: number[]; motionEnergy?: number };
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
  thumbnailHistogram?: number[];
}

function histogramDistance(a: number[], b: number[]) {
  let sum = 0;
  for (let i = 0; i < a.length && i < b.length; i++) {
    const d = a[i] - b[i];
    sum += d * d;
  }
  return Math.sqrt(sum);
}

function histogramSimilarity(a: number[], b: number[]) {
  const d = histogramDistance(a, b);
  return 1 / (1 + d);
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

    const body: SearchRequest = await req.json();

    // Handle histogram upload from client
    if (body.action === 'upload_hist') {
      if (!body.id || !body.histogram) {
        return new Response(JSON.stringify({ error: 'id and histogram required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      try {
        setHistogramFor(body.id, body.histogram);
        return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      } catch (e) {
        return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    const query = body.query || '';
    const perPage = body.perPage || 6;
    const page = body.page || 1;
    const orientation = body.orientation || 'landscape';
    const size = body.size || 'medium';

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
    let videos: StockVideo[] = (data.videos || []).map((video: PexelsVideo) => {
      const hdFile = video.video_files.find(f => f.quality === 'hd' && f.file_type === 'video/mp4');
      const sdFile = video.video_files.find(f => f.quality === 'sd' && f.file_type === 'video/mp4');
      const bestFile = hdFile || sdFile || video.video_files[0];
      const previewFile = sdFile || video.video_files.find(f => f.file_type === 'video/mp4') || video.video_files[0];

      const vidId = `pexels_${video.id}`;
      const hist = getHistogramFor(vidId);

      return {
        id: vidId,
        thumbnailUrl: video.image,
        previewUrl: previewFile?.link || '',
        downloadUrl: bestFile?.link || '',
        duration: video.duration,
        width: bestFile?.width || video.width,
        height: bestFile?.height || video.height,
        source: 'pexels' as const,
        attribution: `Video by ${video.user.name} on Pexels`,
        thumbnailHistogram: hist || undefined,
      };
    });

    // If client provided a style profile, re-rank by histogram similarity when possible
    if (body.styleProfile && body.styleProfile.histogram) {
      const targetHist = body.styleProfile.histogram;
      videos = videos.map(v => ({ v, score: v.thumbnailHistogram ? histogramSimilarity(targetHist, v.thumbnailHistogram) : 0 } as any))
        .sort((a: any, b: any) => b.score - a.score)
        .map((x: any) => x.v);
    }

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
