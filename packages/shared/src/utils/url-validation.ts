import { z } from "zod";

const PRIVATE_IP_RANGES = [
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^127\./,
  /^169\.254\./,
  /^0\./,
  /^::1$/,
  /^fc00:/i,
  /^fe80:/i,
];

export function isPrivateIP(ip: string): boolean {
  return PRIVATE_IP_RANGES.some((regex) => regex.test(ip));
}

export const safeUrlSchema = z
  .string()
  .url()
  .refine((url) => {
    try {
      const parsed = new URL(url);
      if (!["http:", "https:"].includes(parsed.protocol)) return false;
      if (parsed.hostname === "localhost") return false;
      if (isPrivateIP(parsed.hostname)) return false;
      return true;
    } catch {
      return false;
    }
  }, "URL points to a private or disallowed address");
