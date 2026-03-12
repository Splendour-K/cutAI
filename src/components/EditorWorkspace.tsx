import { useState, useCallback, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { ChatPanel } from './ChatPanel';
import { VideoPreview } from './VideoPreview';
import { EditorHeader } from './EditorHeader';
import { AnalyzingOverlay } from './AnalyzingOverlay';
import { EditHistory } from './EditHistory';
import { CaptionEditorPanel } from './CaptionEditorPanel';
import { AIEditorPanel } from './AIEditorPanel';
import { AutoEditorPanel } from './AutoEditorPanel';
import { useVideoChat } from '@/hooks/useVideoChat';
import { useVideoAnalysis } from '@/hooks/useVideoAnalysis';
import { useEnhancementWorkflow } from '@/hooks/useEnhancementWorkflow';
import { useAutoEditor } from '@/hooks/useAutoEditor';
import { useVideoUpload } from '@/hooks/useVideoUpload';
import type { VideoProject, AspectRatio, CaptionSettings } from '@/types/video';
import { PLATFORM_CONFIGS } from '@/types/video';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MessageSquare, History, Settings2, Brain, Loader2, Captions, Wand2, Sparkles, Film, ChevronDown } from 'lucide-react';
import { AnimationWorkflowPanel } from './AnimationWorkflowPanel';
import { useAnimationWorkflow } from '@/hooks/useAnimationWorkflow';
import { useBrandPresets } from '@/hooks/useBrandPresets';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface EditorWorkspaceProps {
  project: VideoProject;
  onBack: () => void;
}

export function EditorWorkspace({ project: initialProject, onBack }: EditorWorkspaceProps) {
  const [project, setProject] = useState<VideoProject>(initialProject);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [hasCheckedExisting, setHasCheckedExisting] = useState(false);
  const [activeTab, setActiveTab] = useState('chat');
  const [editedCaptions, setEditedCaptions] = useState<Record<number, string>>({});
  const [isEditingCaptions, setIsEditingCaptions] = useState(false);
  const [currentVideoTime, setCurrentVideoTime] = useState(0);
  const [isPreviewingEdits, setIsPreviewingEdits] = useState(false);
  const defaultCaptionSettings: CaptionSettings = {
    enabled: false,
    style: 'modern',
    animation: 'none',
    position: 'bottom',
    highlightKeywords: false,
    fontFamily: 'Inter',
    fontSize: 'medium',
    textColor: 'hsl(0, 0%, 100%)',
    brandColor: 'hsl(45, 100%, 55%)'
  };
  const [captionSettings, setCaptionSettings] = useState<CaptionSettings>(
    initialProject.captions || defaultCaptionSettings
  );
  
  const platformConfig = PLATFORM_CONFIGS[project.platform];
  const contentType = platformConfig.contentType;

  const { 
    isAnalyzing: isRunningAnalysis,
    isGeneratingCaptions,
    analysis, 
    analyzeVideo,
    generateCaptions,
    fetchAnalysis 
  } = useVideoAnalysis();

  const {
    messages,
    isProcessing,
    sendMessage,
  } = useVideoChat({
    platform: project.platform,
    contentType,
    analysisContext: analysis,
    videoUrl: project.videoUrl,
    videoTitle: project.title,
  });

  // Animation workflow
  const animationWorkflow = useAnimationWorkflow({
    projectId: project.id,
    videoFile: project.videoFile,
    videoUrl: project.videoUrl,
  });

  // Brand presets
  const brandPresets = useBrandPresets();

  // Enhancement workflow (AI Editor)
  const enhancementWorkflow = useEnhancementWorkflow({ projectId: project.id });

  // Auto Editor workflow
  const autoEditor = useAutoEditor({ projectId: project.id });

  // Auto-enable edit preview when EDL becomes available (both after autonomous completion and review mode)
  useEffect(() => {
    if (autoEditor.workflow.edl && (autoEditor.workflow.status === 'reviewing' || autoEditor.workflow.status === 'complete')) {
      setIsPreviewingEdits(true);
    }
  }, [autoEditor.workflow.edl, autoEditor.workflow.status]);

  // Video upload/delete
  const { deleteProject } = useVideoUpload();
  const [isDeleting, setIsDeleting] = useState(false);

  // Auto-save every 2 minutes (includes caption settings)
  const autoSaveRef = useRef<ReturnType<typeof setInterval>>();
  const captionSettingsRef = useRef(captionSettings);
  captionSettingsRef.current = captionSettings;
  useEffect(() => {
    if (project.id === 'demo') return;
    autoSaveRef.current = setInterval(async () => {
      try {
        await supabase
          .from('video_projects')
          .update({
            updated_at: new Date().toISOString(),
            status: 'in_progress',
            caption_settings: captionSettingsRef.current as any,
          })
          .eq('id', project.id);
      } catch {}
    }, 120_000);
    return () => clearInterval(autoSaveRef.current);
  }, [project.id]);

  // Load edit history on mount
  useEffect(() => {
    if (project.id === 'demo') return;
    supabase
      .from('edit_history')
      .select('*')
      .eq('project_id', project.id)
      .order('applied_at', { ascending: true })
      .then(({ data }) => {
        if (data && data.length > 0) {
          const edits = data.map((e) => ({
            id: e.id,
            type: e.edit_type as any,
            description: e.description,
            applied: true,
            timestamp: new Date(e.applied_at),
          }));
          setProject((prev) => ({ ...prev, edits }));
        }
      });
  }, [project.id]);

  const handleDelete = useCallback(async () => {
    setIsDeleting(true);
    try {
      const success = await deleteProject(project.id, project.videoUrl);
      if (success) {
        onBack();
      }
    } finally {
      setIsDeleting(false);
    }
  }, [project.id, project.videoUrl, deleteProject, onBack]);

  // Fetch existing analysis on mount, auto-generate captions if none exist
  useEffect(() => {
    if (project.id) {
      fetchAnalysis(project.id).then((existingAnalysis) => {
        const hasExistingTranscription = existingAnalysis?.transcription && 
          (existingAnalysis.transcription as any)?.segments?.length > 0;
        const isCompleted = existingAnalysis?.analysis_status === 'completed';
        
        if (hasExistingTranscription && isCompleted) {
          // Analysis already done — skip overlay and don't re-process
          setHasCheckedExisting(true);
          setIsAnalyzing(false);
        } else if (!hasExistingTranscription && project.videoUrl) {
          // No existing analysis — show overlay and generate
          setIsAnalyzing(true);
          setHasCheckedExisting(true);
          const skipPersistence = project.videoUrl.startsWith('blob:') ? true : false;
          generateCaptions(project.id, project.videoFile, project.videoUrl, skipPersistence);
        } else {
          setHasCheckedExisting(true);
          setIsAnalyzing(false);
        }
      });
    }
  }, [project.id, fetchAnalysis, generateCaptions, project.videoFile, project.videoUrl]);

  const handleAnalysisComplete = useCallback(() => {
    setIsAnalyzing(false);
    setProject((prev) => ({ ...prev, status: 'ready' }));
  }, []);

  const handleSendMessage = useCallback(async (content: string) => {
    setProject((prev) => ({ ...prev, status: 'processing' }));
    
    const editAction = await sendMessage(content);
    
    if (editAction) {
      const params = editAction.parameters;

      switch (editAction.type) {
        case 'cut': {
          // Ensure an EDL exists
          if (!autoEditor.workflow.edl && analysis?.transcription?.segments) {
            autoEditor.createEDLFromSegments(
              analysis.transcription.segments,
              project.duration || 60
            );
          }
          // Apply cuts from parameters
          const timestamps = params?.timestamps || (params?.startTime != null && params?.endTime != null
            ? [{ start: params.startTime, end: params.endTime }]
            : []);
          // Use setTimeout to let EDL creation settle in state
          setTimeout(() => {
            for (const ts of timestamps) {
              autoEditor.excludeTimeRange(ts.start, ts.end);
            }
            if (timestamps.length > 0) {
              setIsPreviewingEdits(true);
              toast.success(`Cut ${timestamps.length} section(s) from the video.`);
            }
          }, 50);
          break;
        }

        case 'trim': {
          if (!autoEditor.workflow.edl && analysis?.transcription?.segments) {
            autoEditor.createEDLFromSegments(
              analysis.transcription.segments,
              project.duration || 60
            );
          }
          const start = params?.startTime ?? 0;
          const end = params?.endTime ?? (project.duration || 60);
          // Exclude everything outside the trim range
          setTimeout(() => {
            if (start > 0) autoEditor.excludeTimeRange(0, start);
            if (end < (project.duration || 60)) autoEditor.excludeTimeRange(end, project.duration || 60);
            setIsPreviewingEdits(true);
            toast.success(`Trimmed to ${start.toFixed(1)}s – ${end.toFixed(1)}s`);
          }, 50);
          break;
        }

        case 'speed': {
          const speed = params?.speed ?? 1;
          setProject(prev => ({ ...prev, playbackRate: speed } as any));
          toast.success(`Playback speed set to ${speed}x`);
          break;
        }

        case 'caption': {
          setCaptionSettings(prev => ({
            ...prev,
            enabled: true,
            ...(params?.captionStyle && { style: params.captionStyle }),
            ...(params?.captionAnimation && { animation: params.captionAnimation }),
          }));
          setActiveTab('captions');
          
          const hasTranscript = analysis?.transcription && analysis.transcription.segments?.length > 0;
          if (!hasTranscript && project.id) {
            const skipPersistence = project.videoUrl?.startsWith('blob:') ?? false;
            generateCaptions(project.id, project.videoFile, project.videoUrl, skipPersistence);
          }
          
          toast.success('Captions enabled! Customize the style in the Captions tab.');
          break;
        }

        case 'effect': {
          if (!autoEditor.workflow.edl && analysis?.transcription?.segments) {
            autoEditor.createEDLFromSegments(
              analysis.transcription.segments,
              project.duration || 60
            );
          }
          const zoomStart = params?.startTime ?? 0;
          const zoomEnd = params?.endTime ?? Math.min(zoomStart + 3, project.duration || 60);
          const zoomType = params?.zoomType ?? 'slow-zoom-in';
          setTimeout(() => {
            autoEditor.addZoomEffect(zoomStart, zoomEnd, zoomType, params?.focalPoint);
            setIsPreviewingEdits(true);
            toast.success(`Added ${zoomType} effect at ${zoomStart.toFixed(1)}s`);
          }, 50);
          break;
        }

        case 'format': {
          if (params?.aspectRatio) {
            handleFormatChange(params.aspectRatio);
            toast.success(`Format changed to ${params.aspectRatio}`);
          }
          break;
        }

        default:
          break;
      }
      
      setProject((prev) => ({ 
        ...prev, 
        status: 'ready',
        edits: [...prev.edits, editAction]
      }));
    } else {
      setProject((prev) => ({ ...prev, status: 'ready' }));
    }
  }, [sendMessage, analysis, project.id, project.videoFile, project.videoUrl, project.duration, generateCaptions, autoEditor, handleFormatChange]);

  const handleRunAnalysis = useCallback(async () => {
    if (!project.id) return;
    
    try {
      await analyzeVideo(project.id, project.videoFile, project.videoUrl);
    } catch (error) {
      console.error('Analysis failed:', error);
    }
  }, [project.id, project.videoFile, project.videoUrl, analyzeVideo]);

  const handleGenerateCaptions = useCallback(async () => {
    if (!project.id) return;
    
    try {
      const skipPersistence = project.videoUrl?.startsWith('blob:') ?? false;
      await generateCaptions(project.id, project.videoFile, project.videoUrl, skipPersistence);
      setCaptionSettings(prev => ({ ...prev, enabled: true }));
      setActiveTab('captions');
      toast.success('Captions generated! Choose a style to customize.');
    } catch (error) {
      console.error('Caption generation failed:', error);
    }
  }, [project.id, project.videoFile, project.videoUrl, generateCaptions]);

  const handleExport = useCallback(() => {
    setProject((prev) => ({ ...prev, status: 'exporting' }));
    setTimeout(() => {
      setProject((prev) => ({ ...prev, status: 'ready' }));
    }, 3000);
  }, []);

  const handleFormatChange = useCallback((ratio: AspectRatio) => {
    setProject((prev) => ({ ...prev, aspectRatio: ratio }));
  }, []);

  const handleUndoEdit = useCallback((editId: string) => {
    setProject((prev) => ({
      ...prev,
      edits: prev.edits.map(e => 
        e.id === editId ? { ...e, applied: false } : e
      )
    }));
  }, []);

  const handleEditCaption = useCallback((index: number, text: string) => {
    setEditedCaptions(prev => ({ ...prev, [index]: text }));
  }, []);

  const handleSeek = useCallback((time: number) => {
    setCurrentVideoTime(time);
  }, []);

  const hasTranscription = analysis?.transcription && analysis.transcription.segments?.length > 0;

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {isAnalyzing && <AnalyzingOverlay onComplete={handleAnalysisComplete} />}

      <EditorHeader project={project} onBack={onBack} onExport={handleExport} onDelete={handleDelete} isDeleting={isDeleting} />

      <div className="flex-1 flex min-h-0">
        {/* Left Panel - Chat/Analysis */}
        <div className="w-[360px] border-r border-border flex-shrink-0 bg-surface/50 flex flex-col min-h-0">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
            <TabsList className="w-full justify-start px-3 pt-2 bg-transparent border-b border-border rounded-none h-auto gap-1 flex-shrink-0">
              <TabsTrigger value="chat" className="gap-1.5 text-xs px-3 py-1.5">
                <MessageSquare className="w-3.5 h-3.5" />
                Chat
              </TabsTrigger>
              <TabsTrigger value="captions" className="gap-1.5 text-xs px-3 py-1.5">
                <Captions className="w-3.5 h-3.5" />
                Captions
                {hasTranscription && (
                  <span className="ml-1 w-1.5 h-1.5 rounded-full bg-green-500" />
                )}
              </TabsTrigger>
              <TabsTrigger value="auto-edit" className="gap-1.5 text-xs px-3 py-1.5">
                <Film className="w-3.5 h-3.5" />
                Auto Edit
                {autoEditor.workflow.status === 'reviewing' && (
                  <span className="ml-1 w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                )}
              </TabsTrigger>

              {/* More tools dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className={cn(
                    "inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md font-medium transition-colors",
                    "text-muted-foreground hover:text-foreground hover:bg-muted/50",
                    ['analysis', 'history', 'animate', 'ai-editor', 'settings'].includes(activeTab) && "bg-muted text-foreground"
                  )}>
                    <Settings2 className="w-3.5 h-3.5" />
                    More
                    <ChevronDown className="w-3 h-3" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-44">
                  <DropdownMenuItem onClick={() => setActiveTab('analysis')} className="gap-2 text-xs">
                    <Brain className="w-3.5 h-3.5" /> Analysis
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setActiveTab('ai-editor')} className="gap-2 text-xs">
                    <Sparkles className="w-3.5 h-3.5" /> Enhance
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setActiveTab('animate')} className="gap-2 text-xs">
                    <Wand2 className="w-3.5 h-3.5" /> Animate
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setActiveTab('history')} className="gap-2 text-xs">
                    <History className="w-3.5 h-3.5" /> Edit History
                    {project.edits.length > 0 && (
                      <span className="ml-auto px-1 py-0.5 text-[10px] bg-primary/20 text-primary rounded">
                        {project.edits.filter(e => e.applied).length}
                      </span>
                    )}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setActiveTab('settings')} className="gap-2 text-xs">
                    <Settings2 className="w-3.5 h-3.5" /> Format
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </TabsList>
            
            <TabsContent value="chat" className="flex-1 m-0 min-h-0">
              <ChatPanel
                messages={messages}
                onSendMessage={handleSendMessage}
                isProcessing={isProcessing}
                platform={project.platform}
                isAnalyzingVideo={isGeneratingCaptions || isRunningAnalysis}
                hasAnalysis={!!analysis?.transcription}
              />
            </TabsContent>

            <TabsContent value="captions" className="flex-1 m-0 min-h-0">
              <CaptionEditorPanel
                settings={captionSettings}
                onSettingsChange={setCaptionSettings}
                segments={analysis?.transcription?.segments}
                currentTime={currentVideoTime}
                editedCaptions={editedCaptions}
                onEditCaption={handleEditCaption}
                onSeek={handleSeek}
                isEditMode={isEditingCaptions}
                onEditModeChange={setIsEditingCaptions}
              />
            </TabsContent>

            <TabsContent value="animate" className="flex-1 m-0 min-h-0">
              <AnimationWorkflowPanel
                workflow={animationWorkflow.workflow}
                onAnalyzeContext={animationWorkflow.analyzeContext}
                onGenerateStoryboard={animationWorkflow.generateStoryboard}
                onApproveElement={animationWorkflow.approveElement}
                onUnapproveElement={animationWorkflow.unapproveElement}
                onApproveAll={animationWorkflow.approveAllElements}
                onProceedToPreview={animationWorkflow.proceedToPreview}
                onApplyAnimations={animationWorkflow.applyAnimations}
                onReset={animationWorkflow.resetWorkflow}
                onGoToStep={animationWorkflow.goToStep}
                existingTranscript={analysis?.transcription ? {
                  fullText: analysis.transcription.fullText,
                  segments: analysis.transcription.segments
                } : undefined}
                brandPresets={brandPresets.presets}
                onCreatePreset={brandPresets.createPreset}
                onUpdatePreset={brandPresets.updatePreset}
                onDeletePreset={brandPresets.deletePreset}
                onSetDefaultPreset={brandPresets.setDefaultPreset}
                onDuplicatePreset={brandPresets.duplicatePreset}
              />
            </TabsContent>

            <TabsContent value="ai-editor" className="flex-1 m-0 min-h-0">
              <AIEditorPanel
                workflow={enhancementWorkflow.workflow}
                hasTranscript={hasTranscription}
                onAnalyze={enhancementWorkflow.analyzeForEnhancements}
                onApprove={enhancementWorkflow.approveEnhancement}
                onReject={enhancementWorkflow.rejectEnhancement}
                onApproveAll={enhancementWorkflow.approveAll}
                onGenerate={enhancementWorkflow.generateEnhancementContent}
                onGenerateAll={enhancementWorkflow.generateApproved}
                onRemove={enhancementWorkflow.removeEnhancement}
                onUpdatePosition={enhancementWorkflow.repositionEnhancement}
                onUpdateTiming={enhancementWorkflow.retimeEnhancement}
                onReset={enhancementWorkflow.resetWorkflow}
                transcript={analysis?.transcription ? {
                  fullText: analysis.transcription.fullText,
                  segments: analysis.transcription.segments
                } : undefined}
                videoDuration={project.duration || 60}
                currentTime={currentVideoTime}
                onSeek={handleSeek}
              />
            </TabsContent>

            <TabsContent value="auto-edit" className="flex-1 m-0 min-h-0">
              <AutoEditorPanel
                workflow={autoEditor.workflow}
                hasTranscript={hasTranscription}
                transcript={analysis?.transcription ? {
                  fullText: analysis.transcription.fullText,
                  segments: analysis.transcription.segments
                } : undefined}
                videoDuration={project.duration || 60}
                currentTime={currentVideoTime}
                platform={project.platform}
                onAnalyze={autoEditor.analyzeAndGenerateEDL}
                onToggleSegment={autoEditor.toggleSegmentInclusion}
                onUpdateSegmentCut={autoEditor.updateSegmentCut}
                onToggleBRoll={autoEditor.toggleBRoll}
                onSetBRollFootage={autoEditor.setBRollFootage}
                onApproveAllBRoll={autoEditor.approveAllBRoll}
                onToggleZoom={autoEditor.toggleZoom}
                onUpdateZoom={autoEditor.updateZoom}
                onEnableAllZooms={autoEditor.enableAllZooms}
                onNextStep={autoEditor.nextReviewStep}
                onPrevStep={autoEditor.prevReviewStep}
                onGoToStep={autoEditor.goToReviewStep}
                onApplyEdits={autoEditor.applyEdits}
                onReset={autoEditor.resetWorkflow}
                onEnterReviewMode={autoEditor.enterReviewMode}
                onSeek={handleSeek}
                stats={autoEditor.getStats()}
              />
            </TabsContent>

            <TabsContent value="analysis" className="flex-1 m-0 min-h-0 overflow-auto p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-foreground">AI Video Analysis</h3>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={handleRunAnalysis}
                  disabled={isRunningAnalysis}
                >
                  {isRunningAnalysis ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <Brain className="w-4 h-4 mr-2" />
                      Run Analysis
                    </>
                  )}
                </Button>
              </div>

              {!analysis && !isRunningAnalysis && (
                <div className="text-center py-8 text-muted-foreground">
                  <Brain className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">Run AI analysis to detect pauses, key moments, and get edit suggestions.</p>
                </div>
              )}

              {analysis?.status === 'processing' && (
                <div className="text-center py-8">
                  <Loader2 className="w-8 h-8 mx-auto mb-3 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">Analyzing video content...</p>
                </div>
              )}

              {analysis?.status === 'error' && (
                <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20">
                  <p className="text-sm text-destructive">{analysis.errorMessage || 'Analysis failed'}</p>
                </div>
              )}

              {analysis?.status === 'completed' && (
                <div className="space-y-4">
                  {analysis.transcription && (
                    <div className="p-4 rounded-xl bg-surface-elevated/50 border border-border/50">
                      <h4 className="text-sm font-medium text-foreground mb-2">Transcription</h4>
                      <p className="text-sm text-muted-foreground line-clamp-4">
                        {analysis.transcription.fullText || 'No transcription available'}
                      </p>
                    </div>
                  )}

                  {analysis.pauses && analysis.pauses.length > 0 && (
                    <div className="p-4 rounded-xl bg-surface-elevated/50 border border-border/50">
                      <h4 className="text-sm font-medium text-foreground mb-2">
                        Detected Pauses ({analysis.pauses.length})
                      </h4>
                      <div className="space-y-1 max-h-32 overflow-y-auto">
                        {analysis.pauses.slice(0, 5).map((pause, i) => (
                          <div key={i} className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">
                              {pause.type} at {pause.startTime.toFixed(1)}s
                            </span>
                            <span className="text-foreground">{pause.duration.toFixed(1)}s</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {analysis.keyMoments && analysis.keyMoments.length > 0 && (
                    <div className="p-4 rounded-xl bg-surface-elevated/50 border border-border/50">
                      <h4 className="text-sm font-medium text-foreground mb-2">
                        Key Moments ({analysis.keyMoments.length})
                      </h4>
                      <div className="space-y-2 max-h-40 overflow-y-auto">
                        {analysis.keyMoments.map((moment, i) => (
                          <div key={i} className="p-2 rounded-lg bg-surface/50">
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`px-1.5 py-0.5 text-xs rounded ${
                                moment.importance === 'high' 
                                  ? 'bg-primary/20 text-primary' 
                                  : moment.importance === 'medium'
                                    ? 'bg-yellow-500/20 text-yellow-600'
                                    : 'bg-muted text-muted-foreground'
                              }`}>
                                {moment.type}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {moment.timestamp.toFixed(1)}s
                              </span>
                            </div>
                            <p className="text-xs text-foreground">{moment.description}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="history" className="flex-1 m-0 min-h-0 overflow-auto">
              <EditHistory edits={project.edits} onUndo={handleUndoEdit} />
            </TabsContent>
            
            <TabsContent value="settings" className="flex-1 m-0 min-h-0 overflow-auto p-4 space-y-6">
              <div>
                <h3 className="text-sm font-medium text-foreground mb-3">Output Format</h3>
                <div className="grid grid-cols-2 gap-2">
                  {platformConfig.aspectRatios.map((ratio) => (
                    <button
                      key={ratio}
                      onClick={() => handleFormatChange(ratio as AspectRatio)}
                      className={`p-3 rounded-xl border transition-all ${
                        project.aspectRatio === ratio
                          ? 'bg-primary/10 border-primary text-foreground'
                          : 'bg-surface-elevated/50 border-border/50 text-muted-foreground hover:border-border'
                      }`}
                    >
                      <div className="text-lg font-medium">{ratio}</div>
                      <div className="text-xs mt-1">
                        {ratio === '16:9' && 'Horizontal'}
                        {ratio === '9:16' && 'Vertical'}
                        {ratio === '1:1' && 'Square'}
                        {ratio === '4:5' && 'Portrait'}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
              
              <div>
                <h3 className="text-sm font-medium text-foreground mb-3">Platform</h3>
                <div className="p-3 rounded-xl bg-surface-elevated/50 border border-border/50">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{platformConfig.icon}</span>
                    <div>
                      <div className="font-medium text-foreground">{platformConfig.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {platformConfig.contentType === 'long' ? 'Long-form' : 'Short-form'} • Max {platformConfig.maxDuration >= 3600 
                          ? `${Math.floor(platformConfig.maxDuration / 3600)}h` 
                          : `${Math.floor(platformConfig.maxDuration / 60)}min`}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* Video Preview - Sticky in center */}
        <div className="flex-1 flex items-center justify-center bg-background overflow-auto p-4">
          <VideoPreview 
            project={project} 
            onFormatChange={handleFormatChange}
            analysis={analysis}
            captionSettings={captionSettings}
            onCaptionSettingsChange={setCaptionSettings}
            onGenerateCaptions={handleGenerateCaptions}
            isGeneratingCaptions={isGeneratingCaptions}
            editedCaptions={editedCaptions}
            isEditingCaptions={isEditingCaptions}
            onTimeUpdate={setCurrentVideoTime}
            onEditCaption={handleEditCaption}
            edl={autoEditor.workflow.edl}
            isPreviewingEdits={isPreviewingEdits}
            onTogglePreviewEdits={() => setIsPreviewingEdits(!isPreviewingEdits)}
          />
        </div>
      </div>
    </div>
  );
}
