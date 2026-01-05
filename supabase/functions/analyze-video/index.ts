import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AnalysisRequest {
  projectId: string;
  videoUrl?: string;
  videoBase64?: string;
  mimeType?: string;
}

interface TranscriptSegment {
  startTime: number;
  endTime: number;
  text: string;
  speaker?: string;
}

interface Pause {
  startTime: number;
  endTime: number;
  duration: number;
  type: 'silence' | 'filler' | 'hesitation';
}

interface KeyMoment {
  timestamp: number;
  endTime?: number;
  type: 'highlight' | 'hook' | 'climax' | 'transition' | 'callToAction';
  description: string;
  importance: 'high' | 'medium' | 'low';
}

interface SceneChange {
  timestamp: number;
  description: string;
  transitionType?: string;
}

interface SuggestedEdit {
  type: 'cut' | 'trim' | 'speed' | 'caption' | 'transition' | 'effect';
  startTime: number;
  endTime?: number;
  description: string;
  reason: string;
  priority: 'high' | 'medium' | 'low';
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

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { projectId, videoUrl, videoBase64, mimeType = 'video/mp4' }: AnalysisRequest = await req.json();

    if (!projectId) {
      throw new Error("Project ID is required");
    }

    console.log(`Starting analysis for project: ${projectId}`);

    // Update analysis status to processing
    const { error: updateError } = await supabase
      .from('video_analysis')
      .upsert({
        project_id: projectId,
        analysis_status: 'processing',
        updated_at: new Date().toISOString()
      }, { onConflict: 'project_id' });

    if (updateError) {
      console.error("Error updating analysis status:", updateError);
    }

    // Prepare the video content for Gemini
    let videoContent: any;
    
    if (videoBase64) {
      videoContent = {
        type: "image_url",
        image_url: {
          url: `data:${mimeType};base64,${videoBase64}`
        }
      };
    } else if (videoUrl) {
      videoContent = {
        type: "image_url",
        image_url: {
          url: videoUrl
        }
      };
    } else {
      throw new Error("Either videoUrl or videoBase64 is required");
    }

    const systemPrompt = `You are an expert video analyst AI. Analyze the provided video content and extract comprehensive information.

Your analysis must return a JSON object with the following structure:

{
  "transcription": {
    "fullText": "complete transcription of all spoken content",
    "segments": [
      {
        "startTime": 0.0,
        "endTime": 5.2,
        "text": "segment text",
        "speaker": "Speaker 1"
      }
    ],
    "language": "detected language",
    "confidence": 0.95
  },
  "pauses": [
    {
      "startTime": 12.5,
      "endTime": 14.0,
      "duration": 1.5,
      "type": "silence|filler|hesitation"
    }
  ],
  "keyMoments": [
    {
      "timestamp": 0.0,
      "endTime": 3.0,
      "type": "hook|highlight|climax|transition|callToAction",
      "description": "Opening hook with dramatic question",
      "importance": "high|medium|low"
    }
  ],
  "sceneChanges": [
    {
      "timestamp": 15.0,
      "description": "Cut to B-roll footage",
      "transitionType": "cut|fade|dissolve|wipe"
    }
  ],
  "suggestedEdits": [
    {
      "type": "cut|trim|speed|caption|transition|effect",
      "startTime": 12.5,
      "endTime": 14.0,
      "description": "Remove awkward pause",
      "reason": "Dead air reduces engagement",
      "priority": "high|medium|low"
    }
  ],
  "summary": {
    "duration": 60.0,
    "mainTopics": ["topic1", "topic2"],
    "tone": "informative|casual|formal|entertaining",
    "targetAudience": "general description",
    "engagementScore": 7.5,
    "qualityNotes": ["note1", "note2"]
  }
}

Be thorough and precise with timestamps. Identify all pauses over 0.5 seconds. Highlight the most engaging moments. Suggest practical edits that would improve the content for social media platforms.`;

    const userPrompt = `Analyze this video content thoroughly. Transcribe all spoken content with accurate timestamps. Identify pauses, key moments, scene changes, and suggest specific edits to improve the content. Return ONLY the JSON object, no additional text.`;

    console.log("Calling Lovable AI Gateway with Gemini...");

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
          { 
            role: "user", 
            content: [
              { type: "text", text: userPrompt },
              videoContent
            ]
          }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI Gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        await supabase
          .from('video_analysis')
          .update({
            analysis_status: 'error',
            error_message: 'Rate limit exceeded. Please try again later.',
            updated_at: new Date().toISOString()
          })
          .eq('project_id', projectId);
          
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      if (response.status === 402) {
        await supabase
          .from('video_analysis')
          .update({
            analysis_status: 'error',
            error_message: 'AI credits exhausted. Please add more credits.',
            updated_at: new Date().toISOString()
          })
          .eq('project_id', projectId);
          
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add more credits." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      throw new Error(`AI Gateway error: ${response.status} - ${errorText}`);
    }

    const aiResponse = await response.json();
    console.log("AI Response received");

    const content = aiResponse.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("No content in AI response");
    }

    // Parse the JSON response
    let analysisResult;
    try {
      // Remove markdown code blocks if present
      const cleanedContent = content.replace(/```json\n?|\n?```/g, '').trim();
      analysisResult = JSON.parse(cleanedContent);
    } catch (parseError) {
      console.error("Failed to parse AI response:", content);
      throw new Error("Failed to parse analysis results");
    }

    // Store the analysis results
    const { error: saveError } = await supabase
      .from('video_analysis')
      .upsert({
        project_id: projectId,
        transcription: analysisResult.transcription,
        pauses: analysisResult.pauses,
        key_moments: analysisResult.keyMoments,
        scene_changes: analysisResult.sceneChanges,
        suggested_edits: analysisResult.suggestedEdits,
        analysis_status: 'completed',
        error_message: null,
        updated_at: new Date().toISOString()
      }, { onConflict: 'project_id' });

    if (saveError) {
      console.error("Error saving analysis:", saveError);
      throw new Error("Failed to save analysis results");
    }

    console.log("Analysis completed and saved successfully");

    return new Response(JSON.stringify({
      success: true,
      projectId,
      analysis: analysisResult
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error in analyze-video function:", error);
    
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Unknown error occurred" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
