

# B-Roll Audio & Transition Improvements

## Current State
- B-roll `<video>` elements are already rendered with `muted` attribute (good)
- However, the `useAudioDucking` hook **lowers the main video volume to 15%** when B-roll is active — this contradicts the requirement to keep original audio unchanged
- B-roll overlays appear/disappear instantly with no visual transitions

## Changes

### 1. `src/hooks/useAudioDucking.ts` — Stop ducking main audio during B-roll
Change the default `duckedVolume` from `0.15` to `1.0` so the main video audio remains at full volume when B-roll plays. The hook infrastructure stays intact for users who want manual ducking control later.

### 2. `src/components/BRollOverlay.tsx` — Add fade-in/fade-out transitions
- Track an `isVisible` state that starts `false` and transitions to `true` after mount (triggers CSS fade-in)
- Calculate proximity to clip boundaries: fade in during first 0.3s, fade out during last 0.3s
- Apply `opacity` based on the fade progress using an ease curve
- This creates a smooth cross-dissolve effect at entry/exit points without complex animation libraries

### 3. No changes needed to `useVideoZoomPreview.ts`
The B-roll filtering already correctly shows only `'ready'` items with valid URLs.

