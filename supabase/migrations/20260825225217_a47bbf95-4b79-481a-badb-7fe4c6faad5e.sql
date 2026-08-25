CREATE TABLE public.video_assets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.video_projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'original',
  storage_bucket TEXT NOT NULL DEFAULT 'videos',
  storage_path TEXT NOT NULL,
  public_url TEXT,
  original_filename TEXT,
  mime_type TEXT,
  file_size_bytes BIGINT,
  duration_seconds NUMERIC,
  width INTEGER,
  height INTEGER,
  status TEXT NOT NULL DEFAULT 'uploading',
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_video_assets_project ON public.video_assets(project_id);
CREATE INDEX idx_video_assets_user ON public.video_assets(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.video_assets TO authenticated;
GRANT ALL ON public.video_assets TO service_role;

ALTER TABLE public.video_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own video assets"
  ON public.video_assets FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create video assets for their own projects"
  ON public.video_assets FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND EXISTS (
    SELECT 1 FROM public.video_projects
    WHERE video_projects.id = video_assets.project_id
      AND video_projects.user_id = auth.uid()
  ));

CREATE POLICY "Users can update their own video assets"
  ON public.video_assets FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own video assets"
  ON public.video_assets FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER update_video_assets_updated_at
  BEFORE UPDATE ON public.video_assets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage write protection: users can only write/delete inside their own folder
CREATE POLICY "Users can upload videos in their own folder"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'videos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can update videos in their own folder"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'videos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can delete videos in their own folder"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'videos' AND (storage.foldername(name))[1] = auth.uid()::text);