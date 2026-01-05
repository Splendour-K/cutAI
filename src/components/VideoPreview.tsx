import { useState, useRef, useEffect, useCallback } from 'react';
import { Play, Pause, Volume2, VolumeX, Maximize2, RotateCcw, Captions, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { VideoTimeline } from './VideoTimeline';
import { CaptionOverlay } from './CaptionOverlay';
import { CaptionEditor } from './CaptionEditor';
import { CaptionSettingsPanel } from './CaptionSettingsPanel';
import { cn } from '@/lib/utils';
import type { VideoProject, AspectRatio, CaptionSettings } from '@/types/video';
import { PLATFORM_CONFIGS } from '@/types/video';
import type { VideoAnalysis } from '@/hooks/useVideoAnalysis';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface VideoPreviewProps {
  project: VideoProject;
  onFormatChange?: (ratio: AspectRatio) => void;
  analysis?: VideoAnalysis | null;
}

export function VideoPreview({ project, onFormatChange, analysis }: VideoPreviewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [captionSettings, setCaptionSettings] = useState<CaptionSettings>({
    enabled: true,
    style: 'modern',
    position: 'bottom',
    highlightKeywords: false,
    fontFamily: 'Inter',
    fontSize: 'medium',
    textColor: 'hsl(210, 20%, 95%)',
    brandColor: 'hsl(185, 85%, 50%)'
  });
  const [editedCaptions, setEditedCaptions] = useState<Record<number, string>>({});

  const handleEditCaption = useCallback((index: number, text: string) => {
    setEditedCaptions(prev => ({ ...prev, [index]: text }));
  }, []);

  const platformConfig = PLATFORM_CONFIGS[project.platform];

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => setCurrentTime(video.currentTime);
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
  }, []);

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const handleSeek = (time: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const handleRestart = () => {
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      setCurrentTime(0);
    }
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const getAspectRatioClass = () => {
    switch (project.aspectRatio) {
      case '9:16':
        return 'aspect-[9/16] max-w-[320px]';
      case '1:1':
        return 'aspect-square max-w-[400px]';
      case '4:5':
        return 'aspect-[4/5] max-w-[360px]';
      case '16:9':
      default:
        return 'aspect-video max-w-2xl';
    }
  };

  const isVertical = project.aspectRatio === '9:16';
  const hasAnalysis = analysis?.status === 'completed';

  return (
    <div className="flex flex-col items-center justify-center h-full p-8">
      {/* Platform indicator */}
      <div className="mb-4 flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-elevated/50 border border-border/30">
        <span>{platformConfig.icon}</span>
        <span className="text-sm text-muted-foreground">{platformConfig.name}</span>
        <span className="text-xs text-muted-foreground/60">•</span>
        <span className="text-sm text-foreground font-medium">{project.aspectRatio}</span>
      </div>

      {/* Video frame */}
      <div 
        className={cn(
          "relative bg-surface rounded-3xl overflow-hidden w-full",
          isVertical ? "phone-frame" : "border border-border",
          getAspectRatioClass()
        )}
      >
        {/* Video */}
        <video
          ref={videoRef}
          src={project.videoUrl}
          className="w-full h-full object-cover"
          playsInline
        />

        {/* Caption Overlay */}
        {hasAnalysis && analysis?.transcription && (
          <CaptionOverlay
            currentTime={currentTime}
            segments={analysis.transcription.segments}
            settings={captionSettings}
            editedCaptions={editedCaptions}
          />
        )}

        {/* Overlay controls */}
        <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent opacity-0 hover:opacity-100 transition-opacity duration-300">
          {/* Center play button */}
          <button
            onClick={togglePlay}
            className="absolute inset-0 flex items-center justify-center"
          >
            <div className="w-16 h-16 rounded-full bg-foreground/20 backdrop-blur-sm flex items-center justify-center hover:bg-foreground/30 transition-colors">
              {isPlaying ? (
                <Pause className="w-8 h-8 text-foreground" />
              ) : (
                <Play className="w-8 h-8 text-foreground ml-1" />
              )}
            </div>
          </button>

          {/* Bottom controls */}
          <div className="absolute bottom-0 left-0 right-0 p-4 space-y-3">
            {/* Simple progress bar for overlay */}
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
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={togglePlay}
                  className="h-8 w-8 text-foreground hover:bg-foreground/10"
                >
                  {isPlaying ? (
                    <Pause className="w-4 h-4" />
                  ) : (
                    <Play className="w-4 h-4 ml-0.5" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleRestart}
                  className="h-8 w-8 text-foreground hover:bg-foreground/10"
                >
                  <RotateCcw className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={toggleMute}
                  className="h-8 w-8 text-foreground hover:bg-foreground/10"
                >
                  {isMuted ? (
                    <VolumeX className="w-4 h-4" />
                  ) : (
                    <Volume2 className="w-4 h-4" />
                  )}
                </Button>
                <span className="text-xs text-foreground/80 font-mono">
                  {formatTime(currentTime)} / {formatTime(duration)}
                </span>
              </div>
              <div className="flex items-center gap-1">
                {/* Caption toggle button */}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setCaptionSettings(prev => ({ ...prev, enabled: !prev.enabled }))}
                  className={cn(
                    "h-8 w-8 hover:bg-foreground/10",
                    captionSettings.enabled ? "text-primary" : "text-foreground"
                  )}
                  title={captionSettings.enabled ? "Hide captions" : "Show captions"}
                >
                  <Captions className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-foreground hover:bg-foreground/10"
                >
                  <Maximize2 className="w-4 h-4" />
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
      {duration > 0 && (
        <div className="w-full max-w-2xl mt-6">
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
      <div className="mt-6 flex items-center gap-4">
        {/* Caption Settings Sheet */}
        {hasAnalysis && analysis?.transcription && (
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <Settings2 className="w-4 h-4" />
                Caption Settings
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[400px] sm:w-[540px]">
              <SheetHeader>
                <SheetTitle>Caption Settings</SheetTitle>
              </SheetHeader>
              <Tabs defaultValue="settings" className="mt-4">
                <TabsList className="w-full">
                  <TabsTrigger value="settings" className="flex-1">Style</TabsTrigger>
                  <TabsTrigger value="editor" className="flex-1">Edit Text</TabsTrigger>
                </TabsList>
                <TabsContent value="settings" className="mt-4">
                  <CaptionSettingsPanel
                    settings={captionSettings}
                    onSettingsChange={setCaptionSettings}
                  />
                </TabsContent>
                <TabsContent value="editor" className="mt-4 h-[calc(100vh-200px)]">
                  <CaptionEditor
                    segments={analysis.transcription.segments}
                    currentTime={currentTime}
                    editedCaptions={editedCaptions}
                    onEditCaption={handleEditCaption}
                    onSeek={handleSeek}
                  />
                </TabsContent>
              </Tabs>
            </SheetContent>
          </Sheet>
        )}

        {/* Format switcher */}
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">Format:</span>
          <div className="flex gap-2">
            {platformConfig.aspectRatios.map((ratio) => (
              <button
                key={ratio}
                onClick={() => onFormatChange?.(ratio as AspectRatio)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200",
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

      {/* Edit count */}
      {project.edits.length > 0 && (
        <div className="mt-4 text-xs text-muted-foreground">
          {project.edits.filter(e => e.applied).length} edits applied
        </div>
      )}
    </div>
  );
}
