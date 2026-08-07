import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "update_project",
  title: "Update video project",
  description: "Rename a project or update its description, platform, content type, aspect ratio, or status.",
  inputSchema: {
    project_id: z.string().uuid().describe("The project's ID."),
    title: z.string().trim().optional().describe("New project title."),
    description: z.string().trim().optional().describe("New project description."),
    platform: z
      .enum(["youtube", "instagram", "tiktok", "twitter", "linkedin", "custom"])
      .optional()
      .describe("New target platform."),
    content_type: z.enum(["short", "long"]).optional().describe("New content type."),
    aspect_ratio: z.enum(["16:9", "9:16", "1:1", "4:5"]).optional().describe("New aspect ratio."),
    status: z.string().trim().optional().describe("New project status, e.g. draft or ready."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  handler: async ({ project_id, ...fields }, ctx) => {
    if (!ctx.isAuthenticated()) throw new ToolError("Not authenticated");
    const updates = Object.fromEntries(
      Object.entries(fields).filter(([, value]) => value !== undefined),
    );
    if (Object.keys(updates).length === 0) throw new ToolError("Provide at least one field to update.");

    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("video_projects")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", project_id)
      .select()
      .maybeSingle();
    if (error) throw new ToolError(error.message);
    if (!data) throw new ToolError("Project not found");
    return {
      content: [{ type: "text", text: `Updated project "${data.title}" (${data.id})` }],
      structuredContent: { project: data },
    };
  },
});