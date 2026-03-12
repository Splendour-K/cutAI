import { useState, useCallback, useRef, useEffect } from 'react';
import { Upload, Scissors, MessageCircle, Sparkles, Loader2, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PlatformSelector } from '@/components/PlatformSelector';
import { ThemeToggle } from '@/components/ThemeToggle';
import { AuthModal } from '@/components/AuthModal';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import type { Platform } from '@/types/video';
import { PLATFORM_CONFIGS } from '@/types/video';

const PENDING_PROMPT_KEY = 'clipzy_pending_prompt';
const PENDING_PLATFORM_KEY = 'clipzy_pending_platform';

interface UploadZoneProps {
  onUpload: (file: File, platform: Platform, initialPrompt?: string) => void;
  onDemo?: (platform: Platform) => void;
  isUploading?: boolean;
  uploadProgress?: number;
  onBackToDashboard?: () => void;
}

const EXAMPLE_PROMPTS = {
  short: [
    "Cut long pauses",
    "Remove filler words",
    "Make it faster and more engaging",
    "Add animated captions",
    "Trim to 30 seconds",
    "Add trending music"
  ],
  long: [
    "Create chapter markers",
    "Remove awkward silences",
    "Add professional captions",
    "Optimize for engagement",
    "Create highlight clips",
    "Add intro and outro"
  ]
};

export function UploadZone({ onUpload, onDemo, isUploading, uploadProgress, onBackToDashboard }: UploadZoneProps) {
  const { user, signOut } = useAuth();
  const [prompt, setPrompt] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState<Platform>('instagram');
  const [showAuthModal, setShowAuthModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Restore pending prompt after login
  useEffect(() => {
    if (user) {
      const pendingPrompt = localStorage.getItem(PENDING_PROMPT_KEY);
      const pendingPlatform = localStorage.getItem(PENDING_PLATFORM_KEY);
      if (pendingPrompt) {
        setPrompt(pendingPrompt);
        localStorage.removeItem(PENDING_PROMPT_KEY);
      }
      if (pendingPlatform) {
        setSelectedPlatform(pendingPlatform as Platform);
        localStorage.removeItem(PENDING_PLATFORM_KEY);
      }
    }
  }, [user]);

  const platformConfig = PLATFORM_CONFIGS[selectedPlatform];
  const isLongForm = platformConfig.contentType === 'long';

  const requireAuth = useCallback((action: () => void) => {
    if (!user) {
      // Store current state before showing auth
      localStorage.setItem(PENDING_PROMPT_KEY, prompt);
      localStorage.setItem(PENDING_PLATFORM_KEY, selectedPlatform);
      setShowAuthModal(true);
      return;
    }
    action();
  }, [user, prompt, selectedPlatform]);

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
      requireAuth(() => onUpload(videoFile, selectedPlatform, prompt || undefined));
    }
  }, [onUpload, selectedPlatform, prompt, requireAuth]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files[0]) {
      requireAuth(() => onUpload(files[0], selectedPlatform, prompt || undefined));
    }
  }, [onUpload, selectedPlatform, prompt, requireAuth]);

  const handleUploadClick = () => {
    requireAuth(() => fileInputRef.current?.click());
  };

  const handleDemoClick = () => {
    requireAuth(() => onDemo?.(selectedPlatform));
  };

  const currentExamples = isLongForm ? EXAMPLE_PROMPTS.long : EXAMPLE_PROMPTS.short;

  return (
    <div 
      className="min-h-screen flex flex-col bg-background"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Auth Modal */}
      <AuthModal open={showAuthModal} onOpenChange={setShowAuthModal} />

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
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
            <Scissors className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="font-semibold text-foreground">Clipzy AI</span>
        </div>

        <div className="hidden md:flex items-center gap-2 text-sm">
          <Sparkles className="w-4 h-4 text-primary" />
          <span className="text-muted-foreground">AI-powered video editing</span>
        </div>

        <div className="flex items-center gap-3">
          <ThemeToggle />
          {user ? (
            <>
              <Button variant="ghost" size="sm" onClick={signOut} className="text-muted-foreground gap-2">
                <LogOut className="w-4 h-4" />
                Sign out
              </Button>
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                <span className="text-xs font-medium text-primary">
                  {user.email?.[0]?.toUpperCase() || 'U'}
                </span>
              </div>
            </>
          ) : (
            <Button variant="outline" size="sm" onClick={() => setShowAuthModal(true)}>
              Sign in
            </Button>
          )}
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 pb-24">
        {isDragging && (
          <div className="fixed inset-0 z-50 bg-primary/10 border-2 border-dashed border-primary flex items-center justify-center backdrop-blur-sm">
            <div className="text-center space-y-2">
              <Upload className="w-12 h-12 text-primary mx-auto" />
              <p className="text-lg font-medium text-foreground">Drop your video here</p>
              <p className="text-sm text-muted-foreground">
                Optimized for {platformConfig.name} • {platformConfig.aspectRatios[0]}
              </p>
            </div>
          </div>
        )}

        <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-3 text-center">
          Edit videos with AI
        </h1>
        
        <p className="text-muted-foreground text-center mb-8 max-w-md">
          Upload a video, tell the AI what you want, and export. No editing skills needed.
        </p>

        <div className="mb-8">
          <PlatformSelector selected={selectedPlatform} onSelect={setSelectedPlatform} />
        </div>

        <div className="w-full max-w-2xl">
          <div className={cn(
            "rounded-2xl border border-border/50 bg-card/50 backdrop-blur transition-all duration-300",
            "focus-within:border-primary/50 focus-within:shadow-lg focus-within:shadow-primary/5"
          )}>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="What do you want to do? e.g. 'Add captions and remove filler words'"
              className="w-full min-h-[100px] p-5 bg-transparent text-foreground placeholder:text-muted-foreground/60 resize-none focus:outline-none text-base leading-relaxed"
            />

            <div className="mx-5 border-t border-border/30" />

            <div className="flex items-center justify-between p-4">
              <Button
                variant="secondary"
                size="sm"
                onClick={handleUploadClick}
                disabled={isUploading}
                className="gap-2"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {uploadProgress ? `${uploadProgress}%` : 'Uploading...'}
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    Upload Video
                  </>
                )}
              </Button>

              <Button
                variant="secondary"
                size="sm"
                onClick={handleDemoClick}
                className="gap-2"
              >
                <Scissors className="w-4 h-4" />
                Try Demo
              </Button>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {currentExamples.slice(0, 4).map((example) => (
              <button
                key={example}
                onClick={() => setPrompt(example)}
                className="px-3 py-1.5 text-xs text-muted-foreground bg-card/30 border border-border/30 rounded-full hover:bg-card/50 hover:text-foreground hover:border-primary/40 transition-all duration-200"
              >
                {example}
              </button>
            ))}
          </div>

          <p className="text-center text-xs text-muted-foreground/50 mt-6">
            Supports MP4, MOV, WebM • Max {platformConfig.maxDuration >= 3600 
              ? `${Math.floor(platformConfig.maxDuration / 3600)}h` 
              : `${Math.floor(platformConfig.maxDuration / 60)}min`} for {platformConfig.name}
          </p>
        </div>
      </main>

      <button className="fixed bottom-6 right-6 flex items-center gap-2 px-4 py-2 rounded-full bg-card border border-border/50 text-sm text-muted-foreground hover:text-foreground hover:border-border transition-colors">
        <MessageCircle className="w-4 h-4" />
        Feedback
      </button>
    </div>
  );
}
