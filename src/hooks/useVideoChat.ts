import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import type { ChatMessage, EditAction, Platform } from '@/types/video';
import type { VideoAnalysis } from './useVideoAnalysis';

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/video-chat`;

interface UseChatOptions {
  platform: Platform;
  contentType: 'short' | 'long';
  analysisContext?: VideoAnalysis | null;
}

export function useVideoChat({ platform, contentType, analysisContext }: UseChatOptions) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const sendMessage = useCallback(async (content: string): Promise<EditAction | null> => {
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content,
      timestamp: new Date(),
      status: 'sent',
    };

    setMessages(prev => [...prev, userMessage]);
    setIsProcessing(true);

    let assistantContent = '';
    let editAction: EditAction | null = null;

    try {
      // Build message history for context
      const messageHistory = [...messages, userMessage].map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content
      }));

      const response = await fetch(CHAT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: messageHistory,
          analysisContext: analysisContext ? {
            transcription: analysisContext.transcription,
            pauses: analysisContext.pauses,
            keyMoments: analysisContext.keyMoments,
            sceneChanges: analysisContext.sceneChanges,
            suggestedEdits: analysisContext.suggestedEdits,
          } : undefined,
          platform,
          contentType,
        }),
      });

      if (!response.ok) {
        if (response.status === 429) {
          toast.error('Rate limit exceeded. Please try again in a moment.');
          throw new Error('Rate limit exceeded');
        }
        if (response.status === 402) {
          toast.error('AI credits exhausted. Please add more credits.');
          throw new Error('Credits exhausted');
        }
        throw new Error('Failed to get AI response');
      }

      if (!response.body) {
        throw new Error('No response body');
      }

      // Stream the response
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = '';

      // Add initial assistant message
      const assistantMessageId = (Date.now() + 1).toString();
      setMessages(prev => [...prev, {
        id: assistantMessageId,
        role: 'assistant',
        content: '',
        timestamp: new Date(),
        status: 'processing',
      }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        textBuffer += decoder.decode(value, { stream: true });

        // Process line-by-line
        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf('\n')) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') break;

          try {
            const parsed = JSON.parse(jsonStr);
            const deltaContent = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (deltaContent) {
              assistantContent += deltaContent;
              setMessages(prev => prev.map(m => 
                m.id === assistantMessageId 
                  ? { ...m, content: assistantContent }
                  : m
              ));
            }
          } catch {
            // Incomplete JSON, put it back
            textBuffer = line + '\n' + textBuffer;
            break;
          }
        }
      }

      // Try to extract edit action from the response
      const jsonMatch = assistantContent.match(/```json\n?([\s\S]*?)\n?```/);
      if (jsonMatch) {
        try {
          const editData = JSON.parse(jsonMatch[1]);
          editAction = {
            id: Date.now().toString(),
            type: editData.editType || 'effect',
            description: editData.description || content.substring(0, 50),
            applied: true,
            timestamp: new Date(),
          };

          // Update message with edit action
          setMessages(prev => prev.map(m => 
            m.id === assistantMessageId 
              ? { ...m, status: 'complete', editActions: [editAction!] }
              : m
          ));
        } catch {
          console.log('Could not parse edit action from response');
        }
      }

      // Finalize the message
      setMessages(prev => prev.map(m => 
        m.id === assistantMessageId 
          ? { ...m, status: 'complete', content: assistantContent.replace(/```json[\s\S]*?```/g, '').trim() }
          : m
      ));

      return editAction;

    } catch (error) {
      console.error('Chat error:', error);
      
      // Add error message
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Sorry, I encountered an error processing your request. Please try again.',
        timestamp: new Date(),
        status: 'complete',
      }]);

      return null;
    } finally {
      setIsProcessing(false);
    }
  }, [messages, analysisContext, platform, contentType]);

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  return {
    messages,
    isProcessing,
    sendMessage,
    clearMessages,
    setMessages,
  };
}
