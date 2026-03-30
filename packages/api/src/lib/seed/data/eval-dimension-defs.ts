export const evalDimensionDefs: { evalType: string; name: string; description: string; weight: string }[] = [
  // Chat dimensions
  { evalType: "chat", name: "helpfulness", weight: "0.30", description: "Does the response actually address what the user asked? Does it provide actionable, useful information?" },
  { evalType: "chat", name: "accuracy", weight: "0.25", description: "Are factual claims correct? Is information reliable and not hallucinated?" },
  { evalType: "chat", name: "coherence", weight: "0.25", description: "Does the response logically follow from the conversation context? Is it internally consistent?" },
  { evalType: "chat", name: "formatting", weight: "0.10", description: "Does it follow the formatting rules (prose paragraphs, proper markdown, no excessive lists/bold)?" },
  { evalType: "chat", name: "conciseness", weight: "0.10", description: "Is the response appropriately sized for the effort level? Not too verbose, not too terse?" },
  // Planning dimensions
  { evalType: "planning", name: "tier_accuracy", weight: "0.30", description: "Was the execution tier (direct/sequential/orchestrated) correctly chosen for this request?" },
  { evalType: "planning", name: "plan_completeness", weight: "0.25", description: "Does the plan cover all necessary steps to fulfill the user's request?" },
  { evalType: "planning", name: "plan_efficiency", weight: "0.20", description: "Is the plan minimal (no redundant steps)? Does it maximize parallelism where appropriate?" },
  { evalType: "planning", name: "tool_selection", weight: "0.15", description: "Are the right tools assigned to each step? No missing tools or unnecessary tool usage?" },
  { evalType: "planning", name: "dependency_correctness", weight: "0.10", description: "Are dependency edges between steps valid? No false dependencies blocking parallelism, no missing dependencies causing ordering issues?" },
  // Research dimensions
  { evalType: "research", name: "thoroughness", weight: "0.25", description: "Does the report cover multiple sources, perform multi-pass research, and go beyond surface-level information?" },
  { evalType: "research", name: "accuracy", weight: "0.25", description: "Are claims backed by cited sources? Are citations accurate and not fabricated?" },
  { evalType: "research", name: "analytical_depth", weight: "0.20", description: "Does it use data analysis (code execution, statistics, comparisons) rather than just summarizing text?" },
  { evalType: "research", name: "structure", weight: "0.15", description: "Does it follow the expected report structure (executive summary, findings, analysis, conclusion)?" },
  { evalType: "research", name: "source_quality", weight: "0.15", description: "Are sources diverse, credible, and properly cited with [N] inline citations?" },
];
