ALTER TABLE public.video_projects
  ADD COLUMN IF NOT EXISTS editor_state jsonb,
  ADD COLUMN IF NOT EXISTS playback_rate numeric NOT NULL DEFAULT 1;

CREATE TABLE public.project_exports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.video_projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  version_number integer NOT NULL DEFAULT 0,
  label text NOT NULL DEFAULT 'Export',
  quality text NOT NULL DEFAULT 'standard',
  storage_bucket text NOT NULL DEFAULT 'videos',
  storage_path text NOT NULL,
  public_url text,
  filename text,
  mime_type text,
  file_size_bytes bigint,
  duration_seconds numeric,
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_exports TO authenticated;
GRANT ALL ON public.project_exports TO service_role;

ALTER TABLE public.project_exports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view exports of their projects"
  ON public.project_exports FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create exports for their projects"
  ON public.project_exports FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND EXISTS (
    SELECT 1 FROM public.video_projects p WHERE p.id = project_id AND p.user_id = auth.uid()
  ));

CREATE POLICY "Users can update exports of their projects"
  ON public.project_exports FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete exports of their projects"
  ON public.project_exports FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE UNIQUE INDEX project_exports_project_version_idx
  ON public.project_exports (project_id, version_number);

CREATE INDEX project_exports_project_created_idx
  ON public.project_exports (project_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.set_project_export_version_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.version_number IS NULL OR NEW.version_number = 0 THEN
    SELECT COALESCE(MAX(version_number), 0) + 1 INTO NEW.version_number
    FROM public.project_exports WHERE project_id = NEW.project_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_project_export_version_number_trigger
  BEFORE INSERT ON public.project_exports
  FOR EACH ROW EXECUTE FUNCTION public.set_project_export_version_number();

CREATE TRIGGER update_project_exports_updated_at
  BEFORE UPDATE ON public.project_exports
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();