import { cn } from '@/lib/utils';
import type { CaptionStyle, CaptionAnimation } from '@/types/video';
import { Sparkles, Type, Zap, Music2, Target, ArrowRight } from 'lucide-react';

interface CaptionStylePickerProps {
  selectedStyle: CaptionStyle;
  selectedAnimation: CaptionAnimation;
  onStyleChange: (style: CaptionStyle) => void;
  onAnimationChange: (animation: CaptionAnimation) => void;
}

const CAPTION_STYLES: { id: CaptionStyle; name: string; description: string; preview: string; icon: React.ReactNode }[] = [
  { 
    id: 'modern', 
    name: 'Modern', 
    description: 'Clean blurred background', 
    preview: 'Aa',
    icon: <Type className="w-4 h-4" />
  },
  { 
    id: 'minimal', 
    name: 'Minimal', 
    description: 'Text shadow only', 
    preview: 'Aa',
    icon: <Type className="w-4 h-4" />
  },
  { 
    id: 'bold', 
    name: 'Bold', 
    description: 'Solid background', 
    preview: 'Aa',
    icon: <Type className="w-4 h-4" />
  },
  { 
    id: 'subtitle', 
    name: 'Subtitle', 
    description: 'Classic dark background', 
    preview: 'Aa',
    icon: <Type className="w-4 h-4" />
  },
  { 
    id: 'hormozi', 
    name: 'Hormozi', 
    description: 'Bold kinetic text', 
    preview: 'AA',
    icon: <Zap className="w-4 h-4" />
  },
  { 
    id: 'karaoke', 
    name: 'Karaoke', 
    description: 'Word-by-word highlight', 
    preview: 'Aa',
    icon: <Music2 className="w-4 h-4" />
  },
  { 
    id: 'pop', 
    name: 'Pop', 
    description: 'Words pop in', 
    preview: 'Aa',
    icon: <Sparkles className="w-4 h-4" />
  },
  { 
    id: 'bounce', 
    name: 'Bounce', 
    description: 'Bouncy active word', 
    preview: 'Aa',
    icon: <Target className="w-4 h-4" />
  },
  { 
    id: 'glide', 
    name: 'Glide', 
    description: 'Smooth sliding text', 
    preview: 'Aa',
    icon: <ArrowRight className="w-4 h-4" />
  },
];

const ANIMATIONS: { id: CaptionAnimation; name: string; description: string }[] = [
  { id: 'none', name: 'None', description: 'Static text' },
  { id: 'word-by-word', name: 'Word by Word', description: 'Highlight each word' },
  { id: 'pop', name: 'Pop', description: 'Pop-in effect' },
  { id: 'pulse', name: 'Pulse', description: 'Pulsing glow' },
  { id: 'bounce', name: 'Bounce', description: 'Bouncy entrance' },
  { id: 'typewriter', name: 'Typewriter', description: 'Type effect' },
  { id: 'wave', name: 'Wave', description: 'Wave motion' },
];

export function CaptionStylePicker({
  selectedStyle,
  selectedAnimation,
  onStyleChange,
  onAnimationChange
}: CaptionStylePickerProps) {
  const isDynamicStyle = ['hormozi', 'karaoke', 'pop', 'bounce', 'glide'].includes(selectedStyle);

  return (
    <div className="space-y-6">
      {/* Style Categories */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium text-foreground">Caption Style</h4>
          <span className={cn(
            "text-xs px-2 py-0.5 rounded-full",
            isDynamicStyle 
              ? "bg-primary/20 text-primary" 
              : "bg-muted text-muted-foreground"
          )}>
            {isDynamicStyle ? 'Dynamic' : 'Static'}
          </span>
        </div>
        
        {/* Static Styles */}
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">Basic</p>
          <div className="grid grid-cols-2 gap-2">
            {CAPTION_STYLES.filter(s => !['hormozi', 'karaoke', 'pop', 'bounce', 'glide'].includes(s.id)).map((style) => (
              <StyleCard
                key={style.id}
                style={style}
                isSelected={selectedStyle === style.id}
                onClick={() => onStyleChange(style.id)}
              />
            ))}
          </div>
        </div>
        
        {/* Dynamic Styles */}
        <div className="space-y-2 pt-2">
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Sparkles className="w-3 h-3" />
            Dynamic / Animated
          </p>
          <div className="grid grid-cols-2 gap-2">
            {CAPTION_STYLES.filter(s => ['hormozi', 'karaoke', 'pop', 'bounce', 'glide'].includes(s.id)).map((style) => (
              <StyleCard
                key={style.id}
                style={style}
                isSelected={selectedStyle === style.id}
                onClick={() => onStyleChange(style.id)}
                isDynamic
              />
            ))}
          </div>
        </div>
      </div>

      {/* Animation Override (for basic styles) */}
      {!isDynamicStyle && (
        <div className="space-y-3 pt-3 border-t border-border">
          <h4 className="text-sm font-medium text-foreground">Animation</h4>
          <div className="flex flex-wrap gap-2">
            {ANIMATIONS.map((anim) => (
              <button
                key={anim.id}
                onClick={() => onAnimationChange(anim.id)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                  selectedAnimation === anim.id
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-surface-elevated border border-border hover:border-primary/50'
                )}
              >
                {anim.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

interface StyleCardProps {
  style: typeof CAPTION_STYLES[0];
  isSelected: boolean;
  onClick: () => void;
  isDynamic?: boolean;
}

function StyleCard({ style, isSelected, onClick, isDynamic }: StyleCardProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'relative p-3 rounded-xl border text-left transition-all group overflow-hidden',
        isSelected
          ? 'border-primary bg-primary/10 ring-1 ring-primary/30'
          : 'border-border hover:border-primary/50 hover:bg-surface-elevated'
      )}
    >
      {isDynamic && (
        <div className="absolute top-1 right-1">
          <Sparkles className="w-3 h-3 text-primary" />
        </div>
      )}
      
      <div className="flex items-center gap-2 mb-1">
        <span className={cn(
          'p-1 rounded',
          isSelected ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'
        )}>
          {style.icon}
        </span>
        <span className="text-sm font-medium text-foreground">{style.name}</span>
      </div>
      
      <p className="text-xs text-muted-foreground">{style.description}</p>
      
      {/* Mini preview */}
      <div className={cn(
        'mt-2 px-2 py-1 rounded text-xs font-bold',
        style.id === 'hormozi' && 'bg-black text-white uppercase tracking-wider',
        style.id === 'karaoke' && 'bg-background/60 text-primary',
        style.id === 'pop' && 'bg-transparent text-foreground',
        style.id === 'bounce' && 'bg-transparent text-foreground',
        style.id === 'glide' && 'bg-gradient-to-r from-transparent via-background/80 to-transparent',
        style.id === 'modern' && 'bg-background/80 backdrop-blur-sm text-foreground rounded-lg',
        style.id === 'minimal' && 'bg-transparent text-foreground shadow-lg',
        style.id === 'bold' && 'bg-primary text-primary-foreground',
        style.id === 'subtitle' && 'bg-background/90 text-foreground'
      )}>
        {style.preview}
      </div>
    </button>
  );
}