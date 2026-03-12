

# Connect Chat Edit Actions to Video Preview

## Problem
When users ask the AI chat to make edits (e.g., "remove pauses", "speed up", "add zoom at 5s"), the chat returns a structured JSON `EditAction` — but it only gets logged to the edit history array. No actual video modification happens. Cuts don't cut, zooms don't zoom, speed changes don't apply.

## Solution
Parse the chat's JSON response into concrete operations that modify the auto-editor's EDL or trigger existing workflows. The chat becomes a natural-language interface to the same editing engine the Auto Editor uses.

## How It Works

```text
User chat message
  → AI returns text + JSON block
  → useVideoChat extracts JSON (already works)
  → NEW: EditorWorkspace interprets the editAction
      ├─ "caption" → enable captions (already works)
      ├─ "cut" → create/update EDL segments to exclude timestamps
      ├─ "speed" → store speed modifier on project state  
      ├─ "trim" → adjust EDL to only include specified range
      ├─ "effect" / "transition" → apply zoom/transition to EDL
      └─ "format" → change aspect ratio
```

## Changes

### 1. Expand `EditAction` type (`src/types/video.ts`)
Add an optional `parameters` field to carry structured data from the chat JSON (timestamps, captionStyle, speed values, etc.).

### 2. Update `useVideoChat.ts` — Pass full JSON parameters into `EditAction`
Currently the hook extracts `editType` and `description` from the JSON block but discards `timestamps`, `captionStyle`, etc. Preserve the full parsed JSON as `parameters` on the `EditAction`.

### 3. Update `handleSendMessage` in `EditorWorkspace.tsx` — Route actions to real operations
After receiving an `EditAction` from chat, dispatch based on `editAction.type`:

- **`cut`**: If auto-editor has an existing EDL, mark matching segments as excluded. If no EDL exists, create a minimal EDL from the analysis transcript segments and apply the cuts. This reuses `autoEditor.toggleSegmentInclusion`.
- **`trim`**: Same as cut but excludes everything outside the specified range.
- **`speed`**: Store a `playbackRate` on project state; `VideoPreview` already uses `<video>` element which supports `playbackRate`.
- **`caption`**: Already works — keep as-is, but also apply `captionStyle` from parameters to update `captionSettings.style`.
- **`effect`/`transition`**: If timestamps provided, add zoom effects via `autoEditor.updateZoom` or create new ones.
- **`format`**: Call existing `handleFormatChange` with the specified ratio.

### 4. Update `useAutoEditor.ts` — Add `createEDLFromSegments` and `excludeTimeRange`
Two new methods:
- `createEDLFromSegments(segments, duration)`: Builds a baseline EDL from transcript segments (all included, no zooms/b-roll). This lets chat actions work even before the user runs the full auto-editor.
- `excludeTimeRange(startTime, endTime)`: Marks any A-roll segments overlapping the given range as excluded. Used by both "cut" and "trim" actions.
- `addZoomEffect(segmentId, zoomType, startTime, endTime)`: Adds a new zoom to the EDL.

### 5. Auto-enable edit preview when chat applies cuts
Same pattern already used for auto-editor — set `isPreviewingEdits = true` when a cut/trim action modifies the EDL.

## Files to Change
- `src/types/video.ts` — add `parameters` to `EditAction`
- `src/hooks/useVideoChat.ts` — preserve full JSON params on `EditAction`
- `src/hooks/useAutoEditor.ts` — add `createEDLFromSegments`, `excludeTimeRange`, `addZoomEffect`
- `src/components/EditorWorkspace.tsx` — route chat edit actions to real operations

