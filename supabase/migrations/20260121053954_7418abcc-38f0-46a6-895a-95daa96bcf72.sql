-- Add storage policies for the videos bucket to allow uploads

-- Allow anyone to upload videos (for unauthenticated users during video editing)
CREATE POLICY "Allow public uploads to videos bucket"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'videos');

-- Allow anyone to read videos (needed for caption generation)
CREATE POLICY "Allow public read access to videos"
ON storage.objects
FOR SELECT
USING (bucket_id = 'videos');

-- Allow anyone to update their uploaded videos
CREATE POLICY "Allow public update of videos"
ON storage.objects
FOR UPDATE
USING (bucket_id = 'videos');

-- Allow anyone to delete videos (cleanup temp files)
CREATE POLICY "Allow public delete of videos"
ON storage.objects
FOR DELETE
USING (bucket_id = 'videos');