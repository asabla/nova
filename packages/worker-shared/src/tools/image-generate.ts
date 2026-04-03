import { tool } from "@openai/agents";
import { generateImage } from "../image-generation";

/**
 * Factory: creates an image_generate tool scoped to a specific org.
 * Uses the org's configured provider to call OpenAI-compatible image generation APIs.
 */
export function createImageGenerateTool(orgId: string) {
  return tool({
      name: "image_generate",
    description:
      "Generate an image from a text description. Use when the user asks you to create, draw, design, or generate an image, illustration, icon, diagram, or any visual content. " +
      "Provide a detailed, descriptive prompt for best results. The generated image will be displayed inline in the chat.",
    parameters: {
      type: "object" as const,
      properties: {
        prompt: {
          type: "string",
          description:
            "Detailed description of the image to generate. Be specific about subject, style, composition, colors, lighting, and mood.",
        },
        size: {
          type: ["string", "null"],
          enum: ["1024x1024", "1024x1536", "1536x1024", "auto", null],
          description:
            "Image dimensions. 1024x1024 for square, 1024x1536 for portrait, 1536x1024 for landscape, auto to let the model decide (default: auto)",
        },
        quality: {
          type: ["string", "null"],
          enum: ["low", "medium", "high", "auto", null],
          description: "Image quality level (default: auto)",
        },
      },
      required: ["prompt", "size", "quality"],
      additionalProperties: false,
    },
    execute: async (args: unknown) => {
      const { prompt, size, quality } = args as {
        prompt: string;
        size?: string | null;
        quality?: string | null;
      };

      const enabled =
        process.env.IMAGE_GENERATION_ENABLED === "true" ||
        process.env.IMAGE_GENERATION_ENABLED === "1";
      if (!enabled) {
        return { error: "Image generation is disabled (IMAGE_GENERATION_ENABLED is not set)" };
      }

      try {
        const result = await generateImage(orgId, {
          prompt,
          size: (size as any) ?? undefined,
          quality: (quality as any) ?? undefined,
        });

        return {
          success: true,
          storageKey: result.storageKey,
          mimeType: result.mimeType,
          sizeBytes: result.sizeBytes,
          revisedPrompt: result.revisedPrompt,
        };
      } catch (err: any) {
        return { error: `Image generation failed: ${err.message ?? String(err)}` };
      }
    },
  });
}
