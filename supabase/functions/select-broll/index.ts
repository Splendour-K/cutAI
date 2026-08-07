import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Suggestion {
  id: string;
  timestamp: number;
  duration: number;
  description?: string;
  searchQuery: string;
  altQueries?: string[];
  keywords?: string[];
  mood?: string;
  colorTone?: string;
  motion?: string;
  [key: string]: unknown;
}

interface SelectRequest {
  suggestions: Suggestion[];
  aspectRatio?: string;
  style?: string;
  platform?: string;
}

interface PexelsFile {
  quality: string;
  file_type: string;
  width: number;
  height: number;
  link: string;
}

interface PexelsVideo {
  id: number;
  width: number;
  height: number;
  duration: number;
  image: string;
  url?: string;
  avg_color?: string;
  tags?: string[];
  video_files: PexelsFile[];
  user: { id?: number; name: string; url: string };
}

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'of', 'and', 'or', 'in', 'on', 'at', 'to', 'for', 'with',
  'shot', 'footage', 'video', 'clip', 'view', 'scene', 'people', 'person',
]);

function tokenize(text: string): string[] {
  return (text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
}

function orientationFor(aspectRatio?: string): 'landscape' | 'portrait' | 'square' {
  if (!aspectRatio) return 'landscape';
  if (aspectRatio === '9:16' || aspectRatio === '4:5' || aspectRatio === '3:4') return 'portrait';
  if (aspectRatio === '1:1') return 'square';
  return 'landscape';
}

// Motion hint -> preferred clip length. Fast pacing wants short, punchy clips.
function pacingWindow(style?: string): { min: number; max: number } {
  if (style === 'tiktok' || style === 'fast-paced' || style === 'youtube-short') return { min: 3, max: 12 };
  if (style === 'documentary') return { min: 8, max: 40 };
  return { min: 5, max: 25 };
}

async function pexelsSearch(
  apiKey: string,
  query: string,
  orientation: string,
  perPage: number,
): Promise<PexelsVideo[]> {
  const params = new URLSearchParams({
    query,
    per_page: perPage.toString(),
    page: '1',
    orientation,
  });
  const res = await fetch(`https://api.pexels.com/videos/search?${params}`, {
    headers: { Authorization: apiKey },
  });
  if (!res.ok) {
    console.error(`Pexels error for "${query}": ${res.status} ${await res.text()}`);
    return [];
  }
  const data = await res.json();
  return (data.videos || []) as PexelsVideo[];
}

function pickFile(video: PexelsVideo, orientation: string) {
  const mp4s = video.video_files.filter((f) => f.file_type === 'video/mp4');
  const matchesOrientation = mp4s.filter((f) => {
    if (!f.width || !f.height) return true;
    const isPortrait = f.height > f.width;
    if (orientation === 'portrait') return isPortrait;
    if (orientation === 'landscape') return !isPortrait;
    return true;
  });
  const pool = matchesOrientation.length ? matchesOrientation : mp4s;
  // Prefer ~1080p: big enough to look sharp, small enough to stream in preview.
  const sorted = [...pool].sort((a, b) => {
    const score = (f: PexelsFile) => -Math.abs((f.height || 720) - 1080);
    return score(b) - score(a);
  });
  const best = sorted[0] || video.video_files[0];
  const preview =
    pool.find((f) => (f.height || 0) <= 720 && (f.height || 0) >= 360) || best;
  return { best, preview };
}

/** Score a candidate clip for a given suggestion. Higher is better. */
function scoreCandidate(
  video: PexelsVideo,
  wanted: string[],
  suggestion: Suggestion,
  orientation: string,
  window: { min: number; max: number },
  usedAuthors: Set<number | string>,
  usedTags: Map<string, number>,
): number {
  let score = 0;

  // 1. Semantic overlap between the AI's intent and the clip's tags/url slug.
  const clipText = [
    ...(video.tags || []),
    (video.url || '').split('/').filter(Boolean).pop() || '',
  ].join(' ');
  const clipTokens = new Set(tokenize(clipText));
  let overlap = 0;
  for (const w of wanted) if (clipTokens.has(w)) overlap++;
  score += overlap * 12;

  // 2. Duration fit — clip must comfortably cover the insert duration.
  const needed = suggestion.duration || 3;
  if (video.duration >= needed + 0.5) score += 18;
  else score -= 25;
  if (video.duration >= window.min && video.duration <= window.max) score += 10;
  else score -= Math.min(15, Math.abs(video.duration - window.max) * 0.4);

  // 3. Orientation / framing match with the main video.
  const isPortrait = video.height > video.width;
  if (orientation === 'portrait' && isPortrait) score += 20;
  else if (orientation === 'landscape' && !isPortrait) score += 20;
  else if (orientation === 'square') score += 5;
  else score -= 18;

  // 4. Resolution quality.
  const maxH = Math.max(...video.video_files.map((f) => f.height || 0), video.height || 0);
  if (maxH >= 1080) score += 8;
  else if (maxH >= 720) score += 4;
  else score -= 6;

  // 5. Variety: penalise the same creator or an over-used visual theme.
  if (video.user?.id && usedAuthors.has(video.user.id)) score -= 22;
  if (video.user?.name && usedAuthors.has(video.user.name)) score -= 22;
  for (const t of video.tags || []) {
    const seen = usedTags.get(t.toLowerCase()) || 0;
    if (seen) score -= Math.min(18, seen * 7);
  }

  // 6. Color/mood alignment when the AI expressed a tone preference.
  const tone = (suggestion.colorTone || '').toLowerCase();
  const avg = (video.avg_color || '').replace('#', '');
  if (tone && avg.length === 6) {
    const r = parseInt(avg.slice(0, 2), 16);
    const g = parseInt(avg.slice(2, 4), 16);
    const b = parseInt(avg.slice(4, 6), 16);
    const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    const warm = r > b;
    if (/dark|moody|night|dramatic/.test(tone)) score += lum < 0.45 ? 10 : -6;
    if (/bright|light|airy|clean|day/.test(tone)) score += lum > 0.5 ? 10 : -6;
    if (/warm|golden|orange|sunset/.test(tone)) score += warm ? 8 : -4;
    if (/cool|blue|cold|teal/.test(tone)) score += warm ? -4 : 8;
  }

  return score;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const PEXELS_API_KEY = Deno.env.get('PEXELS_API_KEY');
    if (!PEXELS_API_KEY) throw new Error('PEXELS_API_KEY is not configured');

    const { suggestions, aspectRatio, style }: SelectRequest = await req.json();
    if (!Array.isArray(suggestions) || suggestions.length === 0) {
      return new Response(JSON.stringify({ results: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const orientation = orientationFor(aspectRatio);
    const window = pacingWindow(style);

    const usedVideoIds = new Set<number>();
    const usedAuthors = new Set<number | string>();
    const usedTags = new Map<string, number>();
    const results: Array<Record<string, unknown>> = [];

    // Process in timeline order so earlier picks constrain later ones (no repeats).
    const ordered = [...suggestions].sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

    for (const suggestion of ordered) {
      const queries = [suggestion.searchQuery, ...(suggestion.altQueries || [])]
        .filter((q): q is string => Boolean(q && q.trim()))
        .slice(0, 3);

      if (!queries.length) {
        results.push({ id: suggestion.id, ok: false, reasonFailed: 'no-query' });
        continue;
      }

      const wanted = Array.from(
        new Set([
          ...tokenize(queries.join(' ')),
          ...tokenize((suggestion.keywords || []).join(' ')),
          ...tokenize(suggestion.description || ''),
        ]),
      );

      const candidates = new Map<number, PexelsVideo>();
      for (const q of queries) {
        const found = await pexelsSearch(PEXELS_API_KEY, q, orientation, 8);
        for (const v of found) if (!usedVideoIds.has(v.id)) candidates.set(v.id, v);
        if (candidates.size >= 14) break;
      }

      // Widen the search if the strict orientation returned nothing usable.
      if (candidates.size === 0) {
        const fallback = await pexelsSearch(PEXELS_API_KEY, queries[0], '', 8);
        for (const v of fallback) if (!usedVideoIds.has(v.id)) candidates.set(v.id, v);
      }

      if (candidates.size === 0) {
        results.push({ id: suggestion.id, ok: false, reasonFailed: 'no-results' });
        continue;
      }

      let bestVideo: PexelsVideo | null = null;
      let bestScore = -Infinity;
      for (const v of candidates.values()) {
        const s = scoreCandidate(v, wanted, suggestion, orientation, window, usedAuthors, usedTags);
        if (s > bestScore) {
          bestScore = s;
          bestVideo = v;
        }
      }

      if (!bestVideo || bestScore < -20) {
        results.push({ id: suggestion.id, ok: false, reasonFailed: 'no-good-match' });
        continue;
      }

      usedVideoIds.add(bestVideo.id);
      if (bestVideo.user?.id) usedAuthors.add(bestVideo.user.id);
      if (bestVideo.user?.name) usedAuthors.add(bestVideo.user.name);
      for (const t of bestVideo.tags || []) {
        const k = t.toLowerCase();
        usedTags.set(k, (usedTags.get(k) || 0) + 1);
      }

      const { best, preview } = pickFile(bestVideo, orientation);
      const needed = suggestion.duration || 3;
      // Skip the first moments of long clips: openings are often static/ramping up.
      const clipStartOffset =
        bestVideo.duration > needed + 2 ? Math.min(1.5, (bestVideo.duration - needed) / 4) : 0;

      results.push({
        id: suggestion.id,
        ok: true,
        sourceId: `pexels_${bestVideo.id}`,
        stockFootageUrl: preview?.link || best?.link || '',
        downloadUrl: best?.link || preview?.link || '',
        thumbnailUrl: bestVideo.image,
        clipDuration: bestVideo.duration,
        clipStartOffset: Number(clipStartOffset.toFixed(2)),
        width: best?.width || bestVideo.width,
        height: best?.height || bestVideo.height,
        avgColor: bestVideo.avg_color || null,
        attribution: `Video by ${bestVideo.user.name} on Pexels`,
        matchScore: Math.round(bestScore),
        matchedQuery: queries[0],
      });
    }

    console.log(
      `select-broll: ${results.filter((r) => r.ok).length}/${suggestions.length} matched (orientation=${orientation})`,
    );

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('select-broll error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'B-roll selection failed', results: [] }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
