import type { SandboxFile } from "./docker-sandbox";
import { sandboxExecute } from "./docker-sandbox";
import { openai } from "./litellm";
import { getVisionModel } from "./models";
import { env } from "./env";
import { logger } from "./logger";

const VISUAL_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".svg",
  ".html",
  ".htm",
  ".pptx",
  ".pdf",
]);

const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp"]);

const NEEDS_CONVERSION = new Set([".html", ".htm", ".pptx", ".pdf", ".svg"]);

export function isVisualFile(filename: string): boolean {
  const ext = filename.slice(filename.lastIndexOf(".")).toLowerCase();
  return VISUAL_EXTENSIONS.has(ext);
}

/**
 * Convert a non-image visual file to a PNG screenshot using the sandbox.
 * The sandbox image has Playwright+Chromium, LibreOffice, poppler-utils, and cairosvg.
 */
async function renderToScreenshot(file: SandboxFile): Promise<Buffer | null> {
  const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();

  if (IMAGE_EXTENSIONS.has(ext)) {
    return file.data;
  }

  if (!NEEDS_CONVERSION.has(ext)) {
    return null;
  }

  try {
    const result = await sandboxExecute({
      language: "python",
      code: `import subprocess; subprocess.run(["python3", "/sandbox/skills/_vision/screenshot.py", "/sandbox/input/${file.name}"], check=True)`,
      inputFiles: [file],
      runTimeout: 30_000,
    });

    const screenshot = result.outputFiles.find((f) => f.name === "screenshot.png");
    return screenshot?.data ?? null;
  } catch (err) {
    logger.warn({ err, file: file.name }, "[vision-verify] Screenshot conversion failed");
    return null;
  }
}

/**
 * Send a screenshot to the vision model for description.
 * Follows the same pattern as extractImageContent() in worker-ingestion.
 */
async function describeVisualOutput(
  imageBuffer: Buffer,
  filename: string,
): Promise<string> {
  const visionModel = await getVisionModel();
  if (!visionModel) {
    throw new Error("No vision model available");
  }

  const base64 = imageBuffer.toString("base64");
  // Infer media type from the original file or default to PNG (screenshots are always PNG)
  const mediaType = "image/png";

  const response = await openai.chat.completions.create({
    model: visionModel,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `This is a screenshot of the generated file "${filename}". Describe what you see concisely. Focus on: layout correctness, content accuracy, text readability, visual completeness, and any obvious errors or issues. If it's a chart or diagram, describe the data representation. If it's a document or presentation, describe the structure and content of visible pages/slides.`,
          },
          {
            type: "image_url",
            image_url: {
              url: `data:${mediaType};base64,${base64}`,
            },
          },
        ],
      },
    ],
    max_tokens: 800,
    temperature: 0.2,
  });

  return response.choices[0]?.message?.content ?? "";
}

export interface VisualVerification {
  name: string;
  description: string;
}

/**
 * Verify visual output files by converting them to screenshots and describing
 * them with a vision model. Non-fatal: returns empty array on failure.
 */
export async function verifyVisualOutputs(
  files: SandboxFile[],
  opts?: { maxFiles?: number },
): Promise<VisualVerification[]> {
  if (!env.VISION_VERIFY_ENABLED) return [];

  const visionModel = await getVisionModel();
  if (!visionModel) return [];

  const maxFiles = opts?.maxFiles ?? 3;
  const visualFiles = files.filter((f) => isVisualFile(f.name)).slice(0, maxFiles);

  if (visualFiles.length === 0) return [];

  const results = await Promise.all(
    visualFiles.map(async (file): Promise<VisualVerification | null> => {
      try {
        const screenshot = await renderToScreenshot(file);
        if (!screenshot) return null;

        const description = await describeVisualOutput(screenshot, file.name);
        if (!description) return null;

        return { name: file.name, description };
      } catch (err) {
        logger.warn({ err, file: file.name }, "[vision-verify] Failed to verify");
        return null;
      }
    }),
  );

  return results.filter((r): r is VisualVerification => r !== null);
}
