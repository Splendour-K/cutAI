import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AnalyzeRequest {
  projectId: string;
  transcript: {
    fullText: string;
    segments: Array<{
      startTime: number;
      endTime: number;
      text: string;
    }>;
  };
  videoContext?: {
    genre?: string;
    mood?: string[];
    pacing?: string;
  };
  videoDuration?: number;
  platform?: string;
}

// ---- Post-processing: enforce restraint, spacing, variety ----
const GRAPHIC_TYPES = [
  'animated-title', 'lower-third', 'icon', 'callout', 'arrow',
  'highlight-box', 'progress-bar', 'chart', 'motion-graphic',
  'zoom-emphasis', 'text-emphasis',
];

function pruneSuggestions(raw: any[], videoDuration: number) {
  const minConfidence = 0.62;
  // Graphics budget: ~1 per 15s of runtime, hard cap 14
  const budget = Math.max(2, Math.min(14, Math.round((videoDuration || 60) / 15)));

  const cleaned = (raw || [])
    .filter((s) => s && typeof s.timestamp === 'number')
    .map((s) => {
      const start = Math.max(0, s.timestamp);
      const end = Math.max(start + 0.6, Math.min(s.endTime ?? start + 2.5, start + 8));
      const g = s.graphic || {};
      if (s.type === 'graphic' || s.type === 'animation') {
        if (!GRAPHIC_TYPES.includes(g.graphicType)) {
          g.graphicType = s.type === 'animation' ? 'text-emphasis' : 'callout';
        }
        // Charts/progress bars without data are meaningless — downgrade
        if (g.graphicType === 'chart' && !(Array.isArray(g.chartData) && g.chartData.length >= 2)) {
          g.graphicType = 'callout';
        }
        if (g.graphicType === 'progress-bar' && typeof g.progress !== 'number') {
          g.graphicType = 'callout';
        }
      }
      return { ...s, timestamp: start, endTime: end, graphic: s.graphic ? g : undefined };
    })
    .filter((s) => (s.confidence ?? 0) >= minConfidence)
    .sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0));

  const kept: any[] = [];
  const seen = new Set<string>();
  for (const s of cleaned) {
    const key = `${s.graphic?.graphicType || s.type}:${(s.graphic?.title || s.graphic?.label || s.description || '')
      .toLowerCase()
      .slice(0, 28)}`;
    if (seen.has(key)) continue;
    // Never stack two on-screen graphics within 2.5s of each other
    const overlaps = kept.some(
      (k) =>
        k.type !== 'sfx' &&
        s.type !== 'sfx' &&
        s.timestamp < k.endTime + 2.5 &&
        k.timestamp < s.endTime + 2.5,
    );
    if (overlaps) continue;
    // Keep the hook clean for the first 1.5s except a title
    if (s.timestamp < 1.5 && s.graphic?.graphicType !== 'animated-title') continue;
    seen.add(key);
    kept.push(s);
    if (kept.length >= budget) break;
  }

  return kept.sort((a, b) => a.timestamp - b.timestamp);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const { projectId, transcript, videoContext, videoDuration, platform }: AnalyzeRequest = await req.json();

    if (!transcript || !transcript.segments?.length) {
      throw new Error('Transcript with segments is required');
    }

    const totalDuration =
      videoDuration ||
      transcript.segments[transcript.segments.length - 1]?.endTime ||
      60;

    console.log(`Analyzing enhancements for project ${projectId}`);
    console.log(`Transcript has ${transcript.segments.length} segments`);

    const systemPrompt = `You are a senior motion designer and broadcast graphics editor. You read a transcript and decide, like a professional, WHERE on-screen graphics genuinely earn their place — and where they do not.

Your default answer is NO GRAPHIC. A graphic is only justified when it does one of these jobs:
 (a) makes information easier to understand (numbers, comparisons, steps, structure, spatial reference),
 (b) identifies something the viewer needs to know (a speaker, a place, a topic change),
 (c) locks attention at a genuine engagement beat (the hook, a punchline, a hard-hitting claim).
If a line is just conversational connective tissue, you place nothing. Decorative graphics are a failure.

ENHANCEMENT TYPES
1. "graphic" — an on-screen motion-design element. MUST include a "graphic" object with a "graphicType":
   - "animated-title": the opening topic/hook title, or a chapter title at a hard topic change. Max 1 opening title + 1 per major section. Needs "title", optional "subtitle".
   - "lower-third": names/identifies the speaker or a named entity the FIRST time it matters. Needs "title" (name) and "subtitle" (role). Never repeat the same person twice.
   - "icon": a single symbolic icon reinforcing one concrete concept. Needs "icon" (lucide icon name, kebab-case, e.g. "trending-up", "shield", "clock", "dollar-sign").
   - "callout": a short pull-quote of the exact claim being made. Needs "label" (max 8 words, drawn from the words actually spoken).
   - "arrow": directs the eye to something visible in the frame. Needs "arrowAngle" (degrees, 0 = right) and "box" or "position" for where it points. Only use when the speaker points/refers to something on screen.
   - "highlight-box": frames a region of the frame the speaker is referring to. Needs "box" {x,y,width,height} in % of frame.
   - "progress-bar": shows a proportion/completion the speaker states. Needs "progress" (0-100) and "label".
   - "chart": ONLY when the speaker gives 2+ comparable numbers. Needs "chartType" ("bar"|"line"|"donut"), "chartData" [{label,value}...] taken from the spoken numbers, optional "chartUnit", "label".
   - "motion-graphic": abstract animated accent for a transition beat between sections. Use very sparingly (max 2 per video).
   - "zoom-emphasis": a punch-in on the speaker at an emotional/emphatic peak. Needs "zoomScale" (1.05-1.35) and "focalPoint" {x,y}.
   - "text-emphasis": pops 1-3 spoken words larger for impact. Needs "emphasisWords" (exact spoken words).
2. "visual" — a generated contextual image for a concrete object/place/metaphor named out loud. Include "suggestedPrompt".
3. "sfx" — a sound effect at an impact/comedy/transition beat. Include "suggestedPrompt".
4. "animation" — motion on the existing captions for rhythm. Include a "graphic" with graphicType "text-emphasis" and "emphasisWords".

HARD RULES
- Every graphic must be anchored to the exact spoken words that justify it — quote them in "triggerText", and "timestamp" must fall inside that segment.
- Never invent data. Charts, progress bars, numbers and names must come from the transcript verbatim. If the number isn't spoken, no chart.
- Never place two on-screen graphics within 2.5 seconds of each other, and never overlap them.
- Duration: titles 2-3.5s, lower-thirds 3-4s, callouts 2.5-4s, icons/arrows/highlight boxes 1.5-3s, charts 3-5s, zoom-emphasis 0.6-1.5s, text-emphasis 0.4-1.2s.
- Total budget: roughly one graphic per 15 seconds of runtime. Fewer, better graphics always beat more.
- Variety: never repeat the same graphicType back-to-back, and never repeat the same title/label text.
- Keep text short. Titles ≤ 6 words, callouts ≤ 8 words, lower-third role ≤ 4 words.
- Choose an "anchor" that will not collide with captions (captions sit bottom-center): prefer "top-center"/"top-left" for titles, "bottom-left" for lower-thirds, "center-right"/"center-left" for charts, icons and callouts.
- Pick "accent": "primary" (default/neutral-informative), "success" (positive results), "warning" (risk/problem), "neutral" (quiet identification).
- Set "confidence" honestly. Below 0.62 means you are guessing — omit it instead.

PLATFORM: ${platform || 'youtube'}

Return ONLY a JSON object with this exact structure:
{
  "suggestions": [
    {
      "timestamp": <start seconds>,
      "endTime": <end seconds>,
      "type": "visual" | "sfx" | "graphic" | "animation",
      "description": "<what it is and the job it does>",
      "triggerText": "<exact spoken words>",
      "reason": "<why it improves understanding or engagement here>",
      "confidence": <0-1>,
      "category": "clarity" | "structure" | "identification" | "data" | "emphasis" | "humor" | "transition" | "emotion",
      "tags": ["<tag>"],
      "suggestedPrompt": "<only for visual/sfx>",
      "position": { "x": <0-100>, "y": <0-100>, "scale": <0.5-1.5> },
      "graphic": {
        "graphicType": "animated-title" | "lower-third" | "icon" | "callout" | "arrow" | "highlight-box" | "progress-bar" | "chart" | "motion-graphic" | "zoom-emphasis" | "text-emphasis",
        "anchor": "top-left" | "top-center" | "top-right" | "center-left" | "center" | "center-right" | "bottom-left" | "bottom-center" | "bottom-right",
        "title": "<optional>",
        "subtitle": "<optional>",
        "label": "<optional>",
        "icon": "<lucide kebab-case name, optional>",
        "arrowAngle": <degrees, optional>,
        "progress": <0-100, optional>,
        "chartType": "bar" | "line" | "donut",
        "chartData": [{ "label": "<from transcript>", "value": <number> }],
        "chartUnit": "<optional, e.g. % or $>",
        "zoomScale": <1.05-1.35, optional>,
        "focalPoint": { "x": <0-100>, "y": <0-100> },
        "box": { "x": <0-100>, "y": <0-100>, "width": <0-100>, "height": <0-100> },
        "emphasisWords": ["<exact spoken word>"],
        "accent": "primary" | "success" | "warning" | "neutral",
        "enterAnimation": "pop" | "slide-up" | "slide-left" | "wipe" | "fade" | "draw" | "count-up"
      }
    }
  ],
  "summary": {
    "totalSuggestions": <number>,
    "visualCount": <number>,
    "sfxCount": <number>,
    "graphicCount": <number>,
    "animationCount": <number>
  },
  "videoStyle": "<educational | comedy | vlog | tutorial | interview | promo>",
  "recommendedDensity": "sparse" | "moderate" | "dense"
}`;

    const userPrompt = `Analyze this ${totalDuration.toFixed(1)} second video and decide where graphics and enhancements are genuinely warranted.

TRANSCRIPT:
${transcript.segments.map(s => `[${s.startTime.toFixed(1)}s - ${s.endTime.toFixed(1)}s]: "${s.text}"`).join('\n')}

FULL TEXT:
${transcript.fullText}

${videoContext ? `VIDEO CONTEXT:
- Genre: ${videoContext.genre || 'unknown'}
- Mood: ${videoContext.mood?.join(', ') || 'unknown'}
- Pacing: ${videoContext.pacing || 'unknown'}` : ''}

First, in your head: what is this video about, who is speaking, what are the key claims, and does it contain any spoken numbers, lists, steps, names, or on-screen references?

Then place AT MOST ${Math.max(2, Math.min(14, Math.round(totalDuration / 15)))} enhancements — only where they do a real job. Prioritise, in order: an opening title for the hook, identification (lower-third) if a person/entity is named, data graphics for any spoken numbers, clarity graphics (icon/callout/highlight-box/arrow/progress-bar) for concrete references, and only then emphasis beats (zoom-emphasis/text-emphasis) at the strongest lines. If the transcript does not justify a type, do not use that type at all.

Return the JSON.`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3.6-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.4,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: 'AI credits exhausted. Please add credits.' }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const errorText = await response.text();
      console.error('AI Gateway error:', response.status, errorText);
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('No response from AI');
    }

    // Parse JSON response
    let analysis;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysis = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
      console.log('Raw content:', content);
      throw new Error('Failed to parse enhancement analysis');
    }

    const before = analysis.suggestions?.length || 0;
    analysis.suggestions = pruneSuggestions(analysis.suggestions, totalDuration);
    analysis.summary = {
      totalSuggestions: analysis.suggestions.length,
      visualCount: analysis.suggestions.filter((s: any) => s.type === 'visual').length,
      sfxCount: analysis.suggestions.filter((s: any) => s.type === 'sfx').length,
      graphicCount: analysis.suggestions.filter((s: any) => s.type === 'graphic').length,
      animationCount: analysis.suggestions.filter((s: any) => s.type === 'animation').length,
    };

    console.log(`Enhancements: ${before} suggested -> ${analysis.suggestions.length} kept after pruning`);

    return new Response(JSON.stringify({ analysis }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Enhancement analysis error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Enhancement analysis failed' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
