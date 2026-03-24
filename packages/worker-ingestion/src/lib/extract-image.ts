import { openai } from "@nova/worker-shared/litellm";
import { getVisionModel, buildChatParams } from "@nova/worker-shared/models";

interface ImageMetadata {
  width?: number;
  height?: number;
  format?: string;
  exif?: Record<string, unknown>;
}

export interface ImageExtractionResult {
  text: string;
  documentMetadata: {
    fileType: "image";
    format: string;
    width?: number;
    height?: number;
    exif?: Record<string, unknown>;
  };
}

async function getImageDimensions(buffer: Buffer): Promise<{ width?: number; height?: number; format?: string }> {
  try {
    const { imageSize } = await import("image-size");
    const result = imageSize(buffer);
    return { width: result.width, height: result.height, format: result.type };
  } catch {
    return {};
  }
}

async function getExifData(buffer: Buffer, contentType: string): Promise<Record<string, unknown> | undefined> {
  if (!contentType.includes("jpeg") && !contentType.includes("jpg")) return undefined;

  try {
    const exifReader = await import("exif-reader");
    const parse = exifReader.default ?? exifReader;
    // Find EXIF marker in JPEG — APP1 marker (0xFFE1)
    const exifStart = buffer.indexOf(Buffer.from([0xff, 0xe1]));
    if (exifStart === -1) return undefined;

    const length = buffer.readUInt16BE(exifStart + 2);
    const exifData = buffer.subarray(exifStart + 4, exifStart + 2 + length);

    // Skip "Exif\0\0" header
    const tiffOffset = exifData.indexOf("Exif");
    if (tiffOffset === -1) return undefined;

    const tiffData = exifData.subarray(tiffOffset + 6);
    const parsed = parse(tiffData);

    // Flatten to plain object, picking useful fields
    const result: Record<string, unknown> = {};
    if (parsed.Image) {
      if (parsed.Image.Make) result.cameraMake = parsed.Image.Make;
      if (parsed.Image.Model) result.cameraModel = parsed.Image.Model;
      if (parsed.Image.DateTime) result.dateTime = String(parsed.Image.DateTime);
    }
    if (parsed.Photo) {
      if (parsed.Photo.ExposureTime) result.exposureTime = parsed.Photo.ExposureTime;
      if (parsed.Photo.FNumber) result.fNumber = parsed.Photo.FNumber;
      if (parsed.Photo.ISOSpeedRatings) result.iso = parsed.Photo.ISOSpeedRatings;
      if (parsed.Photo.FocalLength) result.focalLength = parsed.Photo.FocalLength;
    }
    if (parsed.GPSInfo) {
      result.gps = parsed.GPSInfo;
    }

    return Object.keys(result).length > 0 ? result : undefined;
  } catch {
    return undefined;
  }
}

async function describeWithVision(buffer: Buffer, contentType: string): Promise<string> {
  const visionModel = await getVisionModel();
  if (!visionModel) {
    throw new Error("Image ingestion requires VISION_MODEL env var or a vision-capable model in the database");
  }

  const base64 = buffer.toString("base64");
  const mediaType = contentType || "image/png";

  const params = await buildChatParams(visionModel, {
    model: visionModel,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Describe this image in detail. Include: what the image depicts, any text visible in the image, colors, layout, and any notable elements. If it's a chart or diagram, describe the data and structure. If it's a photo, describe the scene, subjects, and setting.",
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
    max_tokens: 1000,
    temperature: 0.3,
  });
  const response = await openai.chat.completions.create(params as any);

  return response.choices[0]?.message?.content ?? "";
}

async function ocrImage(buffer: Buffer): Promise<string> {
  try {
    const { createWorker } = await import("tesseract.js");
    const ocrLangs = process.env.OCR_LANGUAGES ?? "eng+swe";
    const worker = await createWorker(ocrLangs);
    try {
      const { data: { text } } = await worker.recognize(buffer);
      return text.trim();
    } finally {
      await worker.terminate();
    }
  } catch (err) {
    console.warn("[IMAGE] OCR failed, continuing without:", err);
    return "";
  }
}

export async function extractImageContent(
  buffer: Buffer,
  contentType: string,
  filename?: string,
): Promise<ImageExtractionResult> {
  const dimensions = await getImageDimensions(buffer);
  const exif = await getExifData(buffer, contentType);

  // Vision description (required)
  const visionDescription = await describeWithVision(buffer, contentType);

  // OCR (supplementary — captures text vision may miss)
  const ocrText = await ocrImage(buffer);

  // Combine: vision description + any unique OCR text not already in vision
  const parts: string[] = [];

  if (filename) {
    parts.push(`Image: "${filename}"`);
  }

  if (dimensions.width && dimensions.height) {
    parts.push(`Dimensions: ${dimensions.width}x${dimensions.height}px`);
  }

  parts.push("");
  parts.push(visionDescription);

  if (ocrText) {
    // Only include OCR text that adds new information
    const visionLower = visionDescription.toLowerCase();
    const ocrLines = ocrText.split("\n").filter((line) => {
      const trimmed = line.trim();
      return trimmed.length > 2 && !visionLower.includes(trimmed.toLowerCase());
    });
    if (ocrLines.length > 0) {
      parts.push("");
      parts.push("Additional text detected via OCR:");
      parts.push(ocrLines.join("\n"));
    }
  }

  return {
    text: parts.join("\n").trim(),
    documentMetadata: {
      fileType: "image",
      format: dimensions.format ?? contentType.split("/")[1] ?? "unknown",
      width: dimensions.width,
      height: dimensions.height,
      exif,
    },
  };
}
