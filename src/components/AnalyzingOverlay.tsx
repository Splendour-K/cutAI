import { useEffect, useState } from 'react';
import { AudioLines, MessageSquare, Scissors, Sparkles, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AnalyzingOverlayProps {
  onComplete: () => void;
}

const analysisSteps = [
  { icon: AudioLines, label: 'Extracting audio', duration: 1500 },
  { icon: MessageSquare, label: 'Transcribing speech', duration: 2000 },
  { icon: Scissors, label: 'Detecting pauses & filler words', duration: 1500 },
  { icon: Sparkles, label: 'Identifying key moments', duration: 1000 },
];

export function AnalyzingOverlay({ onComplete }: AnalyzingOverlayProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);

  useEffect(() => {
    if (currentStep >= analysisSteps.length) {
      setTimeout(onComplete, 500);
      return;
    }

    const timer = setTimeout(() => {
      setCompletedSteps((prev) => [...prev, currentStep]);
      setCurrentStep((prev) => prev + 1);
    }, analysisSteps[currentStep].duration);

    return () => clearTimeout(timer);
  }, [currentStep, onComplete]);

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-xl flex items-center justify-center">
      <div className="max-w-md w-full p-8 space-y-8 animate-fade-in">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center mx-auto ai-glow">
            <Sparkles className="w-8 h-8 text-primary-foreground" />
          </div>
          <h2 className="text-2xl font-bold text-foreground">Analyzing your video</h2>
          <p className="text-muted-foreground">This will only take a moment</p>
        </div>

        {/* Progress steps */}
        <div className="space-y-3">
          {analysisSteps.map((step, index) => {
            const isCompleted = completedSteps.includes(index);
            const isActive = currentStep === index;

            return (
              <div
                key={step.label}
                className={cn(
                  "flex items-center gap-4 p-4 rounded-xl border transition-all duration-300",
                  isCompleted
                    ? "bg-success/10 border-success/30"
                    : isActive
                    ? "bg-surface-elevated border-primary/50"
                    : "bg-surface/50 border-border/30 opacity-50"
                )}
              >
                <div
                  className={cn(
                    "w-10 h-10 rounded-lg flex items-center justify-center transition-all duration-300",
                    isCompleted
                      ? "bg-success text-primary-foreground"
                      : isActive
                      ? "bg-primary text-primary-foreground"
                      : "bg-surface-elevated text-muted-foreground"
                  )}
                >
                  {isCompleted ? (
                    <Check className="w-5 h-5" />
                  ) : (
                    <step.icon className={cn("w-5 h-5", isActive && "animate-pulse")} />
                  )}
                </div>
                <div className="flex-1">
                  <p
                    className={cn(
                      "font-medium transition-colors duration-300",
                      isCompleted || isActive ? "text-foreground" : "text-muted-foreground"
                    )}
                  >
                    {step.label}
                  </p>
                </div>
                {isActive && (
                  <div className="w-4 h-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                )}
              </div>
            );
          })}
        </div>

        {/* Progress bar */}
        <div className="space-y-2">
          <div className="h-2 bg-surface-elevated rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-primary to-accent transition-all duration-500 ease-out rounded-full"
              style={{ width: `${((currentStep + 1) / analysisSteps.length) * 100}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground text-center">
            Step {Math.min(currentStep + 1, analysisSteps.length)} of {analysisSteps.length}
          </p>
        </div>
      </div>
    </div>
  );
}
