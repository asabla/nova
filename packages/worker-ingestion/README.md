# @nova/worker-ingestion

Temporal worker for document/file/message embedding pipelines. Owns the `nova-ingestion` task queue.

## Runtime

**This package runs on Node.js, not Bun.** See [ADR-0001](../../docs/adr/ADR-0001-tech-stack.md) — Temporal's TypeScript worker SDK needs `worker_threads`, `vm`, and Node-API natives that Bun doesn't provide. Temporal's README explicitly discourages non-Node runtimes for workers.

Dev uses `tsx watch src/index.ts`. Production runs compiled JS via `node`.

## Layout

- `src/index.ts` — entrypoint (delegates to `runWorker` from `@nova/worker-shared/run-worker`).
- `src/activities/` — document extraction (mupdf, tesseract.js, tree-sitter), embedding model calls, Qdrant writes. Native modules live here and are not bundled.
- `src/workflows/` — deterministic orchestration only. Sandboxed in V8 by Temporal.

## Build

`bun run build` runs `tsc` + `bundleWorkflowCode`, emitting `dist/workflow-bundle.js`. Activities (including native deps) are NOT in the bundle — they're loaded normally by Node at runtime.
