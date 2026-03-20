import { openai } from "./litellm";
import { env } from "./env";
import { getVisionModel } from "./models";
import { executeSandboxCode } from "../activities/sandbox.activities";

const MAX_SLIDES = 50;

const EXTRACTION_SCRIPT = `
import json
import sys
import os
from pptx import Presentation
from pptx.util import Inches, Emu
from PIL import Image, ImageDraw, ImageFont

input_dir = "/sandbox/input"
output_dir = "/sandbox/output"
os.makedirs(output_dir, exist_ok=True)

pptx_files = [f for f in os.listdir(input_dir) if f.endswith(('.pptx', '.PPTX'))]
if not pptx_files:
    print("No PPTX file found in input", file=sys.stderr)
    sys.exit(1)

pptx_path = os.path.join(input_dir, pptx_files[0])
prs = Presentation(pptx_path)

slide_width = prs.slide_width or Emu(9144000)  # default 10 inches
slide_height = prs.slide_height or Emu(6858000)  # default 7.5 inches
width_px = int(slide_width / 914400 * 150)  # 150 DPI
height_px = int(slide_height / 914400 * 150)

metadata = {
    "slideCount": len(prs.slides),
    "slideWidth": width_px,
    "slideHeight": height_px,
    "slides": []
}

for idx, slide in enumerate(prs.slides):
    slide_data = {
        "index": idx,
        "title": "",
        "texts": [],
        "speakerNotes": ""
    }

    # Extract title
    if slide.shapes.title:
        slide_data["title"] = slide.shapes.title.text or ""

    # Extract all text
    for shape in slide.shapes:
        if shape.has_text_frame:
            for para in shape.text_frame.paragraphs:
                text = para.text.strip()
                if text:
                    slide_data["texts"].append(text)

    # Extract speaker notes
    if slide.has_notes_slide and slide.notes_slide.notes_text_frame:
        notes = slide.notes_slide.notes_text_frame.text.strip()
        if notes:
            slide_data["speakerNotes"] = notes

    metadata["slides"].append(slide_data)

    # Render slide as simple visual representation
    img = Image.new("RGB", (width_px, height_px), "white")
    draw = ImageDraw.Draw(img)

    # Draw shapes as colored rectangles with text
    for shape in slide.shapes:
        if hasattr(shape, 'left') and shape.left is not None:
            x = int(shape.left / 914400 * 150)
            y = int(shape.top / 914400 * 150)
            w = int(shape.width / 914400 * 150)
            h = int(shape.height / 914400 * 150)

            if shape.has_text_frame:
                draw.rectangle([x, y, x+w, y+h], outline="#cccccc", width=1)
                text = shape.text_frame.text[:200]
                try:
                    draw.text((x+4, y+4), text, fill="black")
                except:
                    pass

            if shape.shape_type == 13:  # Picture
                draw.rectangle([x, y, x+w, y+h], outline="#999999", fill="#eeeeee", width=2)
                draw.text((x+4, y+4), "[Image]", fill="#666666")

    img.save(os.path.join(output_dir, f"slide_{idx}.png"))

# Write metadata
with open(os.path.join(output_dir, "metadata.json"), "w") as f:
    json.dump(metadata, f)

print(json.dumps({"ok": True, "slideCount": len(prs.slides)}))
`;

interface SlideData {
  index: number;
  title: string;
  texts: string[];
  speakerNotes: string;
}

interface PptxMetadata {
  slideCount: number;
  slides: SlideData[];
}

export interface PptxExtractionResult {
  text: string;
  documentMetadata: {
    fileType: "presentation";
    slideCount: number;
    slideTitles: string[];
    hasSpeakerNotes: boolean;
  };
}

async function describeSlideWithVision(
  imageBase64: string,
  slideIndex: number,
  slideTitle: string,
  visionModel: string,
): Promise<string> {

  try {
    const response = await openai.chat.completions.create({
      model: visionModel,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Describe slide ${slideIndex + 1}${slideTitle ? ` ("${slideTitle}")` : ""} of a presentation. Focus on: visual layout, charts/diagrams, images, and any information not captured by text extraction alone. Be concise.`,
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/png;base64,${imageBase64}`,
              },
            },
          ],
        },
      ],
      max_tokens: 500,
      temperature: 0.3,
    });

    return response.choices[0]?.message?.content ?? "";
  } catch (err) {
    console.warn(`[PPTX] Vision description failed for slide ${slideIndex + 1}:`, err);
    return "";
  }
}

export async function extractPptxContent(
  buffer: Buffer,
  contentType: string,
  filename: string,
  orgId: string,
  fileStorageKey: string,
): Promise<PptxExtractionResult> {
  if (!env.SANDBOX_ENABLED) {
    throw new Error("PPTX ingestion requires SANDBOX_ENABLED=true");
  }
  const visionModel = await getVisionModel();
  if (!visionModel) {
    throw new Error("PPTX ingestion requires VISION_MODEL env var or a vision-capable model in the database");
  }

  // Execute Python extraction in sandbox
  const result = await executeSandboxCode({
    orgId,
    language: "python",
    code: EXTRACTION_SCRIPT,
    timeoutMs: 120_000,
    inputFileKeys: [{ name: filename, storageKey: fileStorageKey }],
  });

  if (result.exitCode !== 0) {
    throw new Error(`PPTX extraction failed: ${result.stderr}`);
  }

  // Parse metadata from output files
  const metadataFile = result.outputFiles.find((f) => f.name === "metadata.json");
  if (!metadataFile) {
    throw new Error("PPTX extraction did not produce metadata.json");
  }

  const { getObjectBuffer } = await import("./minio");
  const metadataBuffer = await getObjectBuffer(metadataFile.storageKey);
  const metadata: PptxMetadata = JSON.parse(metadataBuffer.toString("utf-8"));

  const slideCount = Math.min(metadata.slideCount, MAX_SLIDES);
  const sections: string[] = [];
  const slideTitles: string[] = [];
  let hasSpeakerNotes = false;

  for (let i = 0; i < slideCount; i++) {
    const slide = metadata.slides[i];
    if (!slide) continue;

    const title = slide.title || `Slide ${i + 1}`;
    slideTitles.push(title);

    // Try vision description for this slide
    let visionDesc = "";
    const slideFile = result.outputFiles.find((f) => f.name === `slide_${i}.png`);
    if (slideFile) {
      const slideBuffer = await getObjectBuffer(slideFile.storageKey);
      visionDesc = await describeSlideWithVision(slideBuffer.toString("base64"), i, slide.title, visionModel);
    }

    // Compose slide section
    const parts: string[] = [`## Slide ${i + 1}: ${title}`];

    if (visionDesc) {
      parts.push(visionDesc);
    }

    if (slide.texts.length > 0) {
      parts.push("");
      parts.push("**Text content:**");
      parts.push(slide.texts.join("\n"));
    }

    if (slide.speakerNotes) {
      hasSpeakerNotes = true;
      parts.push("");
      parts.push("**Speaker notes:**");
      parts.push(slide.speakerNotes);
    }

    sections.push(parts.join("\n"));
  }

  if (metadata.slideCount > MAX_SLIDES) {
    sections.push(`\n[... ${metadata.slideCount - MAX_SLIDES} additional slides truncated]`);
  }

  const header = filename ? `# ${filename}\n\n` : "";
  const text = header + sections.join("\n\n");

  return {
    text,
    documentMetadata: {
      fileType: "presentation",
      slideCount: metadata.slideCount,
      slideTitles,
      hasSpeakerNotes,
    },
  };
}
