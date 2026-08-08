import { useMemo } from 'react';
import {
  Sparkles, TrendingUp, TrendingDown, Shield, Clock, DollarSign, Target,
  Lightbulb, AlertTriangle, CheckCircle2, Users, Rocket, Brain, Heart,
  Zap, Globe, Star, BarChart3, Search, Flame, ArrowRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Enhancement, GraphicAnchor, GraphicSpec } from '@/types/enhancement';

interface GraphicsOverlayProps {
  enhancements: Enhancement[];
  currentTime: number;
}

const ICONS: Record<string, typeof Sparkles> = {
  'sparkles': Sparkles,
  'trending-up': TrendingUp,
  'trending-down': TrendingDown,
  'shield': Shield,
  'clock': Clock,
  'dollar-sign': DollarSign,
  'target': Target,
  'lightbulb': Lightbulb,
  'alert-triangle': AlertTriangle,
  'check-circle': CheckCircle2,
  'users': Users,
  'rocket': Rocket,
  'brain': Brain,
  'heart': Heart,
  'zap': Zap,
  'globe': Globe,
  'star': Star,
  'bar-chart': BarChart3,
  'search': Search,
  'flame': Flame,
};

const ANCHOR_CLASSES: Record<GraphicAnchor, string> = {
  'top-left': 'top-[8%] left-[6%] items-start text-left',
  'top-center': 'top-[8%] left-1/2 -translate-x-1/2 items-center text-center',
  'top-right': 'top-[8%] right-[6%] items-end text-right',
  'center-left': 'top-1/2 -translate-y-1/2 left-[6%] items-start text-left',
  'center': 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 items-center text-center',
  'center-right': 'top-1/2 -translate-y-1/2 right-[6%] items-end text-right',
  'bottom-left': 'bottom-[22%] left-[6%] items-start text-left',
  'bottom-center': 'bottom-[26%] left-1/2 -translate-x-1/2 items-center text-center',
  'bottom-right': 'bottom-[22%] right-[6%] items-end text-right',
};

const ACCENT: Record<string, { text: string; bg: string; border: string; bar: string }> = {
  primary: { text: 'text-primary', bg: 'bg-primary/15', border: 'border-primary/40', bar: 'bg-primary' },
  success: { text: 'text-emerald-400', bg: 'bg-emerald-500/15', border: 'border-emerald-500/40', bar: 'bg-emerald-400' },
  warning: { text: 'text-amber-400', bg: 'bg-amber-500/15', border: 'border-amber-500/40', bar: 'bg-amber-400' },
  neutral: { text: 'text-foreground', bg: 'bg-foreground/10', border: 'border-foreground/25', bar: 'bg-foreground/70' },
};

// Eased 0 -> 1 -> 0 envelope so graphics animate in, hold, then animate out
function useEnvelope(currentTime: number, start: number, end: number) {
  const inDur = Math.min(0.45, (end - start) / 3);
  const outDur = Math.min(0.35, (end - start) / 3);
  if (currentTime < start || currentTime > end) return { p: 0, enter: 0, exit: 0 };
  const enter = Math.min(1, (currentTime - start) / Math.max(0.01, inDur));
  const exit = Math.min(1, (end - currentTime) / Math.max(0.01, outDur));
  const ease = (t: number) => 1 - Math.pow(1 - t, 3);
  return { p: (currentTime - start) / Math.max(0.01, end - start), enter: ease(enter), exit: ease(exit) };
}

function GraphicItem({ enhancement, currentTime }: { enhancement: Enhancement; currentTime: number }) {
  const spec = enhancement.graphic as GraphicSpec;
  const { p, enter, exit } = useEnvelope(currentTime, enhancement.startTime, enhancement.endTime);
  const visible = Math.min(enter, exit);
  const accent = ACCENT[spec.accent || 'primary'] ?? ACCENT.primary;
  const anchor = ANCHOR_CLASSES[spec.anchor || 'top-center'];

  if (visible <= 0) return null;

  const entryTransform = (() => {
    const off = (1 - enter) * 24;
    switch (spec.enterAnimation) {
      case 'slide-left': return `translateX(${off}px)`;
      case 'pop': return `scale(${0.86 + 0.14 * enter})`;
      case 'fade': return 'none';
      default: return `translateY(${off}px)`;
    }
  })();

  const wrapperStyle: React.CSSProperties = {
    opacity: visible,
    transform: entryTransform === 'none' ? undefined : entryTransform,
  };

  // Full-frame graphics
  if (spec.graphicType === 'highlight-box' && spec.box) {
    return (
      <div
        className={cn('absolute rounded-xl border-2 pointer-events-none', accent.border)}
        style={{
          left: `${spec.box.x}%`,
          top: `${spec.box.y}%`,
          width: `${spec.box.width}%`,
          height: `${spec.box.height}%`,
          opacity: visible,
          boxShadow: `0 0 0 9999px hsl(var(--background) / ${0.35 * visible})`,
          clipPath: `inset(0 ${100 - enter * 100}% 0 0 round 0.75rem)`,
        }}
      >
        {spec.label && (
          <span className={cn('absolute -top-7 left-0 text-xs font-semibold px-2 py-1 rounded-md backdrop-blur-sm', accent.bg, accent.text)}>
            {spec.label}
          </span>
        )}
      </div>
    );
  }

  if (spec.graphicType === 'arrow') {
    const x = spec.box ? spec.box.x : enhancement.position?.x ?? 60;
    const y = spec.box ? spec.box.y : enhancement.position?.y ?? 50;
    return (
      <div
        className="absolute pointer-events-none"
        style={{
          left: `${x}%`,
          top: `${y}%`,
          opacity: visible,
          transform: `translate(-50%,-50%) rotate(${spec.arrowAngle ?? 0}deg) translateX(${(1 - enter) * -30}px)`,
        }}
      >
        <ArrowRight
          className={cn('w-14 h-14 drop-shadow-lg', accent.text)}
          style={{ transform: `scale(${1 + Math.sin(p * Math.PI * 4) * 0.06})` }}
          strokeWidth={2.5}
        />
      </div>
    );
  }

  if (spec.graphicType === 'motion-graphic') {
    return (
      <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ opacity: visible * 0.9 }}>
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className={cn('absolute h-[3px] rounded-full', accent.bar)}
            style={{
              top: `${30 + i * 18}%`,
              left: `${-20 + p * 140 - i * 12}%`,
              width: `${28 - i * 6}%`,
              opacity: 0.5 + i * 0.15,
            }}
          />
        ))}
      </div>
    );
  }

  if (spec.graphicType === 'zoom-emphasis') {
    // Rendered as a soft vignette pulse (actual scale handled by the zoom engine)
    return (
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          opacity: visible * 0.6,
          background: `radial-gradient(circle at ${spec.focalPoint?.x ?? 50}% ${spec.focalPoint?.y ?? 45}%, transparent 40%, hsl(var(--background) / 0.55) 100%)`,
        }}
      />
    );
  }

  // Anchored graphics
  return (
    <div className={cn('absolute flex flex-col gap-1 pointer-events-none max-w-[70%]', anchor)} style={wrapperStyle}>
      {spec.graphicType === 'animated-title' && (
        <>
          <div className={cn('h-[3px] rounded-full mb-1', accent.bar)} style={{ width: `${enter * 100}%`, minWidth: 32 }} />
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground drop-shadow-lg leading-tight">
            {spec.title}
          </h2>
          {spec.subtitle && (
            <p className="text-sm md:text-base text-muted-foreground font-medium">{spec.subtitle}</p>
          )}
        </>
      )}

      {spec.graphicType === 'lower-third' && (
        <div className={cn('flex items-stretch gap-3 rounded-lg backdrop-blur-md border px-4 py-2.5', accent.bg, accent.border)}>
          <div className={cn('w-1 rounded-full', accent.bar)} />
          <div className="text-left">
            <p className="text-lg font-semibold text-foreground leading-tight">{spec.title}</p>
            {spec.subtitle && <p className={cn('text-xs font-medium uppercase tracking-wider', accent.text)}>{spec.subtitle}</p>}
          </div>
        </div>
      )}

      {spec.graphicType === 'callout' && (
        <div className={cn('rounded-xl backdrop-blur-md border px-4 py-2.5', accent.bg, accent.border)}>
          <p className="text-base md:text-xl font-semibold text-foreground leading-snug">{spec.label || spec.title}</p>
        </div>
      )}

      {spec.graphicType === 'icon' && (() => {
        const Icon = ICONS[spec.icon || ''] ?? Sparkles;
        return (
          <div className={cn('flex items-center gap-2 rounded-full backdrop-blur-md border px-3 py-2', accent.bg, accent.border)}>
            <Icon className={cn('w-7 h-7', accent.text)} strokeWidth={2.2} />
            {spec.label && <span className="text-sm font-semibold text-foreground pr-1">{spec.label}</span>}
          </div>
        );
      })()}

      {spec.graphicType === 'progress-bar' && (
        <div className={cn('w-56 rounded-xl backdrop-blur-md border px-4 py-3', accent.bg, accent.border)}>
          <div className="flex justify-between text-xs font-medium text-foreground mb-2">
            <span>{spec.label}</span>
            <span className={accent.text}>{Math.round((spec.progress ?? 0) * Math.min(1, p * 2))}%</span>
          </div>
          <div className="h-2 rounded-full bg-foreground/15 overflow-hidden">
            <div
              className={cn('h-full rounded-full', accent.bar)}
              style={{ width: `${(spec.progress ?? 0) * Math.min(1, p * 2)}%` }}
            />
          </div>
        </div>
      )}

      {spec.graphicType === 'chart' && spec.chartData && (
        <ChartGraphic spec={spec} progress={Math.min(1, p * 2)} accent={accent} />
      )}

      {spec.graphicType === 'text-emphasis' && (
        <div className="flex flex-wrap gap-2 justify-center">
          {(spec.emphasisWords?.length ? spec.emphasisWords : [spec.label || spec.title || '']).map((w, i) => (
            <span
              key={i}
              className="text-3xl md:text-5xl font-extrabold uppercase tracking-tight text-foreground drop-shadow-xl"
              style={{ transform: `scale(${0.8 + 0.2 * enter + Math.sin(p * Math.PI) * 0.06})` }}
            >
              {w}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function ChartGraphic({
  spec,
  progress,
  accent,
}: {
  spec: GraphicSpec;
  progress: number;
  accent: { text: string; bg: string; border: string; bar: string };
}) {
  const data = spec.chartData ?? [];
  const max = Math.max(...data.map((d) => d.value), 1);

  return (
    <div className={cn('rounded-xl backdrop-blur-md border px-4 py-3 w-64', accent.bg, accent.border)}>
      {spec.label && <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">{spec.label}</p>}

      {spec.chartType === 'donut' ? (
        <div className="flex items-center gap-3">
          <svg viewBox="0 0 42 42" className="w-20 h-20 -rotate-90">
            <circle cx="21" cy="21" r="16" fill="none" stroke="hsl(var(--foreground) / 0.15)" strokeWidth="5" />
            <circle
              cx="21" cy="21" r="16" fill="none"
              stroke="currentColor"
              className={accent.text}
              strokeWidth="5"
              strokeLinecap="round"
              strokeDasharray={`${(data[0].value / max) * 100 * progress} 100`}
              pathLength={100}
            />
          </svg>
          <div>
            <p className="text-2xl font-bold text-foreground">
              {Math.round(data[0].value * progress)}{spec.chartUnit}
            </p>
            <p className="text-xs text-muted-foreground">{data[0].label}</p>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {data.slice(0, 5).map((d, i) => (
            <div key={i}>
              <div className="flex justify-between text-xs font-medium text-foreground mb-1">
                <span className="truncate max-w-[60%]">{d.label}</span>
                <span className={accent.text}>{Math.round(d.value * progress)}{spec.chartUnit}</span>
              </div>
              <div className="h-1.5 rounded-full bg-foreground/15 overflow-hidden">
                <div
                  className={cn('h-full rounded-full', accent.bar)}
                  style={{ width: `${(d.value / max) * 100 * progress}%`, transitionDelay: `${i * 60}ms` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function GraphicsOverlay({ enhancements, currentTime }: GraphicsOverlayProps) {
  const active = useMemo(
    () =>
      enhancements.filter(
        (e) =>
          e.graphic &&
          (e.status === 'approved' || e.status === 'ready') &&
          currentTime >= e.startTime &&
          currentTime <= e.endTime,
      ),
    [enhancements, currentTime],
  );

  if (!active.length) return null;

  return (
    <div className="absolute inset-0 pointer-events-none z-20">
      {active.map((e) => (
        <GraphicItem key={e.id} enhancement={e} currentTime={currentTime} />
      ))}
    </div>
  );
}
