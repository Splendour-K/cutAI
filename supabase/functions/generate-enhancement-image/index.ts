import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GenerateImageRequest {
  prompt: string;
  style?: 'realistic' | 'cartoon' | 'meme' | 'minimal' | 'icon';
  aspectRatio?: '1:1' | '16:9' | '9:16';
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

    const { prompt, style = 'cartoon', aspectRatio = '1:1' }: GenerateImageRequest = await req.json();

    if (!prompt) {
      throw new Error('Prompt is required');
    }

    console.log(`Generating image for prompt: ${prompt}`);

    // Enhance prompt based on style
    let enhancedPrompt = prompt;
    switch (style) {
      case 'cartoon':
        enhancedPrompt = `Cartoon illustration style, vibrant colors, clean lines: ${prompt}. Simple, bold, suitable for video overlay.`;
        break;
      case 'meme':
        enhancedPrompt = `Internet meme style, funny, recognizable format: ${prompt}. Clear and readable.`;
        break;
      case 'minimal':
        enhancedPrompt = `Minimalist icon style, flat design, simple shapes: ${prompt}. Transparent background friendly.`;
        break;
      case 'icon':
        enhancedPrompt = `Clean flat icon, simple design, bold colors: ${prompt}. Suitable for video overlay.`;
        break;
      case 'realistic':
      default:
        enhancedPrompt = `High quality, photorealistic: ${prompt}. Clear subject, suitable for video overlay.`;
    }

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-image-preview',
        messages: [
          { role: 'user', content: enhancedPrompt }
        ],
        modalities: ['image', 'text'],
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
      console.error('Image generation error:', response.status, errorText);
      throw new Error(`Image generation failed: ${response.status}`);
    }

    const aiResponse = await response.json();
    const message = aiResponse.choices?.[0]?.message;
    
    // Extract image from response
    const imageUrl = message?.images?.[0]?.image_url?.url;
    
    if (!imageUrl) {
      console.log('No image in response:', JSON.stringify(aiResponse, null, 2));
      throw new Error('No image generated');
    }

    console.log('Image generated successfully');

    return new Response(JSON.stringify({ 
      imageUrl,
      prompt: enhancedPrompt,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Image generation error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Image generation failed' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
