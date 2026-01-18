import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ContextAnalysisRequest {
  projectId: string;
  videoUrl?: string;
  videoBase64?: string;
  mimeType?: string;
  existingTranscript?: {
    fullText: string;
    segments: Array<{
      startTime: number;
      endTime: number;
      text: string;
    }>;
  };
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

    const { 
      projectId, 
      videoUrl, 
      videoBase64, 
      mimeType = 'video/mp4',
      existingTranscript 
    }: ContextAnalysisRequest = await req.json();

    if (!projectId) {
      throw new Error("Project ID is required");
    }

    console.log(`Starting context analysis for project: ${projectId}`);

    // Prepare the video content for Gemini
    let videoContent: any = null;
    
    if (videoBase64) {
      videoContent = {
        type: "image_url",
        image_url: {
          url: `data:${mimeType};base64,${videoBase64}`
        }
      };
    } else if (videoUrl && !videoUrl.startsWith('blob:')) {
      videoContent = {
        type: "image_url",
        image_url: {
          url: videoUrl
        }
      };
    }

    const systemPrompt = `You are an expert video editor AI that analyzes videos like a professional editor would. Your task is to deeply understand the video content to generate perfect animations.

Analyze the video and return a comprehensive JSON object with this EXACT structure:

{
  "script": {
    "fullText": "Complete transcription of spoken content",
    "segments": [
      {
        "id": "seg_1",
        "startTime": 0.0,
        "endTime": 3.5,
        "text": "Segment text here",
        "words": [
          { "word": "Hello", "startTime": 0.0, "endTime": 0.3, "isKeyword": false, "emphasis": 0.5 },
          { "word": "WORLD", "startTime": 0.4, "endTime": 0.8, "isKeyword": true, "emphasis": 0.9 }
        ],
        "emphasis": "normal|emphasized|climax",
        "emotion": "excited|calm|serious|humorous"
      }
    ],
    "language": "en",
    "speakerCount": 1
  },
  "pacing": {
    "averageWordsPerMinute": 150,
    "energyLevel": "low|medium|high|variable",
    "rhythmPattern": "steady|building|dynamic|conversational",
    "pauseFrequency": 0.5
  },
  "visuals": {
    "dominantColors": ["#1a1a1a", "#ffffff", "#ff6b00"],
    "brightness": "dark|neutral|bright",
    "contrast": "low|medium|high",
    "hasMotion": true,
    "shotTypes": [
      { "timestamp": 0, "type": "closeup|medium|wide", "subject": "person talking" }
    ],
    "sceneCount": 3
  },
  "content": {
    "genre": "educational|entertainment|promotional|vlog|tutorial",
    "mood": ["energetic", "informative"],
    "topics": ["main topic 1", "topic 2"],
    "targetAudience": "young professionals interested in...",
    "callToActions": ["subscribe", "like the video"]
  },
  "timing": {
    "totalDuration": 60.0,
    "keyMoments": [
      { "timestamp": 0.0, "type": "hook", "importance": 10, "description": "Opening hook" },
      { "timestamp": 15.0, "type": "highlight", "importance": 8, "description": "Key point" },
      { "timestamp": 55.0, "type": "cta", "importance": 9, "description": "Call to action" }
    ],
    "beatPoints": [0.5, 1.2, 2.0],
    "naturalBreaks": [10.0, 25.0, 45.0]
  },
  "animationRecommendations": {
    "suggestedStyle": "bold|minimal|hormozi|modern|playful|cinematic",
    "captionTiming": "word-by-word|phrase|sentence",
    "emphasisKeywords": ["important", "words", "to", "highlight"],
    "suggestedTransitions": [
      { "timestamp": 10.0, "type": "zoom", "reason": "Scene change detected" }
    ],
    "specialEffects": [
      { "timestamp": 5.0, "effect": "shake", "reason": "Emphasis on impact word" }
    ]
  }
}

IMPORTANT RULES:
1. Identify keywords that should be emphasized (important concepts, action words, emotional words)
2. Detect the natural rhythm and pacing of speech
3. Mark climax moments where animation intensity should peak
4. Identify call-to-action moments that need attention-grabbing animation
5. Analyze visual composition to determine optimal text placement areas
6. Consider the video's mood when recommending animation styles
7. Word timing should be as accurate as possible for word-by-word animations

Return ONLY the JSON object, no additional text or markdown.`;

    let userContent: any[];
    
    if (videoContent) {
      userContent = [
        { type: "text", text: "Analyze this video content thoroughly for animation generation. Provide detailed word-by-word timing and identify all moments that should have animated emphasis." },
        videoContent
      ];
    } else if (existingTranscript) {
      // If we only have transcript (for blob URLs), analyze based on text
      userContent = [
        { 
          type: "text", 
          text: `Analyze this video transcript for animation generation. The video duration is approximately ${existingTranscript.segments.length > 0 ? existingTranscript.segments[existingTranscript.segments.length - 1].endTime : 60} seconds.

Transcript:
${existingTranscript.fullText}

Segments with timing:
${JSON.stringify(existingTranscript.segments, null, 2)}

Based on this transcript, provide comprehensive context analysis with word-by-word timing estimates and animation recommendations. Return the JSON analysis object.`
        }
      ];
    } else {
      throw new Error("Either video content or existing transcript is required");
    }

    console.log("Calling Lovable AI Gateway for context analysis...");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent }
        ],
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
      
      throw new Error(`AI Gateway error: ${response.status} - ${errorText}`);
    }

    const aiResponse = await response.json();
    console.log("Context analysis response received");

    const content = aiResponse.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("No content in AI response");
    }

    // Parse the JSON response
    let contextResult;
    try {
      const cleanedContent = content.replace(/```json\n?|\n?```/g, '').trim();
      contextResult = JSON.parse(cleanedContent);
    } catch (parseError) {
      console.error("Failed to parse AI response:", content);
      throw new Error("Failed to parse context analysis results");
    }

    console.log("Context analysis completed successfully");

    return new Response(JSON.stringify({
      success: true,
      projectId,
      context: contextResult
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error in analyze-context function:", error);
    
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Unknown error occurred" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
