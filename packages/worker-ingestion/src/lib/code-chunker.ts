import type TreeSitter from "web-tree-sitter";
import type { ContentChunk, ChunkMetadata, ChunkOptions } from "@nova/shared/content";
import { chunkContent } from "@nova/shared/content";
import { getLanguageForExtension, createParser } from "./tree-sitter-languages";
import { extname } from "node:path";

const CODE_CHUNK_DEFAULTS: Required<ChunkOptions> = {
  maxChunkSize: 2000,
  minChunkSize: 50,
  overlap: 0,
  preserveTables: false,
};

/** Symbol kinds we extract from the tree-sitter CST */
type SymbolKind = "function" | "class" | "interface" | "type" | "enum" | "variable" | "method" | "module";

interface ExtractedSymbol {
  name: string;
  kind: SymbolKind;
  text: string;
  startLine: number;
  endLine: number;
  isExported: boolean;
}

/**
 * Node types that represent top-level symbol declarations per language family.
 * Maps tree-sitter node types to our SymbolKind.
 */
const SYMBOL_NODE_TYPES: Record<string, SymbolKind> = {
  // JavaScript/TypeScript
  function_declaration: "function",
  generator_function_declaration: "function",
  arrow_function: "function",
  class_declaration: "class",
  interface_declaration: "interface",
  type_alias_declaration: "type",
  enum_declaration: "enum",
  lexical_declaration: "variable",
  variable_declaration: "variable",
  method_definition: "method",
  // Python
  function_definition: "function",
  class_definition: "class",
  decorated_definition: "function",
  // Go
  function_item: "function",
  type_declaration: "type",
  method_declaration: "method",
  // Rust
  function_item_: "function",
  struct_item: "class",
  enum_item: "enum",
  impl_item: "class",
  trait_item: "interface",
  type_item: "type",
  // Java / C# / Kotlin
  class_declaration_: "class",
  method_declaration_: "method",
  interface_declaration_: "interface",
  enum_declaration_: "enum",
  constructor_declaration: "method",
};

/**
 * Check if a node is at the top level or exported.
 */
function isExportedNode(node: TreeSitter.SyntaxNode): boolean {
  const parent = node.parent;
  if (!parent) return false;
  // JS/TS export
  if (parent.type === "export_statement" || parent.type === "export_declaration") return true;
  // Check for 'export' keyword in parent
  if (parent.type === "decorated_definition") {
    return parent.parent?.type === "export_statement" || false;
  }
  // Go/Rust/Java: exported if name starts with uppercase (Go) or has public modifier
  return false;
}

/**
 * Try to extract the name of a symbol from a tree-sitter node.
 */
function extractSymbolName(node: TreeSitter.SyntaxNode): string | null {
  // Direct name child
  const nameNode = node.childForFieldName("name");
  if (nameNode) return nameNode.text;

  // For variable declarations, look for the declarator's name
  if (node.type === "lexical_declaration" || node.type === "variable_declaration") {
    const declarator = node.namedChildren.find(
      (c) => c.type === "variable_declarator" || c.type === "init_declarator",
    );
    if (declarator) {
      const name = declarator.childForFieldName("name");
      if (name) return name.text;
    }
  }

  // For decorated definitions (Python), look deeper
  if (node.type === "decorated_definition") {
    const def = node.namedChildren.find(
      (c) => c.type === "function_definition" || c.type === "class_definition",
    );
    if (def) return extractSymbolName(def);
  }

  // For export statements, look at the declaration inside
  if (node.type === "export_statement" || node.type === "export_declaration") {
    const decl = node.namedChildren.find((c) => SYMBOL_NODE_TYPES[c.type] !== undefined);
    if (decl) return extractSymbolName(decl);
  }

  return null;
}

/**
 * Determine the symbol kind, handling wrapper nodes like export_statement.
 */
function resolveSymbolKind(node: TreeSitter.SyntaxNode): SymbolKind | null {
  const direct = SYMBOL_NODE_TYPES[node.type];
  if (direct) return direct;

  // For export statements, check the inner declaration
  if (node.type === "export_statement" || node.type === "export_declaration") {
    const decl = node.namedChildren.find((c) => SYMBOL_NODE_TYPES[c.type] !== undefined);
    if (decl) return SYMBOL_NODE_TYPES[decl.type];
  }

  return null;
}

/**
 * Extract top-level symbols from a tree-sitter tree.
 */
function extractSymbols(tree: TreeSitter.Tree): ExtractedSymbol[] {
  const symbols: ExtractedSymbol[] = [];
  const root = tree.rootNode;

  for (const node of root.namedChildren) {
    const kind = resolveSymbolKind(node);
    if (!kind) continue;

    const name = extractSymbolName(node);
    if (!name) continue;

    // Skip very small declarations (single-line imports, trivial assignments)
    if (node.endPosition.row - node.startPosition.row < 1 && kind === "variable") continue;

    symbols.push({
      name,
      kind,
      text: node.text,
      startLine: node.startPosition.row + 1,
      endLine: node.endPosition.row + 1,
      isExported: isExportedNode(node) || node.type === "export_statement" || node.type === "export_declaration",
    });
  }

  return symbols;
}

/**
 * Extract import statements from the source code.
 * Returns a compact one-line summary of imports.
 */
function extractImportsSummary(source: string): string {
  const importLines: string[] = [];
  const lines = source.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();
    // JS/TS imports
    if (trimmed.startsWith("import ") || trimmed.startsWith("from ")) {
      importLines.push(trimmed);
    }
    // Python imports
    else if (trimmed.startsWith("from ") || (trimmed.startsWith("import ") && !trimmed.includes("{"))) {
      importLines.push(trimmed);
    }
    // Go imports (single line)
    else if (trimmed.match(/^import\s+"/)) {
      importLines.push(trimmed);
    }
    // Rust use statements
    else if (trimmed.startsWith("use ")) {
      importLines.push(trimmed);
    }
    // Java/C# using/import
    else if (trimmed.startsWith("using ") || trimmed.startsWith("package ")) {
      importLines.push(trimmed);
    }
    // Stop scanning after we've passed the import section
    else if (importLines.length > 0 && trimmed.length > 0 && !trimmed.startsWith("//") && !trimmed.startsWith("#") && !trimmed.startsWith("/*")) {
      break;
    }
  }

  // Return first 5 imports for brevity
  if (importLines.length > 5) {
    return importLines.slice(0, 5).join("\n") + `\n// ... ${importLines.length - 5} more imports`;
  }
  return importLines.join("\n");
}

/**
 * Build a context header for a code chunk.
 */
function buildContextHeader(
  filePath: string,
  imports: string,
  symbolName?: string,
  symbolKind?: string,
  isExported?: boolean,
): string {
  const lines: string[] = [`// File: ${filePath}`];
  if (imports) {
    lines.push(`// Imports:\n${imports.split("\n").map((l) => `//   ${l}`).join("\n")}`);
  }
  if (symbolName) {
    const exportLabel = isExported ? "yes" : "no";
    lines.push(`// Symbol: ${symbolKind} ${symbolName} (exported: ${exportLabel})`);
  }
  return lines.join("\n") + "\n\n";
}

export interface CodeChunkOptions extends ChunkOptions {
  /** Relative file path for context headers */
  filePath?: string;
}

/**
 * Chunk a code file using tree-sitter for symbol-aware splitting.
 *
 * Strategy:
 * 1. Parse with tree-sitter to identify top-level symbols
 * 2. Each symbol becomes a chunk with a context header (file path, imports, export status)
 * 3. Small files (< maxChunkSize) become a single chunk
 * 4. Large symbols fall back to the text-based chunker
 * 5. Non-parseable files use the existing markdown chunker
 */
export async function chunkCodeFile(
  content: string,
  filename: string,
  options?: CodeChunkOptions,
): Promise<ContentChunk[]> {
  const opts = { ...CODE_CHUNK_DEFAULTS, ...options };
  const ext = extname(filename);
  const language = getLanguageForExtension(ext);
  const filePath = options?.filePath ?? filename;

  // If we can't determine the language, fall back to text chunking
  if (!language) {
    return chunkAsText(content, filePath, opts);
  }

  // Parse the file with web-tree-sitter (WASM)
  let tree: TreeSitter.Tree;
  try {
    const parser = await createParser(language);
    if (!parser) {
      return chunkAsText(content, filePath, opts);
    }
    tree = parser.parse(content);
  } catch (err) {
    console.warn(`[code-chunker] tree-sitter parse failed for ${filename}:`, err);
    return chunkAsText(content, filePath, opts);
  }

  // If file is small enough, single chunk
  if (content.length <= opts.maxChunkSize) {
    return [createWholeFileChunk(content, filePath, language, 0)];
  }

  // Extract symbols and imports
  const symbols = extractSymbols(tree);
  const importsSummary = extractImportsSummary(content);

  // If no symbols found (e.g., config file, script), fall back to text chunking
  if (symbols.length === 0) {
    return chunkAsText(content, filePath, opts);
  }

  const chunks: ContentChunk[] = [];
  let chunkIndex = 0;

  // Track which lines are covered by symbols to find gaps
  const lines = content.split("\n");
  const coveredLines = new Set<number>();

  for (const symbol of symbols) {
    for (let l = symbol.startLine; l <= symbol.endLine; l++) {
      coveredLines.add(l);
    }
  }

  // Chunk each symbol
  for (const symbol of symbols) {
    const header = buildContextHeader(filePath, importsSummary, symbol.name, symbol.kind, symbol.isExported);
    const fullText = header + symbol.text;

    if (fullText.length <= opts.maxChunkSize) {
      const metadata: ChunkMetadata = {
        headingHierarchy: [],
        positionRatio: (symbol.startLine - 1) / lines.length,
        chunkType: "code",
        language,
        symbolName: symbol.name,
        symbolKind: symbol.kind,
        filePath,
        isExported: symbol.isExported,
      };
      chunks.push({ text: fullText.trim(), index: chunkIndex++, metadata });
    } else {
      // Symbol too large — split it with the text chunker, preserving metadata
      const subChunks = chunkContent(symbol.text, {
        maxChunkSize: opts.maxChunkSize - header.length,
        minChunkSize: opts.minChunkSize,
        overlap: opts.overlap,
      });
      for (const sub of subChunks) {
        const metadata: ChunkMetadata = {
          ...sub.metadata,
          chunkType: "code",
          language,
          symbolName: symbol.name,
          symbolKind: symbol.kind,
          filePath,
          isExported: symbol.isExported,
        };
        chunks.push({
          text: (header + sub.text).trim(),
          index: chunkIndex++,
          metadata,
        });
      }
    }
  }

  // Collect uncovered top-of-file content (module docs, constants, etc.)
  const uncoveredParts: string[] = [];
  let currentPart: string[] = [];
  for (let i = 1; i <= lines.length; i++) {
    if (!coveredLines.has(i)) {
      const line = lines[i - 1];
      // Skip empty lines at boundaries
      if (line.trim() || currentPart.length > 0) {
        currentPart.push(line);
      }
    } else if (currentPart.length > 0) {
      const text = currentPart.join("\n").trim();
      if (text.length >= opts.minChunkSize) {
        uncoveredParts.push(text);
      }
      currentPart = [];
    }
  }
  if (currentPart.length > 0) {
    const text = currentPart.join("\n").trim();
    if (text.length >= opts.minChunkSize) {
      uncoveredParts.push(text);
    }
  }

  // Add uncovered content as separate chunks (imports, module-level code)
  for (const part of uncoveredParts) {
    const header = buildContextHeader(filePath, "");
    const fullText = header + part;
    if (fullText.length <= opts.maxChunkSize) {
      chunks.push({
        text: fullText.trim(),
        index: chunkIndex++,
        metadata: {
          headingHierarchy: [],
          positionRatio: 0,
          chunkType: "code",
          language,
          filePath,
        },
      });
    }
  }

  return chunks;
}

/**
 * Create a single chunk for the whole file.
 */
function createWholeFileChunk(
  content: string,
  filePath: string,
  language: string,
  index: number,
): ContentChunk {
  return {
    text: `// File: ${filePath}\n\n${content}`.trim(),
    index,
    metadata: {
      headingHierarchy: [],
      positionRatio: 0,
      chunkType: "code",
      language,
      filePath,
    },
  };
}

/**
 * Fall back to the text-based chunker for files we can't parse with tree-sitter.
 */
function chunkAsText(content: string, filePath: string, opts: Required<ChunkOptions>): ContentChunk[] {
  const chunks = chunkContent(content, opts);
  // Enrich with file path metadata
  return chunks.map((chunk) => ({
    ...chunk,
    metadata: {
      ...chunk.metadata,
      filePath,
      chunkType: "code" as const,
    },
  }));
}
