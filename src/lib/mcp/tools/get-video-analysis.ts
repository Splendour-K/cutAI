import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "get_video_analysis",
  title: "Get video analysis",
  description: "Fetch the AI analysis for a project: transcription, pauses, key moments, scene changes, and suggested edits.",
  inputSchema: {
    project_id: z.string().uuid().describe("The project's ID."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ project_id }, ctx) => {
    if (!ctx.isAuthenticated()) throw new ToolError("Not authenticated");
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("video_analysis")
      .select("*")
      .eq("project_id", project_id)
      .maybeSingle();
    if (error) throw new ToolError(error.message);
    if (!data) throw new ToolError("No analysis found for this project yet.");
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { analysis: data },
    };
  },
});