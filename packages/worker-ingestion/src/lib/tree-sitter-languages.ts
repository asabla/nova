import type TreeSitter from "web-tree-sitter";
import { logger } from "@nova/worker-shared/logger";

/** Extension → language name mapping */
const EXTENSION_MAP: Record<string, string> = {
  ".ts": "typescript",
  ".tsx": "tsx",
  ".js": "javascript",
  ".jsx": "javascript",
  ".mjs": "javascript",
  ".cjs": "javascript",
  ".py": "python",
  ".go": "go",
  ".rs": "rust",
  ".java": "java",
  ".cs": "c_sharp",
  ".rb": "ruby",
  ".c": "c",
  ".cpp": "cpp",
  ".cc": "cpp",
  ".cxx": "cpp",
  ".h": "c",
  ".hpp": "cpp",
  ".php": "php",
  ".swift": "swift",
  ".kt": "kotlin",
  ".scala": "scala",
};

/** Language name → tree-sitter-wasms package name mapping */
const WASM_GRAMMAR_NAMES: Record<string, string> = {
  typescript: "tree-sitter-typescript",
  tsx: "tree-sitter-tsx",
  javascript: "tree-sitter-javascript",
  python: "tree-sitter-python",
  go: "tree-sitter-go",
  rust: "tree-sitter-rust",
  java: "tree-sitter-java",
  c_sharp: "tree-sitter-c_sharp",
  ruby: "tree-sitter-ruby",
  c: "tree-sitter-c",
  cpp: "tree-sitter-cpp",
  php: "tree-sitter-php",
};

let parserInitialized = false;
let TreeSitterModule: typeof TreeSitter | null = null;
const loadedGrammars = new Map<string, TreeSitter.Language>();

export function getLanguageForExtension(ext: string): string | null {
  return EXTENSION_MAP[ext.toLowerCase()] ?? null;
}

/**
 * Initialize web-tree-sitter (must be called once before loading grammars).
 */
async function ensureInitialized(): Promise<typeof TreeSitter> {
  if (TreeSitterModule && parserInitialized) return TreeSitterModule;

  const mod = await import("web-tree-sitter");
  TreeSitterModule = mod.default;
  await TreeSitterModule.init();
  parserInitialized = true;
  return TreeSitterModule;
}

/**
 * Lazy-load a tree-sitter WASM grammar by language name.
 * Grammars are cached after first load.
 */
export async function loadGrammar(language: string): Promise<TreeSitter.Language | null> {
  if (loadedGrammars.has(language)) {
    return loadedGrammars.get(language)!;
  }

  const wasmName = WASM_GRAMMAR_NAMES[language];
  if (!wasmName) return null;

  try {
    const TS = await ensureInitialized();

    // tree-sitter-wasms provides .wasm files that can be resolved via require.resolve
    const wasmPath = require.resolve(`tree-sitter-wasms/out/${wasmName}.wasm`);
    const grammar = await TS.Language.load(wasmPath);
    loadedGrammars.set(language, grammar);
    return grammar;
  } catch (err) {
    logger.warn({ err, language }, "[tree-sitter] Failed to load WASM grammar");
    return null;
  }
}

/**
 * Create a new parser instance with the given language.
 */
export async function createParser(language: string): Promise<TreeSitter | null> {
  const TS = await ensureInitialized();
  const grammar = await loadGrammar(language);
  if (!grammar) return null;

  const parser = new TS();
  parser.setLanguage(grammar);
  return parser;
}

export function getSupportedExtensions(): string[] {
  return Object.keys(EXTENSION_MAP);
}
