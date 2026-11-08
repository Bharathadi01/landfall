import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // Standard for GCM
const CURRENT_VERSION = "v1";

function getKey(): Buffer {
  const envKey = process.env.PII_ENCRYPTION_KEY;
  if (!envKey) {
    // Deterministic fallback for dev/test environments
    return crypto.createHash("sha256").update("landfall-dev-secret-key-32-bytes-min").digest();
  }
  // If base64 encoded 32 bytes
  if (envKey.length === 44 && envKey.endsWith("=")) {
    return Buffer.from(envKey, "base64");
  }
  // Otherwise SHA-256 hash to ensure exact 32 bytes
  return crypto.createHash("sha256").update(envKey).digest();
}

/**
 * Encrypts a plaintext PII string using AES-256-GCM.
 * Output format: `v1:<iv_hex>:<auth_tag_hex>:<ciphertext_hex>`
 */
export function encryptPII(plaintext: string | null | undefined): string | null {
  if (!plaintext) return null;

  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");

  return `${CURRENT_VERSION}:${iv.toString("hex")}:${authTag}:${encrypted}`;
}

/**
 * Decrypts an encrypted PII string.
 */
export function decryptPII(encryptedData: string | null | undefined): string | null {
  if (!encryptedData) return null;

  const parts = encryptedData.split(":");
  if (parts.length !== 4) {
    // Unencrypted legacy fallback for dev/test
    return encryptedData;
  }

  const [version, ivHex, authTagHex, ciphertextHex] = parts;
  if (version !== CURRENT_VERSION) {
    throw new Error(`Unsupported encryption version: ${version}`);
  }

  const key = getKey();
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(ciphertextHex, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}
