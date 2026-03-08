import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { AttachmentBar } from "@/components/chat/AttachmentBar";
import { FilePreview } from "@/components/chat/FilePreview";
import { FileUploadPreview } from "@/components/chat/FileUploadPreview";

// ── Mock File objects ────────────────────────────────────────────────────

function createMockFile(name: string, size: number, type: string): File {
  const blob = new Blob([""], { type });
  return new File([blob], name, { type, lastModified: Date.now() });
}

const mockFiles = {
  image: createMockFile("screenshot.png", 245_000, "image/png"),
  pdf: createMockFile("report.pdf", 1_200_000, "application/pdf"),
  code: createMockFile("index.tsx", 3_400, "text/tsx"),
  csv: createMockFile("data.csv", 52_000, "text/csv"),
  generic: createMockFile("archive.zip", 8_900_000, "application/zip"),
};

// ── FilePreview stories ──────────────────────────────────────────────────

const filePreviewMeta: Meta<typeof FilePreview> = {
  title: "Chat/FilePreview",
  component: FilePreview,
  tags: ["autodocs"],
  args: {
    onRemove: fn(),
  },
};

export default filePreviewMeta;
type FilePreviewStory = StoryObj<typeof FilePreview>;

/** Image file with thumbnail preview */
export const ImageFile: FilePreviewStory = {
  args: { file: mockFiles.image },
};

/** PDF file */
export const PDFFile: FilePreviewStory = {
  args: { file: mockFiles.pdf },
};

/** Source code file */
export const CodeFile: FilePreviewStory = {
  args: { file: mockFiles.code },
};

/** Generic file type */
export const GenericFile: FilePreviewStory = {
  args: { file: mockFiles.generic },
};

/** AttachmentBar with multiple files */
export const AttachmentBarMultiple: FilePreviewStory = {
  render: () => (
    <div style={{ maxWidth: 600 }}>
      <AttachmentBar
        files={[mockFiles.image, mockFiles.pdf, mockFiles.code, mockFiles.csv]}
        onRemove={fn()}
      />
    </div>
  ),
};

/** AttachmentBar empty (renders nothing) */
export const AttachmentBarEmpty: FilePreviewStory = {
  render: () => (
    <div style={{ maxWidth: 600 }}>
      <AttachmentBar files={[]} onRemove={fn()} />
      <p className="text-xs text-text-tertiary mt-2">(Empty — no output above)</p>
    </div>
  ),
};

/** FileUploadPreview with progress bars */
export const UploadInProgress: FilePreviewStory = {
  render: () => (
    <div style={{ maxWidth: 600 }}>
      <FileUploadPreview
        files={[
          { name: "photo.jpg", type: "image/jpeg", size: 340_000, progress: 65 },
          { name: "document.pdf", type: "application/pdf", size: 1_500_000, progress: 30 },
          { name: "notes.txt", type: "text/plain", size: 1_200, progress: 100 },
        ]}
        onRemove={fn()}
      />
    </div>
  ),
};

/** FileUploadPreview completed (all at 100%) */
export const UploadComplete: FilePreviewStory = {
  render: () => (
    <div style={{ maxWidth: 600 }}>
      <FileUploadPreview
        files={[
          { name: "image.png", type: "image/png", size: 250_000 },
          { name: "script.py", type: "text/x-python", size: 4_200 },
        ]}
        onRemove={fn()}
      />
    </div>
  ),
};

/** All file attachment components gallery */
export const AllVariants: FilePreviewStory = {
  render: () => (
    <div className="space-y-8" style={{ maxWidth: 600 }}>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-3">
          Individual FilePreview cards
        </p>
        <div className="flex flex-wrap gap-3">
          <FilePreview file={mockFiles.image} onRemove={fn()} />
          <FilePreview file={mockFiles.pdf} onRemove={fn()} />
          <FilePreview file={mockFiles.code} onRemove={fn()} />
          <FilePreview file={mockFiles.generic} onRemove={fn()} />
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-3">
          AttachmentBar (scrollable row)
        </p>
        <AttachmentBar
          files={[mockFiles.image, mockFiles.pdf, mockFiles.code, mockFiles.csv, mockFiles.generic]}
          onRemove={fn()}
        />
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-3">
          FileUploadPreview (with progress)
        </p>
        <FileUploadPreview
          files={[
            { name: "upload1.jpg", type: "image/jpeg", size: 800_000, progress: 45 },
            { name: "upload2.pdf", type: "application/pdf", size: 2_100_000, progress: 88 },
            { name: "upload3.ts", type: "text/typescript", size: 1_500, progress: 100 },
          ]}
          onRemove={fn()}
        />
      </div>
    </div>
  ),
  parameters: { layout: "padded" },
};
