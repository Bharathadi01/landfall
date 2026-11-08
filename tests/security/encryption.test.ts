import { describe, it, expect } from "vitest";
import { encryptPII, decryptPII } from "@/lib/security/encryption";

describe("AES-256-GCM PII Encryption", () => {
  it("encrypts and decrypts text correctly", () => {
    const sensitive = "Maria Rodriguez - 1402 E 7th Ave, Tampa FL";
    const encrypted = encryptPII(sensitive);

    expect(encrypted).not.toBeNull();
    expect(encrypted).not.toBe(sensitive);
    expect(encrypted).toContain("v1:");

    const decrypted = decryptPII(encrypted);
    expect(decrypted).toBe(sensitive);
  });

  it("handles null and undefined gracefully", () => {
    expect(encryptPII(null)).toBeNull();
    expect(encryptPII(undefined)).toBeNull();
    expect(decryptPII(null)).toBeNull();
    expect(decryptPII(undefined)).toBeNull();
  });

  it("produces distinct ciphertexts for same plaintext due to random IV", () => {
    const text = "123-45-6789";
    const enc1 = encryptPII(text);
    const enc2 = encryptPII(text);

    expect(enc1).not.toBe(enc2);
    expect(decryptPII(enc1)).toBe(text);
    expect(decryptPII(enc2)).toBe(text);
  });

  it("fails decryption if auth tag or ciphertext is tampered with", () => {
    const text = "Confidential note";
    const encrypted = encryptPII(text)!;
    const parts = encrypted.split(":");
    // Tamper with the ciphertext (last part)
    const tamperedParts = [...parts];
    tamperedParts[3] = tamperedParts[3].replace(/^[0-9a-f]/, "e");
    const tampered = tamperedParts.join(":");

    expect(() => decryptPII(tampered)).toThrow();
  });
});

