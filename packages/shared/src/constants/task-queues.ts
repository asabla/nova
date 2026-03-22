export const TASK_QUEUES = {
  AGENT: "nova-agent",
  INGESTION: "nova-ingestion",
  BACKGROUND: "nova-background",
} as const;

export type TaskQueue = (typeof TASK_QUEUES)[keyof typeof TASK_QUEUES];
