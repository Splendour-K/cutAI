import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface StoryboardRequest {
  projectId: string;
  videoContext: any;
  selectedStyle: any;
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

    const { projectId, videoContext, selectedStyle }: StoryboardRequest = await req.json();

    if (!projectId || !videoContext) {
      throw new Error("Project ID and video context are required");
    }

    console.log(`Generating storyboard for project: ${projectId}`);

    const systemPrompt = `You are an expert motion graphics designer and video editor. Based on the video context analysis and selected visual style, generate a complete animation storyboard.

The storyboard should specify exactly how each text element should animate - timing, position, style, and animation type.

STYLE CONTEXT:
${JSON.stringify(selectedStyle, null, 2)}

Generate a storyboard JSON with this EXACT structure:

{
  "id": "storyboard_unique_id",
  "projectId": "${projectId}",
  "scenes": [
    {
      "id": "scene_1",
      "startTime": 0.0,
      "endTime": 5.0,
      "description": "Opening hook with dramatic text reveal",
      "elements": [
        {
          "id": "elem_1",
          "type": "caption|title|lower-third|callout|emoji",
          "content": "The actual text content",
          "startTime": 0.0,
          "endTime": 2.5,
          "position": { "x": 50, "y": 75 },
          "animation": {
            "enter": {
              "name": "pop|fade|slide|bounce|scale|typewriter",
              "keyframes": [
                { "offset": 0, "properties": { "opacity": 0, "scale": 0.5 } },
                { "offset": 0.5, "properties": { "opacity": 1, "scale": 1.1 } },
                { "offset": 1, "properties": { "opacity": 1, "scale": 1 } }
              ],
              "easing": "cubic-bezier(0.34, 1.56, 0.64, 1)"
            },
            "during": {
              "name": "pulse|none|shake|glow",
              "keyframes": [
                { "offset": 0, "properties": { "scale": 1 } },
                { "offset": 0.5, "properties": { "scale": 1.05 } },
                { "offset": 1, "properties": { "scale": 1 } }
              ],
              "easing": "ease-in-out"
            },
            "exit": {
              "name": "fade|slide|pop|none",
              "keyframes": [
                { "offset": 0, "properties": { "opacity": 1 } },
                { "offset": 1, "properties": { "opacity": 0 } }
              ],
              "easing": "ease-out"
            },
            "timing": "onWord|onBeat|onScene|continuous",
            "delay": 0,
            "duration": 0.3
          },
          "style": {
            "fontSize": 48,
            "fontFamily": "Inter",
            "fontWeight": "bold",
            "color": "#ffffff",
            "backgroundColor": "rgba(0,0,0,0.5)",
            "borderRadius": 8,
            "padding": 16,
            "shadow": "0 4px 20px rgba(0,0,0,0.5)",
            "stroke": { "color": "#000000", "width": 2 }
          },
          "approved": false
        }
      ],
      "transition": {
        "type": "cut|fade|slide|zoom",
        "duration": 0.3,
        "direction": "left|right|up|down"
      }
    }
  ],
  "globalSettings": {
    "defaultFontFamily": "Inter",
    "defaultFontSize": 42,
    "primaryColor": "#ffffff",
    "secondaryColor": "#ffd700",
    "animationSpeed": "normal",
    "captionStyle": "word-by-word"
  }
}

ANIMATION GUIDELINES:
1. For HORMOZI style: Use aggressive pop/bounce animations, word-by-word reveals, strong color emphasis on keywords
2. For MINIMAL style: Use subtle fades and slides, gentle timing, elegant easing
3. For BOLD style: Use scale animations, hard shadows, dynamic motion
4. For PLAYFUL style: Use bouncy easing, colorful elements, fun movements
5. For CINEMATIC style: Use slow fades, dramatic reveals, sophisticated timing

Position is in percentage (0-100) where x=50, y=50 is center.
Timing should sync with speech rhythm and key moments.
Keywords from context should have emphasized animations.
Hook moments need attention-grabbing animations.
Call-to-action moments should have distinctive styling.

Return ONLY the JSON object, no additional text.`;

    const userPrompt = `Generate a complete animation storyboard for this video based on the context analysis:

VIDEO CONTEXT:
${JSON.stringify(videoContext, null, 2)}

Create scene-by-scene animation instructions with precise timing. Each caption/text element should have unique animation based on its importance and the video's pacing. Emphasize keywords and key moments. Make the animations feel dynamic and professional.`;

    console.log("Calling Lovable AI Gateway for storyboard generation...");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
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
    console.log("Storyboard response received");

    const content = aiResponse.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("No content in AI response");
    }

    // Parse the JSON response
    let storyboardResult;
    try {
      const cleanedContent = content.replace(/```json\n?|\n?```/g, '').trim();
      storyboardResult = JSON.parse(cleanedContent);
    } catch (parseError) {
      console.error("Failed to parse AI response:", content);
      throw new Error("Failed to parse storyboard results");
    }

    // Add metadata
    storyboardResult.createdAt = new Date().toISOString();
    storyboardResult.style = selectedStyle;

    console.log("Storyboard generation completed successfully");

    return new Response(JSON.stringify({
      success: true,
      projectId,
      storyboard: storyboardResult
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error in generate-storyboard function:", error);
    
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Unknown error occurred" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
