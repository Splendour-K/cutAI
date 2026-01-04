import { useState, useCallback } from 'react';
import { ChatPanel } from './ChatPanel';
import { VideoPreview } from './VideoPreview';
import { EditorHeader } from './EditorHeader';
import { AnalyzingOverlay } from './AnalyzingOverlay';
import { EditHistory } from './EditHistory';
import type { VideoProject, ChatMessage, EditAction, AspectRatio } from '@/types/video';
import { PLATFORM_CONFIGS } from '@/types/video';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MessageSquare, History, Settings2 } from 'lucide-react';

interface EditorWorkspaceProps {
  project: VideoProject;
  onBack: () => void;
}

const aiResponses: Record<string, { message: string; editType: EditAction['type'] }> = {
  'remove': {
    message: "I've removed all long pauses and silences from your video. The pacing is now much tighter — total runtime reduced by 23 seconds.",
    editType: 'cut'
  },
  'pause': {
    message: "I've removed all long pauses and silences from your video. The pacing is now much tighter — total runtime reduced by 23 seconds.",
    editType: 'cut'
  },
  'caption': {
    message: "I've added modern captions synced to your speech. Key phrases are highlighted with a subtle glow effect. The style uses a clean sans-serif font with a semi-transparent background.",
    editType: 'caption'
  },
  'filler': {
    message: "I've detected and removed 12 filler words (um, uh, like, you know). The audio transitions are smooth — you won't notice the cuts.",
    editType: 'cut'
  },
  'viral': {
    message: "I've optimized your video for maximum engagement:\n\n• Added punchy intro hook (first 2 sec)\n• Quick jump cuts between key points\n• Modern captions with emphasis\n• Tightened pacing by 40%\n\nYour video is now ready to go viral! 🚀",
    editType: 'effect'
  },
  'music': {
    message: "I've added a subtle lo-fi background track that complements your voice. The music ducks automatically when you speak and rises during pauses.",
    editType: 'music'
  },
  'vertical': {
    message: "I've reframed your video for vertical (9:16) format. The AI tracked your face to keep you centered throughout. Safe zones for platform UI are preserved.",
    editType: 'format'
  },
  'horizontal': {
    message: "I've reframed your video for horizontal (16:9) format, perfect for YouTube. Letterboxing has been applied where needed.",
    editType: 'format'
  },
  'short': {
    message: "I've shortened your video to under 60 seconds by:\n\n• Removing redundant sections\n• Cutting filler words\n• Tightening pauses\n\nThe core message is preserved with better pacing.",
    editType: 'trim'
  },
  'trim': {
    message: "I've trimmed your video to the requested duration. The most engaging parts have been preserved.",
    editType: 'trim'
  },
  'intro': {
    message: "I've added a professional title card intro with your topic. It features a modern fade-in animation with your key message.",
    editType: 'effect'
  },
  'outro': {
    message: "I've added a call-to-action outro with subscribe/follow animation and social links placeholder.",
    editType: 'effect'
  },
  'chapter': {
    message: "I've analyzed your content and created chapter markers:\n\n00:00 - Introduction\n02:15 - Main Topic\n08:42 - Key Insights\n14:30 - Summary\n\nThese will show up in the YouTube progress bar.",
    editType: 'effect'
  },
  'highlight': {
    message: "I've created 3 highlight clips from your video:\n\n• Clip 1: Best quote (0:45)\n• Clip 2: Key moment (1:12)\n• Clip 3: Engaging section (0:58)\n\nPerfect for social media shorts!",
    editType: 'trim'
  },
  'speed': {
    message: "I've adjusted the pacing of your video. Slower sections have been sped up slightly while keeping your speech natural.",
    editType: 'speed'
  },
  'fast': {
    message: "I've increased the pace by 15%. The video feels more energetic while maintaining clear speech.",
    editType: 'speed'
  },
  'engag': {
    message: "I've optimized for engagement:\n\n• Tightened intro to hook viewers in 3 seconds\n• Added visual emphasis on key points\n• Improved pacing throughout\n• Enhanced audio clarity",
    editType: 'effect'
  },
  'youtube': {
    message: "I've optimized your video for YouTube:\n\n• 16:9 aspect ratio\n• Added chapter markers\n• Optimized thumbnail moment at 0:12\n• Professional intro/outro added",
    editType: 'format'
  },
  'instagram': {
    message: "I've optimized for Instagram:\n\n• 9:16 vertical format\n• Under 90 seconds\n• Eye-catching captions\n• Hook in first 3 seconds",
    editType: 'format'
  },
  'tiktok': {
    message: "I've made it TikTok-ready:\n\n• 9:16 vertical format\n• Punchy 60-second edit\n• Trending-style captions\n• Maximum energy pacing",
    editType: 'format'
  },
  'default': {
    message: "I've applied your requested changes to the video. The preview has been updated — take a look and let me know if you'd like any adjustments!",
    editType: 'effect'
  }
};

function getAIResponse(message: string): { message: string; editType: EditAction['type'] } {
  const lowerMessage = message.toLowerCase();
  
  for (const [key, response] of Object.entries(aiResponses)) {
    if (key !== 'default' && lowerMessage.includes(key)) {
      return response;
    }
  }
  
  return aiResponses.default;
}

export function EditorWorkspace({ project: initialProject, onBack }: EditorWorkspaceProps) {
  const [project, setProject] = useState<VideoProject>(initialProject);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(true);
  const [activeTab, setActiveTab] = useState('chat');

  const platformConfig = PLATFORM_CONFIGS[project.platform];

  const handleAnalysisComplete = useCallback(() => {
    setIsAnalyzing(false);
    setProject((prev) => ({ ...prev, status: 'ready' }));
  }, []);

  const handleSendMessage = useCallback((content: string) => {
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content,
      timestamp: new Date(),
      status: 'sent',
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsProcessing(true);
    setProject((prev) => ({ ...prev, status: 'processing' }));

    // Simulate AI processing
    setTimeout(() => {
      const response = getAIResponse(content);
      
      const newEdit: EditAction = {
        id: Date.now().toString(),
        type: response.editType,
        description: content.length > 50 ? content.substring(0, 50) + '...' : content,
        applied: true,
        timestamp: new Date(),
      };

      const aiMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.message,
        timestamp: new Date(),
        status: 'complete',
        editActions: [newEdit],
      };

      setMessages((prev) => [...prev, aiMessage]);
      setProject((prev) => ({ 
        ...prev, 
        status: 'ready',
        edits: [...prev.edits, newEdit]
      }));
      setIsProcessing(false);
    }, 2000 + Math.random() * 1000);
  }, []);

  const handleExport = useCallback(() => {
    setProject((prev) => ({ ...prev, status: 'exporting' }));
    // Simulate export
    setTimeout(() => {
      setProject((prev) => ({ ...prev, status: 'ready' }));
      // Would trigger download here
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
          />
        </div>
      </div>
    </div>
  );
}
