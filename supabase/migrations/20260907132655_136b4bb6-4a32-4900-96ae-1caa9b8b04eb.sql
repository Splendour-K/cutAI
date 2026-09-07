-- Remove wide-open write access (anyone could overwrite/delete any user's videos)
DROP POLICY IF EXISTS "Allow public uploads to videos bucket" ON storage.objects;
DROP POLICY IF EXISTS "Allow public update of videos" ON storage.objects;
DROP POLICY IF EXISTS "Allow public delete of videos" ON storage.objects;

-- Deduplicate owner-scoped policies (the "... in their own folder" versions are kept)
DROP POLICY IF EXISTS "Users can upload their own videos" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own videos" ON storage.objects;