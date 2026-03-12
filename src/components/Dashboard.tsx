import { useState, useCallback, useRef } from 'react';
import { useProjects, type ProjectWithLocal } from '@/hooks/useProjects';
import { useAuth } from '@/hooks/useAuth';
import { getLocalVideo } from '@/lib/localVideoStore';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ThemeToggle } from '@/components/ThemeToggle';
import {
  Plus, Search, SortAsc, Clock, Trash2, Copy, Play,
  Scissors, LogOut, Upload, AlertTriangle, Film, Loader2, Check, X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { VideoProject, Platform, AspectRatio } from '@/types/video';
import { PLATFORM_CONFIGS } from '@/types/video';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface DashboardProps {
  onNewProject: () => void;
  onOpenProject: (project: VideoProject) => void;
}

type SortMode = 'recent' | 'alpha';

export function Dashboard({ onNewProject, onOpenProject }: DashboardProps) {
  const { user, signOut } = useAuth();
  const { projects, isLoading, deleteProject, duplicateProject, renameProject } = useProjects();
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortMode>('recent');
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [reuploadTarget, setReuploadTarget] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filtered = projects
    .filter((p) => p.title.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) =>
      sort === 'recent'
        ? new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
        : a.title.localeCompare(b.title)
    );

  const handleOpenProject = useCallback(
    async (proj: ProjectWithLocal) => {
      if (!proj.hasLocalVideo) {
        setReuploadTarget(proj.id);
        return;
      }
      const file = await getLocalVideo(proj.id);
      if (!file) {
        setReuploadTarget(proj.id);
        return;
      }
      const videoUrl = URL.createObjectURL(file);
      const config = PLATFORM_CONFIGS[proj.platform as Platform] || PLATFORM_CONFIGS.instagram;
      const videoProject: VideoProject = {
        id: proj.id,
        title: proj.title,
        videoUrl,
        videoFile: file,
        createdAt: new Date(proj.created_at),
        duration: proj.duration_seconds ? Number(proj.duration_seconds) : 0,
        aspectRatio: (proj.aspect_ratio || config.aspectRatios[0]) as AspectRatio,
        platform: proj.platform as Platform,
        status: (['ready', 'in_progress', 'analyzing', 'processing', 'exporting'].includes(proj.status) ? proj.status : 'ready') as VideoProject['status'],
        edits: [],
        captions: proj.caption_settings ? (proj.caption_settings as any) : undefined,
      };
      onOpenProject(videoProject);
    },
    [onOpenProject]
  );

  const handleReuploadFile = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !reuploadTarget) return;
      const proj = projects.find((p) => p.id === reuploadTarget);
      if (!proj) return;

      // Save locally and open
      const { saveVideoLocally } = await import('@/lib/localVideoStore');
      await saveVideoLocally(reuploadTarget, file);
      setReuploadTarget(null);

      const videoUrl = URL.createObjectURL(file);
      const config = PLATFORM_CONFIGS[proj.platform as Platform] || PLATFORM_CONFIGS.instagram;
      const videoProject: VideoProject = {
        id: proj.id,
        title: proj.title,
        videoUrl,
        videoFile: file,
        createdAt: new Date(proj.created_at),
        duration: proj.duration_seconds ? Number(proj.duration_seconds) : 0,
        aspectRatio: (proj.aspect_ratio || config.aspectRatios[0]) as AspectRatio,
        platform: proj.platform as Platform,
        status: 'analyzing',
        edits: [],
        captions: proj.caption_settings ? (proj.caption_settings as any) : undefined,
      };
      onOpenProject(videoProject);
    },
    [reuploadTarget, projects, onOpenProject]
  );

  const formatDate = (d: string) => {
    const diff = Date.now() - new Date(d).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    return new Date(d).toLocaleDateString();
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-border/30">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
            <Scissors className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="font-semibold text-foreground">Clipzy AI</span>
        </div>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          {user && (
            <>
              <Button variant="ghost" size="sm" onClick={signOut} className="text-muted-foreground gap-2">
                <LogOut className="w-4 h-4" />
                Sign out
              </Button>
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                <span className="text-xs font-medium text-primary">
                  {user.email?.[0]?.toUpperCase() || 'U'}
                </span>
              </div>
            </>
          )}
        </div>
      </header>

      {/* Toolbar */}
      <div className="flex items-center gap-3 px-6 py-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search projects..."
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setSort(sort === 'recent' ? 'alpha' : 'recent')}
          className="gap-2 text-muted-foreground"
        >
          {sort === 'recent' ? <Clock className="w-4 h-4" /> : <SortAsc className="w-4 h-4" />}
          {sort === 'recent' ? 'Recent' : 'A–Z'}
        </Button>
        <Button onClick={onNewProject} className="gap-2">
          <Plus className="w-4 h-4" />
          New Project
        </Button>
      </div>

      {/* Content */}
      <main className="flex-1 px-6 pb-12">
        {isLoading ? (
          <div className="flex items-center justify-center py-32">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 text-center">
            <Film className="w-12 h-12 text-muted-foreground/40 mb-4" />
            <h2 className="text-lg font-medium text-foreground mb-1">
              {search ? 'No projects found' : 'No projects yet'}
            </h2>
            <p className="text-sm text-muted-foreground mb-6">
              {search ? 'Try a different search term' : 'Upload a video to get started'}
            </p>
            {!search && (
              <Button onClick={onNewProject} className="gap-2">
                <Plus className="w-4 h-4" />
                Create your first project
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map((proj) => (
              <div
                key={proj.id}
                className="group rounded-xl border border-border/50 bg-card overflow-hidden hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 transition-all duration-200 cursor-pointer"
                onClick={() => handleOpenProject(proj)}
              >
                {/* Thumbnail */}
                <div className="relative aspect-video bg-muted">
                  {proj.localThumbnail ? (
                    <img
                      src={proj.localThumbnail}
                      alt={proj.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="flex items-center justify-center w-full h-full">
                      <Film className="w-8 h-8 text-muted-foreground/30" />
                    </div>
                  )}
                  {!proj.hasLocalVideo && (
                    <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
                      <div className="flex items-center gap-1.5 text-xs text-warning">
                        <AlertTriangle className="w-4 h-4" />
                        Re-upload needed
                      </div>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-foreground/0 group-hover:bg-foreground/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                    <Play className="w-8 h-8 text-primary-foreground drop-shadow-lg" />
                  </div>
                </div>

                {/* Info */}
                <div className="p-3">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    {editingId === proj.id ? (
                      <form
                        className="flex items-center gap-1 flex-1 min-w-0"
                        onSubmit={(e) => {
                          e.preventDefault();
                          const trimmed = editingTitle.trim();
                          if (trimmed && trimmed !== proj.title) {
                            renameProject(proj.id, trimmed);
                          }
                          setEditingId(null);
                        }}
                      >
                        <input
                          autoFocus
                          value={editingTitle}
                          onChange={(e) => setEditingTitle(e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => {
                            if (e.key === 'Escape') setEditingId(null);
                          }}
                          className="flex-1 min-w-0 text-sm font-medium bg-transparent border-b border-primary text-foreground focus:outline-none"
                        />
                        <button type="submit" onClick={(e) => e.stopPropagation()} className="text-primary hover:text-primary/80">
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button type="button" onClick={(e) => { e.stopPropagation(); setEditingId(null); }} className="text-muted-foreground hover:text-foreground">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </form>
                    ) : (
                      <h3
                        className="font-medium text-sm text-foreground truncate cursor-text hover:text-primary transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingId(proj.id);
                          setEditingTitle(proj.title);
                        }}
                        title="Click to rename"
                      >
                        {proj.title}
                      </h3>
                    )}
                    <Badge variant="secondary" className="text-[10px] shrink-0">
                      {proj.platform}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{formatDate(proj.updated_at)}</p>

                  {/* Actions */}
                  <div className="flex items-center gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        duplicateProject(proj.id);
                      }}
                    >
                      <Copy className="w-3 h-3 mr-1" />
                      Duplicate
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteTarget(proj.id);
                      }}
                    >
                      <Trash2 className="w-3 h-3 mr-1" />
                      Delete
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete project?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the project and all associated data. The local video file will also be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteTarget) deleteProject(deleteTarget);
                setDeleteTarget(null);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Re-upload dialog */}
      <AlertDialog open={!!reuploadTarget} onOpenChange={() => setReuploadTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Video file missing</AlertDialogTitle>
            <AlertDialogDescription>
              The local video file was cleared from your browser cache. Please re-upload the original video to continue editing this project.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => fileInputRef.current?.click()}>
              <Upload className="w-4 h-4 mr-2" />
              Re-upload Video
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <input
        ref={fileInputRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={handleReuploadFile}
      />
    </div>
  );
}
