import { useState, useRef, useEffect } from 'react';
import { Play, Pause, Volume2, VolumeX, Maximize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';
import type { VideoProject } from '@/types/video';

interface VideoPreviewProps {
  project: VideoProject;
}

export function VideoPreview({ project }: VideoPreviewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

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

  const handleSeek = (value: number[]) => {
    if (videoRef.current) {
      videoRef.current.currentTime = value[0];
      setCurrentTime(value[0]);
    }
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const isVertical = project.aspectRatio === '9:16';

  return (
    <div className="flex flex-col items-center justify-center h-full p-8">
      {/* Phone frame for vertical content */}
      <div 
        className={cn(
          "relative bg-surface rounded-3xl overflow-hidden",
          isVertical ? "phone-frame max-w-[320px] aspect-[9/16]" : "w-full max-w-2xl aspect-video rounded-2xl border border-border"
        )}
      >
        {/* Video */}
        <video
          ref={videoRef}
          src={project.videoUrl}
          className="w-full h-full object-cover"
          playsInline
        />

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
            {/* Progress bar */}
            <Slider
              value={[currentTime]}
              max={duration || 100}
              step={0.1}
              onValueChange={handleSeek}
              className="cursor-pointer"
            />

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

        {/* Processing indicator */}
        {project.status === 'processing' && (
          <div className="absolute inset-0 bg-background/60 backdrop-blur-sm flex items-center justify-center">
            <div className="text-center space-y-3">
              <div className="w-12 h-12 rounded-full border-2 border-primary border-t-transparent animate-spin mx-auto" />
              <p className="text-sm text-foreground font-medium">Applying edits...</p>
            </div>
          </div>
        )}
      </div>

      {/* Format indicator */}
      <div className="mt-6 flex items-center gap-3">
        <span className="text-xs text-muted-foreground">Format:</span>
        <div className="flex gap-2">
          {['9:16', '1:1', '16:9'].map((ratio) => (
            <button
              key={ratio}
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
  );
}
