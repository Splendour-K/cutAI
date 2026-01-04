import { useState, useCallback } from 'react';
import { ChatPanel } from './ChatPanel';
import { VideoPreview } from './VideoPreview';
import { EditorHeader } from './EditorHeader';
import { AnalyzingOverlay } from './AnalyzingOverlay';
import type { VideoProject, ChatMessage } from '@/types/video';

interface EditorWorkspaceProps {
  project: VideoProject;
  onBack: () => void;
}

const aiResponses: Record<string, string> = {
  'remove': "I've removed all long pauses and silences from your video. The pacing is now much tighter — total runtime reduced by 23 seconds.",
  'pause': "I've removed all long pauses and silences from your video. The pacing is now much tighter — total runtime reduced by 23 seconds.",
  'caption': "I've added modern captions synced to your speech. Key phrases are highlighted with a subtle glow effect. The style uses a clean sans-serif font with a semi-transparent background.",
  'filler': "I've detected and removed 12 filler words (um, uh, like, you know). The audio transitions are smooth — you won't notice the cuts.",
  'viral': "I've optimized your video for maximum engagement:\n\n• Added punchy intro hook (first 2 sec)\n• Quick jump cuts between key points\n• Modern captions with emphasis\n• Tightened pacing by 40%\n\nYour video is now ready to go viral! 🚀",
  'music': "I've added a subtle lo-fi background track that complements your voice. The music ducks automatically when you speak and rises during pauses.",
  'vertical': "I've reframed your video for vertical (9:16) format. The AI tracked your face to keep you centered throughout. Safe zones for platform UI are preserved.",
  'short': "I've shortened your video to under 60 seconds by:\n\n• Removing redundant sections\n• Cutting filler words\n• Tightening pauses\n\nThe core message is preserved with better pacing.",
  'intro': "I've added a professional title card intro with your topic. It features a modern fade-in animation with your key message.",
  'default': "I've applied your requested changes to the video. The preview has been updated — take a look and let me know if you'd like any adjustments!"
};

function getAIResponse(message: string): string {
  const lowerMessage = message.toLowerCase();
  
  for (const [key, response] of Object.entries(aiResponses)) {
    if (lowerMessage.includes(key)) {
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
      const aiMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: getAIResponse(content),
        timestamp: new Date(),
        status: 'complete',
      };

      setMessages((prev) => [...prev, aiMessage]);
      setIsProcessing(false);
      setProject((prev) => ({ ...prev, status: 'ready' }));
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

  return (
    <div className="h-screen flex flex-col bg-background">
      {isAnalyzing && <AnalyzingOverlay onComplete={handleAnalysisComplete} />}

      <EditorHeader project={project} onBack={onBack} onExport={handleExport} />

      <div className="flex-1 flex overflow-hidden">
        {/* Chat Panel */}
        <div className="w-[400px] border-r border-border flex-shrink-0 bg-surface/50">
          <ChatPanel
            messages={messages}
            onSendMessage={handleSendMessage}
            isProcessing={isProcessing}
          />
        </div>

        {/* Video Preview */}
        <div className="flex-1 bg-background">
          <VideoPreview project={project} />
        </div>
      </div>
    </div>
  );
}
