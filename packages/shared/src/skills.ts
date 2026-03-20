/**
 * Skill registry — defines specialized instructions and metadata for sandbox execution.
 *
 * Each skill corresponds to a category of file processing (xlsx, pdf, docx).
 * The actual Python packages are pre-installed in the `nova-sandbox-python` Docker image;
 * the skill only controls which instructions are injected into the agent's prompt.
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
  /** Prompt instructions for the agent (adapted from github.com/anthropics/skills) */
  instructions: string;
}

const xlsx: SkillDefinition = {
  name: "xlsx",
  description: "Analyze, transform, and generate Excel spreadsheets",
  packages: ["pandas", "openpyxl", "xlsxwriter"],
  fileTypes: [
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-excel",
    "text/csv",
  ],
  instructions: `## Skill: Spreadsheet Analysis (xlsx)

When working with spreadsheet files (.xlsx, .xls, .csv):

1. **Reading**: Use \`pandas.read_excel()\` for Excel files, \`pandas.read_csv()\` for CSV. Files are at \`/sandbox/input/<filename>\`.
2. **Analysis**: Use pandas for data manipulation — describe(), groupby(), pivot_table(), value_counts(). Print results to stdout.
3. **Visualization**: Use matplotlib/seaborn for charts. Save figures to \`/sandbox/output/\` as PNG.
4. **Writing**: Use \`pandas.to_excel()\` with \`engine='xlsxwriter'\` for styled output. Save to \`/sandbox/output/\`.
5. **Large files**: Use \`nrows\` parameter to sample first. Check \`df.shape\` before heavy operations.

Example pattern:
\`\`\`python
import pandas as pd
df = pd.read_excel("/sandbox/input/data.xlsx")
print(df.describe())
print(df.head(20).to_string())
# Save processed output
df_result.to_excel("/sandbox/output/result.xlsx", index=False)
\`\`\``,
};

const pdf: SkillDefinition = {
  name: "pdf",
  description: "Extract text, merge, split, and generate PDF documents",
  packages: ["pypdf", "pdfplumber", "reportlab"],
  fileTypes: ["application/pdf"],
  instructions: `## Skill: PDF Processing (pdf)

When working with PDF files:

1. **Text extraction**: Use \`pdfplumber\` for layout-aware text extraction (tables, columns). Falls back to \`pypdf\` for simple text.
2. **Table extraction**: Use \`pdfplumber.open(path).pages[i].extract_table()\` for tabular data — convert to pandas DataFrame.
3. **Merging/splitting**: Use \`pypdf.PdfWriter\` and \`pypdf.PdfReader\` for structural operations.
4. **Generation**: Use \`reportlab\` to create new PDFs. Save to \`/sandbox/output/\`.
5. **Page-level processing**: Iterate over pages, process individually for large documents.

Example pattern:
\`\`\`python
import pdfplumber
with pdfplumber.open("/sandbox/input/document.pdf") as pdf:
    for page in pdf.pages:
        text = page.extract_text()
        if text:
            print(text)
        tables = page.extract_tables()
        for table in tables:
            print(table)
\`\`\``,
};

const docx: SkillDefinition = {
  name: "docx",
  description: "Read, modify, and generate Word documents",
  packages: ["python-docx"],
  fileTypes: [
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/msword",
  ],
  instructions: `## Skill: Word Document Processing (docx)

When working with Word documents (.docx):

1. **Reading**: Use \`docx.Document()\` to open. Iterate \`doc.paragraphs\` for text, \`doc.tables\` for tables.
2. **Extraction**: Print paragraph text with style info. For tables, iterate rows and cells.
3. **Creation**: Build new documents with headings, paragraphs, tables, and styles.
4. **Modification**: Load existing doc, modify content, save to \`/sandbox/output/\`.

Example pattern:
\`\`\`python
from docx import Document
doc = Document("/sandbox/input/report.docx")
for para in doc.paragraphs:
    print(f"[{para.style.name}] {para.text}")
for table in doc.tables:
    for row in table.rows:
        print([cell.text for cell in row.cells])
\`\`\``,
};

/** All registered skills, keyed by name */
export const SKILLS: Record<string, SkillDefinition> = { xlsx, pdf, docx };

/** Pre-installed packages note (always included when sandbox is available) */
export const SANDBOX_PACKAGES_NOTE = [
  "## Pre-installed Python Packages",
  "The Python sandbox has these packages pre-installed (no need to pip install):",
  "- **Data**: pandas, numpy, scipy",
  "- **Spreadsheets**: openpyxl, xlsxwriter",
  "- **PDF**: pypdf, pdfplumber, reportlab",
  "- **Word**: python-docx",
  "- **Visualization**: matplotlib, seaborn, Pillow",
  "- **Web scraping**: requests, beautifulsoup4, lxml",
].join("\n");
