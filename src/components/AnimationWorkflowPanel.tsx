import { useState } from 'react';
import { 
  Wand2, 
  CheckCircle2, 
  Circle, 
  Loader2, 
  ChevronRight,
  Palette,
  Film,
  Eye,
  Download,
  Sparkles,
  RotateCcw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { AnimationStyleSelector } from './AnimationStyleSelector';
import { StoryboardReview } from './StoryboardReview';
import type { AnimationWorkflow, VisualStyle, Storyboard, WorkflowStep } from '@/types/animation';
import type { TranscriptSegment } from '@/hooks/useVideoAnalysis';
import type { BrandPreset } from '@/hooks/useBrandPresets';

interface AnimationWorkflowPanelProps {
  workflow: AnimationWorkflow;
  onAnalyzeContext: (transcript?: { fullText: string; segments: TranscriptSegment[] }) => Promise<any>;
  onGenerateStoryboard: (style: VisualStyle) => Promise<any>;
  onApproveElement: (elementId: string) => void;
  onUnapproveElement: (elementId: string) => void;
  onApproveAll: () => void;
  onProceedToPreview: () => void;
  onApplyAnimations: () => void;
  onReset: () => void;
  onGoToStep: (step: WorkflowStep) => void;
  existingTranscript?: { fullText: string; segments: TranscriptSegment[] };
  // Brand presets props
  brandPresets: BrandPreset[];
  onCreatePreset: (name: string, description: string, style: VisualStyle) => BrandPreset;
  onUpdatePreset: (presetId: string, updates: Partial<Omit<BrandPreset, 'id' | 'createdAt'>>) => void;
  onDeletePreset: (presetId: string) => void;
  onSetDefaultPreset: (presetId: string) => void;
  onDuplicatePreset: (presetId: string) => BrandPreset | undefined;
}

const WORKFLOW_STEPS = [
  { id: 'context-analysis' as WorkflowStep, label: 'Analyze', icon: Sparkles },
  { id: 'style-selection' as WorkflowStep, label: 'Style', icon: Palette },
  { id: 'storyboard-generation' as WorkflowStep, label: 'Generate', icon: Film },
  { id: 'element-review' as WorkflowStep, label: 'Review', icon: Eye },
  { id: 'animation-preview' as WorkflowStep, label: 'Preview', icon: Wand2 },
  { id: 'final-integration' as WorkflowStep, label: 'Export', icon: Download },
];

export function AnimationWorkflowPanel({
  workflow,
  onAnalyzeContext,
  onGenerateStoryboard,
  onApproveElement,
  onUnapproveElement,
  onApproveAll,
  onProceedToPreview,
  onApplyAnimations,
  onReset,
  onGoToStep,
  existingTranscript,
  brandPresets,
  onCreatePreset,
  onUpdatePreset,
  onDeletePreset,
  onSetDefaultPreset,
  onDuplicatePreset,
}: AnimationWorkflowPanelProps) {
  const [selectedStyle, setSelectedStyle] = useState<VisualStyle | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const currentStepIndex = WORKFLOW_STEPS.findIndex(s => s.id === workflow.currentStep);

  const handleStartAnalysis = async () => {
    setIsProcessing(true);
    try {
      await onAnalyzeContext(existingTranscript);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleGenerateStoryboard = async () => {
    if (!selectedStyle) return;
    setIsProcessing(true);
    try {
      await onGenerateStoryboard(selectedStyle);
    } finally {
      setIsProcessing(false);
    }
  };

  const renderStepContent = () => {
    switch (workflow.currentStep) {
      case 'context-analysis':
        return (
          <div className="p-4 space-y-4">
            <div className="text-center py-6">
              <Sparkles className="w-12 h-12 mx-auto mb-4 text-primary" />
              <h3 className="text-lg font-semibold text-foreground mb-2">
                Content-Aware Animation
              </h3>
              <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
                Our AI will analyze your video like a professional editor — understanding script, 
                pacing, visuals, and timing to generate perfect animations.
              </p>
              <Button 
                onClick={handleStartAnalysis}
                disabled={isProcessing || workflow.status === 'analyzing'}
                size="lg"
                className="gap-2"
              >
                {isProcessing || workflow.status === 'analyzing' ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Analyzing Video...
                  </>
                ) : (
                  <>
                    <Wand2 className="w-4 h-4" />
                    Analyze Video Context
                  </>
                )}
              </Button>
            </div>

            {workflow.status === 'analyzing' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Analyzing...</span>
                  <span className="text-foreground font-medium">{workflow.progress}%</span>
                </div>
                <Progress value={workflow.progress} className="h-2" />
                <p className="text-xs text-muted-foreground text-center">
                  Extracting script, detecting pacing, analyzing visuals...
                </p>
              </div>
            )}
          </div>
        );

      case 'style-selection':
        return (
          <div className="p-4 space-y-4">
            <div className="mb-4">
              <h3 className="text-sm font-semibold text-foreground mb-1">
                Choose Animation Style
              </h3>
              <p className="text-xs text-muted-foreground">
                Select a visual style that matches your brand. This will be applied consistently across all animations.
              </p>
            </div>

            <AnimationStyleSelector
              selectedStyle={selectedStyle}
              onSelectStyle={setSelectedStyle}
              videoContext={workflow.videoContext}
              brandPresets={brandPresets}
              onCreatePreset={onCreatePreset}
              onUpdatePreset={onUpdatePreset}
              onDeletePreset={onDeletePreset}
              onSetDefaultPreset={onSetDefaultPreset}
              onDuplicatePreset={onDuplicatePreset}
            />

            <Button 
              onClick={handleGenerateStoryboard}
              disabled={!selectedStyle || isProcessing}
              className="w-full gap-2"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating Storyboard...
                </>
              ) : (
                <>
                  <ChevronRight className="w-4 h-4" />
                  Generate Storyboard
                </>
              )}
            </Button>
          </div>
        );

      case 'storyboard-generation':
        return (
          <div className="p-4 space-y-4">
            <div className="text-center py-8">
              <Loader2 className="w-12 h-12 mx-auto mb-4 text-primary animate-spin" />
              <h3 className="text-lg font-semibold text-foreground mb-2">
                Generating Storyboard
              </h3>
              <p className="text-sm text-muted-foreground">
                Creating element-by-element animations based on your video context...
              </p>
              <Progress value={workflow.progress} className="h-2 mt-4" />
            </div>
          </div>
        );

      case 'element-review':
        return (
          <StoryboardReview
            storyboard={workflow.storyboard}
            approvedElements={workflow.approvedElements}
            onApproveElement={onApproveElement}
            onUnapproveElement={onUnapproveElement}
            onApproveAll={onApproveAll}
            onProceed={onProceedToPreview}
            style={selectedStyle ?? undefined}
          />
        );

      case 'animation-preview':
        return (
          <div className="p-4 space-y-4">
            <div className="text-center py-6">
              <Eye className="w-12 h-12 mx-auto mb-4 text-primary" />
              <h3 className="text-lg font-semibold text-foreground mb-2">
                Preview Animations
              </h3>
              <p className="text-sm text-muted-foreground mb-6">
                Play your video to see the animations in action. Make adjustments if needed.
              </p>
              <div className="flex gap-2 justify-center">
                <Button 
                  variant="outline"
                  onClick={() => onGoToStep('element-review')}
                >
                  Back to Review
                </Button>
                <Button 
                  onClick={onApplyAnimations}
                  className="gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Apply Animations
                </Button>
              </div>
            </div>
          </div>
        );

      case 'final-integration':
        return (
          <div className="p-4 space-y-4">
            <div className="text-center py-6">
              <CheckCircle2 className="w-12 h-12 mx-auto mb-4 text-green-500" />
              <h3 className="text-lg font-semibold text-foreground mb-2">
                Animations Applied!
              </h3>
              <p className="text-sm text-muted-foreground mb-6">
                Your video is now enhanced with professional animations. Export when ready.
              </p>
              <div className="flex gap-2 justify-center">
                <Button 
                  variant="outline"
                  onClick={onReset}
                  className="gap-2"
                >
                  <RotateCcw className="w-4 h-4" />
                  Start Over
                </Button>
                <Button className="gap-2">
                  <Download className="w-4 h-4" />
                  Export Video
                </Button>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Workflow Progress */}
      <div className="p-3 border-b border-border bg-surface/50 flex-shrink-0">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-muted-foreground">Animation Workflow</span>
          {workflow.status !== 'idle' && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={onReset}
              className="h-6 px-2 text-xs"
            >
              <RotateCcw className="w-3 h-3 mr-1" />
              Reset
            </Button>
          )}
        </div>
        
        {/* Step indicators */}
        <div className="flex items-center gap-1">
          {WORKFLOW_STEPS.map((step, index) => {
            const Icon = step.icon;
            const isComplete = index < currentStepIndex;
            const isCurrent = index === currentStepIndex;
            const isDisabled = index > currentStepIndex;
            
            return (
              <button
                key={step.id}
                onClick={() => isComplete && onGoToStep(step.id)}
                disabled={isDisabled}
                className={cn(
                  "flex-1 flex flex-col items-center gap-1 p-1.5 rounded-lg transition-all",
                  isComplete && "text-primary cursor-pointer hover:bg-primary/10",
                  isCurrent && "text-foreground bg-surface-elevated",
                  isDisabled && "text-muted-foreground/50 cursor-not-allowed"
                )}
              >
                <div className={cn(
                  "w-6 h-6 rounded-full flex items-center justify-center",
                  isComplete && "bg-primary/20",
                  isCurrent && "bg-primary text-primary-foreground",
                  isDisabled && "bg-muted/50"
                )}>
                  {isComplete ? (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  ) : (
                    <Icon className="w-3.5 h-3.5" />
                  )}
                </div>
                <span className="text-[10px] font-medium">{step.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Error state */}
      {workflow.status === 'error' && (
        <div className="p-3 bg-destructive/10 border-b border-destructive/20">
          <p className="text-sm text-destructive">{workflow.errorMessage}</p>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={onReset}
            className="mt-2"
          >
            Try Again
          </Button>
        </div>
      )}

      {/* Step Content */}
      <ScrollArea className="flex-1">
        {renderStepContent()}
      </ScrollArea>
    </div>
  );
}
