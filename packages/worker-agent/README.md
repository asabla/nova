# @nova/worker-agent

Temporal worker for agent execution. Owns the `nova-agent` task queue: chat workflows, tool calls, DAG orchestration, and subtask dispatch.

## Runtime

**This package runs on Node.js, not Bun.** Temporal's TypeScript worker SDK depends on `worker_threads`, the `vm` module, and Node-API native modules that Bun does not provide. Temporal's own README states: *"running Temporal Workers in non-Node.js environments is strongly discouraged."*

Dev uses `tsx watch src/index.ts`. Production runs compiled JS from `dist/` via `node` — see `infra/docker/Dockerfile.worker`.

The API package (`@nova/api`) uses `@temporalio/client` only and runs on Bun — that's fine. The runtime split is intentional. See [ADR-0001](../../docs/adr/ADR-0001-tech-stack.md) for the full rationale.

## Layout

- `src/index.ts` — entrypoint. Initialises telemetry, then delegates to `runWorker` from `@nova/worker-shared/run-worker`.
- `src/activities/` — side-effect functions (LLM calls, DB writes, Redis publishes). These run in the regular Node process and can use any dependency.
- `src/workflows/` — deterministic orchestration code. Runs inside Temporal's V8 sandbox. Must not do I/O, read `Date.now()` outside `workflowInfo`, or import value-heavy modules (only types + constants from `@nova/shared`).

## Build

`bun run build` runs `tsc` and then `bundleWorkflowCode` via `scripts/build-workflow-bundle.ts`, emitting `dist/workflow-bundle.js`. `runWorker` uses the bundle when present and falls back to `workflowsPath` in dev. Bundle-breaking imports (e.g. a non-deterministic module leaking into workflow code) surface at build time rather than on the first workflow task.
