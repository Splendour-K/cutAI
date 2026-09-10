CREATE TABLE public.project_versions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES public.video_projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  version_number integer NOT NULL,
  label text NOT NULL DEFAULT 'Version',
  note text,
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (project_id, version_number)
);

CREATE INDEX project_versions_project_idx ON public.project_versions (project_id, version_number DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_versions TO authenticated;
GRANT ALL ON public.project_versions TO service_role;

ALTER TABLE public.project_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view versions of their projects"
ON public.project_versions FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can create versions for their projects"
ON public.project_versions FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id AND EXISTS (
  SELECT 1 FROM public.video_projects p WHERE p.id = project_id AND p.user_id = auth.uid()
));

CREATE POLICY "Users can update versions of their projects"
ON public.project_versions FOR UPDATE TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete versions of their projects"
ON public.project_versions FOR DELETE TO authenticated
USING (auth.uid() = user_id);

CREATE TRIGGER update_project_versions_updated_at
BEFORE UPDATE ON public.project_versions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.set_project_version_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.version_number IS NULL OR NEW.version_number = 0 THEN
    SELECT COALESCE(MAX(version_number), 0) + 1 INTO NEW.version_number
    FROM public.project_versions WHERE project_id = NEW.project_id;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.set_project_version_number() FROM anon, authenticated;

CREATE TRIGGER set_project_version_number_trigger
BEFORE INSERT ON public.project_versions
FOR EACH ROW EXECUTE FUNCTION public.set_project_version_number();