import { useState, useRef, useEffect, useCallback } from 'react';
import { Play, Pause, Volume2, VolumeX, Maximize2, RotateCcw, Captions, Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { VideoTimeline } from './VideoTimeline';
import { DraggableCaptionOverlay } from './DraggableCaptionOverlay';
import { cn } from '@/lib/utils';
import type { VideoProject, AspectRatio, CaptionSettings } from '@/types/video';
import { PLATFORM_CONFIGS } from '@/types/video';
import type { VideoAnalysis } from '@/hooks/useVideoAnalysis';

interface VideoPreviewProps {
  project: VideoProject;
  onFormatChange?: (ratio: AspectRatio) => void;
  analysis?: VideoAnalysis | null;
  captionSettings: CaptionSettings;
  onCaptionSettingsChange: (settings: CaptionSettings) => void;
  onGenerateCaptions?: () => void;
  isGeneratingCaptions?: boolean;
  editedCaptions?: Record<number, string>;
  isEditingCaptions?: boolean;
  onTimeUpdate?: (time: number) => void;
  onEditCaption?: (index: number, text: string) => void;
  compact?: boolean;
}

export function VideoPreview({ 
  project, 
  onFormatChange, 
  analysis, 
  captionSettings, 
  onCaptionSettingsChange,
  onGenerateCaptions,
  isGeneratingCaptions = false,
  editedCaptions = {},
  isEditingCaptions = false,
  onTimeUpdate,
  onEditCaption,
  compact = false
}: VideoPreviewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const platformConfig = PLATFORM_CONFIGS[project.platform];

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime);
      onTimeUpdate?.(video.currentTime);
    };
    const handleLoadedMetadata = () => setDuration(video.duration);
    const handleEnded = () => setIsPlaying(false);

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('ended', handleEnded);

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('ended', handleEnded);
    };
  }, [onTimeUpdate]);

  const togglePlay = useCallback(() => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  }, [isPlaying]);

  const toggleMute = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  }, [isMuted]);

  const handleSeek = useCallback((time: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
      onTimeUpdate?.(time);
    }
  }, [onTimeUpdate]);

  const handleRestart = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      setCurrentTime(0);
      onTimeUpdate?.(0);
    }
  }, [onTimeUpdate]);

  const handlePositionChange = useCallback((position: { x: number; y: number }) => {
    onCaptionSettingsChange({ ...captionSettings, customPosition: position });
  }, [captionSettings, onCaptionSettingsChange]);

  const handleCaptionTextChange = useCallback((segmentIndex: number, text: string) => {
    onEditCaption?.(segmentIndex, text);
  }, [onEditCaption]);

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const getAspectRatioClass = () => {
    switch (project.aspectRatio) {
      case '9:16':
        return compact ? 'aspect-[9/16] max-w-[240px]' : 'aspect-[9/16] max-w-[320px]';
      case '1:1':
        return compact ? 'aspect-square max-w-[300px]' : 'aspect-square max-w-[400px]';
      case '4:5':
        return compact ? 'aspect-[4/5] max-w-[280px]' : 'aspect-[4/5] max-w-[360px]';
      case '16:9':
      default:
        return compact ? 'aspect-video max-w-xl' : 'aspect-video max-w-2xl';
    }
  };

  const isVertical = project.aspectRatio === '9:16';
  const hasAnalysis = analysis?.status === 'completed';
  const hasTranscription = analysis?.transcription && analysis.transcription.segments?.length > 0;

  return (
    <div className={cn(
      "flex flex-col items-center justify-center w-full",
      compact ? "p-4" : "p-2"
    )}>
      {/* Platform indicator */}
      {!compact && (
        <div className="mb-4 flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-elevated/50 border border-border/30">
          <span>{platformConfig.icon}</span>
          <span className="text-sm text-muted-foreground">{platformConfig.name}</span>
          <span className="text-xs text-muted-foreground/60">•</span>
          <span className="text-sm text-foreground font-medium">{project.aspectRatio}</span>
        </div>
      )}

      {/* Video frame */}
      <div 
        ref={containerRef}
        className={cn(
          "relative bg-surface rounded-3xl overflow-hidden w-full",
          isVertical ? "phone-frame" : "border border-border",
          getAspectRatioClass(),
          isEditingCaptions && "ring-2 ring-primary/30"
        )}
      >
        {/* Video */}
        <video
          ref={videoRef}
          src={project.videoUrl}
          className="w-full h-full object-cover"
          playsInline
        />

        {/* Draggable Caption Overlay */}
        {hasTranscription && (
          <DraggableCaptionOverlay
            currentTime={currentTime}
            segments={analysis!.transcription!.segments}
            settings={captionSettings}
            editedCaptions={editedCaptions}
            containerRef={containerRef}
            isEditing={isEditingCaptions}
            onPositionChange={handlePositionChange}
            onTextChange={handleCaptionTextChange}
          />
        )}

        {/* Overlay controls */}
        <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent opacity-0 hover:opacity-100 transition-opacity duration-300">
          {/* Center play button */}
          <button
            onClick={togglePlay}
            className="absolute inset-0 flex items-center justify-center"
          >
            <div className="w-14 h-14 rounded-full bg-foreground/20 backdrop-blur-sm flex items-center justify-center hover:bg-foreground/30 transition-colors">
              {isPlaying ? (
                <Pause className="w-6 h-6 text-foreground" />
              ) : (
                <Play className="w-6 h-6 text-foreground ml-1" />
              )}
            </div>
          </button>

          {/* Bottom controls */}
          <div className="absolute bottom-0 left-0 right-0 p-3 space-y-2">
            {/* Progress bar */}
            <div 
              className="h-1 bg-foreground/20 rounded-full cursor-pointer"
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const percent = x / rect.width;
                handleSeek(percent * duration);
              }}
            >
              <div 
                className="h-full bg-primary rounded-full transition-all"
                style={{ width: `${(currentTime / (duration || 1)) * 100}%` }}
              />
            </div>

            {/* Control buttons */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={togglePlay}
                  className="h-7 w-7 text-foreground hover:bg-foreground/10"
                >
                  {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 ml-0.5" />}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleRestart}
                  className="h-7 w-7 text-foreground hover:bg-foreground/10"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={toggleMute}
                  className="h-7 w-7 text-foreground hover:bg-foreground/10"
                >
                  {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                </Button>
                <span className="text-xs text-foreground/80 font-mono ml-1">
                  {formatTime(currentTime)} / {formatTime(duration)}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onCaptionSettingsChange({ ...captionSettings, enabled: !captionSettings.enabled })}
                  className={cn(
                    "h-7 w-7 hover:bg-foreground/10",
                    captionSettings.enabled ? "text-primary" : "text-foreground"
                  )}
                  title={captionSettings.enabled ? "Hide captions" : "Show captions"}
                >
                  <Captions className="w-3.5 h-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-foreground hover:bg-foreground/10"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Processing indicator */}
        {project.status === 'processing' && (
          <div className="absolute inset-0 bg-background/60 backdrop-blur-sm flex items-center justify-center">
            <div className="text-center space-y-3">
              <div className="w-12 h-12 rounded-full border-2 border-primary border-t-transparent animate-spin mx-auto" />
              <p className="text-sm text-foreground font-medium">Applying edits...</p>
            </div>
          </div>
        )}

        {/* Exporting indicator */}
        {project.status === 'exporting' && (
          <div className="absolute inset-0 bg-background/60 backdrop-blur-sm flex items-center justify-center">
            <div className="text-center space-y-3">
              <div className="w-12 h-12 rounded-full border-2 border-primary border-t-transparent animate-spin mx-auto" />
              <p className="text-sm text-foreground font-medium">Exporting video...</p>
            </div>
          </div>
        )}
      </div>

      {/* Timeline with analysis markers */}
      {duration > 0 && !compact && (
        <div className="w-full max-w-2xl mt-4">
          <VideoTimeline
            duration={duration}
            currentTime={currentTime}
            pauses={hasAnalysis ? analysis?.pauses : null}
            keyMoments={hasAnalysis ? analysis?.keyMoments : null}
            sceneChanges={hasAnalysis ? analysis?.sceneChanges : null}
            onSeek={handleSeek}
          />
        </div>
      )}

      {/* Caption & Format Controls */}
      {!compact && (
        <div className="mt-4 flex items-center gap-4 flex-wrap justify-center">
          {/* Generate Captions button */}
          {!hasTranscription && onGenerateCaptions && (
            <Button 
              variant="outline" 
              size="sm" 
              className="gap-2"
              onClick={onGenerateCaptions}
              disabled={isGeneratingCaptions}
            >
              {isGeneratingCaptions ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Generate Captions
                </>
              )}
            </Button>
          )}

          {/* Format switcher */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Format:</span>
            <div className="flex gap-1">
              {platformConfig.aspectRatios.map((ratio) => (
                <button
                  key={ratio}
                  onClick={() => onFormatChange?.(ratio as AspectRatio)}
                  className={cn(
                    "px-2.5 py-1 rounded-lg text-xs font-medium transition-all duration-200",
                    project.aspectRatio === ratio
                      ? "bg-primary text-primary-foreground"
                      : "bg-surface-elevated text-muted-foreground hover:text-foreground"
                  )}
                >
                  {ratio}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Edit count */}
      {!compact && project.edits.length > 0 && (
        <div className="mt-3 text-xs text-muted-foreground">
          {project.edits.filter(e => e.applied).length} edits applied
        </div>
      )}
    </div>
  );
}
