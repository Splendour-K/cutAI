

# Dashboard & Project System — Issues & Gaps

## Currently Working
- Project creation, upload, local IndexedDB storage
- Dashboard with search, sort, delete, duplicate, rename
- Analysis persistence (skips re-processing on resume)
- Auto-save every 2 minutes

## Issues Found

### 1. `useState` misused as `useEffect` for auth sync (Index.tsx, line 21-25)
`useState(() => { ... })` is being used as a side-effect initializer. This runs only once during initial render and won't react to auth state changes. Should be `useEffect`.

### 2. Dashboard opens resumed projects with `status: 'analyzing'` (Dashboard.tsx, line 75)
When resuming a project from the dashboard, it always sets `status: 'analyzing'` regardless of the project's actual status. This is misleading — the EditorWorkspace then has to figure out if analysis already exists. Should use the project's stored status (e.g. `'ready'` or `'in_progress'`).

### 3. Re-upload flow also sets `status: 'analyzing'` (Dashboard.tsx, line 107)
Same issue as above for re-uploaded videos.

### 4. `forwardRef` warnings in console
`VideoTimeline` and `DraggableCaptionOverlay` are passed refs but don't use `React.forwardRef()`. These are warnings, not breaking, but should be fixed.

### 5. No caption settings persistence
Caption style, animation, position, font, and color settings are stored only in component state. When the user leaves and resumes, all caption customization is lost. These should be saved to the `video_projects` table or a dedicated column.

### 6. No edit history restoration on resume
The `edits` array in `VideoProject` is always initialized as `[]` when opening from the dashboard. Previous edit actions from `edit_history` table are never loaded back.

### 7. Auto-save doesn't persist caption or edit state
The 2-minute auto-save only updates `updated_at` and `status`. It doesn't save caption settings, applied edits, or timeline state.

### 8. Export is a no-op placeholder
`handleExport` just toggles status for 3 seconds. No actual export happens — but this is a broader feature gap, not a dashboard bug.

## Proposed Fixes

### Fix 1: Auth sync — `useState` → `useEffect` (Index.tsx)
Replace the misused `useState` with a proper `useEffect` that reacts to `user` changes.

### Fix 2: Use stored status when resuming (Dashboard.tsx)
Map the database `status` field to the `VideoProject.status` type when opening a project, defaulting to `'ready'` for completed projects.

### Fix 3: Fix forwardRef warnings (VideoTimeline.tsx, DraggableCaptionOverlay.tsx)
Wrap both components with `React.forwardRef`.

### Fix 4: Persist and restore caption settings
- Add a `caption_settings` JSONB column to `video_projects` (migration)
- Save caption settings during auto-save
- Load and restore them when resuming a project in EditorWorkspace

### Fix 5: Load edit history on resume
- In EditorWorkspace mount, fetch `edit_history` for the project and populate the `edits` array

### Technical Details

**Migration SQL:**
```sql
ALTER TABLE video_projects ADD COLUMN caption_settings jsonb DEFAULT null;
```

**Files to change:**
- `src/pages/Index.tsx` — fix auth sync effect
- `src/components/Dashboard.tsx` — use correct status on resume
- `src/components/EditorWorkspace.tsx` — persist/restore captions, load edit history, improve auto-save
- `src/components/VideoTimeline.tsx` — add forwardRef
- `src/components/DraggableCaptionOverlay.tsx` — add forwardRef

