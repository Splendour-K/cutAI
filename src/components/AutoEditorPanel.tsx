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
  Pencil,
  TrendingUp,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { AutoEditorTimeline } from './AutoEditorTimeline';
import { AutoEditorCutsPanel } from './AutoEditorCutsPanel';
import { AutoEditorBRollPanel } from './AutoEditorBRollPanel';
import { AutoEditorZoomsPanel } from './AutoEditorZoomsPanel';
import { AutoEditorSettings } from './AutoEditorSettings';
import type { AutoEditorWorkflow, ARollSegment, BRollSuggestion, ZoomEffect, PacingAnalysis } from '@/types/autoEditor';
import type { TranscriptSegment } from '@/hooks/useVideoAnalysis';

interface AutoEditorPanelProps {
  workflow: AutoEditorWorkflow;
  hasTranscript: boolean;
  videoDuration: number;
  currentTime: number;
  platform?: string;
  onSeek?: (time: number) => void;
  
  onAnalyze: (
    transcript: { fullText: string; segments: TranscriptSegment[] },
    videoDuration: number,
    options?: any
  ) => Promise<any>;
  transcript?: { fullText: string; segments: TranscriptSegment[] };
  
  onToggleSegment: (id: string) => void;
  onUpdateSegmentCut: (id: string, cutType: ARollSegment['cutType'], transitionDuration?: number) => void;
  onToggleBRoll: (id: string) => void;
  onSetBRollFootage?: (id: string, url: string, attribution?: string) => void;
  onApproveAllBRoll: () => void;
  onToggleZoom: (id: string) => void;
  onUpdateZoom: (id: string, updates: Partial<ZoomEffect>) => void;
  onEnableAllZooms: () => void;
  onNextStep: () => void;
  onPrevStep: () => void;
  onGoToStep: (step: AutoEditorWorkflow['reviewStep']) => void;
  onApplyEdits: () => void;
  onReset: () => void;
  onEnterReviewMode?: () => void;
  stats: any;
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
  platform = 'youtube',
  onSeek,
  onAnalyze,
  transcript,
  onToggleSegment,
  onUpdateSegmentCut,
  onToggleBRoll,
  onSetBRollFootage,
  onApproveAllBRoll,
  onToggleZoom,
  onUpdateZoom,
  onEnableAllZooms,
  onNextStep,
  onPrevStep,
  onGoToStep,
  onApplyEdits,
  onReset,
  onEnterReviewMode,
  stats,
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
    platform,
    preferences: {
      enableZooms: true,
      enableBRoll: true,
      cutFrequency: 'moderate',
    },
  });

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

  const formatTime = (time: number) => {
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // === IDLE STATE ===
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
                One click. Fully edited video. The AI handles everything automatically.
              </p>
            </div>

            <div className="space-y-3 mb-6">
              {[
                { icon: Scissors, title: 'Smart Cuts', desc: 'Removes dead air, fillers, and repetition' },
                { icon: Film, title: 'B-Roll', desc: 'Automatically inserts relevant visuals' },
                { icon: ZoomIn, title: 'Dynamic Zooms', desc: 'Adds emphasis and engagement' },
                { icon: TrendingDown, title: 'Pacing', desc: 'Optimizes rhythm and flow' },
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

            <button
              onClick={() => setShowSettings(!showSettings)}
              className="w-full flex items-center justify-between p-3 rounded-xl bg-muted/50 hover:bg-muted/80 transition-colors mb-4"
            >
              <div className="flex items-center gap-2">
                <Settings2 className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-foreground">Advanced Settings</span>
              </div>
              <ChevronRight className={cn(
                "w-4 h-4 text-muted-foreground transition-transform",
                showSettings && "rotate-90"
              )} />
            </button>

            {showSettings && (
              <AutoEditorSettings
                options={editingOptions}
                onChange={setEditingOptions}
              />
            )}

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
                    Auto-Editing...
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

  // === ANALYZING STATE ===
  if (workflow.status === 'analyzing') {
    return (
      <div className="h-full flex items-center justify-center p-6">
        <div className="text-center max-w-xs">
          <Loader2 className="w-12 h-12 mx-auto mb-4 animate-spin text-primary" />
          <h3 className="text-lg font-semibold text-foreground mb-2">Auto-Editing Your Video</h3>
          <p className="text-sm text-muted-foreground mb-4">
            The AI is making all editing decisions automatically...
          </p>
          <Progress value={workflow.progress} className="w-48 mx-auto mb-3" />
          <div className="space-y-1 text-xs text-muted-foreground">
            {workflow.progress >= 10 && <p className="flex items-center gap-2 justify-center"><Check className="w-3 h-3 text-green-500" /> Analyzing content</p>}
            {workflow.progress >= 40 && <p className="flex items-center gap-2 justify-center"><Check className="w-3 h-3 text-green-500" /> Creating cuts</p>}
            {workflow.progress >= 60 && <p className="flex items-center gap-2 justify-center"><Check className="w-3 h-3 text-green-500" /> Adding B-roll & zooms</p>}
            {workflow.progress >= 80 && <p className="flex items-center gap-2 justify-center"><Check className="w-3 h-3 text-green-500" /> Finalizing edit</p>}
          </div>
        </div>
      </div>
    );
  }

  // === ERROR STATE ===
  if (workflow.status === 'error') {
    return (
      <div className="h-full flex items-center justify-center p-6">
        <div className="text-center">
          <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-destructive/10 flex items-center justify-center">
            <span className="text-2xl">❌</span>
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-2">Auto-Edit Failed</h3>
          <p className="text-sm text-destructive mb-4">{workflow.errorMessage}</p>
          <Button onClick={onReset} variant="outline">
            <RotateCcw className="w-4 h-4 mr-2" />
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  // === COMPLETE STATE (Post-edit summary) ===
  if (workflow.status === 'complete' && workflow.reviewStep === 'complete') {
    return (
      <div className="h-full flex flex-col">
        <div className="p-3 border-b border-border bg-surface/50 flex-shrink-0">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-green-600 flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5" /> Auto-Edit Complete
            </span>
            <Button variant="ghost" size="sm" onClick={onReset} className="h-6 px-2 text-xs">
              <RotateCcw className="w-3 h-3 mr-1" /> Start Over
            </Button>
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-4 space-y-4">
            {/* Success banner */}
            <div className="p-4 rounded-xl bg-gradient-to-br from-green-500/10 to-emerald-500/10 border border-green-500/20 text-center">
              <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-green-500/20 flex items-center justify-center">
                <Check className="w-6 h-6 text-green-500" />
              </div>
              <h3 className="text-base font-semibold text-foreground mb-1">Your video has been edited!</h3>
              <p className="text-sm text-muted-foreground">
                The AI made all editing decisions automatically. Here's what changed:
              </p>
            </div>

            {/* Stats grid */}
            {stats && (
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-surface-elevated/50 border border-border/50">
                  <div className="flex items-center gap-2 mb-1">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Duration</span>
                  </div>
                  <p className="text-lg font-semibold text-foreground">
                    {formatTime(stats.originalDuration)} → {formatTime(stats.editedDuration)}
                  </p>
                  <span className="text-xs text-green-600">-{stats.reductionPercent}%</span>
                </div>

                <div className="p-3 rounded-lg bg-surface-elevated/50 border border-border/50">
                  <div className="flex items-center gap-2 mb-1">
                    <Scissors className="w-4 h-4 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Clips</span>
                  </div>
                  <p className="text-lg font-semibold text-foreground">{stats.includedSegments}</p>
                  <span className="text-xs text-muted-foreground">{stats.removedSections} sections removed</span>
                </div>

                <div className="p-3 rounded-lg bg-surface-elevated/50 border border-border/50">
                  <div className="flex items-center gap-2 mb-1">
                    <Film className="w-4 h-4 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">B-Roll</span>
                  </div>
                  <p className="text-lg font-semibold text-foreground">{stats.approvedBRoll}</p>
                  <span className="text-xs text-muted-foreground">clips added</span>
                </div>

                <div className="p-3 rounded-lg bg-surface-elevated/50 border border-border/50">
                  <div className="flex items-center gap-2 mb-1">
                    <ZoomIn className="w-4 h-4 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Zooms</span>
                  </div>
                  <p className="text-lg font-semibold text-foreground">{stats.enabledZooms}</p>
                  <span className="text-xs text-muted-foreground">effects applied</span>
                </div>
              </div>
            )}

            {/* Timeline Preview */}
            {workflow.edl && (
              <div className="p-4 rounded-xl bg-surface-elevated/50 border border-border/50">
                <h4 className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wide">
                  Timeline Preview
                </h4>
                <AutoEditorTimeline
                  segments={workflow.edl.aRollSegments}
                  bRoll={workflow.edl.bRollSuggestions}
                  zooms={workflow.edl.zoomEffects}
                  duration={workflow.edl.originalDuration}
                  editedDuration={workflow.edl.editedDuration}
                  currentTime={0}
                />
              </div>
            )}

            {/* Pacing */}
            {stats?.pacing && (
              <div className="p-4 rounded-xl bg-surface-elevated/50 border border-border/50">
                <div className="flex items-center gap-2 mb-3">
                  <TrendingUp className="w-4 h-4 text-primary" />
                  <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Pacing</h4>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2 rounded-lg bg-muted/30">
                    <p className="text-[10px] text-muted-foreground">Avg Segment</p>
                    <p className="text-sm font-medium text-foreground">{stats.pacing.averageSegmentDuration?.toFixed(1) || '--'}s</p>
                  </div>
                  <div className="p-2 rounded-lg bg-muted/30">
                    <p className="text-[10px] text-muted-foreground">Energy</p>
                    <p className="text-sm font-medium text-foreground capitalize">{stats.pacing.energyLevel || '--'}</p>
                  </div>
                </div>
              </div>
            )}

            {/* AI Notes */}
            {stats?.editingNotes && stats.editingNotes.length > 0 && (
              <div className="p-4 rounded-xl bg-surface-elevated/50 border border-border/50">
                <div className="flex items-center gap-2 mb-3">
                  <AlertCircle className="w-4 h-4 text-amber-500" />
                  <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">AI Notes</h4>
                </div>
                <ul className="space-y-1">
                  {stats.editingNotes.map((note: string, i: number) => (
                    <li key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                      <span className="text-amber-500">•</span>{note}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Adjust button */}
            {onEnterReviewMode && (
              <Button
                variant="outline"
                className="w-full gap-2"
                onClick={onEnterReviewMode}
              >
                <Pencil className="w-4 h-4" />
                Adjust AI Edits
              </Button>
            )}
          </div>
        </ScrollArea>
      </div>
    );
  }

  // === REVIEW MODE (manual adjustments) ===
  return (
    <div className="h-full flex flex-col">
      <div className="p-3 border-b border-border bg-surface/50 flex-shrink-0">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-muted-foreground">Adjusting AI Edits</span>
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" onClick={() => {
              updateWorkflow({ status: 'complete', reviewStep: 'complete' });
            }} className="h-6 px-2 text-xs">
              Done
            </Button>
            <Button variant="ghost" size="sm" onClick={onReset} className="h-6 px-2 text-xs">
              <RotateCcw className="w-3 h-3 mr-1" /> Reset
            </Button>
          </div>
        </div>
        
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
          </div>
        )}
      </div>

      {/* Step Navigation */}
      <div className="flex items-center gap-1 p-2 border-b border-border bg-surface/30 overflow-x-auto flex-shrink-0">
        {REVIEW_STEPS.filter(s => s.id !== 'complete').map((step, index) => {
          const isActive = step.id === workflow.reviewStep;
          return (
            <button
              key={step.id}
              onClick={() => onGoToStep(step.id as any)}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap",
                isActive && "bg-primary text-primary-foreground",
                !isActive && "bg-muted/50 text-muted-foreground hover:bg-muted"
              )}
            >
              <step.icon className="w-3.5 h-3.5" />
              {step.label}
            </button>
          );
        })}
      </div>

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
            onSetFootage={onSetBRollFootage}
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
        {workflow.reviewStep === 'preview' && workflow.edl && stats && (
          <div className="p-4 text-center">
            <p className="text-sm text-muted-foreground mb-4">Preview your adjusted edits in the video player.</p>
            <Button onClick={onApplyEdits} className="gap-2">
              <Check className="w-4 h-4" /> Apply Changes
            </Button>
          </div>
        )}
      </ScrollArea>

      {/* Navigation Footer */}
      {workflow.reviewStep !== 'preview' && (
        <div className="p-3 border-t border-border bg-surface/50 flex items-center justify-between flex-shrink-0">
          <Button variant="ghost" size="sm" onClick={onPrevStep} disabled={currentStepIndex === 0}>
            <ChevronLeft className="w-4 h-4 mr-1" /> Back
          </Button>
          <Button size="sm" onClick={onNextStep}>
            Next <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      )}
    </div>
  );
}
