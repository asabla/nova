import { useMemo } from "react";
import { parseThinkBlocks, type ThinkParseResult } from "../lib/think-parser";

export function useThinkingParser(raw: string): ThinkParseResult {
  return useMemo(() => parseThinkBlocks(raw), [raw]);
}
