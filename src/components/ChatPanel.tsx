import { useState, useRef, useEffect } from 'react';
import { Send, Sparkles, Wand2, Scissors, Type, Music, Zap, Clock, Film } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { ChatMessage, Platform } from '@/types/video';

interface ChatPanelProps {
  messages: ChatMessage[];
  onSendMessage: (message: string) => void;
  isProcessing: boolean;
  platform?: Platform;
}

const quickActionsShort = [
  { icon: Scissors, label: 'Remove pauses', prompt: 'Remove all long pauses and tighten the pacing' },
  { icon: Type, label: 'Add captions', prompt: 'Add modern captions synced to speech with keyword highlights' },
  { icon: Wand2, label: 'Make it viral', prompt: 'Optimize this for maximum engagement - quick cuts, captions, and hooks' },
  { icon: Music, label: 'Add music', prompt: 'Add subtle background music that matches the mood' },
  { icon: Zap, label: 'Speed up', prompt: 'Make it faster and more engaging, remove dead air' },
  { icon: Clock, label: 'Trim to 60s', prompt: 'Trim this video to under 60 seconds, keep the best parts' },
];

const quickActionsLong = [
  { icon: Film, label: 'Add chapters', prompt: 'Create chapter markers for this video' },
  { icon: Type, label: 'Add captions', prompt: 'Add professional captions synced to speech' },
  { icon: Scissors, label: 'Create clips', prompt: 'Create highlight clips from the best moments' },
  { icon: Wand2, label: 'Optimize', prompt: 'Optimize this for maximum engagement and watch time' },
  { icon: Music, label: 'Add music', prompt: 'Add subtle background music that complements the content' },
  { icon: Zap, label: 'Intro/Outro', prompt: 'Add professional intro and outro with call-to-action' },
];

export function ChatPanel({ messages, onSendMessage, isProcessing, platform = 'instagram' }: ChatPanelProps) {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const isLongForm = platform === 'youtube' || platform === 'linkedin';
  const quickActions = isLongForm ? quickActionsLong : quickActionsShort;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isProcessing) {
      onSendMessage(input.trim());
      setInput('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h2 className="font-semibold text-foreground">AI Editor</h2>
            <p className="text-xs text-muted-foreground">
              {isLongForm ? 'Optimized for long-form content' : 'Ready for short-form magic'}
            </p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="space-y-6 pt-4">
            <div className="text-center space-y-2">
              <p className="text-muted-foreground">
                Tell me how you'd like to edit your video. I can cut, trim, add captions, and more.
              </p>
            </div>
            
            {/* Quick Actions */}
            <div className="grid grid-cols-2 gap-2">
              {quickActions.map((action) => (
                <button
                  key={action.label}
                  onClick={() => onSendMessage(action.prompt)}
                  disabled={isProcessing}
                  className="flex items-center gap-2 p-3 rounded-xl bg-surface-elevated/50 border border-border/50 hover:border-primary/50 hover:bg-surface-elevated transition-all duration-200 text-left group disabled:opacity-50"
                >
                  <div className="w-8 h-8 rounded-lg bg-surface flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                    <action.icon className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                  <span className="text-sm font-medium text-foreground">{action.label}</span>
                </button>
              ))}
            </div>

            {/* Example prompts */}
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground text-center">Or try these:</p>
              <div className="flex flex-wrap gap-2 justify-center">
                {(isLongForm 
                  ? ['Add subtitles', 'Create timestamps', 'Remove ums']
                  : ['Make it snappy', 'Add hook', 'Trim to 30s']
                ).map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => onSendMessage(prompt)}
                    disabled={isProcessing}
                    className="px-3 py-1 text-xs bg-surface-elevated/30 border border-border/30 rounded-full text-muted-foreground hover:text-foreground hover:border-primary/40 transition-all disabled:opacity-50"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                "flex gap-3 animate-slide-up",
                message.role === 'user' ? 'flex-row-reverse' : 'flex-row'
              )}
            >
              {message.role === 'assistant' && (
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center flex-shrink-0">
                  <Sparkles className="w-4 h-4 text-primary-foreground" />
                </div>
              )}
              <div
                className={cn(
                  "max-w-[85%] rounded-2xl px-4 py-3",
                  message.role === 'user'
                    ? 'bg-primary text-primary-foreground rounded-br-md'
                    : 'bg-surface-elevated border border-border/50 rounded-bl-md'
                )}
              >
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
                {message.editActions && message.editActions.length > 0 && (
                  <div className="flex items-center gap-2 mt-2 pt-2 border-t border-border/30">
                    <span className="text-xs text-primary">✓ Applied</span>
                  </div>
                )}
                {message.status === 'processing' && (
                  <div className="flex items-center gap-2 mt-2 pt-2 border-t border-border/30">
                    <div className="flex gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary animate-typing" style={{ animationDelay: '0ms' }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-primary animate-typing" style={{ animationDelay: '150ms' }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-primary animate-typing" style={{ animationDelay: '300ms' }} />
                    </div>
                    <span className="text-xs text-muted-foreground">Applying changes...</span>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
        
        {isProcessing && messages[messages.length - 1]?.role === 'user' && (
          <div className="flex gap-3 animate-slide-up">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-4 h-4 text-primary-foreground" />
            </div>
            <div className="bg-surface-elevated border border-border/50 rounded-2xl rounded-bl-md px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary animate-typing" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-primary animate-typing" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-primary animate-typing" style={{ animationDelay: '300ms' }} />
                </div>
                <span className="text-sm text-muted-foreground">Editing your video...</span>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-border">
        <form onSubmit={handleSubmit} className="relative">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isLongForm 
              ? "Add chapters, create clips, optimize for YouTube..." 
              : "Remove pauses, add captions, make it viral..."}
            rows={1}
            className="w-full resize-none bg-surface-elevated border border-border/50 rounded-xl pl-4 pr-12 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 chat-input-glow transition-all duration-200"
            style={{ minHeight: '48px', maxHeight: '120px' }}
          />
          <Button
            type="submit"
            size="icon"
            variant="ai"
            disabled={!input.trim() || isProcessing}
            className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8"
          >
            <Send className="w-4 h-4" />
          </Button>
        </form>
        <p className="text-xs text-muted-foreground mt-2 text-center">
          Press Enter to send • Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}
