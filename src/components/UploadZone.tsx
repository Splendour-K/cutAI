import { useState, useCallback } from 'react';
import { Upload, Film, Cloud, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface UploadZoneProps {
  onUpload: (file: File) => void;
  onDemo?: () => void;
}

export function UploadZone({ onUpload, onDemo }: UploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = Array.from(e.dataTransfer.files);
    const videoFile = files.find(f => f.type.startsWith('video/'));
    
    if (videoFile) {
      onUpload(videoFile);
    }
  }, [onUpload]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files[0]) {
      onUpload(files[0]);
    }
  }, [onUpload]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8 relative overflow-hidden">
      {/* Background glow effects */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-2xl w-full text-center space-y-8 animate-fade-in">
        {/* Logo/Brand */}
        <div className="space-y-4">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-surface-elevated/60 backdrop-blur border border-border/50">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-muted-foreground">AI-Powered Editing</span>
          </div>
          
          <h1 className="text-5xl md:text-6xl font-bold tracking-tight">
            <span className="text-foreground">Edit videos by</span>
            <br />
            <span className="text-gradient-ai">talking to AI</span>
          </h1>
          
          <p className="text-lg text-muted-foreground max-w-md mx-auto">
            Upload your video and let AI handle the editing. Just describe what you want — no timeline, no complexity.
          </p>
        </div>

        {/* Upload Zone */}
        <div
          className={cn(
            "upload-zone p-12 transition-all duration-300 cursor-pointer group",
            isDragging && "upload-zone-active scale-[1.02]"
          )}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => document.getElementById('file-input')?.click()}
        >
          <input
            id="file-input"
            type="file"
            accept="video/*"
            onChange={handleFileSelect}
            className="hidden"
          />
          
          <div className="flex flex-col items-center gap-6">
            <div className={cn(
              "w-20 h-20 rounded-2xl flex items-center justify-center transition-all duration-300",
              "bg-surface-elevated border border-border",
              isDragging ? "bg-primary/20 border-primary scale-110" : "group-hover:border-primary/50"
            )}>
              <Upload className={cn(
                "w-8 h-8 transition-colors duration-300",
                isDragging ? "text-primary" : "text-muted-foreground group-hover:text-primary"
              )} />
            </div>
            
            <div className="space-y-2">
              <p className="text-lg font-medium text-foreground">
                Drop your video here
              </p>
              <p className="text-sm text-muted-foreground">
                or click to browse • MP4, MOV, WebM supported
              </p>
            </div>
          </div>
        </div>

        {/* Alternative options */}
        <div className="flex items-center gap-4 justify-center">
          <div className="h-px flex-1 max-w-[100px] bg-border" />
          <span className="text-sm text-muted-foreground">or import from</span>
          <div className="h-px flex-1 max-w-[100px] bg-border" />
        </div>

        <div className="flex gap-3 justify-center">
          <Button variant="glass" className="gap-2">
            <Cloud className="w-4 h-4" />
            Google Drive
          </Button>
          <Button variant="glass" className="gap-2">
            <Film className="w-4 h-4" />
            YouTube URL
          </Button>
        </div>

        {/* Demo button */}
        {onDemo && (
          <div className="pt-4">
            <Button 
              variant="ai" 
              size="lg" 
              onClick={onDemo}
              className="gap-2"
            >
              <Sparkles className="w-5 h-5" />
              Try with sample video
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
