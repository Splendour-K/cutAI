import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_projects",
  title: "List video projects",
  description: "List the signed-in user's video editing projects, newest first.",
  inputSchema: {
    limit: z.number().int().min(1).max(50).optional().describe("Maximum number of projects to return (default 20)."),
    status: z.string().optional().describe("Optional status filter, e.g. draft, ready, exporting."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit, status }, ctx) => {
    if (!ctx.isAuthenticated()) throw new ToolError("Not authenticated");
    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("video_projects")
      .select("id,title,description,platform,content_type,aspect_ratio,status,duration_seconds,created_at,updated_at")
      .order("updated_at", { ascending: false })
      .limit(limit ?? 20);
    if (status) query = query.eq("status", status);
    const { data, error } = await query;
    if (error) throw new ToolError(error.message);
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { projects: data ?? [] },
    };
  },
});