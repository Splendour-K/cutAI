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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
    if (!ELEVENLABS_API_KEY) {
      throw new Error("ELEVENLABS_API_KEY is not configured. Please connect ElevenLabs in Settings → Connectors.");
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
    const videoBlob = new Blob([videoArrayBuffer], { type: 'video/mp4' });
    
    console.log(`Video downloaded: ${(videoArrayBuffer.byteLength / 1024 / 1024).toFixed(2)} MB`);

    // Create form data for ElevenLabs API
    const formData = new FormData();
    formData.append('file', videoBlob, 'video.mp4');
    formData.append('model_id', 'scribe_v1');
    formData.append('timestamps_granularity', 'word');

    console.log("Calling ElevenLabs Speech-to-Text API...");

    const transcriptionResponse = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
      method: 'POST',
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY,
      },
      body: formData,
    });

    if (!transcriptionResponse.ok) {
      const errorText = await transcriptionResponse.text();
      console.error("ElevenLabs API error:", transcriptionResponse.status, errorText);
      
      if (transcriptionResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      if (transcriptionResponse.status === 401) {
        throw new Error("Invalid ElevenLabs API key. Please check your connector settings.");
      }
      
      throw new Error(`ElevenLabs API error: ${transcriptionResponse.status}`);
    }

    const transcriptionResult = await transcriptionResponse.json();
    console.log("Transcription received from ElevenLabs");

    // Convert ElevenLabs response to our format
    const segments: TranscriptSegment[] = [];
    
    if (transcriptionResult.words && transcriptionResult.words.length > 0) {
      // Group words into segments of ~3-5 seconds
      let currentSegment: TranscriptSegment | null = null;
      const targetSegmentDuration = 4; // seconds
      
      for (const word of transcriptionResult.words) {
        const wordStart = word.start || 0;
        const wordEnd = word.end || wordStart + 0.5;
        const wordText = word.text || '';
        
        if (!currentSegment) {
          currentSegment = {
            startTime: wordStart,
            endTime: wordEnd,
            text: wordText,
            speaker: word.speaker || 'Speaker 1',
          };
        } else {
          const segmentDuration = wordEnd - currentSegment.startTime;
          
          // Check if we should start a new segment
          const endsWithPunctuation = /[.!?]$/.test(currentSegment.text);
          const isLongEnough = segmentDuration >= targetSegmentDuration;
          
          if (endsWithPunctuation && isLongEnough) {
            segments.push(currentSegment);
            currentSegment = {
              startTime: wordStart,
              endTime: wordEnd,
              text: wordText,
              speaker: word.speaker || 'Speaker 1',
            };
          } else {
            currentSegment.endTime = wordEnd;
            currentSegment.text += ' ' + wordText;
          }
        }
      }
      
      // Don't forget the last segment
      if (currentSegment && currentSegment.text.trim()) {
        segments.push(currentSegment);
      }
    } else if (transcriptionResult.text) {
      // Fallback: create a single segment if no word-level timestamps
      segments.push({
        startTime: 0,
        endTime: 30, // Estimate
        text: transcriptionResult.text,
        speaker: 'Speaker 1',
      });
    }

    const transcription = {
      fullText: transcriptionResult.text || segments.map(s => s.text).join(' '),
      segments,
      language: transcriptionResult.language_code || 'en',
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
