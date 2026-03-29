/**
 * AES-256-GCM encryption/decryption for data at rest.
 *
 * Uses ENCRYPTION_KEY env var (32-byte hex or base64 key).
 * Format: iv:ciphertext:tag (base64 encoded, colon-separated).
 */

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

function getKey(): Buffer {
  const envKey = process.env.ENCRYPTION_KEY;
  if (!envKey) throw new Error("ENCRYPTION_KEY environment variable is required for encryption");

  // Support hex (64 chars) or base64 (44 chars) encoded 32-byte keys
  if (envKey.length === 64 && /^[0-9a-fA-F]+$/.test(envKey)) {
    return Buffer.from(envKey, "hex");
  }
  const decoded = Buffer.from(envKey, "base64");
  if (decoded.length === 32) return decoded;

  throw new Error("ENCRYPTION_KEY must be a 32-byte key encoded as hex (64 chars) or base64 (44 chars)");
}

export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, "utf8");
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${iv.toString("base64")}:${encrypted.toString("base64")}:${tag.toString("base64")}`;
}

export function decrypt(encryptedValue: string): string {
  const key = getKey();
  const parts = encryptedValue.split(":");
  if (parts.length !== 3) throw new Error("Invalid encrypted value format");

  const iv = Buffer.from(parts[0], "base64");
  const encrypted = Buffer.from(parts[1], "base64");
  const tag = Buffer.from(parts[2], "base64");

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  let decrypted = decipher.update(encrypted);
  decrypted = Buffer.concat([decrypted, decipher.final()]);

  return decrypted.toString("utf8");
}

/**
 * Check if a value appears to be encrypted (matches iv:ciphertext:tag format).
 */
export function isEncrypted(value: string): boolean {
  const parts = value.split(":");
  if (parts.length !== 3) return false;
  try {
    Buffer.from(parts[0], "base64");
    Buffer.from(parts[1], "base64");
    Buffer.from(parts[2], "base64");
    return true;
  } catch {
    return false;
  }
}
