// AI Auto-Editor Types for Professional Video Editing

// Edit Decision List (EDL) types
export type CutType = 'hard' | 'dissolve' | 'fade' | 'wipe' | 'zoom-transition';
export type ZoomType = 'slow-zoom-in' | 'slow-zoom-out' | 'quick-punch' | 'ken-burns' | 'focus-shift';
export type BRollType = 'contextual' | 'reaction' | 'cutaway' | 'overlay' | 'split-screen';

// A-roll segment after AI cuts
export interface ARollSegment {
  id: string;
  originalStartTime: number;
  originalEndTime: number;
  newStartTime: number;
  newEndTime: number;
  duration: number;
  content: string; // Transcript text for this segment
  isIncluded: boolean;
  reason?: string; // Why AI made this cut decision
  cutType: CutType;
  transitionDuration?: number;
}

// B-roll suggestion
export interface BRollSuggestion {
  id: string;
  insertAfterSegmentId: string;
  timestamp: number; // Where to insert
  duration: number;
  type: BRollType;
  description: string; // What B-roll should show
  searchQuery: string; // Query for stock footage
  altQueries?: string[]; // Fallback/alternative stock searches
  keywords?: string[]; // Concrete visual nouns for relevance scoring
  mood?: string; // e.g. 'energetic', 'calm', 'dramatic'
  colorTone?: string; // e.g. 'warm golden', 'cool blue', 'dark moody'
  motion?: string; // e.g. 'static', 'slow pan', 'fast action'
  reason: string;
  confidence: number;
  position?: 'fullscreen' | 'pip-topright' | 'pip-topleft' | 'pip-bottomright' | 'pip-bottomleft' | 'split-left' | 'split-right';
  scale?: number;
  status: 'suggested' | 'approved' | 'rejected' | 'ready';
  stockFootageUrl?: string; // Generated or selected footage URL
  downloadUrl?: string; // Full-quality source for export
  thumbnailUrl?: string;
  sourceId?: string; // e.g. pexels_12345 — used to avoid duplicates
  clipStartOffset?: number; // Where to start inside the stock clip
  clipDuration?: number; // Length of the source clip
  attribution?: string;
  matchScore?: number; // Relevance score from the selection engine
}

// Dynamic zoom effect
export interface ZoomEffect {
  id: string;
  segmentId: string;
  startTime: number;
  endTime: number;
  duration: number;
  type: ZoomType;
  startScale: number;
  endScale: number;
  focalPoint: { x: number; y: number }; // 0-100 percentage
  reason: string;
  isEnabled: boolean;
  easing: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out';
}

// Pacing analysis
export interface PacingAnalysis {
  averageSegmentDuration: number;
  suggestedCutFrequency: number; // Cuts per minute
  energyLevel: 'low' | 'medium' | 'high' | 'variable';
  rhythmPattern: string;
  hooks: Array<{ timestamp: number; description: string }>;
  slowSections: Array<{ startTime: number; endTime: number; reason: string }>;
}

// Complete Edit Decision List
export interface EditDecisionList {
  projectId: string;
  createdAt: string;
  originalDuration: number;
  editedDuration: number;
  
  // A-roll cuts
  aRollSegments: ARollSegment[];
  removedSections: Array<{
    startTime: number;
    endTime: number;
    reason: string; // 'silence', 'filler', 'repetition', 'low-energy', etc.
  }>;
  
  // B-roll suggestions
  bRollSuggestions: BRollSuggestion[];
  
  // Zoom effects
  zoomEffects: ZoomEffect[];
  
  // Pacing analysis
  pacing: PacingAnalysis;
  
  // Metadata
  style: 'youtube-short' | 'tiktok' | 'documentary' | 'tutorial' | 'vlog' | 'interview';
  targetPlatform?: string;
  editingNotes: string[];
}

// Auto-editor workflow states
export type AutoEditorStatus = 'idle' | 'analyzing' | 'reviewing' | 'applying' | 'complete' | 'error';

export interface AutoEditorWorkflow {
  status: AutoEditorStatus;
  progress: number;
  edl: EditDecisionList | null;
  errorMessage?: string;
  
  // Review state
  reviewStep: 'cuts' | 'broll' | 'zooms' | 'preview' | 'complete';
  hasUnapprovedChanges: boolean;
}

// Analysis request
export interface AutoEditorAnalysisRequest {
  projectId: string;
  transcript: {
    fullText: string;
    segments: Array<{
      startTime: number;
      endTime: number;
      text: string;
    }>;
  };
  videoDuration: number;
  targetStyle?: 'fast-paced' | 'moderate' | 'documentary' | 'auto';
  targetDurationReduction?: number; // Percentage to reduce (0-50)
  platform?: string;
  preferences?: {
    enableZooms: boolean;
    enableBRoll: boolean;
    cutFrequency: 'minimal' | 'moderate' | 'aggressive';
    preserveMoments?: string[]; // Timestamps to never cut
  };
}

// Preset editing styles
export const EDITING_STYLE_PRESETS = [
  {
    id: 'youtube-short',
    name: 'YouTube Short',
    description: 'Fast cuts, high energy, 5-6s segments',
    cutFrequency: 'aggressive',
    zoomIntensity: 'high',
    bRollDensity: 'moderate',
  },
  {
    id: 'tiktok',
    name: 'TikTok',
    description: 'Ultra-fast, punch zooms, no dead air',
    cutFrequency: 'aggressive',
    zoomIntensity: 'high',
    bRollDensity: 'sparse',
  },
  {
    id: 'documentary',
    name: 'Documentary',
    description: 'Slow Ken Burns effects, contextual B-roll',
    cutFrequency: 'minimal',
    zoomIntensity: 'low',
    bRollDensity: 'dense',
  },
  {
    id: 'tutorial',
    name: 'Tutorial',
    description: 'Clear pacing, focus zooms on key points',
    cutFrequency: 'moderate',
    zoomIntensity: 'moderate',
    bRollDensity: 'moderate',
  },
  {
    id: 'vlog',
    name: 'Vlog',
    description: 'Natural pacing, selective zooms, lifestyle B-roll',
    cutFrequency: 'moderate',
    zoomIntensity: 'moderate',
    bRollDensity: 'moderate',
  },
] as const;

// B-roll stock footage categories
export const BROLL_CATEGORIES = [
  { id: 'tech', name: 'Technology', examples: ['coding', 'devices', 'futuristic'] },
  { id: 'nature', name: 'Nature', examples: ['landscapes', 'animals', 'weather'] },
  { id: 'people', name: 'People', examples: ['crowds', 'reactions', 'lifestyle'] },
  { id: 'abstract', name: 'Abstract', examples: ['particles', 'gradients', 'motion'] },
  { id: 'business', name: 'Business', examples: ['office', 'meetings', 'graphs'] },
  { id: 'urban', name: 'Urban', examples: ['cities', 'traffic', 'architecture'] },
] as const;

// Zoom effect presets
export const ZOOM_PRESETS = [
  {
    id: 'slow-zoom-in',
    name: 'Slow Zoom In',
    startScale: 1.0,
    endScale: 1.15,
    duration: 3,
    easing: 'ease-in-out' as const,
  },
  {
    id: 'slow-zoom-out',
    name: 'Slow Zoom Out',
    startScale: 1.15,
    endScale: 1.0,
    duration: 3,
    easing: 'ease-in-out' as const,
  },
  {
    id: 'quick-punch',
    name: 'Quick Punch',
    startScale: 1.0,
    endScale: 1.3,
    duration: 0.3,
    easing: 'ease-out' as const,
  },
  {
    id: 'ken-burns',
    name: 'Ken Burns',
    startScale: 1.0,
    endScale: 1.2,
    duration: 5,
    easing: 'linear' as const,
  },
] as const;
