import { useState } from 'react';
import {
  Scissors,
  Film,
  ZoomIn,
  Play,
  Check,
  Loader2,
  Wand2,
  ChevronRight,
  ChevronLeft,
  RotateCcw,
  Clock,
  TrendingDown,
  Sparkles,
  Settings2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { AutoEditorTimeline } from './AutoEditorTimeline';
import { AutoEditorCutsPanel } from './AutoEditorCutsPanel';
import { AutoEditorBRollPanel } from './AutoEditorBRollPanel';
import { AutoEditorZoomsPanel } from './AutoEditorZoomsPanel';
import { AutoEditorPreview } from './AutoEditorPreview';
import { AutoEditorSettings } from './AutoEditorSettings';
import type { AutoEditorWorkflow, ARollSegment, BRollSuggestion, ZoomEffect } from '@/types/autoEditor';
import type { TranscriptSegment } from '@/hooks/useVideoAnalysis';
import { EDITING_STYLE_PRESETS } from '@/types/autoEditor';

interface AutoEditorPanelProps {
  workflow: AutoEditorWorkflow;
  hasTranscript: boolean;
  videoDuration: number;
  currentTime: number;
  onSeek?: (time: number) => void;
  
  // Analysis
  onAnalyze: (
    transcript: { fullText: string; segments: TranscriptSegment[] },
    videoDuration: number,
    options?: any
  ) => Promise<any>;
  transcript?: { fullText: string; segments: TranscriptSegment[] };
  
  // Segment controls
  onToggleSegment: (id: string) => void;
  onUpdateSegmentCut: (id: string, cutType: ARollSegment['cutType'], transitionDuration?: number) => void;
  
  // B-roll controls
  onToggleBRoll: (id: string) => void;
  onApproveAllBRoll: () => void;
  
  // Zoom controls
  onToggleZoom: (id: string) => void;
  onUpdateZoom: (id: string, updates: Partial<ZoomEffect>) => void;
  onEnableAllZooms: () => void;
  
  // Navigation
  onNextStep: () => void;
  onPrevStep: () => void;
  onGoToStep: (step: AutoEditorWorkflow['reviewStep']) => void;
  
  // Actions
  onApply: () => void;
  onReset: () => void;
  getStats: () => any;
}

const REVIEW_STEPS = [
  { id: 'cuts', label: 'Cuts', icon: Scissors, description: 'Review A-roll segments' },
  { id: 'broll', label: 'B-Roll', icon: Film, description: 'Approve B-roll suggestions' },
  { id: 'zooms', label: 'Zooms', icon: ZoomIn, description: 'Configure zoom effects' },
  { id: 'preview', label: 'Preview', icon: Play, description: 'Preview final edit' },
  { id: 'complete', label: 'Done', icon: Check, description: 'Export ready' },
] as const;

export function AutoEditorPanel({
  workflow,
  hasTranscript,
  videoDuration,
  currentTime,
  onSeek,
  onAnalyze,
  transcript,
  onToggleSegment,
  onUpdateSegmentCut,
  onToggleBRoll,
  onApproveAllBRoll,
  onToggleZoom,
  onUpdateZoom,
  onEnableAllZooms,
  onNextStep,
  onPrevStep,
  onGoToStep,
  onApply,
  onReset,
  getStats,
}: AutoEditorPanelProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [editingOptions, setEditingOptions] = useState<{
    targetStyle: 'fast-paced' | 'moderate' | 'documentary' | 'auto';
    targetDurationReduction: number;
    platform: string;
    preferences: {
      enableZooms: boolean;
      enableBRoll: boolean;
      cutFrequency: 'minimal' | 'moderate' | 'aggressive';
    };
  }>({
    targetStyle: 'auto',
    targetDurationReduction: 20,
    platform: 'youtube',
    preferences: {
      enableZooms: true,
      enableBRoll: true,
      cutFrequency: 'moderate',
    },
  });

  const stats = getStats();
  const currentStepIndex = REVIEW_STEPS.findIndex(s => s.id === workflow.reviewStep);

  const handleStartAnalysis = async () => {
    if (!transcript) return;
    
    setIsAnalyzing(true);
    try {
      await onAnalyze(transcript, videoDuration, editingOptions);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Idle state - prompt to analyze
  if (workflow.status === 'idle') {
    return (
      <div className="h-full flex flex-col">
        <ScrollArea className="flex-1">
          <div className="p-6">
            <div className="text-center max-w-sm mx-auto mb-6">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center">
                <Wand2 className="w-8 h-8 text-blue-500" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">
                AI Auto-Editor
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                Transform your raw footage into professional content. The AI will automatically:
              </p>
            </div>

            {/* Features */}
            <div className="space-y-3 mb-6">
              {[
                { icon: Scissors, title: 'Smart Cuts', desc: 'Segment into 5-6s cuts, remove dead air' },
                { icon: Film, title: 'B-Roll Suggestions', desc: 'AI picks relevant supporting footage' },
                { icon: ZoomIn, title: 'Dynamic Zooms', desc: 'Add engagement through motion' },
                { icon: TrendingDown, title: 'Pacing Analysis', desc: 'Optimize video rhythm and flow' },
              ].map(feature => (
                <div key={feature.title} className="flex items-start gap-3 p-3 rounded-xl bg-surface-elevated/50 border border-border/50">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <feature.icon className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{feature.title}</p>
                    <p className="text-xs text-muted-foreground">{feature.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Settings Toggle */}
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="w-full flex items-center justify-between p-3 rounded-xl bg-muted/50 hover:bg-muted/80 transition-colors mb-4"
            >
              <div className="flex items-center gap-2">
                <Settings2 className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-foreground">Editing Settings</span>
              </div>
              <ChevronRight className={cn(
                "w-4 h-4 text-muted-foreground transition-transform",
                showSettings && "rotate-90"
              )} />
            </button>

            {/* Settings Panel */}
            {showSettings && (
              <AutoEditorSettings
                options={editingOptions}
                onChange={setEditingOptions}
              />
            )}

            {/* Action Button */}
            {!hasTranscript ? (
              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
                <p className="text-sm text-amber-600 dark:text-amber-400">
                  Generate captions first. The AI needs to understand your video's content.
                </p>
              </div>
            ) : (
              <Button 
                onClick={handleStartAnalysis}
                disabled={isAnalyzing}
                size="lg"
                className="w-full gap-2"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Analyzing Video...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Auto-Edit Video
                  </>
                )}
              </Button>
            )}
          </div>
        </ScrollArea>
      </div>
    );
  }

  // Analyzing state
  if (workflow.status === 'analyzing') {
    return (
      <div className="h-full flex items-center justify-center p-6">
        <div className="text-center">
          <Loader2 className="w-12 h-12 mx-auto mb-4 animate-spin text-primary" />
          <h3 className="text-lg font-semibold text-foreground mb-2">Analyzing Video</h3>
          <p className="text-sm text-muted-foreground mb-4">
            AI is creating your edit decision list...
          </p>
          <Progress value={workflow.progress} className="w-48 mx-auto" />
        </div>
      </div>
    );
  }

  // Error state
  if (workflow.status === 'error') {
    return (
      <div className="h-full flex items-center justify-center p-6">
        <div className="text-center">
          <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-destructive/10 flex items-center justify-center">
            <span className="text-2xl">❌</span>
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-2">Analysis Failed</h3>
          <p className="text-sm text-destructive mb-4">{workflow.errorMessage}</p>
          <Button onClick={onReset} variant="outline">
            <RotateCcw className="w-4 h-4 mr-2" />
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  // Review / Applying / Complete states
  return (
    <div className="h-full flex flex-col">
      {/* Header with Stats */}
      <div className="p-3 border-b border-border bg-surface/50 flex-shrink-0">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-muted-foreground">AI Auto-Editor</span>
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
        
        {/* Stats Bar */}
        {stats && (
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-muted-foreground">
                {stats.originalDuration.toFixed(0)}s → {stats.editedDuration.toFixed(0)}s
              </span>
              <span className="px-1.5 py-0.5 rounded bg-green-500/20 text-green-600 text-[10px] font-medium">
                -{stats.reductionPercent}%
              </span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground">{stats.includedSegments}/{stats.totalSegments} clips</span>
            </div>
          </div>
        )}
      </div>

      {/* Step Navigation */}
      <div className="flex items-center gap-1 p-2 border-b border-border bg-surface/30 overflow-x-auto flex-shrink-0">
        {REVIEW_STEPS.map((step, index) => {
          const isActive = step.id === workflow.reviewStep;
          const isCompleted = index < currentStepIndex;
          const isAccessible = index <= currentStepIndex + 1;

          return (
            <button
              key={step.id}
              onClick={() => isAccessible && onGoToStep(step.id as any)}
              disabled={!isAccessible}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap",
                isActive && "bg-primary text-primary-foreground",
                isCompleted && !isActive && "bg-green-500/20 text-green-600",
                !isActive && !isCompleted && isAccessible && "bg-muted/50 text-muted-foreground hover:bg-muted",
                !isAccessible && "opacity-40 cursor-not-allowed"
              )}
            >
              <step.icon className="w-3.5 h-3.5" />
              {step.label}
              {isCompleted && !isActive && <Check className="w-3 h-3" />}
            </button>
          );
        })}
      </div>

      {/* Main Content Area */}
      <ScrollArea className="flex-1">
        {workflow.reviewStep === 'cuts' && workflow.edl && (
          <AutoEditorCutsPanel
            segments={workflow.edl.aRollSegments}
            removedSections={workflow.edl.removedSections}
            onToggleSegment={onToggleSegment}
            onUpdateCut={onUpdateSegmentCut}
            onSeek={onSeek}
            currentTime={currentTime}
          />
        )}

        {workflow.reviewStep === 'broll' && workflow.edl && (
          <AutoEditorBRollPanel
            suggestions={workflow.edl.bRollSuggestions}
            onToggle={onToggleBRoll}
            onApproveAll={onApproveAllBRoll}
            onSeek={onSeek}
          />
        )}

        {workflow.reviewStep === 'zooms' && workflow.edl && (
          <AutoEditorZoomsPanel
            zooms={workflow.edl.zoomEffects}
            onToggle={onToggleZoom}
            onUpdate={onUpdateZoom}
            onEnableAll={onEnableAllZooms}
            onSeek={onSeek}
          />
        )}

        {workflow.reviewStep === 'preview' && workflow.edl && (
          <AutoEditorPreview
            edl={workflow.edl}
            stats={stats}
          />
        )}

        {workflow.reviewStep === 'complete' && (
          <div className="p-6 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-500/20 flex items-center justify-center">
              <Check className="w-8 h-8 text-green-500" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">Edits Applied!</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Your video has been professionally edited by AI.
            </p>
            {stats && (
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-muted/50 text-sm">
                <Clock className="w-4 h-4" />
                <span>{stats.originalDuration.toFixed(0)}s → {stats.editedDuration.toFixed(0)}s</span>
                <span className="text-green-600">(-{stats.reductionPercent}%)</span>
              </div>
            )}
          </div>
        )}
      </ScrollArea>

      {/* Navigation Footer */}
      {workflow.reviewStep !== 'complete' && (
        <div className="p-3 border-t border-border bg-surface/50 flex items-center justify-between flex-shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={onPrevStep}
            disabled={currentStepIndex === 0}
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Back
          </Button>

          {workflow.reviewStep === 'preview' ? (
            <Button
              size="sm"
              onClick={onApply}
              disabled={workflow.status === 'applying'}
              className="gap-2"
            >
              {workflow.status === 'applying' ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Applying...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  Apply Edits
                </>
              )}
            </Button>
          ) : (
            <Button size="sm" onClick={onNextStep}>
              Next
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
