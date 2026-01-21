import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ExportRequest {
  projectId: string;
  edl: {
    projectId: string;
    originalDuration: number;
    editedDuration: number;
    aRollSegments: Array<{
      id: string;
      originalStartTime: number;
      originalEndTime: number;
      newStartTime: number;
      newEndTime: number;
      duration: number;
      isIncluded: boolean;
      cutType: string;
      transitionDuration?: number;
    }>;
    bRollSuggestions: Array<{
      id: string;
      timestamp: number;
      duration: number;
      type: string;
      description: string;
      position: string;
      stockFootageUrl?: string;
      status: string;
    }>;
    zoomEffects: Array<{
      id: string;
      startTime: number;
      endTime: number;
      duration: number;
      type: string;
      startScale: number;
      endScale: number;
      focalPoint: { x: number; y: number };
      isEnabled: boolean;
      easing: string;
    }>;
  };
  format: 'edl' | 'json' | 'premiere' | 'fcpxml';
  videoUrl?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { projectId, edl, format, videoUrl }: ExportRequest = await req.json();

    if (!edl) {
      throw new Error('EDL is required');
    }

    console.log(`Exporting project ${projectId} in ${format} format`);

    let exportContent: string;
    let contentType: string;
    let filename: string;

    switch (format) {
      case 'edl':
        exportContent = generateEDLFormat(edl, videoUrl);
        contentType = 'text/plain';
        filename = `${projectId}_edit.edl`;
        break;

      case 'premiere':
        exportContent = generatePremiereXML(edl, videoUrl);
        contentType = 'application/xml';
        filename = `${projectId}_premiere.xml`;
        break;

      case 'fcpxml':
        exportContent = generateFCPXML(edl, videoUrl);
        contentType = 'application/xml';
        filename = `${projectId}_fcpxml.fcpxml`;
        break;

      case 'json':
      default:
        exportContent = JSON.stringify(edl, null, 2);
        contentType = 'application/json';
        filename = `${projectId}_edl.json`;
        break;
    }

    // Generate render instructions for client-side processing
    const renderInstructions = generateRenderInstructions(edl);

    return new Response(JSON.stringify({
      success: true,
      format,
      filename,
      content: exportContent,
      contentType,
      renderInstructions,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Export error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Export failed' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// Generate standard CMX 3600 EDL format
function generateEDLFormat(edl: ExportRequest['edl'], videoUrl?: string): string {
  const lines: string[] = [];
  const fps = 30; // Assume 30fps

  const toTimecode = (seconds: number): string => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    const f = Math.floor((seconds % 1) * fps);
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}:${f.toString().padStart(2, '0')}`;
  };

  lines.push('TITLE: AI Auto-Edit Project');
  lines.push('FCM: NON-DROP FRAME');
  lines.push('');

  let editNumber = 1;
  const includedSegments = edl.aRollSegments.filter(s => s.isIncluded);

  for (const segment of includedSegments) {
    const editType = segment.cutType === 'dissolve' ? 'D' : 
                     segment.cutType === 'wipe' ? 'W' : 'C';
    
    const sourceIn = toTimecode(segment.originalStartTime);
    const sourceOut = toTimecode(segment.originalEndTime);
    const recordIn = toTimecode(segment.newStartTime);
    const recordOut = toTimecode(segment.newEndTime);

    lines.push(`${editNumber.toString().padStart(3, '0')}  AX       V     ${editType}        ${sourceIn} ${sourceOut} ${recordIn} ${recordOut}`);
    lines.push(`* FROM CLIP NAME: Source Video`);
    
    if (segment.transitionDuration && segment.transitionDuration > 0) {
      lines.push(`* TRANSITION DURATION: ${segment.transitionDuration}s`);
    }
    
    lines.push('');
    editNumber++;
  }

  // Add zoom effect markers as comments
  const enabledZooms = edl.zoomEffects.filter(z => z.isEnabled);
  if (enabledZooms.length > 0) {
    lines.push('* ZOOM EFFECTS:');
    for (const zoom of enabledZooms) {
      lines.push(`* ${zoom.type} at ${toTimecode(zoom.startTime)} - ${toTimecode(zoom.endTime)} | Scale: ${zoom.startScale} -> ${zoom.endScale}`);
    }
    lines.push('');
  }

  // Add B-roll markers
  const approvedBRoll = edl.bRollSuggestions.filter(b => b.status === 'approved' || b.status === 'ready');
  if (approvedBRoll.length > 0) {
    lines.push('* B-ROLL INSERTIONS:');
    for (const broll of approvedBRoll) {
      lines.push(`* ${broll.type} at ${toTimecode(broll.timestamp)} for ${broll.duration}s | ${broll.description}`);
      if (broll.stockFootageUrl) {
        lines.push(`*   URL: ${broll.stockFootageUrl}`);
      }
    }
  }

  return lines.join('\n');
}

// Generate Adobe Premiere XML
function generatePremiereXML(edl: ExportRequest['edl'], videoUrl?: string): string {
  const fps = 30;
  const ticksPerSecond = 254016000000;
  
  const toTicks = (seconds: number): number => Math.round(seconds * ticksPerSecond);

  const includedSegments = edl.aRollSegments.filter(s => s.isIncluded);
  
  let clipItems = '';
  for (let i = 0; i < includedSegments.length; i++) {
    const seg = includedSegments[i];
    clipItems += `
        <clipitem id="clipitem-${i + 1}">
          <name>Clip ${i + 1}</name>
          <duration>${Math.round(seg.duration * fps)}</duration>
          <rate><timebase>${fps}</timebase><ntsc>FALSE</ntsc></rate>
          <start>${Math.round(seg.newStartTime * fps)}</start>
          <end>${Math.round(seg.newEndTime * fps)}</end>
          <in>${Math.round(seg.originalStartTime * fps)}</in>
          <out>${Math.round(seg.originalEndTime * fps)}</out>
        </clipitem>`;
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE xmeml>
<xmeml version="5">
  <sequence>
    <name>AI Auto-Edit Sequence</name>
    <duration>${Math.round(edl.editedDuration * fps)}</duration>
    <rate><timebase>${fps}</timebase><ntsc>FALSE</ntsc></rate>
    <media>
      <video>
        <track>
          ${clipItems}
        </track>
      </video>
    </media>
  </sequence>
</xmeml>`;
}

// Generate Final Cut Pro X XML
function generateFCPXML(edl: ExportRequest['edl'], videoUrl?: string): string {
  const fps = 30;
  
  const toDuration = (seconds: number): string => {
    const frames = Math.round(seconds * fps);
    return `${frames}/${fps}s`;
  };

  const includedSegments = edl.aRollSegments.filter(s => s.isIncluded);
  
  let clips = '';
  for (let i = 0; i < includedSegments.length; i++) {
    const seg = includedSegments[i];
    clips += `
      <asset-clip ref="asset-1" offset="${toDuration(seg.newStartTime)}" name="Clip ${i + 1}" start="${toDuration(seg.originalStartTime)}" duration="${toDuration(seg.duration)}" />`;
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE fcpxml>
<fcpxml version="1.9">
  <resources>
    <format id="r1" frameDuration="1/${fps}s" width="1920" height="1080"/>
    <asset id="asset-1" name="Source Video" src="${videoUrl || 'file:///source.mp4'}" />
  </resources>
  <library>
    <event name="AI Auto-Edit">
      <project name="Auto-Edited Video">
        <sequence format="r1" duration="${toDuration(edl.editedDuration)}">
          <spine>
            ${clips}
          </spine>
        </sequence>
      </project>
    </event>
  </library>
</fcpxml>`;
}

// Generate render instructions for client-side WebCodecs processing
function generateRenderInstructions(edl: ExportRequest['edl']) {
  const includedSegments = edl.aRollSegments
    .filter(s => s.isIncluded)
    .sort((a, b) => a.newStartTime - b.newStartTime);

  const enabledZooms = edl.zoomEffects
    .filter(z => z.isEnabled)
    .sort((a, b) => a.startTime - b.startTime);

  const approvedBRoll = edl.bRollSuggestions
    .filter(b => b.status === 'approved' || b.status === 'ready')
    .sort((a, b) => a.timestamp - b.timestamp);

  return {
    totalDuration: edl.editedDuration,
    segments: includedSegments.map(seg => ({
      sourceStart: seg.originalStartTime,
      sourceEnd: seg.originalEndTime,
      targetStart: seg.newStartTime,
      targetEnd: seg.newEndTime,
      transition: seg.cutType,
      transitionDuration: seg.transitionDuration || 0,
    })),
    zooms: enabledZooms.map(z => ({
      startTime: z.startTime,
      endTime: z.endTime,
      startScale: z.startScale,
      endScale: z.endScale,
      focalX: z.focalPoint.x,
      focalY: z.focalPoint.y,
      easing: z.easing,
    })),
    bRoll: approvedBRoll.map(b => ({
      timestamp: b.timestamp,
      duration: b.duration,
      position: b.position,
      url: b.stockFootageUrl,
    })),
  };
}
