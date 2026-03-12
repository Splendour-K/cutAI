const DB_NAME = 'clipzy_local_videos';
const DB_VERSION = 1;
const VIDEO_STORE = 'videos';
const THUMBNAIL_STORE = 'thumbnails';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(VIDEO_STORE)) {
        db.createObjectStore(VIDEO_STORE);
      }
      if (!db.objectStoreNames.contains(THUMBNAIL_STORE)) {
        db.createObjectStore(THUMBNAIL_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveVideoLocally(projectId: string, file: File): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(VIDEO_STORE, 'readwrite');
    tx.objectStore(VIDEO_STORE).put(file, projectId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getLocalVideo(projectId: string): Promise<File | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(VIDEO_STORE, 'readonly');
    const req = tx.objectStore(VIDEO_STORE).get(projectId);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteLocalVideo(projectId: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([VIDEO_STORE, THUMBNAIL_STORE], 'readwrite');
    tx.objectStore(VIDEO_STORE).delete(projectId);
    tx.objectStore(THUMBNAIL_STORE).delete(projectId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function generateAndCacheThumbnail(projectId: string, videoFile: File): Promise<string> {
  const db = await openDB();

  // Check cache first
  const cached = await new Promise<string | null>((resolve, reject) => {
    const tx = db.transaction(THUMBNAIL_STORE, 'readonly');
    const req = tx.objectStore(THUMBNAIL_STORE).get(projectId);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
  if (cached) return cached;

  // Generate thumbnail from first frame
  const url = URL.createObjectURL(videoFile);
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;
    video.onloadeddata = () => {
      video.currentTime = 1; // seek to 1s for a better frame
    };
    video.onseeked = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 320;
      canvas.height = 180;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(video, 0, 0, canvas.width, canvas.height);
      const data = canvas.toDataURL('image/jpeg', 0.7);
      URL.revokeObjectURL(url);
      resolve(data);
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to generate thumbnail'));
    };
    video.src = url;
  });

  // Cache it
  const db2 = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db2.transaction(THUMBNAIL_STORE, 'readwrite');
    tx.objectStore(THUMBNAIL_STORE).put(dataUrl, projectId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });

  return dataUrl;
}

export async function getVideoThumbnail(projectId: string): Promise<string | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(THUMBNAIL_STORE, 'readonly');
    const req = tx.objectStore(THUMBNAIL_STORE).get(projectId);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}

export async function hasLocalVideo(projectId: string): Promise<boolean> {
  const file = await getLocalVideo(projectId);
  return file !== null;
}
