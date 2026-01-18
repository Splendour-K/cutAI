import { useState, useCallback, useEffect, useRef } from 'react';
import { ChatPanel } from './ChatPanel';
import { VideoPreview } from './VideoPreview';
import { EditorHeader } from './EditorHeader';
import { AnalyzingOverlay } from './AnalyzingOverlay';
import { EditHistory } from './EditHistory';
import { CaptionEditorPanel } from './CaptionEditorPanel';
import { AIEditorPanel } from './AIEditorPanel';
import { useVideoChat } from '@/hooks/useVideoChat';
import { useVideoAnalysis } from '@/hooks/useVideoAnalysis';
import { useEnhancementWorkflow } from '@/hooks/useEnhancementWorkflow';
import type { VideoProject, EditAction, AspectRatio, CaptionSettings } from '@/types/video';
import { PLATFORM_CONFIGS } from '@/types/video';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MessageSquare, History, Settings2, Brain, Loader2, Captions, Wand2, Sparkles } from 'lucide-react';
import { AnimationWorkflowPanel } from './AnimationWorkflowPanel';
import { useAnimationWorkflow } from '@/hooks/useAnimationWorkflow';
import { useBrandPresets } from '@/hooks/useBrandPresets';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface EditorWorkspaceProps {
  project: VideoProject;
  onBack: () => void;
}

export function EditorWorkspace({ project: initialProject, onBack }: EditorWorkspaceProps) {
  const [project, setProject] = useState<VideoProject>(initialProject);
  const [isAnalyzing, setIsAnalyzing] = useState(true);
  const [activeTab, setActiveTab] = useState('chat');
  const [editedCaptions, setEditedCaptions] = useState<Record<number, string>>({});
  const [isEditingCaptions, setIsEditingCaptions] = useState(false);
  const [currentVideoTime, setCurrentVideoTime] = useState(0);
  const [captionSettings, setCaptionSettings] = useState<CaptionSettings>({
    enabled: false,
    style: 'modern',
    animation: 'none',
    position: 'bottom',
    highlightKeywords: false,
    fontFamily: 'Inter',
    fontSize: 'medium',
    textColor: 'hsl(0, 0%, 100%)',
    brandColor: 'hsl(45, 100%, 55%)'
  });
  
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

  // Fetch existing analysis on mount
  useEffect(() => {
    if (project.id) {
      fetchAnalysis(project.id);
    }
  }, [project.id, fetchAnalysis]);

  const handleAnalysisComplete = useCallback(() => {
    setIsAnalyzing(false);
    setProject((prev) => ({ ...prev, status: 'ready' }));
  }, []);

  const handleSendMessage = useCallback(async (content: string) => {
    setProject((prev) => ({ ...prev, status: 'processing' }));
    
    const editAction = await sendMessage(content);
    
    if (editAction) {
      // Handle caption-related edits
      if (editAction.type === 'caption') {
        setCaptionSettings(prev => ({ ...prev, enabled: true }));
        setActiveTab('captions');
        
        // If no transcription exists, generate captions
        const hasTranscription = analysis?.transcription && analysis.transcription.segments?.length > 0;
        if (!hasTranscription && project.id) {
          const skipPersistence = project.videoUrl?.startsWith('blob:') ?? false;
          generateCaptions(project.id, project.videoFile, project.videoUrl, skipPersistence);
        }
        
        toast.success('Captions enabled! Customize the style in the Captions tab.');
      }
      
      setProject((prev) => ({ 
        ...prev, 
        status: 'ready',
        edits: [...prev.edits, editAction]
      }));
    } else {
      setProject((prev) => ({ ...prev, status: 'ready' }));
    }
  }, [sendMessage, analysis, project.id, project.videoFile, project.videoUrl, generateCaptions]);

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

      <EditorHeader project={project} onBack={onBack} onExport={handleExport} />

      <div className="flex-1 flex min-h-0">
        {/* Left Panel - Chat/Analysis */}
        <div className="w-[360px] border-r border-border flex-shrink-0 bg-surface/50 flex flex-col min-h-0">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
            <TabsList className="w-full justify-start px-3 pt-2 bg-transparent border-b border-border rounded-none h-auto flex-wrap gap-1 flex-shrink-0">
              <TabsTrigger value="chat" className="gap-1.5 text-xs px-2.5 py-1.5">
                <MessageSquare className="w-3.5 h-3.5" />
                Chat
              </TabsTrigger>
              <TabsTrigger value="captions" className="gap-1.5 text-xs px-2.5 py-1.5">
                <Captions className="w-3.5 h-3.5" />
                Captions
                {hasTranscription && (
                  <span className="ml-1 w-1.5 h-1.5 rounded-full bg-green-500" />
                )}
              </TabsTrigger>
              <TabsTrigger value="analysis" className="gap-1.5 text-xs px-2.5 py-1.5">
                <Brain className="w-3.5 h-3.5" />
                Analysis
              </TabsTrigger>
              <TabsTrigger value="history" className="gap-1.5 text-xs px-2.5 py-1.5">
                <History className="w-3.5 h-3.5" />
                Edits
                {project.edits.length > 0 && (
                  <span className="ml-1 px-1 py-0.5 text-[10px] bg-primary/20 text-primary rounded">
                    {project.edits.filter(e => e.applied).length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="animate" className="gap-1.5 text-xs px-2.5 py-1.5">
                <Wand2 className="w-3.5 h-3.5" />
                Animate
              </TabsTrigger>
              <TabsTrigger value="ai-editor" className="gap-1.5 text-xs px-2.5 py-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                AI Editor
              </TabsTrigger>
              <TabsTrigger value="settings" className="gap-1.5 text-xs px-2.5 py-1.5">
                <Settings2 className="w-3.5 h-3.5" />
                Format
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="chat" className="flex-1 m-0 min-h-0">
              <ChatPanel
                messages={messages}
                onSendMessage={handleSendMessage}
                isProcessing={isProcessing}
                platform={project.platform}
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
          />
        </div>
      </div>
    </div>
  );
}
