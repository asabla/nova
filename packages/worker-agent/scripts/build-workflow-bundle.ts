/**
 * Pre-bundle workflow code with @temporalio/worker's bundleWorkflowCode.
 *
 * The bundle is written to dist/workflow-bundle.js and loaded at worker
 * startup when present (see runWorker in @nova/worker-shared).
 *
 * Benefits over lazy runtime bundling via workflowsPath:
 *  - Bundle errors (e.g. a non-deterministic import leaking into workflow
 *    code) surface at build time, not on the first workflow task.
 *  - Faster cold start — no per-process webpack invocation.
 *  - Deterministic, diffable artifact shipped with the Docker image.
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
