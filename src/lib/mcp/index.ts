import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listProjectsTool from "./tools/list-projects";
import getProjectTool from "./tools/get-project";
import getVideoAnalysisTool from "./tools/get-video-analysis";
import createProjectTool from "./tools/create-project";
import updateProjectTool from "./tools/update-project";
import deleteProjectTool from "./tools/delete-project";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "chat-edit-pro",
  title: "Chat Edit Pro",
  version: "0.1.0",
  instructions:
    "Tools for Chat Edit Pro, an AI video editing app. Use `list_projects` and `get_project` to inspect the signed-in user's video projects, `get_video_analysis` to read a project's transcript, pauses, key moments and suggested edits, and `create_project` / `update_project` / `delete_project` to manage projects. Video uploads, rendering, and export happen inside the app.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [
    listProjectsTool,
    getProjectTool,
    getVideoAnalysisTool,
    createProjectTool,
    updateProjectTool,
    deleteProjectTool,
  ],
});