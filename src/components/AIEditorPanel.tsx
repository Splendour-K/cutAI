import { useState } from 'react';
import { 
  Sparkles,
  Wand2,
  Loader2,
  RotateCcw,
  Play
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { EnhancementReviewPanel } from './EnhancementReviewPanel';
import { EnhancementPreviewModal } from './EnhancementPreviewModal';
import type { EnhancementWorkflow, Enhancement } from '@/types/enhancement';
import type { TranscriptSegment } from '@/hooks/useVideoAnalysis';

interface AIEditorPanelProps {
  workflow: EnhancementWorkflow;
  hasTranscript: boolean;
  onAnalyze: (transcript: { fullText: string; segments: TranscriptSegment[] }) => Promise<any>;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onApproveAll: () => void;
  onGenerate: (id: string) => void;
  onGenerateAll: () => void;
  onRemove: (id: string) => void;
  onUpdatePosition: (id: string, position: { x: number; y: number; scale: number }) => void;
  onUpdateTiming: (id: string, startTime: number, endTime: number) => void;
  onReset: () => void;
  transcript?: { fullText: string; segments: TranscriptSegment[] };
  videoContext?: { genre?: string; mood?: string[]; pacing?: string };
}

export function AIEditorPanel({
  workflow,
  hasTranscript,
  onAnalyze,
  onApprove,
  onReject,
  onApproveAll,
  onGenerate,
  onGenerateAll,
  onRemove,
  onUpdatePosition,
  onUpdateTiming,
  onReset,
  transcript,
  videoContext,
}: AIEditorPanelProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [previewEnhancement, setPreviewEnhancement] = useState<Enhancement | null>(null);

  const handleStartAnalysis = async () => {
    if (!transcript) return;
    
    setIsAnalyzing(true);
    try {
      await onAnalyze(transcript);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Idle state - prompt to analyze
  if (workflow.status === 'idle') {
    return (
      <div className="h-full flex flex-col">
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center max-w-sm">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-primary/20 to-purple-500/20 flex items-center justify-center">
              <Sparkles className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">
              AI Editor
            </h3>
            <p className="text-sm text-muted-foreground mb-6">
              Let AI analyze your video and suggest contextual visuals, sound effects, 
              and animated graphics that reinforce your message.
            </p>
            
            {!hasTranscript ? (
              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 mb-4">
                <p className="text-sm text-amber-600 dark:text-amber-400">
                  Generate captions first to enable AI analysis. The AI needs to understand 
                  what's being said in your video.
                </p>
              </div>
            ) : (
              <Button 
                onClick={handleStartAnalysis}
                disabled={isAnalyzing}
                size="lg"
                className="gap-2"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Wand2 className="w-4 h-4" />
                    Analyze Video
                  </>
                )}
              </Button>
            )}
          </div>
        </div>

        {/* Feature Preview */}
        <div className="p-4 border-t border-border bg-surface/50">
          <h4 className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wide">
            What AI will suggest
          </h4>
          <div className="grid grid-cols-2 gap-2">
            {[
              { icon: '🖼️', label: 'Visual Overlays', desc: 'Images & memes' },
              { icon: '🔊', label: 'Sound Effects', desc: 'Whooshes & impacts' },
              { icon: '✨', label: 'Animated Graphics', desc: 'Text & emojis' },
              { icon: '🎬', label: 'Motion Effects', desc: 'Zoom & shake' },
            ].map(item => (
              <div key={item.label} className="p-2 rounded-lg bg-muted/50">
                <span className="text-lg">{item.icon}</span>
                <p className="text-xs font-medium text-foreground mt-1">{item.label}</p>
                <p className="text-[10px] text-muted-foreground">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header with Reset */}
      <div className="p-3 border-b border-border bg-surface/50 flex items-center justify-between flex-shrink-0">
        <span className="text-xs font-medium text-muted-foreground">AI Editor</span>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={onReset}
          className="h-6 px-2 text-xs"
        >
          <RotateCcw className="w-3 h-3 mr-1" />
          Reset
        </Button>
      </div>

      {/* Main Content */}
      <EnhancementReviewPanel
        workflow={workflow}
        onApprove={onApprove}
        onReject={onReject}
        onApproveAll={onApproveAll}
        onGenerate={onGenerate}
        onGenerateAll={onGenerateAll}
        onRemove={onRemove}
        onUpdatePosition={onUpdatePosition}
        onUpdateTiming={onUpdateTiming}
        onPreview={setPreviewEnhancement}
      />

      {/* Preview Modal */}
      <EnhancementPreviewModal
        isOpen={!!previewEnhancement}
        onClose={() => setPreviewEnhancement(null)}
        enhancement={previewEnhancement}
      />
    </div>
  );
}
