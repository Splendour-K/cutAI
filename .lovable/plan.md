

# Fix: Original Audio Getting Ducked During B-Roll

## Root Cause
The `bRollDuckingLevel` state in `VideoPreview.tsx` is initialized to `15` (line 61), which converts to `0.15` and overrides the hook's default of `1.0`. This means the main video audio drops to 15% whenever B-roll appears — despite the earlier fix to the hook default.

## Change

### `src/components/VideoPreview.tsx`
- Change the initial state of `bRollDuckingLevel` from `15` to `100` (line 61)
- This means the slider defaults to 100% = no ducking, preserving original audio
- The user can still manually lower it via the existing slider in the UI if they want ducking

One-line fix: `useState(15)` → `useState(100)`

