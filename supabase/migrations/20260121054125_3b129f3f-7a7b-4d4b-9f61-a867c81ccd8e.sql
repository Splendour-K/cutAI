-- Make the videos bucket public so URLs can be accessed by external services
UPDATE storage.buckets 
SET public = true 
WHERE id = 'videos';