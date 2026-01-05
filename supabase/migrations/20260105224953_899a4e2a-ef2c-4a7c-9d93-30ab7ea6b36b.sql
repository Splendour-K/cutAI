-- Create profiles table for user data
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Trigger to create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (new.id, new.email, new.raw_user_meta_data ->> 'display_name');
  RETURN new;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create video_projects table
CREATE TABLE public.video_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Untitled Project',
  description TEXT,
  video_url TEXT,
  thumbnail_url TEXT,
  duration_seconds NUMERIC,
  platform TEXT NOT NULL DEFAULT 'youtube',
  content_type TEXT NOT NULL DEFAULT 'short',
  aspect_ratio TEXT NOT NULL DEFAULT '16:9',
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

ALTER TABLE public.video_projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own projects"
  ON public.video_projects FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own projects"
  ON public.video_projects FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own projects"
  ON public.video_projects FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own projects"
  ON public.video_projects FOR DELETE
  USING (auth.uid() = user_id);

-- Create video_analysis table for AI analysis results
CREATE TABLE public.video_analysis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.video_projects(id) ON DELETE CASCADE,
  transcription JSONB,
  pauses JSONB,
  key_moments JSONB,
  scene_changes JSONB,
  suggested_edits JSONB,
  analysis_status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

ALTER TABLE public.video_analysis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view analysis of their projects"
  ON public.video_analysis FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.video_projects
    WHERE video_projects.id = video_analysis.project_id
    AND video_projects.user_id = auth.uid()
  ));

CREATE POLICY "Users can create analysis for their projects"
  ON public.video_analysis FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.video_projects
    WHERE video_projects.id = video_analysis.project_id
    AND video_projects.user_id = auth.uid()
  ));

CREATE POLICY "Users can update analysis of their projects"
  ON public.video_analysis FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.video_projects
    WHERE video_projects.id = video_analysis.project_id
    AND video_projects.user_id = auth.uid()
  ));

-- Create edit_history table to track applied edits
CREATE TABLE public.edit_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.video_projects(id) ON DELETE CASCADE,
  edit_type TEXT NOT NULL,
  description TEXT NOT NULL,
  parameters JSONB,
  applied_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

ALTER TABLE public.edit_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view edit history of their projects"
  ON public.edit_history FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.video_projects
    WHERE video_projects.id = edit_history.project_id
    AND video_projects.user_id = auth.uid()
  ));

CREATE POLICY "Users can create edit history for their projects"
  ON public.edit_history FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.video_projects
    WHERE video_projects.id = edit_history.project_id
    AND video_projects.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete edit history of their projects"
  ON public.edit_history FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.video_projects
    WHERE video_projects.id = edit_history.project_id
    AND video_projects.user_id = auth.uid()
  ));

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_video_projects_updated_at
  BEFORE UPDATE ON public.video_projects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_video_analysis_updated_at
  BEFORE UPDATE ON public.video_analysis
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for videos
INSERT INTO storage.buckets (id, name, public) VALUES ('videos', 'videos', false);

-- Storage policies for videos bucket
CREATE POLICY "Users can upload their own videos"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'videos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view their own videos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'videos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own videos"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'videos' AND auth.uid()::text = (storage.foldername(name))[1]);