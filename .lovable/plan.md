

# Fix: Auto-fetch Stock Footage During Autonomous Auto-Edit

## Problem
The auto-edit flow approves B-roll suggestions but never fetches actual stock footage from Pexels. Each B-roll suggestion has a `searchQuery` but no `stockFootageUrl`, so the `BRollOverlay` renders a blank/placeholder overlay instead of real video.

## Solution
After the AI returns the EDL with B-roll suggestions, automatically search Pexels for each suggestion's `searchQuery`, download the first result's preview URL, and attach it to the B-roll entry before finalizing.

## Changes

### 1. `src/hooks/useAutoEditor.ts` — Add auto-fetch step after EDL is received

After `autoApproveAll(rawEdl)`, add a new step that:
- Iterates over all approved B-roll suggestions
- Calls `search-stock-footage` edge function for each suggestion's `searchQuery`
- Takes the first result's `previewUrl` and assigns it as `stockFootageUrl`
- Updates progress (70% → 90%) during this phase
- Handles failures gracefully: if a search fails, the B-roll is removed (status set to `'rejected'`) so no blank placeholder appears
- Sets status to `'ready'` for successfully fetched items

### 2. `src/components/BRollOverlay.tsx` — Add loading state

- If `status === 'approved'` but no `stockFootageUrl`, show a subtle loading spinner instead of the current placeholder
- This handles the brief window while footage is being fetched

### 3. `src/hooks/useVideoZoomPreview.ts` — Filter B-roll to only show ready items

- Change line 66-67 filter to only include B-roll with `status === 'ready'` (has actual footage URL), excluding `'approved'` items that haven't been fetched yet

This ensures users never see blank B-roll segments. The fetch happens automatically as part of the autonomous flow, and any failed fetches are silently excluded.

## Technical Detail

The B-roll fetch loop in `useAutoEditor.ts` will use `Promise.allSettled` to parallelize searches and handle individual failures without blocking the entire flow. Each successful result stores the Pexels preview URL directly on the B-roll suggestion object.

