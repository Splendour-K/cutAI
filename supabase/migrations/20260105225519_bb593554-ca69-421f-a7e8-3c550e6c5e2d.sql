-- Add unique constraint on project_id for video_analysis table
ALTER TABLE public.video_analysis 
ADD CONSTRAINT video_analysis_project_id_unique UNIQUE (project_id);