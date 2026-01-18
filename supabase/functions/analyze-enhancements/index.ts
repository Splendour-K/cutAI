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

    const { projectId, transcript, videoContext }: AnalyzeRequest = await req.json();

    if (!transcript || !transcript.segments?.length) {
      throw new Error('Transcript with segments is required');
    }

    console.log(`Analyzing enhancements for project ${projectId}`);
    console.log(`Transcript has ${transcript.segments.length} segments`);

    const systemPrompt = `You are an expert video editor analyzing dialogue to identify moments that would benefit from visual, audio, or animated enhancements. You think like a YouTube/TikTok editor who adds engaging elements to make content more entertaining.

Your task is to identify specific moments in the transcript where enhancements would improve engagement:

ENHANCEMENT TYPES:
1. "visual" - Contextual images, memes, or graphics that reinforce what's being said
   - Use for: references to objects/people/places, metaphors, comparisons, jokes
   - Example: "It was like a rocket ship" → image of a rocket
   
2. "sfx" - Sound effects that add impact or humor
   - Use for: emphasis, transitions, comedic timing, emotional beats
   - Example: "And then it hit me" → impact sound effect
   
3. "graphic" - Animated text, emojis, arrows, or visual effects
   - Use for: key points, reactions, emphasis, callouts
   - Example: "This is HUGE" → animated text with shake effect
   
4. "animation" - Motion effects on existing captions
   - Use for: emphasis on specific words, rhythm matching
   - Example: "Boom!" → word pops with scale animation

GUIDELINES:
- Don't overdo it - suggest enhancements for impactful moments only
- Consider the pacing - space out suggestions naturally
- Match the tone - comedy content gets more playful enhancements
- High confidence (0.8+) for obvious enhancement opportunities
- Medium confidence (0.5-0.8) for subjective improvements
- Include specific generation prompts for visuals and SFX

Return a JSON object with this exact structure:
{
  "suggestions": [
    {
      "timestamp": <start time in seconds>,
      "endTime": <end time in seconds>,
      "type": "visual" | "sfx" | "graphic" | "animation",
      "description": "<what the enhancement should be>",
      "triggerText": "<the exact words that triggered this>",
      "reason": "<why this enhancement fits here>",
      "confidence": <0-1>,
      "category": "<category like 'humor', 'emphasis', 'transition', 'emotion'>",
      "tags": ["<relevant tags>"],
      "suggestedPrompt": "<prompt for generating image or SFX>",
      "position": { "x": <0-100>, "y": <0-100>, "scale": <0.5-1.5> },
      "animationType": "<for graphics: 'pop', 'slide', 'bounce', 'shake', 'fade'>"
    }
  ],
  "summary": {
    "totalSuggestions": <number>,
    "visualCount": <number>,
    "sfxCount": <number>,
    "graphicCount": <number>,
    "animationCount": <number>
  },
  "videoStyle": "<detected style like 'educational', 'comedy', 'vlog', 'tutorial'>",
  "recommendedDensity": "sparse" | "moderate" | "dense"
}`;

    const userPrompt = `Analyze this video transcript and identify enhancement opportunities:

TRANSCRIPT:
${transcript.segments.map(s => `[${s.startTime.toFixed(1)}s - ${s.endTime.toFixed(1)}s]: "${s.text}"`).join('\n')}

FULL TEXT:
${transcript.fullText}

${videoContext ? `VIDEO CONTEXT:
- Genre: ${videoContext.genre || 'unknown'}
- Mood: ${videoContext.mood?.join(', ') || 'unknown'}
- Pacing: ${videoContext.pacing || 'unknown'}` : ''}

Identify 5-15 enhancement opportunities that would make this video more engaging. Focus on quality over quantity - each suggestion should genuinely improve the viewing experience.`;

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
        temperature: 0.7,
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

    console.log(`Found ${analysis.suggestions?.length || 0} enhancement suggestions`);

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
