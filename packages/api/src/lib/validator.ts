/**
 * Re-export of @hono/zod-validator with a simplified type signature.
 *
 * Hono's middleware type chain creates exponentially complex generics when
 * combined with zValidator — 110 calls across 24 route files cause tsc to
 * spend 5-30s per call and OOM. This wrapper preserves the validated type
 * info for c.req.valid() while skipping the expensive conditional type
 * computations (HasUndefined, ValidationTargets intersection, Env chaining).
 *
 * Trade-off: route handlers lose Hono's chained Env type propagation for
 * validated data, but c.req.valid("json") etc. still return the correct
 * inferred Zod output type.
 */
import { zValidator as _zValidator } from "@hono/zod-validator";
import type { z } from "zod";
import type { Env, ValidationTargets } from "hono";
import type { MiddlewareHandler } from "hono/types";

export function zValidator<
  Target extends keyof ValidationTargets,
  T extends z.ZodSchema,
>(
  target: Target,
  schema: T,
): MiddlewareHandler<
  Env,
  string,
  { in: { [K in Target]: z.output<T> }; out: { [K in Target]: z.output<T> } }
> {
  // @ts-expect-error — zValidator's return type is excessively deep (TS2589).
  // Runtime behavior is identical; the cast preserves validated types for callers.
  return _zValidator(target, schema);
}
