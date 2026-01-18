// AI Editor Enhancement Types

export type EnhancementType = 'visual' | 'sfx' | 'graphic' | 'animation';
export type EnhancementStatus = 'suggested' | 'approved' | 'rejected' | 'generating' | 'ready' | 'error';

export interface Enhancement {
  id: string;
  type: EnhancementType;
  status: EnhancementStatus;
  
  // Timing
  startTime: number;
  endTime: number;
  duration: number;
  
  // Content
  description: string;
  triggerText: string; // The dialogue/context that triggered this suggestion
  reason: string; // Why AI suggested this
  
  // Position (for visuals)
  position?: {
    x: number; // 0-100 percentage
    y: number; // 0-100 percentage
    scale: number; // 0.1-2
  };
  
  // Generated content
  content?: {
    type: 'image' | 'audio' | 'graphic';
    url?: string; // Base64 data URL or blob URL
    thumbnail?: string;
    prompt?: string; // Prompt used to generate
  };
  
  // Animation config for graphics
  animation?: {
    enter: string;
    during?: string;
    exit: string;
    duration: number;
  };
  
  // Metadata
  confidence: number; // 0-1, how confident AI is this enhancement fits
  category: string; // e.g., "emphasis", "humor", "transition", "emotion"
  tags: string[];
}

export interface EnhancementSuggestion {
  timestamp: number;
  endTime: number;
  type: EnhancementType;
  description: string;
  triggerText: string;
  reason: string;
  confidence: number;
  category: string;
  tags: string[];
  suggestedPrompt?: string; // For image/SFX generation
  position?: { x: number; y: number; scale: number };
  animationType?: string; // For animated graphics
}

export interface EnhancementAnalysis {
  suggestions: EnhancementSuggestion[];
  summary: {
    totalSuggestions: number;
    visualCount: number;
    sfxCount: number;
    graphicCount: number;
    animationCount: number;
  };
  videoStyle: string;
  recommendedDensity: 'sparse' | 'moderate' | 'dense';
}

export interface EnhancementWorkflow {
  status: 'idle' | 'analyzing' | 'reviewing' | 'generating' | 'complete' | 'error';
  progress: number;
  enhancements: Enhancement[];
  analysis: EnhancementAnalysis | null;
  errorMessage?: string;
}

// Preset graphic templates
export const GRAPHIC_PRESETS = [
  { id: 'emoji-reaction', name: 'Emoji Reaction', icon: '😂' },
  { id: 'arrow-callout', name: 'Arrow Callout', icon: '👆' },
  { id: 'text-emphasis', name: 'Text Emphasis', icon: '💥' },
  { id: 'lower-third', name: 'Lower Third', icon: '📝' },
  { id: 'zoom-effect', name: 'Zoom Effect', icon: '🔍' },
  { id: 'shake-effect', name: 'Shake Effect', icon: '📳' },
] as const;

// SFX categories
export const SFX_CATEGORIES = [
  { id: 'impact', name: 'Impact', examples: ['whoosh', 'punch', 'slam'] },
  { id: 'comedy', name: 'Comedy', examples: ['boing', 'slide whistle', 'record scratch'] },
  { id: 'transition', name: 'Transition', examples: ['swoosh', 'magic sparkle', 'ding'] },
  { id: 'emotion', name: 'Emotion', examples: ['dramatic reveal', 'tension build', 'sad trombone'] },
  { id: 'ambient', name: 'Ambient', examples: ['crowd cheer', 'crickets', 'wind'] },
] as const;
