import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "create_project",
  title: "Create video project",
  description: "Create a new video editing project for the signed-in user. The video file itself is uploaded in the app.",
  inputSchema: {
    title: z.string().trim().min(1).describe("Project title."),
    description: z.string().trim().optional().describe("Optional project description or brief."),
    platform: z
      .enum(["youtube", "instagram", "tiktok", "twitter", "linkedin", "custom"])
      .optional()
      .describe("Target platform (default instagram)."),
    content_type: z.enum(["short", "long"]).optional().describe("Short-form or long-form content."),
    aspect_ratio: z.enum(["16:9", "9:16", "1:1", "4:5"]).optional().describe("Target aspect ratio."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ title, description, platform, content_type, aspect_ratio }, ctx) => {
    if (!ctx.isAuthenticated()) throw new ToolError("Not authenticated");
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("video_projects")
      .insert({
        user_id: ctx.getUserId(),
        title,
        description: description ?? null,
        platform: platform ?? "instagram",
        content_type: content_type ?? "short",
        aspect_ratio: aspect_ratio ?? "9:16",
        status: "draft",
      })
      .select()
      .single();
    if (error) throw new ToolError(error.message);
    return {
      content: [{ type: "text", text: `Created project "${data.title}" (${data.id})` }],
      structuredContent: { project: data },
    };
  },
});