import { ArrowLeft, Download, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { VideoProject } from '@/types/video';

interface EditorHeaderProps {
  project: VideoProject;
  onBack: () => void;
  onExport: () => void;
}

export function EditorHeader({ project, onBack, onExport }: EditorHeaderProps) {
  return (
    <header className="h-16 px-4 flex items-center justify-between border-b border-border bg-surface/80 backdrop-blur-lg">
      {/* Left side */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onBack} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="font-semibold text-foreground">{project.title}</h1>
          <p className="text-xs text-muted-foreground">
            {project.status === 'ready' ? 'Ready to edit' : 
             project.status === 'processing' ? 'Processing...' :
             project.status === 'exporting' ? 'Exporting...' : 'Analyzing...'}
          </p>
        </div>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-foreground">
          <Share2 className="w-4 h-4" />
          Share
        </Button>
        <Button variant="ai" size="sm" onClick={onExport} className="gap-2">
          <Download className="w-4 h-4" />
          Export
        </Button>
      </div>
    </header>
  );
}
