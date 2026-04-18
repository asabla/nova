/**
 * Pre-bundle workflow code with @temporalio/worker's bundleWorkflowCode.
 * See packages/worker-agent/scripts/build-workflow-bundle.ts for rationale.
 */
import { bundleWorkflowCode } from "@temporalio/worker";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const workflowsPath = path.resolve(import.meta.dirname, "../src/workflows/index.ts");
const outDir = path.resolve(import.meta.dirname, "../dist");
const outFile = path.join(outDir, "workflow-bundle.js");

const { code } = await bundleWorkflowCode({ workflowsPath });

mkdirSync(outDir, { recursive: true });
writeFileSync(outFile, code);

const sizeKb = (code.length / 1024).toFixed(1);
// eslint-disable-next-line no-console
console.log(`workflow-bundle.js written (${sizeKb} KB) → ${outFile}`);
