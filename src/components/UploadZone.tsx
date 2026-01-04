import { useState, useCallback, useRef } from 'react';
import { Upload, Cloud, Scissors, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface UploadZoneProps {
  onUpload: (file: File) => void;
  onDemo?: () => void;
}

export function UploadZone({ onUpload, onDemo }: UploadZoneProps) {
  const [prompt, setPrompt] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div 
      className="min-h-screen flex flex-col bg-background"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="video/*"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-border/30">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
            <Scissors className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="font-semibold text-foreground">CutAI</span>
        </div>

        {/* Center promo (optional) */}
        <div className="hidden md:flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">🎬 Edit videos with AI</span>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" className="text-muted-foreground">
            <MessageCircle className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="sm">
            Upgrade
          </Button>
          <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
            <span className="text-xs text-muted-foreground">U</span>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 pb-24">
        {/* Drag overlay */}
        {isDragging && (
          <div className="fixed inset-0 z-50 bg-primary/10 border-2 border-dashed border-primary flex items-center justify-center backdrop-blur-sm">
            <div className="text-center space-y-2">
              <Upload className="w-12 h-12 text-primary mx-auto" />
              <p className="text-lg font-medium text-foreground">Drop your video here</p>
            </div>
          </div>
        )}

        {/* Title */}
        <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-6 text-center">
          What's your next video?
        </h1>

        {/* Example Prompts */}
        <div className="flex flex-wrap justify-center gap-2 mb-8 max-w-3xl">
          {[
            "Cut long pauses",
            "Remove filler words",
            "Make it faster and more engaging",
            "Generate rough cuts for Instagram",
            "Trim to 30 seconds",
            "Add animated captions"
          ].map((example) => (
            <button
              key={example}
              onClick={() => setPrompt(example)}
              className="px-3 py-1.5 text-sm text-muted-foreground bg-card/30 border border-border/30 rounded-full hover:bg-card/50 hover:text-foreground hover:border-primary/40 transition-all duration-200"
            >
              {example}
            </button>
          ))}
        </div>

        {/* Prompt box */}
        <div className="w-full max-w-2xl">
          <div className={cn(
            "rounded-2xl border border-border/50 bg-card/50 backdrop-blur transition-all duration-300",
            "focus-within:border-primary/50 focus-within:shadow-lg focus-within:shadow-primary/5"
          )}>
            {/* Textarea */}
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Ask CutAI to create minimalist captions that follow me as I speak"
              className="w-full min-h-[120px] p-5 bg-transparent text-foreground placeholder:text-muted-foreground/60 resize-none focus:outline-none text-base leading-relaxed"
            />

            {/* Divider */}
            <div className="mx-5 border-t border-border/30" />

            {/* Actions bar */}
            <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleUploadClick}
                  className="gap-2"
                >
                  <Upload className="w-4 h-4" />
                  Upload
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  className="gap-2"
                >
                  <Cloud className="w-4 h-4" />
                  Drive
                </Button>
              </div>

              <Button
                variant="secondary"
                size="sm"
                onClick={onDemo}
                className="gap-2"
              >
                <Scissors className="w-4 h-4" />
                Edit
              </Button>
            </div>
          </div>

          {/* Caption Features Hint */}
          <div className="mt-6 p-4 rounded-xl bg-card/30 border border-border/20">
            <p className="text-sm text-muted-foreground text-center">
              <span className="text-primary">✨ Auto-captions</span> synced word-by-word • <span className="text-primary">Highlighted keywords</span> for emphasis • Modern animated styles • Brand colors & fonts
            </p>
          </div>

          {/* Disclaimer */}
          <p className="text-center text-xs text-muted-foreground/60 mt-4">
            Public Beta Experimental: AI may produce inaccurate information.
          </p>
        </div>
      </main>

      {/* Feedback button */}
      <button className="fixed bottom-6 right-6 flex items-center gap-2 px-4 py-2 rounded-full bg-card border border-border/50 text-sm text-muted-foreground hover:text-foreground hover:border-border transition-colors">
        <MessageCircle className="w-4 h-4" />
        Feedback
      </button>
    </div>
  );
}
