import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { CaptionSettings, AspectRatio } from '@/types/video';
import type { EditDecisionList } from '@/types/autoEditor';
import type { Enhancement } from '@/types/enhancement';

export interface EditorState {
  edl: EditDecisionList | null;
  enhancements: Enhancement[];
  editedCaptions: Record<number, string>;
  captions: CaptionSettings | null;
  playbackRate: number;
  aspectRatio: AspectRatio;
}

export type SaveState = 'idle' | 'saving' | 'saved' | 'error';

const DEBOUNCE_MS = 1500;

/**
 * Continuously mirrors the editor's working state (cuts, zooms, graphics,
 * captions, speed, format) into the cloud so nothing depends on the browser.
 */
export function useEditorAutosave(projectId: string, state: EditorState, enabled: boolean) {
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const lastPayload = useRef<string>('');
  const timer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (!enabled || !projectId) return;

    const payload = JSON.stringify(state);
    if (payload === lastPayload.current) return;

    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      lastPayload.current = payload;
      setSaveState('saving');
      const { error } = await supabase
        .from('video_projects')
        .update({
          editor_state: state as never,
          caption_settings: (state.captions ?? null) as never,
          playback_rate: state.playbackRate,
          aspect_ratio: state.aspectRatio,
          updated_at: new Date().toISOString(),
        })
        .eq('id', projectId);

      if (error) {
        console.error('Autosave failed:', error);
        lastPayload.current = '';
        setSaveState('error');
        return;
      }
      setSaveState('saved');
      setLastSavedAt(new Date());
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer.current);
  }, [projectId, state, enabled]);

  return { saveState, lastSavedAt };
}

export async function loadEditorState(projectId: string): Promise<EditorState | null> {
  const { data, error } = await supabase
    .from('video_projects')
    .select('editor_state, playback_rate')
    .eq('id', projectId)
    .maybeSingle();
  if (error || !data?.editor_state) return null;
  const state = data.editor_state as unknown as EditorState;
  return { ...state, playbackRate: state.playbackRate ?? data.playback_rate ?? 1 };
}
