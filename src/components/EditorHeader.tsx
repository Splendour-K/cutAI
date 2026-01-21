import { useState } from 'react';
import { ArrowLeft, Download, Share2, Trash2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { ThemeToggle } from '@/components/ThemeToggle';
import type { VideoProject } from '@/types/video';

interface EditorHeaderProps {
  project: VideoProject;
  onBack: () => void;
  onExport: () => void;
  onDelete?: () => Promise<void>;
  isDeleting?: boolean;
}

export function EditorHeader({ project, onBack, onExport, onDelete, isDeleting = false }: EditorHeaderProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const handleDelete = async () => {
    if (onDelete) {
      await onDelete();
    }
    setShowDeleteDialog(false);
  };

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
        {/* Theme toggle */}
        <ThemeToggle />
        
        {/* Delete button */}
        {onDelete && (
          <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
            <AlertDialogTrigger asChild>
              <Button 
                variant="ghost" 
                size="sm" 
                className="gap-2 text-muted-foreground hover:text-destructive"
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete video?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete "{project.title}" and all associated data including analysis, captions, and edit history. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction 
                  onClick={handleDelete}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
        
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
