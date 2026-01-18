import { useState } from 'react';
import { 
  Plus, 
  Star, 
  StarOff, 
  Trash2, 
  Copy, 
  Edit3, 
  Check, 
  X,
  Palette
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
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
import { cn } from '@/lib/utils';
import type { BrandPreset } from '@/hooks/useBrandPresets';
import type { VisualStyle } from '@/types/animation';

interface BrandPresetsManagerProps {
  presets: BrandPreset[];
  selectedStyle: VisualStyle | null;
  onCreatePreset: (name: string, description: string, style: VisualStyle) => BrandPreset;
  onUpdatePreset: (presetId: string, updates: Partial<Omit<BrandPreset, 'id' | 'createdAt'>>) => void;
  onDeletePreset: (presetId: string) => void;
  onSetDefault: (presetId: string) => void;
  onDuplicatePreset: (presetId: string) => BrandPreset | undefined;
  onSelectPreset: (style: VisualStyle) => void;
}

export function BrandPresetsManager({
  presets,
  selectedStyle,
  onCreatePreset,
  onUpdatePreset,
  onDeletePreset,
  onSetDefault,
  onDuplicatePreset,
  onSelectPreset,
}: BrandPresetsManagerProps) {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingPresetId, setEditingPresetId] = useState<string | null>(null);
  const [newPresetName, setNewPresetName] = useState('');
  const [newPresetDescription, setNewPresetDescription] = useState('');
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');

  const handleCreatePreset = () => {
    if (!selectedStyle || !newPresetName.trim()) return;
    
    onCreatePreset(newPresetName.trim(), newPresetDescription.trim(), selectedStyle);
    setNewPresetName('');
    setNewPresetDescription('');
    setIsCreateDialogOpen(false);
  };

  const handleStartEdit = (preset: BrandPreset) => {
    setEditingPresetId(preset.id);
    setEditName(preset.name);
    setEditDescription(preset.description);
  };

  const handleSaveEdit = (presetId: string) => {
    if (!editName.trim()) return;
    
    onUpdatePreset(presetId, {
      name: editName.trim(),
      description: editDescription.trim(),
    });
    setEditingPresetId(null);
  };

  const handleCancelEdit = () => {
    setEditingPresetId(null);
    setEditName('');
    setEditDescription('');
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-foreground flex items-center gap-2">
          <Palette className="w-4 h-4" />
          Brand Presets
        </h4>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button 
              variant="outline" 
              size="sm" 
              disabled={!selectedStyle}
              className="gap-1.5 h-7 text-xs"
            >
              <Plus className="w-3 h-3" />
              Save Current
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Save Brand Preset</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Preset Name</label>
                <Input
                  placeholder="e.g., My Brand Style"
                  value={newPresetName}
                  onChange={(e) => setNewPresetName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Description (optional)</label>
                <Textarea
                  placeholder="Describe when to use this style..."
                  value={newPresetDescription}
                  onChange={(e) => setNewPresetDescription(e.target.value)}
                  rows={2}
                />
              </div>
              {selectedStyle && (
                <div className="p-3 rounded-lg bg-muted/50 border border-border">
                  <div className="flex items-center gap-2 mb-2">
                    <div 
                      className="w-8 h-8 rounded flex items-center justify-center text-sm font-bold"
                      style={{
                        backgroundColor: selectedStyle.primaryColor,
                        color: selectedStyle.secondaryColor,
                      }}
                    >
                      Aa
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{selectedStyle.name}</p>
                      <p className="text-xs text-muted-foreground">{selectedStyle.fontFamily}</p>
                    </div>
                  </div>
                </div>
              )}
              <Button 
                onClick={handleCreatePreset}
                disabled={!newPresetName.trim()}
                className="w-full"
              >
                Save Preset
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {presets.length === 0 ? (
        <div className="py-6 text-center border border-dashed border-border rounded-xl">
          <Palette className="w-8 h-8 mx-auto mb-2 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">
            No brand presets saved yet.
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Select a style and click "Save Current" to create one.
          </p>
        </div>
      ) : (
        <ScrollArea className="h-[200px]">
          <div className="space-y-2 pr-3">
            {presets.map((preset) => {
              const isEditing = editingPresetId === preset.id;

              return (
                <div
                  key={preset.id}
                  className={cn(
                    "p-3 rounded-xl border transition-all",
                    "bg-surface-elevated/50 border-border/50 hover:border-border"
                  )}
                >
                  {isEditing ? (
                    <div className="space-y-2">
                      <Input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        placeholder="Preset name"
                        className="h-8"
                      />
                      <Textarea
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                        placeholder="Description"
                        rows={2}
                        className="resize-none"
                      />
                      <div className="flex gap-2">
                        <Button 
                          size="sm" 
                          onClick={() => handleSaveEdit(preset.id)}
                          className="flex-1 h-7"
                        >
                          <Check className="w-3 h-3 mr-1" />
                          Save
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={handleCancelEdit}
                          className="h-7"
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-3">
                      {/* Style Preview */}
                      <button
                        onClick={() => onSelectPreset(preset.style)}
                        className="w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold shrink-0 hover:scale-105 transition-transform"
                        style={{
                          backgroundColor: preset.style.primaryColor,
                          color: preset.style.secondaryColor,
                        }}
                      >
                        Aa
                      </button>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <button
                            onClick={() => onSelectPreset(preset.style)}
                            className="font-medium text-sm text-foreground hover:text-primary transition-colors truncate"
                          >
                            {preset.name}
                          </button>
                          {preset.isDefault && (
                            <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">
                              Default
                            </Badge>
                          )}
                        </div>
                        {preset.description && (
                          <p className="text-xs text-muted-foreground line-clamp-1">
                            {preset.description}
                          </p>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex gap-1 shrink-0">
                        <button
                          onClick={() => onSetDefault(preset.id)}
                          className={cn(
                            "p-1.5 rounded-lg transition-colors",
                            preset.isDefault 
                              ? "text-yellow-500" 
                              : "text-muted-foreground hover:text-yellow-500 hover:bg-muted"
                          )}
                          title={preset.isDefault ? "Default preset" : "Set as default"}
                        >
                          {preset.isDefault ? (
                            <Star className="w-3.5 h-3.5 fill-current" />
                          ) : (
                            <StarOff className="w-3.5 h-3.5" />
                          )}
                        </button>
                        <button
                          onClick={() => handleStartEdit(preset)}
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                          title="Edit"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => onDuplicatePreset(preset.id)}
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                          title="Duplicate"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <button
                              className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Brand Preset</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete "{preset.name}"? This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction 
                                onClick={() => onDeletePreset(preset.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
