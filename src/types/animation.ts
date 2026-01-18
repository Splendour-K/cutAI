// Animation System Types

export type AnimationCategory = 'text' | 'overlay' | 'transition' | 'effect';
export type AnimationTiming = 'onBeat' | 'onWord' | 'onScene' | 'continuous';

export interface VisualStyle {
  id: string;
  name: string;
  description: string;
  primaryColor: string;
  secondaryColor: string;
  fontFamily: string;
  fontWeight: 'normal' | 'medium' | 'bold' | 'black';
  textTransform: 'none' | 'uppercase' | 'lowercase';
  animationIntensity: 'subtle' | 'moderate' | 'dynamic' | 'intense';
  shadowStyle: 'none' | 'soft' | 'hard' | 'glow';
  strokeEnabled: boolean;
  strokeColor?: string;
  strokeWidth?: number;
}

export interface VideoContext {
  // Script analysis
  script: {
    fullText: string;
    segments: ScriptSegment[];
    language: string;
    speakerCount: number;
  };
  // Pacing analysis
  pacing: {
    averageWordsPerMinute: number;
    energyLevel: 'low' | 'medium' | 'high' | 'variable';
    rhythmPattern: 'steady' | 'building' | 'dynamic' | 'conversational';
    pauseFrequency: number;
  };
  // Visual analysis
  visuals: {
    dominantColors: string[];
    brightness: 'dark' | 'neutral' | 'bright';
    contrast: 'low' | 'medium' | 'high';
    hasMotion: boolean;
    shotTypes: ShotType[];
    sceneCount: number;
  };
  // Content analysis
  content: {
    genre: string;
    mood: string[];
    topics: string[];
    targetAudience: string;
    callToActions: string[];
  };
  // Timing analysis
  timing: {
    totalDuration: number;
    keyMoments: TimedMoment[];
    beatPoints: number[];
    naturalBreaks: number[];
  };
  // Animation recommendations from AI
  animationRecommendations?: {
    suggestedStyle: string;
    captionTiming: string;
    emphasisKeywords: string[];
    suggestedTransitions: Array<{ timestamp: number; type: string; reason: string }>;
    specialEffects: Array<{ timestamp: number; effect: string; reason: string }>;
  };
}

export interface ScriptSegment {
  id: string;
  startTime: number;
  endTime: number;
  text: string;
  words: WordTiming[];
  emphasis: 'normal' | 'emphasized' | 'climax';
  emotion?: string;
}

export interface WordTiming {
  word: string;
  startTime: number;
  endTime: number;
  isKeyword: boolean;
  emphasis: number; // 0-1 scale
}

export interface ShotType {
  timestamp: number;
  type: 'closeup' | 'medium' | 'wide' | 'extreme-closeup' | 'establishing';
  subject?: string;
}

export interface TimedMoment {
  timestamp: number;
  type: 'hook' | 'highlight' | 'transition' | 'climax' | 'cta' | 'pause';
  importance: number; // 1-10
  description: string;
}

// Storyboard types
export interface Storyboard {
  id: string;
  projectId: string;
  createdAt: Date;
  style: VisualStyle;
  scenes: StoryboardScene[];
  globalSettings: StoryboardSettings;
}

export interface StoryboardScene {
  id: string;
  startTime: number;
  endTime: number;
  description: string;
  elements: StoryboardElement[];
  transition?: SceneTransition;
}

export interface StoryboardElement {
  id: string;
  type: 'caption' | 'title' | 'lower-third' | 'callout' | 'emoji' | 'graphic';
  content: string;
  startTime: number;
  endTime: number;
  position: { x: number; y: number };
  animation: ElementAnimation;
  style: ElementStyle;
  approved: boolean;
}

export interface ElementAnimation {
  enter: AnimationPreset;
  during?: AnimationPreset;
  exit: AnimationPreset;
  timing: AnimationTiming;
  delay: number;
  duration: number;
}

export interface AnimationPreset {
  name: string;
  keyframes: AnimationKeyframe[];
  easing: string;
}

export interface AnimationKeyframe {
  offset: number; // 0-1
  properties: Record<string, string | number>;
}

export interface ElementStyle {
  fontSize: number;
  fontFamily: string;
  fontWeight: string;
  color: string;
  backgroundColor?: string;
  borderRadius?: number;
  padding?: number;
  shadow?: string;
  stroke?: {
    color: string;
    width: number;
  };
}

export interface SceneTransition {
  type: 'cut' | 'fade' | 'slide' | 'zoom' | 'wipe' | 'dissolve';
  duration: number;
  direction?: 'left' | 'right' | 'up' | 'down';
}

export interface StoryboardSettings {
  defaultFontFamily: string;
  defaultFontSize: number;
  primaryColor: string;
  secondaryColor: string;
  animationSpeed: 'slow' | 'normal' | 'fast';
  captionStyle: 'static' | 'word-by-word' | 'karaoke' | 'dynamic';
}

// Animation workflow state
export interface AnimationWorkflow {
  status: 'idle' | 'analyzing' | 'generating' | 'reviewing' | 'applying' | 'complete' | 'error';
  currentStep: WorkflowStep;
  progress: number;
  videoContext: VideoContext | null;
  storyboard: Storyboard | null;
  approvedElements: string[];
  errorMessage?: string;
}

export type WorkflowStep = 
  | 'context-analysis'
  | 'style-selection'
  | 'storyboard-generation'
  | 'element-review'
  | 'animation-preview'
  | 'final-integration';

// Preset animation styles for quick selection
export const ANIMATION_STYLE_PRESETS: VisualStyle[] = [
  {
    id: 'minimal',
    name: 'Minimal',
    description: 'Clean, subtle animations with understated elegance',
    primaryColor: 'hsl(0, 0%, 100%)',
    secondaryColor: 'hsl(0, 0%, 80%)',
    fontFamily: 'Inter',
    fontWeight: 'medium',
    textTransform: 'none',
    animationIntensity: 'subtle',
    shadowStyle: 'soft',
    strokeEnabled: false,
  },
  {
    id: 'bold',
    name: 'Bold Impact',
    description: 'High-contrast, attention-grabbing animations',
    primaryColor: 'hsl(45, 100%, 55%)',
    secondaryColor: 'hsl(0, 0%, 100%)',
    fontFamily: 'Inter',
    fontWeight: 'black',
    textTransform: 'uppercase',
    animationIntensity: 'dynamic',
    shadowStyle: 'hard',
    strokeEnabled: true,
    strokeColor: 'hsl(0, 0%, 0%)',
    strokeWidth: 3,
  },
  {
    id: 'hormozi',
    name: 'Hormozi Style',
    description: 'High-energy, word-by-word emphasis like Alex Hormozi',
    primaryColor: 'hsl(45, 100%, 55%)',
    secondaryColor: 'hsl(0, 0%, 100%)',
    fontFamily: 'Impact',
    fontWeight: 'bold',
    textTransform: 'uppercase',
    animationIntensity: 'intense',
    shadowStyle: 'hard',
    strokeEnabled: true,
    strokeColor: 'hsl(0, 0%, 0%)',
    strokeWidth: 4,
  },
  {
    id: 'modern',
    name: 'Modern Clean',
    description: 'Contemporary style with smooth transitions',
    primaryColor: 'hsl(220, 100%, 60%)',
    secondaryColor: 'hsl(0, 0%, 100%)',
    fontFamily: 'Inter',
    fontWeight: 'bold',
    textTransform: 'none',
    animationIntensity: 'moderate',
    shadowStyle: 'glow',
    strokeEnabled: false,
  },
  {
    id: 'playful',
    name: 'Playful Pop',
    description: 'Fun, bouncy animations with vibrant colors',
    primaryColor: 'hsl(330, 100%, 60%)',
    secondaryColor: 'hsl(180, 100%, 50%)',
    fontFamily: 'Inter',
    fontWeight: 'bold',
    textTransform: 'none',
    animationIntensity: 'dynamic',
    shadowStyle: 'glow',
    strokeEnabled: false,
  },
  {
    id: 'cinematic',
    name: 'Cinematic',
    description: 'Movie-quality text with dramatic reveals',
    primaryColor: 'hsl(0, 0%, 100%)',
    secondaryColor: 'hsl(45, 100%, 50%)',
    fontFamily: 'Georgia',
    fontWeight: 'normal',
    textTransform: 'none',
    animationIntensity: 'moderate',
    shadowStyle: 'soft',
    strokeEnabled: false,
  },
];
