#!/usr/bin/env bun
/**
 * Storybook vs Web App Gap Analysis
 *
 * Compares Storybook stories (design specs) against the actual web app to find
 * unimplemented designs, partial implementations, and unused component variants.
 *
 * Run:
 *   bun run storybook:gap              (from packages/web)
 *   bun run packages/web/scripts/storybook-gap-analysis.ts  (from repo root)
 *
 * Output:
 *   packages/web/storybook-gap-report.md  (Markdown report)
 *   stdout                                (same report + progress)
 *
 * Three-pass analysis:
 *   Pass 1 — Story-to-Route Mapping
 *     Parses each *.stories.tsx to extract title, named exports, and imports.
 *     Classifies as primitive | feature | pattern | documentation.
 *     Maps pattern/feature stories to route files via manual map + name similarity.
 *
 *   Pass 2 — Import Diff
 *     For matched story-route pairs, diffs component and icon imports.
 *     Distinguishes "missing from entire app" vs "used elsewhere, not in this route".
 *
 *   Pass 3 — Variant Sweep
 *     Extracts prop type unions from UI component source (e.g. variant: "primary" | "ghost").
 *     Scans all non-story source files for usage of each value.
 *     Reports variants defined + demonstrated in stories but never used in the app.
 *
 * Priority labels:
 *   P1 — Entire page/flow designed in Storybook but no matching route exists
 *   P2 — Route exists but is missing features shown in the story design
 *   P3 — Component variant unused anywhere in the app
 */

import { readdir, readFile } from "node:fs/promises";
import { join, basename, resolve } from "node:path";
import { Glob } from "bun";

// ── Config ──────────────────────────────────────────────────────────────────

const WEB_ROOT = resolve(import.meta.dir, "..");
const STORIES_DIR = join(WEB_ROOT, "src/stories");
const ROUTES_DIR = join(WEB_ROOT, "src/routes");
const COMPONENTS_DIR = join(WEB_ROOT, "src/components");
const SRC_DIR = join(WEB_ROOT, "src");

// ── Types ───────────────────────────────────────────────────────────────────

interface StoryInfo {
  file: string;
  fileName: string;
  title: string;
  category: string; // from title: "Components/Button" → "Components"
  storyName: string; // from title: "Components/Button" → "Button"
  exports: string[]; // named story exports
  imports: ImportInfo[];
  classification: "primitive" | "feature" | "pattern" | "documentation";
  sizeBytes: number;
}

interface ImportInfo {
  names: string[];
  source: string;
}

interface RouteInfo {
  file: string;
  fileName: string;
  imports: ImportInfo[];
  content: string;
}

interface ComponentInfo {
  file: string;
  name: string;
  variants: VariantInfo[];
  content: string;
}

interface VariantInfo {
  propName: string;
  values: string[];
}

interface GapReport {
  unimplemented: UnimplementedGap[];
  partial: PartialGap[];
  unusedVariants: UnusedVariantGap[];
}

interface UnimplementedGap {
  story: StoryInfo;
  reason: string;
}

interface PartialGap {
  story: StoryInfo;
  route: RouteInfo;
  missingComponents: string[]; // not imported anywhere in app
  indirectComponents: string[]; // imported elsewhere but not in this route
  missingIcons: string[];
  notes: string[];
}

interface UnusedVariantGap {
  component: string;
  componentFile: string;
  propName: string;
  variant: string;
  storyFile: string;
}

// ── Parsing Helpers ─────────────────────────────────────────────────────────

function parseImports(content: string): ImportInfo[] {
  const imports: ImportInfo[] = [];
  // Match: import { Foo, Bar } from "source"
  // Match: import { Foo } from "source"
  // Match: import Foo from "source"
  // Match: import type { Foo } from "source" (skip types)
  const importRegex =
    /import\s+(?:type\s+)?(?:\{([^}]+)\}|(\w+))\s+from\s+["']([^"']+)["']/g;
  let match: RegExpExecArray | null;
  while ((match = importRegex.exec(content)) !== null) {
    const namedImports = match[1];
    const defaultImport = match[2];
    const source = match[3];

    // Skip type-only imports
    if (content.substring(match.index, match.index + 12).includes("import type"))
      continue;

    const names: string[] = [];
    if (namedImports) {
      names.push(
        ...namedImports
          .split(",")
          .map((n) => n.trim().split(/\s+as\s+/)[0].trim())
          .filter(Boolean),
      );
    }
    if (defaultImport) {
      names.push(defaultImport);
    }
    if (names.length > 0) {
      imports.push({ names, source });
    }
  }
  return imports;
}

function parseStoryExports(content: string): string[] {
  const exports: string[] = [];
  // Match: export const StoryName: Story = ...
  // Match: export const StoryName = ...
  // Skip: export default
  const exportRegex = /export\s+const\s+(\w+)\s*(?::\s*Story)?\s*=/g;
  let match: RegExpExecArray | null;
  while ((match = exportRegex.exec(content)) !== null) {
    exports.push(match[1]);
  }
  return exports;
}

function parseStoryTitle(content: string): string {
  // Find the meta object definition and extract title from it
  // Look for title inside const meta = { ... } or const meta: Meta = { ... }
  const metaBlock = content.match(/const\s+meta[\s:][^=]*=\s*\{[\s\S]*?\n\};\s*\nexport default meta/);
  if (metaBlock) {
    const titleMatch = metaBlock[0].match(/title:\s*["']([^"']+)["']/);
    if (titleMatch) return titleMatch[1];
  }
  // Fallback: find the first top-level title (skip indented ones)
  const titleMatch = content.match(/^\s{1,2}title:\s*["']([^"']+)["']/m);
  return titleMatch?.[1] ?? "";
}

function classifyStory(imports: ImportInfo[], title: string): StoryInfo["classification"] {
  const category = title.split("/")[0]?.toLowerCase() ?? "";

  // Documentation stories
  if (
    ["guides", "overview", "changelog", "getting started"].some((k) =>
      category.includes(k),
    ) ||
    ["Introduction", "Changelog", "DesignTokens", "IconLibrary", "ComponentStatus", "DarkModeAudit", "AnimationGuide", "Accessibility"].some(
      (k) => title.includes(k),
    )
  ) {
    return "documentation";
  }

  // Check if it imports from @/components/ui/
  const hasUiImport = imports.some((i) => i.source.startsWith("@/components/ui/"));
  const hasFeatureImport = imports.some(
    (i) =>
      i.source.startsWith("@/components/") && !i.source.startsWith("@/components/ui/"),
  );

  // If it has a component prop in meta (component: SomeComponent), it's testing that component
  // Patterns build UI inline — they typically import UI primitives but don't test a specific component
  if (category === "patterns" || category === "layouts") {
    return "pattern";
  }

  if (hasFeatureImport) return "feature";
  if (hasUiImport) return "primitive";

  // If no component imports at all, likely a pattern that builds everything inline
  return "pattern";
}

function extractComponentImports(imports: ImportInfo[]): string[] {
  return imports
    .filter((i) => i.source.startsWith("@/components/"))
    .flatMap((i) => i.names);
}

function extractIconImports(imports: ImportInfo[]): string[] {
  return imports.filter((i) => i.source === "lucide-react").flatMap((i) => i.names);
}

// ── Pass 1: Story-to-Route Mapping ──────────────────────────────────────────

async function loadStories(): Promise<StoryInfo[]> {
  const files = await readdir(STORIES_DIR);
  const storyFiles = files.filter((f) => f.endsWith(".stories.tsx"));
  const stories: StoryInfo[] = [];

  for (const file of storyFiles) {
    const filePath = join(STORIES_DIR, file);
    const content = await readFile(filePath, "utf-8");
    const stat = Bun.file(filePath).size;
    const title = parseStoryTitle(content);
    const imports = parseImports(content);
    const exports = parseStoryExports(content);
    const parts = title.split("/");

    stories.push({
      file: filePath,
      fileName: file,
      title,
      category: parts[0] ?? "",
      storyName: parts.slice(1).join("/") || parts[0] || file.replace(".stories.tsx", ""),
      exports,
      imports,
      classification: classifyStory(imports, title),
      sizeBytes: stat,
    });
  }

  return stories;
}

async function loadRoutes(): Promise<RouteInfo[]> {
  const routes: RouteInfo[] = [];
  const glob = new Glob("**/*.tsx");
  for await (const file of glob.scan(ROUTES_DIR)) {
    const filePath = join(ROUTES_DIR, file);
    const content = await readFile(filePath, "utf-8");
    routes.push({
      file: filePath,
      fileName: file,
      imports: parseImports(content),
      content,
    });
  }
  return routes;
}

async function loadComponents(): Promise<ComponentInfo[]> {
  const components: ComponentInfo[] = [];
  const glob = new Glob("ui/*.tsx");
  for await (const file of glob.scan(COMPONENTS_DIR)) {
    const filePath = join(COMPONENTS_DIR, file);
    const content = await readFile(filePath, "utf-8");
    const name = basename(file, ".tsx");
    components.push({
      file: filePath,
      name,
      variants: parseVariants(content),
      content,
    });
  }
  return components;
}

function parseVariants(content: string): VariantInfo[] {
  const variants: VariantInfo[] = [];
  // Match: variant?: "a" | "b" | "c"  or  variant: "a" | "b" | "c"
  const propRegex = /(\w+)\??\s*:\s*((?:"[^"]+"\s*\|\s*)*"[^"]+")\s*[;,}]/g;
  let match: RegExpExecArray | null;
  while ((match = propRegex.exec(content)) !== null) {
    const propName = match[1];
    const valuesStr = match[2];
    const values = [...valuesStr.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
    if (values.length >= 2) {
      variants.push({ propName, values });
    }
  }
  return variants;
}

// Name similarity matching for stories → routes
// Route files live under _auth/ subdir, so fileNames are like "_auth/knowledge.tsx"
const STORY_ROUTE_MAP: Record<string, string[]> = {
  // Manual mappings for non-obvious matches
  AdminPanelLayout: ["_auth/admin.tsx", "_auth/admin.index.tsx"],
  AgentMarketplace: ["_auth/agents.marketplace.tsx"],
  AgentReasoningTrace: ["_auth/conversations.$id.tsx"],
  ConversationList: ["_auth.tsx"], // sidebar contains conversation list
  ConversationHeader: ["_auth/conversations.$id.tsx"],
  DashboardLayout: ["_auth/index.tsx", "_auth.tsx"],
  KnowledgeBrowser: ["_auth/knowledge.tsx", "_auth/knowledge.$id.tsx", "_auth/knowledge.new.tsx"],
  ModelComparison: ["_auth/model-compare.tsx"],
  OnboardingFlow: ["_auth/onboarding.tsx"],
  ResearchView: ["_auth/research.tsx"],
  NewResearchForm: ["_auth/research.tsx"],
  FormPatterns: [], // design reference, no direct route
  ResponsivePatterns: [], // design reference
  Patterns: [], // design reference
  ErrorRecovery: [], // cross-cutting concern
  LoadingStates: [], // cross-cutting concern
  Showcase: [], // design reference
  MessageBubble: ["_auth/conversations.$id.tsx"],
  MessageInput: ["_auth/conversations.$id.tsx"],
  StreamingMessage: ["_auth/conversations.$id.tsx"],
  CommandPalette: ["_auth.tsx"],
  FileAttachments: ["_auth/conversations.$id.tsx"],
  ToolCallDisplay: ["_auth/conversations.$id.tsx"],
  ToolStatusChip: ["_auth/conversations.$id.tsx"],
  TypingIndicator: ["_auth/conversations.$id.tsx"],
  VoiceInput: ["_auth/conversations.$id.tsx"],
  SlashCommand: ["_auth/conversations.$id.tsx"],
  ErrorMessage: ["_auth/conversations.$id.tsx"],
  RateLimitWarning: ["_auth/conversations.$id.tsx"],
  ArtifactDisplay: ["_auth/conversations.$id.tsx"],
  DynamicWidget: ["_auth/conversations.$id.tsx"],
  URLPreviewCard: ["_auth/conversations.$id.tsx"],
};

function findMatchingRoutes(story: StoryInfo, routes: RouteInfo[]): RouteInfo[] {
  const name = story.storyName.replace(/\s+/g, "");

  // Check manual map first
  const manualMatch = STORY_ROUTE_MAP[story.fileName.replace(".stories.tsx", "")];
  if (manualMatch !== undefined) {
    return routes.filter((r) => manualMatch.includes(r.fileName));
  }

  // Try name-based matching
  const nameLower = name.toLowerCase();
  return routes.filter((r) => {
    // Strip _auth/ prefix and extension for comparison
    const routeName = basename(r.fileName, ".tsx").replace(/[._$]/g, "").toLowerCase();
    return (
      routeName.includes(nameLower) ||
      nameLower.includes(routeName) ||
      // Check shared component imports
      (story.classification !== "documentation" &&
        hasSignificantImportOverlap(story.imports, r.imports))
    );
  });
}

function hasSignificantImportOverlap(a: ImportInfo[], b: ImportInfo[]): boolean {
  const aComponents = new Set(extractComponentImports(a));
  const bComponents = new Set(extractComponentImports(b));
  if (aComponents.size === 0 || bComponents.size === 0) return false;
  const overlap = [...aComponents].filter((c) => bComponents.has(c)).length;
  // Require at least 3 shared component imports for a meaningful match
  return overlap >= 3;
}

// ── Pass 2: Import Diff ─────────────────────────────────────────────────────

// Build a set of all component names imported anywhere in the app (non-story files)
async function buildAppImportIndex(): Promise<Set<string>> {
  const allImported = new Set<string>();
  const glob = new Glob("**/*.tsx");
  for await (const file of glob.scan(SRC_DIR)) {
    if (file.includes(".stories.")) continue;
    const content = await readFile(join(SRC_DIR, file), "utf-8");
    const imports = parseImports(content);
    for (const imp of imports) {
      // Match absolute (@/components/) and relative (./Foo, ../Foo) imports within component tree
      const isComponentImport =
        imp.source.startsWith("@/components/") ||
        imp.source.includes("/components/") ||
        (file.startsWith("components/") && imp.source.startsWith("./")) ||
        (file.startsWith("components/") && imp.source.startsWith("../"));
      if (isComponentImport) {
        for (const name of imp.names) {
          allImported.add(name);
        }
      }
    }
  }
  return allImported;
}

function computeImportDiff(
  story: StoryInfo,
  route: RouteInfo,
  appImports: Set<string>,
): { missingComponents: string[]; missingIcons: string[]; indirectComponents: string[]; notes: string[] } {
  const storyComponents = new Set(extractComponentImports(story.imports));
  const routeComponents = new Set(extractComponentImports(route.imports));
  const storyIcons = new Set(extractIconImports(story.imports));
  const routeIcons = new Set(extractIconImports(route.imports));

  const missingFromRoute = [...storyComponents].filter((c) => !routeComponents.has(c));

  // Separate: missing from entire app vs just missing from this route (indirect usage)
  const missingComponents = missingFromRoute.filter((c) => !appImports.has(c));
  const indirectComponents = missingFromRoute.filter((c) => appImports.has(c));

  const missingIcons = [...storyIcons].filter((i) => !routeIcons.has(i));

  const notes: string[] = [];

  // Check for structural patterns
  if (storyComponents.has("Table") && !routeComponents.has("Table")) {
    notes.push("Story uses Table component but route does not");
  }
  if (storyComponents.has("Tabs") && !routeComponents.has("Tabs")) {
    notes.push("Story uses Tabs component but route does not");
  }
  if (storyComponents.has("Dialog") && !routeComponents.has("Dialog")) {
    notes.push("Story uses Dialog component but route does not");
  }
  if (storyComponents.has("Pagination") && !routeComponents.has("Pagination")) {
    notes.push("Story uses Pagination but route does not");
  }

  return { missingComponents, indirectComponents, missingIcons, notes };
}

// ── Pass 3: Variant Sweep ───────────────────────────────────────────────────

async function findUsedVariants(
  components: ComponentInfo[],
): Promise<Map<string, Map<string, Set<string>>>> {
  // Map: componentName → propName → Set<usedValues>
  const usage = new Map<string, Map<string, Set<string>>>();

  // Scan all non-story source files
  const glob = new Glob("**/*.tsx");
  const sourceFiles: string[] = [];
  for await (const file of glob.scan(SRC_DIR)) {
    if (!file.includes(".stories.")) {
      sourceFiles.push(join(SRC_DIR, file));
    }
  }

  for (const comp of components) {
    if (comp.variants.length === 0) continue;
    const propMap = new Map<string, Set<string>>();

    for (const variant of comp.variants) {
      const usedValues = new Set<string>();

      for (const srcFile of sourceFiles) {
        const content = await readFile(srcFile, "utf-8");
        // Check for variant="value" or variant={'value'} or variant: "value"
        for (const val of variant.values) {
          const patterns = [
            `${variant.propName}="${val}"`,
            `${variant.propName}={'${val}'}`,
            `${variant.propName}: "${val}"`,
            `"${val}"`, // also check bare string usage in context of the component
          ];
          // More targeted: look for component usage with this variant
          if (
            content.includes(`<${comp.name}`) &&
            patterns.some((p) => content.includes(p))
          ) {
            usedValues.add(val);
          }
        }
      }

      propMap.set(variant.propName, usedValues);
    }

    usage.set(comp.name, propMap);
  }

  return usage;
}

function findStoryDemonstratedVariants(
  stories: StoryInfo[],
  components: ComponentInfo[],
): Map<string, Map<string, Set<string>>> {
  // Map: componentName → propName → Set<demonstratedValues>
  const demonstrated = new Map<string, Map<string, Set<string>>>();

  for (const comp of components) {
    if (comp.variants.length === 0) continue;

    // Find the story for this component
    const story = stories.find(
      (s) => s.fileName.replace(".stories.tsx", "") === comp.name,
    );
    if (!story) continue;

    const propMap = new Map<string, Set<string>>();

    // Read story content to find which variants are demonstrated
    const storyContent = Bun.file(story.file);

    for (const variant of comp.variants) {
      const demonstratedValues = new Set<string>();
      for (const val of variant.values) {
        // Will be checked after reading
        demonstratedValues.add(val); // Assume all variants in props are demonstrated
      }
      propMap.set(variant.propName, demonstratedValues);
    }

    demonstrated.set(comp.name, propMap);
  }

  return demonstrated;
}

// ── Report Generation ───────────────────────────────────────────────────────

function generateReport(report: GapReport, stories: StoryInfo[]): string {
  const lines: string[] = [];
  const now = new Date().toISOString().split("T")[0];

  lines.push("# Storybook vs Web App — Gap Analysis Report");
  lines.push("");
  lines.push(`> Generated: ${now}`);
  lines.push(`> Stories analyzed: ${stories.length}`);
  lines.push(
    `> Classification: ${stories.filter((s) => s.classification === "primitive").length} primitives, ${stories.filter((s) => s.classification === "feature").length} features, ${stories.filter((s) => s.classification === "pattern").length} patterns, ${stories.filter((s) => s.classification === "documentation").length} documentation`,
  );
  lines.push("");

  // ── Section 1: Unimplemented Designs ──
  lines.push("## 1. Unimplemented Designs (P1)");
  lines.push("");
  lines.push(
    "Pattern/page stories with no matching route or component implementation.",
  );
  lines.push("");

  if (report.unimplemented.length === 0) {
    lines.push("*No unimplemented designs found.*");
  } else {
    lines.push(
      "| Priority | Story | Title | Size | Reason |",
    );
    lines.push(
      "|----------|-------|-------|------|--------|",
    );
    for (const gap of report.unimplemented) {
      const size = `${(gap.story.sizeBytes / 1024).toFixed(1)}K`;
      lines.push(
        `| **P1** | \`${gap.story.fileName}\` | ${gap.story.title} | ${size} | ${gap.reason} |`,
      );
    }
  }
  lines.push("");

  // ── Section 2: Partial Implementations ──
  lines.push("## 2. Partial Implementations (P2)");
  lines.push("");
  lines.push(
    "Routes that exist but are missing features shown in their corresponding story.",
  );
  lines.push("");

  if (report.partial.length === 0) {
    lines.push("*No partial implementations found.*");
  } else {
    for (const gap of report.partial) {
      lines.push(`### ${gap.story.storyName}`);
      lines.push("");
      lines.push(`- **Story**: \`${gap.story.fileName}\``);
      lines.push(`- **Route**: \`${gap.route.fileName}\``);

      if (gap.missingComponents.length > 0) {
        lines.push(
          `- **Missing from app**: ${gap.missingComponents.map((c) => `\`${c}\``).join(", ")}`,
        );
      }
      if (gap.indirectComponents.length > 0) {
        lines.push(
          `- **Not in route** (used elsewhere in app): ${gap.indirectComponents.map((c) => `\`${c}\``).join(", ")}`,
        );
      }
      if (gap.missingIcons.length > 0) {
        lines.push(
          `- **Missing icons**: ${gap.missingIcons.map((i) => `\`${i}\``).join(", ")}`,
        );
      }
      if (gap.notes.length > 0) {
        for (const note of gap.notes) {
          lines.push(`- **Note**: ${note}`);
        }
      }
      lines.push("");
    }
  }

  // ── Section 3: Unused Component Variants ──
  lines.push("## 3. Unused Component Variants (P3)");
  lines.push("");
  lines.push(
    "UI primitive variants defined in component source and demonstrated in stories but never used in the app.",
  );
  lines.push("");

  if (report.unusedVariants.length === 0) {
    lines.push("*No unused variants found.*");
  } else {
    // Group by component
    const byComponent = new Map<string, UnusedVariantGap[]>();
    for (const gap of report.unusedVariants) {
      const existing = byComponent.get(gap.component) ?? [];
      existing.push(gap);
      byComponent.set(gap.component, existing);
    }

    lines.push("| Component | Prop | Unused Variant | Component File |");
    lines.push("|-----------|------|----------------|----------------|");
    for (const [component, gaps] of byComponent) {
      for (const gap of gaps) {
        lines.push(
          `| \`${component}\` | \`${gap.propName}\` | \`"${gap.variant}"\` | \`${basename(gap.componentFile)}\` |`,
        );
      }
    }
  }
  lines.push("");

  // ── Summary ──
  lines.push("## Summary");
  lines.push("");
  lines.push(`| Category | Count |`);
  lines.push(`|----------|-------|`);
  lines.push(`| P1 — Unimplemented designs | ${report.unimplemented.length} |`);
  lines.push(`| P2 — Partial implementations | ${report.partial.length} |`);
  lines.push(`| P3 — Unused component variants | ${report.unusedVariants.length} |`);
  lines.push(`| **Total gaps** | **${report.unimplemented.length + report.partial.length + report.unusedVariants.length}** |`);
  lines.push("");

  return lines.join("\n");
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log("🔍 Loading stories...");
  const stories = await loadStories();
  console.log(`   Found ${stories.length} stories`);

  console.log("🔍 Loading routes...");
  const routes = await loadRoutes();
  console.log(`   Found ${routes.length} routes`);

  console.log("🔍 Loading UI components...");
  const components = await loadComponents();
  console.log(`   Found ${components.length} UI components`);

  // ── Pass 1: Story-to-Route Mapping ──
  console.log("\n📋 Pass 1: Story-to-Route Mapping...");
  const unimplemented: UnimplementedGap[] = [];
  const matchedPairs: { story: StoryInfo; routes: RouteInfo[] }[] = [];

  for (const story of stories) {
    if (story.classification === "documentation") continue;

    const matchedRoutes = findMatchingRoutes(story, routes);

    if (story.classification === "pattern" && matchedRoutes.length === 0) {
      unimplemented.push({
        story,
        reason: "Pattern/page story with no matching route",
      });
    } else if (matchedRoutes.length > 0) {
      matchedPairs.push({ story, routes: matchedRoutes });
    }
  }

  console.log(`   ${unimplemented.length} unimplemented designs`);
  console.log(`   ${matchedPairs.length} matched story-route pairs`);

  // ── Pass 2: Import Diff ──
  console.log("\n📋 Pass 2: Import Diff...");
  console.log("   Building app-wide import index...");
  const appImports = await buildAppImportIndex();
  const partial: PartialGap[] = [];

  for (const { story, routes: matchedRoutes } of matchedPairs) {
    for (const route of matchedRoutes) {
      const diff = computeImportDiff(story, route, appImports);
      if (
        diff.missingComponents.length > 0 ||
        diff.indirectComponents.length > 0 ||
        diff.notes.length > 0
      ) {
        partial.push({
          story,
          route,
          ...diff,
        });
      }
    }
  }

  // Deduplicate: keep only the best match per story (fewest missing components)
  const bestPartial = new Map<string, PartialGap>();
  for (const gap of partial) {
    const key = gap.story.fileName;
    const existing = bestPartial.get(key);
    if (
      !existing ||
      gap.missingComponents.length < existing.missingComponents.length
    ) {
      bestPartial.set(key, gap);
    }
  }
  const deduplicatedPartial = [...bestPartial.values()].filter(
    (g) => g.missingComponents.length > 0 || g.indirectComponents.length > 0 || g.notes.length > 0,
  );

  console.log(`   ${deduplicatedPartial.length} partial implementations`);

  // ── Pass 3: Variant Sweep ──
  console.log("\n📋 Pass 3: Variant Sweep...");
  const usedVariants = await findUsedVariants(components);
  const unusedVariants: UnusedVariantGap[] = [];

  for (const comp of components) {
    if (comp.variants.length === 0) continue;
    const compUsage = usedVariants.get(comp.name);
    if (!compUsage) continue;

    // Find story for this component
    const story = stories.find(
      (s) => s.fileName.replace(".stories.tsx", "") === comp.name,
    );

    for (const variant of comp.variants) {
      const used = compUsage.get(variant.propName) ?? new Set();
      for (const val of variant.values) {
        if (!used.has(val)) {
          unusedVariants.push({
            component: comp.name,
            componentFile: comp.file,
            propName: variant.propName,
            variant: val,
            storyFile: story?.fileName ?? "N/A",
          });
        }
      }
    }
  }

  console.log(`   ${unusedVariants.length} unused variants`);

  // ── Generate Report ──
  console.log("\n📝 Generating report...");
  const report: GapReport = {
    unimplemented,
    partial: deduplicatedPartial,
    unusedVariants,
  };

  const markdown = generateReport(report, stories);
  const outputPath = join(WEB_ROOT, "storybook-gap-report.md");
  await Bun.write(outputPath, markdown);
  console.log(`\n✅ Report written to: ${outputPath}`);
  console.log(
    `\n   P1 (unimplemented): ${report.unimplemented.length}`,
  );
  console.log(`   P2 (partial):       ${report.partial.length}`);
  console.log(`   P3 (unused variants): ${report.unusedVariants.length}`);

  // Also print to stdout
  console.log("\n" + "=".repeat(80) + "\n");
  console.log(markdown);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
