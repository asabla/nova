export const LITELLM_URL = process.env.LITELLM_URL ?? "http://localhost:4000";

export function litellmHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const key = process.env.LITELLM_MASTER_KEY;
  if (key) {
    headers.Authorization = `Bearer ${key}`;
  }
  return headers;
}
