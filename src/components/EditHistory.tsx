import { Check, Clock, Undo2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { EditAction } from '@/types/video';

interface EditHistoryProps {
  edits: EditAction[];
  onUndo?: (editId: string) => void;
}

export function EditHistory({ edits, onUndo }: EditHistoryProps) {
  if (edits.length === 0) {
    return (
      <div className="p-4 text-center text-muted-foreground text-sm">
        <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p>No edits yet</p>
        <p className="text-xs mt-1">Start by typing instructions in the chat</p>
      </div>
    );
  }

  return (
    <div className="p-2 space-y-1">
      <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
        Edit History
      </div>
      {edits.map((edit, index) => (
        <div
          key={edit.id}
          className={cn(
            "flex items-center gap-3 px-3 py-2 rounded-lg transition-colors",
            edit.applied 
              ? "bg-primary/5 border border-primary/20" 
              : "bg-surface-elevated/50"
          )}
        >
          <div className={cn(
            "w-6 h-6 rounded-full flex items-center justify-center text-xs",
            edit.applied ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
          )}>
            {edit.applied ? <Check className="w-3 h-3" /> : index + 1}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-foreground truncate">{edit.description}</p>
            <p className="text-xs text-muted-foreground">
              {edit.type.charAt(0).toUpperCase() + edit.type.slice(1)}
            </p>
          </div>
          {onUndo && edit.applied && (
            <button
              onClick={() => onUndo(edit.id)}
              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-surface transition-colors"
            >
              <Undo2 className="w-4 h-4" />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
