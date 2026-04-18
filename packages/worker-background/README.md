# @nova/worker-background

Temporal worker for background workflows: research, summaries, cleanup, scheduling. Owns the `nova-background` task queue.

## Runtime

**This package runs on Node.js, not Bun.** See [ADR-0001](../../docs/adr/ADR-0001-tech-stack.md) — Temporal's TypeScript worker SDK needs `worker_threads`, `vm`, and Node-API natives that Bun doesn't provide. Temporal's README explicitly discourages non-Node runtimes for workers.

Dev uses `tsx watch src/index.ts`. Production runs compiled JS via `node`.

## Layout

- `src/index.ts` — entrypoint. Delegates to `runWorker` from `@nova/worker-shared/run-worker` and passes `setupSchedules` as the `beforeStart` hook so Temporal schedules are registered before the worker starts polling.
- `src/activities/` — research tool calls, LLM-driven summaries, metric rollups, eval dispatch.
- `src/workflows/` — deep-research, conversation-summary, research-agent, research-refinement, and siblings. Deterministic orchestration only.
- `src/scheduler.ts` — Temporal schedule definitions registered at worker boot.

## Build

`bun run build` runs `tsc` + `bundleWorkflowCode`, emitting `dist/workflow-bundle.js`.
