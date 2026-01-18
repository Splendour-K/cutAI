import { useState } from 'react';
import { cn } from '@/lib/utils';
import { 
  Check, 
  X, 
  ChevronDown, 
  ChevronRight, 
  Play,
  CheckCircle2,
  Circle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import type { Storyboard, StoryboardScene, StoryboardElement } from '@/types/animation';

interface StoryboardReviewProps {
  storyboard: Storyboard | null;
  approvedElements: string[];
  onApproveElement: (elementId: string) => void;
  onUnapproveElement: (elementId: string) => void;
  onApproveAll: () => void;
  onProceed: () => void;
}

export function StoryboardReview({
  storyboard,
  approvedElements,
  onApproveElement,
  onUnapproveElement,
  onApproveAll,
  onProceed,
}: StoryboardReviewProps) {
  const [expandedScenes, setExpandedScenes] = useState<string[]>([]);

  if (!storyboard) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        No storyboard generated yet.
      </div>
    );
  }

  const totalElements = storyboard.scenes.reduce(
    (acc, scene) => acc + scene.elements.length, 
    0
  );
  const approvedCount = approvedElements.length;
  const allApproved = approvedCount === totalElements;

  const toggleScene = (sceneId: string) => {
    setExpandedScenes(prev => 
      prev.includes(sceneId) 
        ? prev.filter(id => id !== sceneId)
        : [...prev, sceneId]
    );
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-3 border-b border-border bg-surface/50 flex-shrink-0">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-foreground">Review Animations</h3>
          <Badge variant={allApproved ? "default" : "secondary"}>
            {approvedCount}/{totalElements} approved
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          Review each animation element. Approve the ones you want to keep.
        </p>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={onApproveAll}
            disabled={allApproved}
            className="flex-1"
          >
            <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
            Approve All
          </Button>
          <Button 
            size="sm" 
            onClick={onProceed}
            disabled={approvedCount === 0}
            className="flex-1"
          >
            Continue
            <ChevronRight className="w-3.5 h-3.5 ml-1.5" />
          </Button>
        </div>
      </div>

      {/* Scenes */}
      <ScrollArea className="flex-1">
        <div className="p-3 space-y-2">
          {storyboard.scenes.map((scene, sceneIndex) => {
            const isExpanded = expandedScenes.includes(scene.id);
            const sceneApprovedCount = scene.elements.filter(
              el => approvedElements.includes(el.id)
            ).length;

            return (
              <Collapsible
                key={scene.id}
                open={isExpanded}
                onOpenChange={() => toggleScene(scene.id)}
              >
                <CollapsibleTrigger asChild>
                  <button className="w-full p-3 rounded-xl bg-surface-elevated/50 border border-border/50 hover:bg-surface-elevated transition-colors text-left">
                    <div className="flex items-center gap-2">
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-sm font-medium text-foreground">
                            Scene {sceneIndex + 1}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {formatTime(scene.startTime)} - {formatTime(scene.endTime)}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {scene.description}
                        </p>
                      </div>
                      <Badge 
                        variant={sceneApprovedCount === scene.elements.length ? "default" : "secondary"}
                        className="shrink-0"
                      >
                        {sceneApprovedCount}/{scene.elements.length}
                      </Badge>
                    </div>
                  </button>
                </CollapsibleTrigger>

                <CollapsibleContent>
                  <div className="mt-2 ml-6 space-y-2">
                    {scene.elements.map((element) => (
                      <ElementCard
                        key={element.id}
                        element={element}
                        isApproved={approvedElements.includes(element.id)}
                        onApprove={() => onApproveElement(element.id)}
                        onUnapprove={() => onUnapproveElement(element.id)}
                      />
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}

interface ElementCardProps {
  element: StoryboardElement;
  isApproved: boolean;
  onApprove: () => void;
  onUnapprove: () => void;
}

function ElementCard({ element, isApproved, onApprove, onUnapprove }: ElementCardProps) {
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 10);
    return `${mins}:${secs.toString().padStart(2, '0')}.${ms}`;
  };

  return (
    <div 
      className={cn(
        "p-3 rounded-lg border transition-all",
        isApproved 
          ? "bg-primary/5 border-primary/30" 
          : "bg-surface/50 border-border/50"
      )}
    >
      <div className="flex items-start gap-2">
        <button
          onClick={isApproved ? onUnapprove : onApprove}
          className={cn(
            "mt-0.5 w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition-colors",
            isApproved 
              ? "bg-primary text-primary-foreground" 
              : "border border-muted-foreground/30 hover:border-primary"
          )}
        >
          {isApproved && <Check className="w-3 h-3" />}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
              {element.type}
            </Badge>
            <span className="text-[10px] text-muted-foreground">
              {formatTime(element.startTime)} - {formatTime(element.endTime)}
            </span>
          </div>
          
          <p className="text-sm text-foreground font-medium mb-2 line-clamp-2">
            "{element.content}"
          </p>

          <div className="flex flex-wrap gap-1">
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
              {element.animation.enter.name}
            </span>
            {element.animation.during?.name && element.animation.during.name !== 'none' && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                {element.animation.during.name}
              </span>
            )}
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
              {element.animation.timing}
            </span>
          </div>
        </div>

        <button className="p-1.5 rounded-lg hover:bg-muted transition-colors shrink-0">
          <Play className="w-3.5 h-3.5 text-muted-foreground" />
        </button>
      </div>
    </div>
  );
}
