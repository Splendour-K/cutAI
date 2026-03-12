CREATE POLICY "Users can delete analysis of their projects"
ON public.video_analysis
FOR DELETE
TO public
USING (EXISTS (
  SELECT 1 FROM video_projects
  WHERE video_projects.id = video_analysis.project_id
    AND video_projects.user_id = auth.uid()
));