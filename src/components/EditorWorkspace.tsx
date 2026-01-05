import { useState, useCallback, useEffect } from 'react';
import { ChatPanel } from './ChatPanel';
import { VideoPreview } from './VideoPreview';
import { EditorHeader } from './EditorHeader';
import { AnalyzingOverlay } from './AnalyzingOverlay';
import { EditHistory } from './EditHistory';
import { useVideoChat } from '@/hooks/useVideoChat';
import { useVideoAnalysis } from '@/hooks/useVideoAnalysis';
import type { VideoProject, EditAction, AspectRatio } from '@/types/video';
import { PLATFORM_CONFIGS } from '@/types/video';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MessageSquare, History, Settings2, Brain, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface EditorWorkspaceProps {
  project: VideoProject;
  onBack: () => void;
}

export function EditorWorkspace({ project: initialProject, onBack }: EditorWorkspaceProps) {
  const [project, setProject] = useState<VideoProject>(initialProject);
  const [isAnalyzing, setIsAnalyzing] = useState(true);
  const [activeTab, setActiveTab] = useState('chat');

  const platformConfig = PLATFORM_CONFIGS[project.platform];
  const contentType = platformConfig.contentType;

  const { 
    isAnalyzing: isRunningAnalysis, 
    analysis, 
    analyzeVideo,
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
      setProject((prev) => ({ 
        ...prev, 
        status: 'ready',
        edits: [...prev.edits, editAction]
      }));
    } else {
      setProject((prev) => ({ ...prev, status: 'ready' }));
    }
  }, [sendMessage]);

  const handleRunAnalysis = useCallback(async () => {
    if (!project.id) return;
    
    try {
      // For demo, we'll use a sample video URL
      // In production, this would use the actual uploaded video
      await analyzeVideo(project.id, undefined, project.videoUrl);
    } catch (error) {
      console.error('Analysis failed:', error);
    }
  }, [project.id, project.videoUrl, analyzeVideo]);

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

  return (
    <div className="h-screen flex flex-col bg-background">
      {isAnalyzing && <AnalyzingOverlay onComplete={handleAnalysisComplete} />}

      <EditorHeader project={project} onBack={onBack} onExport={handleExport} />

      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel */}
        <div className="w-[400px] border-r border-border flex-shrink-0 bg-surface/50 flex flex-col">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
            <TabsList className="w-full justify-start px-4 pt-2 bg-transparent border-b border-border rounded-none">
              <TabsTrigger value="chat" className="gap-2">
                <MessageSquare className="w-4 h-4" />
                Chat
              </TabsTrigger>
              <TabsTrigger value="analysis" className="gap-2">
                <Brain className="w-4 h-4" />
                Analysis
                {analysis?.status === 'completed' && (
                  <span className="ml-1 w-2 h-2 rounded-full bg-green-500" />
                )}
              </TabsTrigger>
              <TabsTrigger value="history" className="gap-2">
                <History className="w-4 h-4" />
                Edits
                {project.edits.length > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 text-xs bg-primary/20 text-primary rounded-full">
                    {project.edits.filter(e => e.applied).length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="settings" className="gap-2">
                <Settings2 className="w-4 h-4" />
                Format
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="chat" className="flex-1 m-0 overflow-hidden">
              <ChatPanel
                messages={messages}
                onSendMessage={handleSendMessage}
                isProcessing={isProcessing}
                platform={project.platform}
              />
            </TabsContent>

            <TabsContent value="analysis" className="flex-1 m-0 overflow-auto p-4 space-y-4">
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
                  {/* Transcription */}
                  {analysis.transcription && (
                    <div className="p-4 rounded-xl bg-surface-elevated/50 border border-border/50">
                      <h4 className="text-sm font-medium text-foreground mb-2">Transcription</h4>
                      <p className="text-sm text-muted-foreground line-clamp-4">
                        {analysis.transcription.fullText || 'No transcription available'}
                      </p>
                      {analysis.transcription.language && (
                        <p className="text-xs text-muted-foreground mt-2">
                          Language: {analysis.transcription.language}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Pauses */}
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
                        {analysis.pauses.length > 5 && (
                          <p className="text-xs text-muted-foreground">
                            +{analysis.pauses.length - 5} more pauses
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Key Moments */}
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

                  {/* Suggested Edits */}
                  {analysis.suggestedEdits && analysis.suggestedEdits.length > 0 && (
                    <div className="p-4 rounded-xl bg-surface-elevated/50 border border-border/50">
                      <h4 className="text-sm font-medium text-foreground mb-2">
                        Suggested Edits ({analysis.suggestedEdits.length})
                      </h4>
                      <div className="space-y-2 max-h-40 overflow-y-auto">
                        {analysis.suggestedEdits.map((edit, i) => (
                          <div key={i} className="p-2 rounded-lg bg-surface/50">
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`px-1.5 py-0.5 text-xs rounded ${
                                edit.priority === 'high' 
                                  ? 'bg-destructive/20 text-destructive' 
                                  : edit.priority === 'medium'
                                    ? 'bg-yellow-500/20 text-yellow-600'
                                    : 'bg-muted text-muted-foreground'
                              }`}>
                                {edit.type}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {edit.startTime.toFixed(1)}s
                              </span>
                            </div>
                            <p className="text-xs text-foreground">{edit.description}</p>
                            <p className="text-xs text-muted-foreground mt-1">{edit.reason}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="history" className="flex-1 m-0 overflow-auto">
              <EditHistory edits={project.edits} onUndo={handleUndoEdit} />
            </TabsContent>
            
            <TabsContent value="settings" className="flex-1 m-0 p-4 space-y-6">
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

        {/* Video Preview */}
        <div className="flex-1 bg-background">
          <VideoPreview 
            project={project} 
            onFormatChange={handleFormatChange}
            analysis={analysis}
          />
        </div>
      </div>
    </div>
  );
}
