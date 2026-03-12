

# Persistent Video Dashboard for User Projects

## Overview
Add a project dashboard between login and the editor. Videos are stored locally on the user's device (using IndexedDB) to save cloud credits, while project metadata is persisted in the database. Users can resume editing, duplicate, delete, and manage their projects.

## Architecture

```text
Homepage (UploadZone)
  └─ [User logged in] → Dashboard (new)
       ├─ Project grid with thumbnails
       ├─ Click project → EditorWorkspace (resume)
       └─ "New Project" → UploadZone flow
  └─ [Guest] → Current upload flow (unchanged)
```

## Changes

### 1. New: `src/lib/localVideoStore.ts` — IndexedDB helper for local video storage
- Store/retrieve video blobs keyed by project ID
- Functions: `saveVideoLocally(projectId, file)`, `getLocalVideo(projectId)`, `deleteLocalVideo(projectId)`, `getVideoThumbnail(projectId)`
- Generate and cache thumbnail (canvas snapshot of first frame)
- Uses the native IndexedDB API (no extra dependencies)

### 2. New: `src/components/Dashboard.tsx` — Project dashboard UI
- Grid of project cards showing: thumbnail (from local video or placeholder), title, platform icon, last edited date, status badge
- Actions per project: Continue editing, Duplicate, Delete, Export
- Search bar to filter by name
- Sort toggle (recent / alphabetical)
- "New Project" button that triggers the upload flow
- Empty state for users with no projects
- Shows warning if local video file is missing (cleared cache)

### 3. New: `src/hooks/useProjects.ts` — Fetch and manage user projects
- Query `video_projects` table for the current user, ordered by `updated_at desc`
- Provide `duplicateProject`, `deleteProject`, `renameProject` mutations
- Check local video availability via IndexedDB on load

### 4. Update: `src/pages/Index.tsx` — Route between dashboard and upload
- If user is logged in, show Dashboard instead of UploadZone
- Dashboard has a "New Project" button that shows the UploadZone
- When a project is selected from dashboard, load it into EditorWorkspace
- Restore local video blob from IndexedDB when resuming

### 5. Update: `src/hooks/useVideoUpload.ts` — Save video locally after upload
- After successful upload to cloud storage, also save the file to IndexedDB via `saveVideoLocally(projectId, file)`
- This ensures the video is available locally for future sessions without re-downloading

### 6. Update: `src/components/EditorWorkspace.tsx` — Auto-save support
- Add a debounced auto-save that updates `video_projects.updated_at` and stores current edit state (caption settings, timeline metadata) every 2 minutes
- Save on significant actions (apply edits, generate captions)
- Update `video_projects.status` to reflect current state

### 7. Update: `src/components/UploadZone.tsx` — Add "Back to Dashboard" navigation
- When user is logged in and came from dashboard, show a back button to return to the project list

## Local Video Storage (IndexedDB)
Videos are stored entirely on the user's device. The database only stores metadata (title, platform, status, timestamps). This means:
- No cloud storage costs for video files during editing
- Videos persist across browser sessions (unless user clears site data)
- If local video is missing, dashboard shows a "Re-upload" prompt

## Data Flow for Resume
1. User opens dashboard → fetch projects from database
2. User clicks a project → retrieve video blob from IndexedDB
3. If blob exists → create `blob:` URL, open EditorWorkspace
4. If blob missing → show re-upload dialog, user provides the file again
5. EditorWorkspace loads, fetches existing analysis/captions from database
6. User continues editing where they left off

## No Database Schema Changes Needed
The existing `video_projects` table already has all required fields (title, status, platform, updated_at, video_url, thumbnail_url). The `video_analysis` and `edit_history` tables handle timeline/edit persistence.

