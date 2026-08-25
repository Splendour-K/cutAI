export type Platform = 'youtube' | 'instagram' | 'tiktok' | 'twitter' | 'linkedin' | 'custom';
export type ContentType = 'short' | 'long';
export type AspectRatio = '16:9' | '9:16' | '1:1' | '4:5';

export interface PlatformConfig {
  id: Platform;
  name: string;
  icon: string;
  aspectRatios: AspectRatio[];
  maxDuration: number; // in seconds
  contentType: ContentType;
}

export const PLATFORM_CONFIGS: Record<Platform, PlatformConfig> = {
  youtube: {
    id: 'youtube',
    name: 'YouTube',
    icon: '📺',
    aspectRatios: ['16:9', '9:16', '1:1'],
    maxDuration: 43200, // 12 hours
    contentType: 'long',
  },
  instagram: {
    id: 'instagram',
    name: 'Instagram',
    icon: '📸',
    aspectRatios: ['9:16', '1:1', '4:5'],
    maxDuration: 90,
    contentType: 'short',
  },
  tiktok: {
    id: 'tiktok',
    name: 'TikTok',
    icon: '🎵',
    aspectRatios: ['9:16'],
    maxDuration: 180,
    contentType: 'short',
  },
  twitter: {
    id: 'twitter',
    name: 'X / Twitter',
    icon: '𝕏',
    aspectRatios: ['16:9', '1:1'],
    maxDuration: 140,
    contentType: 'short',
  },
  linkedin: {
    id: 'linkedin',
    name: 'LinkedIn',
    icon: '💼',
    aspectRatios: ['16:9', '1:1', '9:16'],
    maxDuration: 600,
    contentType: 'long',
  },
  custom: {
    id: 'custom',
    name: 'Custom',
    icon: '⚙️',
    aspectRatios: ['16:9', '9:16', '1:1', '4:5'],
    maxDuration: 43200,
    contentType: 'long',
  },
};

export interface VideoProject {
  id: string;
  title: string;
  videoUrl: string;
  /** Permanent cloud storage URL — the source of truth when videoUrl is a local blob. */
  cloudVideoUrl?: string;
  videoFile?: File;
  createdAt: Date;
  duration: number;
  aspectRatio: AspectRatio;
  platform: Platform;
  status: 'uploading' | 'analyzing' | 'ready' | 'processing' | 'exporting';
  edits: EditAction[];
  captions?: CaptionSettings;
}

export interface EditActionParameters {
  startTime?: number;
  endTime?: number;
  timestamps?: Array<{ start: number; end: number; reason?: string }>;
  speed?: number;
  captionStyle?: CaptionStyle;
  captionAnimation?: CaptionAnimation;
  zoomType?: 'slow-zoom-in' | 'slow-zoom-out' | 'quick-punch' | 'ken-burns' | 'focus-shift';
  aspectRatio?: AspectRatio;
  focalPoint?: { x: number; y: number };
  [key: string]: unknown;
}

export interface EditAction {
  id: string;
  type: 'cut' | 'trim' | 'speed' | 'caption' | 'music' | 'effect' | 'format';
  description: string;
  applied: boolean;
  timestamp: Date;
  parameters?: EditActionParameters;
}

export type CaptionStyle = 'modern' | 'minimal' | 'bold' | 'subtitle' | 'hormozi' | 'karaoke' | 'pop' | 'glide' | 'bounce';
export type CaptionAnimation = 'none' | 'word-by-word' | 'pop' | 'pulse' | 'glide' | 'bounce' | 'typewriter' | 'wave';

export interface CaptionSettings {
  enabled: boolean;
  style: CaptionStyle;
  animation: CaptionAnimation;
  position: 'top' | 'center' | 'bottom';
  customPosition?: { x: number; y: number }; // For drag positioning
  highlightKeywords: boolean;
  brandColor?: string;
  fontFamily?: string;
  fontSize?: 'small' | 'medium' | 'large' | 'xlarge';
  textColor?: string;
  backgroundColor?: string;
  strokeColor?: string;
  strokeWidth?: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  status?: 'sending' | 'sent' | 'processing' | 'complete';
  editActions?: EditAction[];
}

export interface VideoAnalysis {
  transcript: string;
  segments: VideoSegment[];
  fillerWords: FillerWord[];
  silences: Silence[];
  keyMoments: KeyMoment[];
}

export interface VideoSegment {
  id: string;
  startTime: number;
  endTime: number;
  text: string;
}

export interface FillerWord {
  word: string;
  startTime: number;
  endTime: number;
}

export interface Silence {
  startTime: number;
  endTime: number;
  duration: number;
}

export interface KeyMoment {
  time: number;
  description: string;
  importance: 'high' | 'medium' | 'low';
}
