/**
 * Skill registry — defines specialized instructions and metadata for sandbox execution.
 *
 * Each skill corresponds to a category of file/task processing.
 * The actual Python packages are pre-installed in the `nova-sandbox-python` Docker image;
 * the skill only controls which instructions are injected into the agent's prompt.
 *
 * Full instructions, scripts, and docs are baked into the Docker image at
 * `/sandbox/skills/{name}/`. Compact instructions here tell the model where to look.
 */

export interface SkillDefinition {
  /** Unique skill identifier (used in `code_execute` skill parameter) */
  name: string;
  /** When to use this skill (shown in tool description) */
  description: string;
  /** Human-readable list of pre-installed packages */
  packages: string[];
  /** MIME types that trigger auto-injection of this skill's instructions */
  fileTypes: string[];
  /** Keywords in user message that trigger this skill (case-insensitive) */
  triggerKeywords?: string[];
  /** Relative path to scripts/ dir baked into Docker image */
  scriptsDir?: string;
  /** Prompt instructions for the agent (compact summary; full docs at /sandbox/skills/{name}/) */
  instructions: string;
}

// ---------------------------------------------------------------------------
// Existing skills — upgraded with richer instructions + scripts
// ---------------------------------------------------------------------------

const xlsx: SkillDefinition = {
  name: "xlsx",
  description: "Analyze, transform, and generate Excel spreadsheets",
  packages: ["pandas", "openpyxl", "xlsxwriter"],
  fileTypes: [
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-excel",
    "text/csv",
  ],
  scriptsDir: "/sandbox/skills/xlsx/scripts",
  instructions: `## Skill: Spreadsheet Analysis (xlsx)

When working with spreadsheet files (.xlsx, .xls, .csv):

1. **Reading**: Use \`pandas.read_excel()\` for Excel, \`pandas.read_csv()\` for CSV. Files at \`/sandbox/input/<filename>\`.
2. **Analysis**: Use pandas — describe(), groupby(), pivot_table(), value_counts(). Print results to stdout.
3. **Visualization**: Use matplotlib/seaborn for charts. Save figures to \`/sandbox/output/\` as PNG.
4. **Writing**: Use \`pandas.to_excel()\` with \`engine='xlsxwriter'\` for styled output. Save to \`/sandbox/output/\`.
5. **Formula recalculation**: Use \`python /sandbox/skills/xlsx/scripts/recalc.py <file>\` to recalculate formulas via LibreOffice.
6. **Large files**: Use \`nrows\` parameter to sample first. Check \`df.shape\` before heavy operations.

For detailed reference and advanced patterns: \`cat /sandbox/skills/xlsx/SKILL.md\``,
};

const pdf: SkillDefinition = {
  name: "pdf",
  description: "Extract text, merge, split, fill forms, and generate PDF documents",
  packages: ["pypdf", "pdfplumber", "reportlab"],
  fileTypes: ["application/pdf"],
  scriptsDir: "/sandbox/skills/pdf/scripts",
  instructions: `## Skill: PDF Processing (pdf)

When working with PDF files:

1. **Text extraction**: Use \`pdfplumber\` for layout-aware extraction (tables, columns). Falls back to \`pypdf\` for simple text.
2. **Table extraction**: Use \`pdfplumber.open(path).pages[i].extract_table()\` — convert to pandas DataFrame.
3. **Merging/splitting**: Use \`pypdf.PdfWriter\` and \`pypdf.PdfReader\`.
4. **Generation**: Use \`reportlab\` to create new PDFs. Save to \`/sandbox/output/\`.
5. **Form filling**: Scripts at \`/sandbox/skills/pdf/scripts/\` handle both fillable and non-fillable forms. Read \`cat /sandbox/skills/pdf/forms.md\` for the workflow.
6. **Page-level processing**: Iterate over pages individually for large documents.

For detailed reference and advanced patterns: \`cat /sandbox/skills/pdf/SKILL.md\``,
};

const docx: SkillDefinition = {
  name: "docx",
  description: "Read, modify, and generate Word documents",
  packages: ["python-docx"],
  fileTypes: [
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/msword",
  ],
  scriptsDir: "/sandbox/skills/docx/scripts",
  instructions: `## Skill: Word Document Processing (docx)

When working with Word documents (.docx):

1. **Reading**: Use \`pandoc\` for quick text extraction, or unpack the ZIP for raw XML manipulation.
2. **Creating new**: Use \`docx-js\` (Node.js) for programmatic document creation with full formatting control.
3. **Editing existing**: Unpack → edit XML → repack. Use scripts at \`/sandbox/skills/docx/scripts/\`.
4. **Tracked changes**: Use \`python /sandbox/skills/docx/scripts/accept_changes.py <file>\` to accept all tracked changes.
5. **Comments**: Use \`python /sandbox/skills/docx/scripts/comment.py\` to add comments.
6. **Converting .doc**: Use \`python /sandbox/skills/docx/scripts/office/soffice.py --headless --convert-to docx file.doc\`.

For detailed reference: \`cat /sandbox/skills/docx/SKILL.md\``,
};

// ---------------------------------------------------------------------------
// New skills — with scripts/templates
// ---------------------------------------------------------------------------

const pptx: SkillDefinition = {
  name: "pptx",
  description: "Read, edit, and create PowerPoint presentations",
  packages: ["python-pptx", "markitdown", "pptx2md"],
  fileTypes: [
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "application/vnd.ms-powerpoint",
  ],
  triggerKeywords: ["powerpoint", "pptx", "slide deck", "presentation"],
  scriptsDir: "/sandbox/skills/pptx/scripts",
  instructions: `## Skill: PowerPoint Processing (pptx)

When working with presentations (.pptx):

1. **Reading**: \`python -m markitdown presentation.pptx\` for text extraction. \`python /sandbox/skills/pptx/scripts/thumbnail.py <file>\` for visual overview.
2. **Editing existing**: Unpack → edit XML → repack. See \`cat /sandbox/skills/pptx/editing.md\` for template editing workflow.
3. **Creating from scratch**: Use PptxGenJS (Node.js). See \`cat /sandbox/skills/pptx/pptxgenjs.md\` for tutorial.
4. **Adding slides**: \`python /sandbox/skills/pptx/scripts/add_slide.py\` to add slides to existing deck.
5. **Cleaning**: \`python /sandbox/skills/pptx/scripts/clean.py\` to remove unused layouts/masters.
6. **Office utils**: Shared pack/unpack/validate at \`/sandbox/skills/pptx/scripts/office/\`.

For detailed reference: \`cat /sandbox/skills/pptx/SKILL.md\``,
};

const algorithmicArt: SkillDefinition = {
  name: "algorithmic-art",
  description: "Create generative art using p5.js with seeded randomness",
  packages: [],
  fileTypes: [],
  triggerKeywords: ["generative art", "algorithmic art", "p5.js", "creative coding"],
  scriptsDir: "/sandbox/skills/algorithmic-art/templates",
  instructions: `## Skill: Algorithmic Art (p5.js)

Create generative art in two steps:
1. **Philosophy**: Write an algorithmic philosophy manifesto (.md) defining the aesthetic movement.
2. **Expression**: Create p5.js sketches that express the philosophy — 90% algorithmic generation, 10% parameters.

Use the viewer template at \`/sandbox/skills/algorithmic-art/templates/viewer.html\` and generator template at \`/sandbox/skills/algorithmic-art/templates/generator_template.js\`.

Key patterns: seeded randomness, noise fields, particle systems, flow fields, parametric variation.
Output: .html files to \`/sandbox/output/\`. Create original work — never copy existing artists.

For detailed reference: \`cat /sandbox/skills/algorithmic-art/SKILL.md\``,
};

const mcpBuilder: SkillDefinition = {
  name: "mcp-builder",
  description: "Build MCP (Model Context Protocol) servers for LLM integrations",
  packages: [],
  fileTypes: [],
  triggerKeywords: ["mcp server", "mcp tool", "model context protocol"],
  scriptsDir: "/sandbox/skills/mcp-builder/scripts",
  instructions: `## Skill: MCP Server Builder

Build MCP servers that enable LLMs to interact with external services. Four phases:
1. **Plan**: Define tools, understand the API, choose Python (FastMCP) or TypeScript (MCP SDK).
2. **Build**: Implement tools with clear names, rich descriptions, and proper error handling.
3. **Test**: Use \`python /sandbox/skills/mcp-builder/scripts/connections.py\` for connection testing.
4. **Evaluate**: Use \`python /sandbox/skills/mcp-builder/scripts/evaluation.py\` for quality evaluation.

Reference docs at \`/sandbox/skills/mcp-builder/reference/\` cover best practices, Python, and Node implementations.

For detailed reference: \`cat /sandbox/skills/mcp-builder/SKILL.md\``,
};

const webArtifactsBuilder: SkillDefinition = {
  name: "web-artifacts-builder",
  description: "Build multi-component web artifacts with React + shadcn/ui",
  packages: [],
  fileTypes: [],
  triggerKeywords: ["web artifact", "interactive widget", "react artifact"],
  scriptsDir: "/sandbox/skills/web-artifacts-builder/scripts",
  instructions: `## Skill: Web Artifacts Builder

Build elaborate frontend artifacts using React 18 + TypeScript + Tailwind + shadcn/ui:
1. **Init**: \`bash /sandbox/skills/web-artifacts-builder/scripts/init-artifact.sh\` to scaffold project.
2. **Develop**: Edit generated code — components, state, routing.
3. **Bundle**: \`bash /sandbox/skills/web-artifacts-builder/scripts/bundle-artifact.sh\` to produce a single HTML file.
4. **Output**: Save bundled HTML to \`/sandbox/output/\`.

Avoid "AI slop": no excessive centered layouts, purple gradients, uniform rounded corners, or Inter font.

For detailed reference: \`cat /sandbox/skills/web-artifacts-builder/SKILL.md\``,
};

const webappTesting: SkillDefinition = {
  name: "webapp-testing",
  description: "Test web applications using Playwright with browser automation",
  packages: ["playwright"],
  fileTypes: [],
  triggerKeywords: ["playwright test", "browser test", "web test", "test website"],
  scriptsDir: "/sandbox/skills/webapp-testing/scripts",
  instructions: `## Skill: Web App Testing (Playwright)

Test web applications with native Python Playwright scripts:
1. **Server management**: Use \`python /sandbox/skills/webapp-testing/scripts/with_server.py\` to manage server lifecycle.
2. **Static HTML**: Read file directly to identify selectors, then write Playwright script.
3. **Running apps**: Start server first, then automate with Playwright.
4. **Screenshots**: Capture browser state with \`page.screenshot()\`.
5. **Console logs**: Monitor with \`page.on("console", ...)\`.

Examples at \`/sandbox/skills/webapp-testing/examples/\`. Run scripts with \`--help\` first.

For detailed reference: \`cat /sandbox/skills/webapp-testing/SKILL.md\``,
};

// ---------------------------------------------------------------------------
// New skills — pure instruction (no scripts)
// ---------------------------------------------------------------------------

const brandGuidelines: SkillDefinition = {
  name: "brand-guidelines",
  description: "Apply Anthropic brand colors, typography, and visual identity",
  packages: [],
  fileTypes: [],
  triggerKeywords: ["brand guideline", "brand identity", "style guide"],
  instructions: `## Skill: Brand Guidelines

Apply Anthropic's official brand identity:
- **Colors**: Dark #141413, Light #faf9f5, Orange accent #d97757, Blue #6a9bcc, Green #788c5d
- **Typography**: Professional, consistent font families
- **Usage**: Apply to any artifact needing Anthropic look-and-feel (slides, docs, HTML, etc.)

For full color palette, typography rules, and usage guidelines: \`cat /sandbox/skills/brand-guidelines/SKILL.md\``,
};

const frontendDesign: SkillDefinition = {
  name: "frontend-design",
  description: "Create distinctive, production-grade frontend interfaces",
  packages: [],
  fileTypes: [],
  triggerKeywords: ["frontend design", "ui design", "landing page", "web interface"],
  instructions: `## Skill: Frontend Design

Create distinctive, production-grade frontend interfaces that avoid generic "AI slop":
1. **Design thinking**: Commit to a BOLD aesthetic direction — brutally minimal, maximalist, retro-futuristic, editorial, etc.
2. **Differentiation**: What makes this UNFORGETTABLE? Intentionality over intensity.
3. **Implementation**: Real working code with exceptional attention to aesthetic details.
4. **Anti-patterns**: Avoid centered layouts with purple gradients, uniform rounded corners, generic card grids.

For detailed design philosophy and patterns: \`cat /sandbox/skills/frontend-design/SKILL.md\``,
};

const docCoauthoring: SkillDefinition = {
  name: "doc-coauthoring",
  description: "Structured 3-stage collaborative document writing workflow",
  packages: [],
  fileTypes: [],
  triggerKeywords: ["co-author", "coauthor", "draft review", "writing workshop"],
  instructions: `## Skill: Document Co-Authoring

Guide users through structured collaborative writing in 3 stages:
1. **Context Gathering**: User provides context while Claude asks clarifying questions.
2. **Refinement & Structure**: Iterate on drafts — restructure, expand, sharpen.
3. **Reader Testing**: Verify the document works for its intended audience.

Trigger for: documentation, proposals, technical specs, decision docs, PRDs, RFCs, design docs.

For detailed workflow instructions: \`cat /sandbox/skills/doc-coauthoring/SKILL.md\``,
};

const claudeApi: SkillDefinition = {
  name: "claude-api",
  description: "Build LLM-powered applications with the Claude API and Anthropic SDKs",
  packages: [],
  fileTypes: [],
  triggerKeywords: ["claude api", "anthropic sdk", "anthropic api"],
  instructions: `## Skill: Claude API

Build apps with Claude API. Default to Claude Opus 4.6 (\`claude-opus-4-6\`), adaptive thinking, and streaming.
1. **Detect language**: Check project files to determine Python, TypeScript, Java, etc.
2. **Read docs**: Language-specific guides at \`/sandbox/skills/claude-api/{language}/\`.
3. **Shared reference**: Models, error codes, tool use concepts at \`/sandbox/skills/claude-api/shared/\`.

For full API reference and code examples: \`cat /sandbox/skills/claude-api/SKILL.md\``,
};

const internalComms: SkillDefinition = {
  name: "internal-comms",
  description: "Draft internal communications using structured templates",
  packages: [],
  fileTypes: [],
  triggerKeywords: ["internal comms", "company announcement", "internal memo", "newsletter draft"],
  instructions: `## Skill: Internal Communications

Draft internal communications using structured formats:
- **3P Updates**: Progress, Plans, Problems
- **Newsletters**: Company-wide updates with consistent formatting
- **FAQ Responses**: Structured Q&A for common questions
- **Status Reports**: Project/leadership updates

Examples at \`/sandbox/skills/internal-comms/examples/\` for each format.

For detailed templates and guidelines: \`cat /sandbox/skills/internal-comms/SKILL.md\``,
};

const themeFactory: SkillDefinition = {
  name: "theme-factory",
  description: "Apply professional color/font themes to any artifact",
  packages: [],
  fileTypes: [],
  triggerKeywords: ["theme factory", "color theme", "design theme", "ui theme"],
  instructions: `## Skill: Theme Factory

Apply professional styling themes to any artifact (slides, docs, HTML, etc.):
- **10 preset themes**: Ocean Depths, Sunset Boulevard, Forest Canopy, Modern Minimalist, Golden Hour, Arctic Frost, Desert Rose, Tech Innovation, Botanical Garden, Midnight Galaxy.
- Each theme includes color palette (hex codes) + font pairings (header + body).
- Can also generate custom themes on-the-fly.

Theme definitions at \`/sandbox/skills/theme-factory/themes/\`.

For usage instructions: \`cat /sandbox/skills/theme-factory/SKILL.md\``,
};

const excalidraw: SkillDefinition = {
  name: "excalidraw",
  description: "Create and transform interactive diagrams using Excalidraw",
  packages: ["@excalidraw/mermaid-to-excalidraw"],
  fileTypes: ["application/vnd.excalidraw+json"],
  triggerKeywords: [
    "excalidraw", "diagram", "flowchart", "wireframe",
    "architecture diagram", "sequence diagram", "draw a diagram",
    "sketch", "whiteboard",
  ],
  scriptsDir: "/sandbox/skills/excalidraw/scripts",
  instructions: `## Skill: Excalidraw Diagrams

Create interactive diagrams that users can edit in the conversation.

### Creating diagrams

**From mermaid** (preferred for structured diagrams):
1. Write mermaid syntax describing the diagram
2. Run \`node /sandbox/skills/excalidraw/scripts/mermaid-to-excalidraw.js <mermaid-code>\`
3. Script outputs Excalidraw scene JSON to stdout
4. Write the JSON to \`/sandbox/output/diagram.excalidraw\`

**Direct Excalidraw JSON** (for precise layout control):
1. Construct Excalidraw elements array (rectangles, arrows, text, etc.)
2. Write valid scene JSON to \`/sandbox/output/diagram.excalidraw\`
3. Reference: \`cat /sandbox/skills/excalidraw/SKILL.md\` for element schema

### Modifying existing diagrams
When the user asks to change a diagram, you'll receive the current scene JSON in context.
Parse it, modify the elements array, and write the updated JSON to \`/sandbox/output/diagram.excalidraw\`.

### Output format
Always write files with \`.excalidraw\` extension to \`/sandbox/output/\`.
The frontend automatically renders these as interactive, editable diagrams.

For detailed element reference: \`cat /sandbox/skills/excalidraw/SKILL.md\``,
};

const canvasDesign: SkillDefinition = {
  name: "canvas-design",
  description: "Create visual art, posters, and designs as PDF/PNG using code",
  packages: ["cairosvg", "svgwrite", "Pillow"],
  fileTypes: [],
  triggerKeywords: ["poster design", "canvas artwork", "visual artwork"],
  instructions: `## Skill: Canvas Design

Create static visual art in two steps:
1. **Design Philosophy**: Write a visual philosophy manifesto defining the aesthetic movement.
2. **Expression**: Create the artwork on a canvas — output .pdf or .png files.

Use Python libraries (Pillow, cairosvg, svgwrite, reportlab) for rendering.
Output files to \`/sandbox/output/\`. Create original work — never copy existing artists.

For detailed design philosophy guidance: \`cat /sandbox/skills/canvas-design/SKILL.md\``,
};

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

/** All registered skills, keyed by name */
export const SKILLS: Record<string, SkillDefinition> = {
  xlsx,
  pdf,
  docx,
  pptx,
  "algorithmic-art": algorithmicArt,
  "brand-guidelines": brandGuidelines,
  "canvas-design": canvasDesign,
  "claude-api": claudeApi,
  "doc-coauthoring": docCoauthoring,
  excalidraw,
  "frontend-design": frontendDesign,
  "internal-comms": internalComms,
  "mcp-builder": mcpBuilder,
  "theme-factory": themeFactory,
  "web-artifacts-builder": webArtifactsBuilder,
  "webapp-testing": webappTesting,
};

/** Pre-installed packages note (always included when sandbox is available) */
export const SANDBOX_PACKAGES_NOTE = [
  "## Pre-installed Python Packages",
  "The Python sandbox has these packages pre-installed (no need to pip install):",
  "- **Data**: pandas, numpy, scipy",
  "- **Spreadsheets**: openpyxl, xlsxwriter",
  "- **PDF**: pypdf, pdfplumber, reportlab",
  "- **Word**: python-docx",
  "- **Presentations**: python-pptx, markitdown, pptx2md",
  "- **Visualization**: matplotlib, seaborn, Pillow",
  "- **Web scraping**: requests, beautifulsoup4, lxml",
  "- **SVG/Graphics**: cairosvg, svgwrite",
  "- **Browser testing**: playwright (with Chromium)",
  "",
  "Node.js is also available with pptxgenjs installed globally.",
  "",
  "Skill scripts and docs are at `/sandbox/skills/{name}/`.",
].join("\n");
