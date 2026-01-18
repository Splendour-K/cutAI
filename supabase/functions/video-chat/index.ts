import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ChatRequest {
  messages: { role: 'user' | 'assistant' | 'system'; content: string }[];
  analysisContext?: {
    transcription?: any;
    pauses?: any[];
    keyMoments?: any[];
    sceneChanges?: any[];
    suggestedEdits?: any[];
  };
  platform?: string;
  contentType?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const { messages, analysisContext, platform = 'instagram', contentType = 'short' }: ChatRequest = await req.json();

    console.log(`Processing chat request with ${messages.length} messages`);

    // Build context from analysis
    let contextInfo = '';
    if (analysisContext) {
      if (analysisContext.transcription?.fullText) {
        contextInfo += `\n\n**VIDEO TRANSCRIPTION:**\n${analysisContext.transcription.fullText}`;
      }
      
      if (analysisContext.pauses && analysisContext.pauses.length > 0) {
        const pausesSummary = analysisContext.pauses.slice(0, 10).map((p: any) => 
          `- ${p.type} at ${p.startTime}s (${p.duration}s)`
        ).join('\n');
        contextInfo += `\n\n**DETECTED PAUSES (${analysisContext.pauses.length} total):**\n${pausesSummary}`;
      }
      
      if (analysisContext.keyMoments && analysisContext.keyMoments.length > 0) {
        const momentsSummary = analysisContext.keyMoments.map((m: any) => 
          `- [${m.importance}] ${m.type} at ${m.timestamp}s: ${m.description}`
        ).join('\n');
        contextInfo += `\n\n**KEY MOMENTS:**\n${momentsSummary}`;
      }
      
      if (analysisContext.suggestedEdits && analysisContext.suggestedEdits.length > 0) {
        const editsSummary = analysisContext.suggestedEdits.slice(0, 5).map((e: any) => 
          `- [${e.priority}] ${e.type} at ${e.startTime}s: ${e.description} (${e.reason})`
        ).join('\n');
        contextInfo += `\n\n**AI-SUGGESTED EDITS:**\n${editsSummary}`;
      }
    }

    const systemPrompt = `You are an expert AI video editor assistant. You help users edit their videos through natural conversation.

**YOUR ROLE:**
- Analyze user requests and suggest specific video edits
- Explain what changes you're making and why
- Be concise but informative
- Always respond with actionable edits when the user requests changes

**TARGET PLATFORM:** ${platform} (${contentType}-form content)

**AVAILABLE EDIT TYPES:**
- cut: Remove sections (pauses, filler words, unwanted content)
- trim: Shorten video to specific duration
- speed: Adjust playback speed
- caption: Add/style captions and subtitles
- transition: Add transitions between scenes
- effect: Add visual effects, intros, outros
- music: Add background music
- format: Change aspect ratio or reformat for platform

**CAPTION STYLES (when user asks for captions):**
When adding captions, ALWAYS ask the user which style they prefer:
1. **Static Styles:** Modern (blurred bg), Minimal (shadow only), Bold (solid bg), Subtitle (classic)
2. **Dynamic Styles:** 
   - Hormozi (bold kinetic text like Alex Hormozi - uppercase, high contrast, word-by-word emphasis)
   - Karaoke (word-by-word highlight as spoken)
   - Pop (words pop in one by one)
   - Bounce (bouncy active word)
   - Glide (smooth sliding text)

If user just says "add captions" without specifying, ask: "Would you like **static captions** (clean, professional) or **dynamic/animated captions** (engaging, social-media style like Alex Hormozi)?"

**RESPONSE FORMAT:**
When the user asks for edits, ALWAYS respond with actionable changes. Never ask for more information if you can proceed with reasonable defaults.

1. Briefly confirm what you understood
2. State the specific changes you're applying
3. For captions: If no style specified, default to "modern" and mention the user can change it

**CRITICAL: Always include the JSON block when the user requests any edit action.**

At the end of your response, you MUST include a JSON block with the edit action:
\`\`\`json
{
  "editType": "cut|trim|speed|caption|transition|effect|music|format",
  "description": "Brief description of the edit",
  "captionStyle": "modern|minimal|bold|subtitle|hormozi|karaoke|pop|bounce|glide",
  "timestamps": [{"start": 0, "end": 5}]
}
\`\`\`

**Examples of required JSON responses:**
- User says "add captions" → Include JSON with editType: "caption", captionStyle: "modern"
- User says "remove pauses" → Include JSON with editType: "cut", timestamps of pauses
- User says "make it faster" → Include JSON with editType: "speed", description of change
${contextInfo}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI Gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add more credits." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    // Return the stream directly
    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });

  } catch (error) {
    console.error("Error in video-chat function:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Unknown error occurred" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
