import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "get_project",
  title: "Get project details",
  description: "Fetch one of the signed-in user's video projects, including its caption settings and recent edit history.",
  inputSchema: {
    project_id: z.string().uuid().describe("The project's ID."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ project_id }, ctx) => {
    if (!ctx.isAuthenticated()) throw new ToolError("Not authenticated");
    const supabase = supabaseForUser(ctx);
    const { data: project, error } = await supabase
      .from("video_projects")
      .select("*")
      .eq("id", project_id)
      .maybeSingle();
    if (error) throw new ToolError(error.message);
    if (!project) throw new ToolError("Project not found");

    const { data: edits } = await supabase
      .from("edit_history")
      .select("id,edit_type,description,parameters,applied_at")
      .eq("project_id", project_id)
      .order("applied_at", { ascending: false })
      .limit(25);

    const payload = { project, edits: edits ?? [] };
    return {
      content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
      structuredContent: payload,
    };
  },
});