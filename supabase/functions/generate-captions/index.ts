import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TranscriptSegment {
  startTime: number;
  endTime: number;
  text: string;
  speaker?: string;
}

interface TranscriptionResponse {
  segments: Array<{
    start: number;
    end: number;
    text: string;
    speaker?: string;
  }>;
  fullText: string;
  language?: string;
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

    const requestBody = await req.json();
    const projectId = requestBody.projectId;
    const videoUrl = requestBody.videoUrl;
    const skipPersistence = requestBody.skipPersistence ?? false;

    if (!projectId) {
      throw new Error("Project ID is required");
    }

    if (requestBody.videoBase64) {
      return new Response(JSON.stringify({
        error: "Video is too large for processing. Please use a shorter video or upload to storage first.",
        code: "VIDEO_TOO_LARGE"
      }), {
        status: 413,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!videoUrl) {
      throw new Error("videoUrl is required");
    }

    console.log(`Starting caption generation for project: ${projectId}`);

    // Update status if persistence is enabled
    if (!skipPersistence) {
      const { data: projectExists } = await supabase
        .from('video_projects')
        .select('id')
        .eq('id', projectId)
        .single();

      if (projectExists) {
        await supabase
          .from('video_analysis')
          .upsert({
            project_id: projectId,
            analysis_status: 'processing',
            updated_at: new Date().toISOString()
          }, { onConflict: 'project_id' });
      }
    }

    console.log("Downloading video for transcription...");
    
    // Download the video file
    const videoResponse = await fetch(videoUrl);
    if (!videoResponse.ok) {
      throw new Error(`Failed to download video: ${videoResponse.status}`);
    }
    
    const videoArrayBuffer = await videoResponse.arrayBuffer();
    const videoBase64 = btoa(String.fromCharCode(...new Uint8Array(videoArrayBuffer)));
    
    console.log(`Video downloaded: ${(videoArrayBuffer.byteLength / 1024 / 1024).toFixed(2)} MB`);

    // Use Lovable AI Gateway with Gemini for transcription
    console.log("Calling Lovable AI for transcription...");

    const systemPrompt = `You are an expert transcription assistant. Your task is to transcribe the audio from the provided video with precise timestamps.

IMPORTANT: You must respond ONLY with a valid JSON object, no other text. The format must be exactly:
{
  "segments": [
    {"start": 0.0, "end": 2.5, "text": "First sentence here", "speaker": "Speaker 1"},
    {"start": 2.5, "end": 5.0, "text": "Second sentence here", "speaker": "Speaker 1"}
  ],
  "fullText": "Complete transcription text here",
  "language": "en"
}

Guidelines:
- Break the transcription into natural segments of 3-5 seconds each
- Use punctuation to determine segment boundaries when possible
- Start times should be in seconds with decimal precision
- Include speaker labels if multiple speakers are detected
- Ensure timestamps are sequential and don't overlap
- If there's no speech, return empty segments array with empty fullText`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { 
            role: "user", 
            content: [
              {
                type: "text",
                text: "Please transcribe all spoken audio from this video with accurate timestamps. Return ONLY the JSON object, no markdown or other formatting."
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:video/mp4;base64,${videoBase64}`
                }
              }
            ]
          }
        ],
        max_tokens: 4096,
        temperature: 0.1,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("Lovable AI error:", aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required. Please add credits to your Lovable workspace." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      throw new Error(`AI transcription failed: ${aiResponse.status}`);
    }

    const aiResult = await aiResponse.json();
    console.log("Transcription received from Lovable AI");

    // Extract the content from the AI response
    const content = aiResult.choices?.[0]?.message?.content || "";
    
    // Parse the JSON response
    let transcriptionData: TranscriptionResponse;
    try {
      // Clean up the response - remove markdown code blocks if present
      let cleanContent = content.trim();
      if (cleanContent.startsWith("```json")) {
        cleanContent = cleanContent.slice(7);
      } else if (cleanContent.startsWith("```")) {
        cleanContent = cleanContent.slice(3);
      }
      if (cleanContent.endsWith("```")) {
        cleanContent = cleanContent.slice(0, -3);
      }
      cleanContent = cleanContent.trim();
      
      transcriptionData = JSON.parse(cleanContent);
    } catch (parseError) {
      console.error("Failed to parse AI response:", content);
      // Fallback: treat the entire response as a single segment
      transcriptionData = {
        segments: [{
          start: 0,
          end: 30,
          text: content,
          speaker: "Speaker 1"
        }],
        fullText: content,
        language: "en"
      };
    }

    // Convert to our segment format
    const segments: TranscriptSegment[] = (transcriptionData.segments || []).map(seg => ({
      startTime: seg.start,
      endTime: seg.end,
      text: seg.text,
      speaker: seg.speaker || "Speaker 1"
    }));

    const transcription = {
      fullText: transcriptionData.fullText || segments.map(s => s.text).join(' '),
      segments,
      language: transcriptionData.language || 'en',
      confidence: 0.95,
    };

    console.log(`Created ${segments.length} caption segments`);

    // Save to database if persistence is enabled
    if (!skipPersistence) {
      const { data: projectExists } = await supabase
        .from('video_projects')
        .select('id')
        .eq('id', projectId)
        .single();

      if (projectExists) {
        const { error: saveError } = await supabase
          .from('video_analysis')
          .upsert({
            project_id: projectId,
            transcription,
            analysis_status: 'completed',
            error_message: null,
            updated_at: new Date().toISOString()
          }, { onConflict: 'project_id' });

        if (saveError) {
          console.error("Error saving transcription:", saveError);
        } else {
          console.log("Transcription saved successfully");
        }
      }
    }

    return new Response(JSON.stringify({
      success: true,
      projectId,
      transcription,
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
