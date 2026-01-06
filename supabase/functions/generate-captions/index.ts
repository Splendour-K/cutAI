import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CaptionRequest {
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

    const { projectId, videoUrl, videoBase64, mimeType = 'video/mp4' }: CaptionRequest = await req.json();

    if (!projectId) {
      throw new Error("Project ID is required");
    }

    console.log(`Starting caption generation for project: ${projectId}`);

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

    const systemPrompt = `You are an expert transcription AI. Your task is to transcribe all spoken content in the video with precise timestamps.

Your response must be a JSON object with this exact structure:

{
  "transcription": {
    "fullText": "complete transcription of all spoken content",
    "segments": [
      {
        "startTime": 0.0,
        "endTime": 3.5,
        "text": "First sentence or phrase spoken",
        "speaker": "Speaker 1"
      },
      {
        "startTime": 3.5,
        "endTime": 7.2,
        "text": "Second sentence or phrase spoken",
        "speaker": "Speaker 1"
      }
    ],
    "language": "English",
    "confidence": 0.95
  }
}

Guidelines:
- Create segments of 2-5 seconds each for natural caption display
- Be very precise with timestamps
- Identify different speakers if multiple people are talking
- Include all spoken words accurately
- Do not include non-speech sounds in the transcription text
- Return ONLY the JSON object, no additional text`;

    const userPrompt = `Transcribe all spoken content in this video with accurate timestamps. Create segments suitable for captions (2-5 seconds each). Return ONLY the JSON object.`;

    console.log("Calling Lovable AI Gateway for transcription...");

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
    let transcriptionResult;
    try {
      // Remove markdown code blocks if present
      const cleanedContent = content.replace(/```json\n?|\n?```/g, '').trim();
      transcriptionResult = JSON.parse(cleanedContent);
    } catch (parseError) {
      console.error("Failed to parse AI response:", content);
      throw new Error("Failed to parse transcription results");
    }

    // Store the transcription results
    const { error: saveError } = await supabase
      .from('video_analysis')
      .upsert({
        project_id: projectId,
        transcription: transcriptionResult.transcription,
        analysis_status: 'completed',
        error_message: null,
        updated_at: new Date().toISOString()
      }, { onConflict: 'project_id' });

    if (saveError) {
      console.error("Error saving transcription:", saveError);
      throw new Error("Failed to save transcription results");
    }

    console.log("Caption generation completed and saved successfully");

    return new Response(JSON.stringify({
      success: true,
      projectId,
      transcription: transcriptionResult.transcription
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error in generate-captions function:", error);
    
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Unknown error occurred" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
