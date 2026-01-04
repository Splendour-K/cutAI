export interface VideoProject {
  id: string;
  title: string;
  videoUrl: string;
  videoFile?: File;
  createdAt: Date;
  duration: number;
  aspectRatio: '16:9' | '9:16' | '1:1';
  status: 'uploading' | 'analyzing' | 'ready' | 'processing' | 'exporting';
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  status?: 'sending' | 'sent' | 'processing' | 'complete';
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
