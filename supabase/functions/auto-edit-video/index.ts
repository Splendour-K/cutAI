import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TranscriptSegment {
  startTime: number;
  endTime: number;
  text: string;
}

interface AutoEditRequest {
  projectId: string;
  transcript: {
    fullText: string;
    segments: TranscriptSegment[];
  };
  videoDuration: number;
  targetStyle?: 'fast-paced' | 'moderate' | 'documentary' | 'auto';
  targetDurationReduction?: number;
  platform?: string;
  preferences?: {
    enableZooms: boolean;
    enableBRoll: boolean;
    cutFrequency: 'minimal' | 'moderate' | 'aggressive';
  };
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

    const { 
      projectId, 
      transcript, 
      videoDuration,
      targetStyle = 'auto',
      targetDurationReduction = 20,
      platform = 'youtube',
      preferences = {
        enableZooms: true,
        enableBRoll: true,
        cutFrequency: 'moderate',
      }
    }: AutoEditRequest = await req.json();

    if (!transcript || !transcript.segments?.length) {
      throw new Error('Transcript with segments is required');
    }

    console.log(`Auto-editing video for project ${projectId}`);
    console.log(`Duration: ${videoDuration}s, Segments: ${transcript.segments.length}`);
    console.log(`Style: ${targetStyle}, Reduction target: ${targetDurationReduction}%`);

    const systemPrompt = `You are an expert AI video editor. Your job is to analyze video transcripts and create professional Edit Decision Lists (EDLs) that transform raw footage into engaging content.

You edit like a professional YouTube/TikTok editor:
- Cut out dead air, filler words, repetition, and low-value content
- Keep segments between 4-8 seconds for engagement (unless content requires longer)
- Add dynamic zoom effects at emotional/emphasis moments
- Suggest relevant B-roll to support the narrative
- Maintain story flow and natural transitions

EDITING STYLE: ${targetStyle}
${targetStyle === 'fast-paced' ? '- Very quick cuts (4-6s), lots of zooms, high energy' : ''}
${targetStyle === 'moderate' ? '- Balanced cuts (5-8s), selective zooms, good flow' : ''}
${targetStyle === 'documentary' ? '- Longer segments (8-15s), subtle Ken Burns effects, narrative focus' : ''}
${targetStyle === 'auto' ? '- Detect optimal style from content' : ''}

TARGET PLATFORM: ${platform}
CUT FREQUENCY: ${preferences.cutFrequency}
ENABLE ZOOMS: ${preferences.enableZooms}
ENABLE B-ROLL: ${preferences.enableBRoll}

Return a JSON object with this EXACT structure:
{
  "aRollSegments": [
    {
      "id": "seg_1",
      "originalStartTime": <number>,
      "originalEndTime": <number>,
      "newStartTime": <number>,
      "newEndTime": <number>,
      "duration": <number>,
      "content": "<text content>",
      "isIncluded": true,
      "reason": "<why included/excluded>",
      "cutType": "hard" | "dissolve" | "fade",
      "transitionDuration": <number, optional>
    }
  ],
  "removedSections": [
    {
      "startTime": <number>,
      "endTime": <number>,
      "reason": "silence" | "filler" | "repetition" | "low-energy" | "off-topic"
    }
  ],
  "bRollSuggestions": [
    {
      "id": "broll_1",
      "insertAfterSegmentId": "<segment id>",
      "timestamp": <number>,
      "duration": <2-5 seconds>,
      "type": "contextual" | "reaction" | "cutaway" | "overlay",
      "description": "<what should be shown>",
      "searchQuery": "<stock footage search query>",
      "reason": "<why this B-roll fits>",
      "confidence": <0-1>,
      "position": "fullscreen" | "pip-topright" | "split-left",
      "status": "suggested"
    }
  ],
  "zoomEffects": [
    {
      "id": "zoom_1",
      "segmentId": "<segment id>",
      "startTime": <number>,
      "endTime": <number>,
      "duration": <number>,
      "type": "slow-zoom-in" | "slow-zoom-out" | "quick-punch" | "ken-burns" | "focus-shift",
      "startScale": <1.0-1.5>,
      "endScale": <1.0-1.5>,
      "focalPoint": { "x": 50, "y": 50 },
      "reason": "<why zoom here>",
      "isEnabled": true,
      "easing": "linear" | "ease-in" | "ease-out" | "ease-in-out"
    }
  ],
  "pacing": {
    "averageSegmentDuration": <number>,
    "suggestedCutFrequency": <cuts per minute>,
    "energyLevel": "low" | "medium" | "high" | "variable",
    "rhythmPattern": "<description of rhythm>",
    "hooks": [
      { "timestamp": <number>, "description": "<hook description>" }
    ],
    "slowSections": [
      { "startTime": <number>, "endTime": <number>, "reason": "<why slow>" }
    ]
  },
  "style": "youtube-short" | "tiktok" | "documentary" | "tutorial" | "vlog" | "interview",
  "editingNotes": ["<note 1>", "<note 2>"]
}

CRITICAL RULES:
1. Segment A-roll into 4-8 second chunks for maximum engagement
2. Remove pauses longer than 0.5s, filler words (um, uh, like, you know)
3. Cut repetitive explanations - keep the clearest version
4. Add zoom at emotional peaks, emphasis words, or reveals
5. Suggest B-roll at metaphors, references, or transition points
6. newStartTime/newEndTime should reflect the edited timeline position
7. Maintain logical flow - don't cut mid-sentence inappropriately
8. Use quick-punch zoom for impact words, slow-zoom for emphasis sections
9. B-roll should enhance, not distract from the main content`;

    const segmentsText = transcript.segments
      .map((s, i) => `[${s.startTime.toFixed(2)}s - ${s.endTime.toFixed(2)}s] Segment ${i + 1}: "${s.text}"`)
      .join('\n');

    const userPrompt = `Create a professional Edit Decision List for this ${videoDuration.toFixed(1)} second video.

TARGET: Reduce duration by approximately ${targetDurationReduction}% while maintaining quality.

TRANSCRIPT SEGMENTS:
${segmentsText}

FULL TEXT:
${transcript.fullText}

Analyze the content and create:
1. Optimized A-roll segments (4-8 second cuts)
2. Sections to remove (silences, fillers, repetition)
3. B-roll suggestions at appropriate moments${preferences.enableBRoll ? '' : ' (SKIP - disabled)'}
4. Dynamic zoom effects for engagement${preferences.enableZooms ? '' : ' (SKIP - disabled)'}
5. Pacing analysis with hooks and slow sections

Return the complete EDL as JSON.`;

    console.log('Calling AI for auto-edit analysis...');

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.6,
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
    let edl;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        edl = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
      console.log('Raw content:', content);
      throw new Error('Failed to parse edit decision list');
    }

    // Calculate edited duration
    const editedDuration = edl.aRollSegments
      .filter((s: any) => s.isIncluded)
      .reduce((total: number, s: any) => total + s.duration, 0);

    // Add metadata
    const completeEdl = {
      projectId,
      createdAt: new Date().toISOString(),
      originalDuration: videoDuration,
      editedDuration,
      ...edl,
      targetPlatform: platform,
    };

    console.log(`Auto-edit complete: ${videoDuration.toFixed(1)}s -> ${editedDuration.toFixed(1)}s`);
    console.log(`Segments: ${edl.aRollSegments?.length}, B-roll: ${edl.bRollSuggestions?.length}, Zooms: ${edl.zoomEffects?.length}`);

    return new Response(JSON.stringify({ edl: completeEdl }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Auto-edit error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Auto-edit failed' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
