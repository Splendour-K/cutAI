import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "delete_project",
  title: "Delete video project",
  description: "Permanently delete one of the signed-in user's projects along with its analysis and edit history.",
  inputSchema: {
    project_id: z.string().uuid().describe("The project's ID."),
  },
  annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ project_id }, ctx) => {
    if (!ctx.isAuthenticated()) throw new ToolError("Not authenticated");
    const supabase = supabaseForUser(ctx);

    const { data: project, error: findError } = await supabase
      .from("video_projects")
      .select("id,title")
      .eq("id", project_id)
      .maybeSingle();
    if (findError) throw new ToolError(findError.message);
    if (!project) throw new ToolError("Project not found");

    await supabase.from("edit_history").delete().eq("project_id", project_id);
    await supabase.from("video_analysis").delete().eq("project_id", project_id);
    const { error } = await supabase.from("video_projects").delete().eq("id", project_id);
    if (error) throw new ToolError(error.message);

    return {
      content: [{ type: "text", text: `Deleted project "${project.title}" (${project.id})` }],
      structuredContent: { deleted_project_id: project.id },
    };
  },
});