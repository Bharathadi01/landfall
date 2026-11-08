import crypto from "crypto";
import fs from "fs";
import path from "path";

const CACHE_DIR = path.resolve(process.cwd(), ".cache");
const CACHE_FILE = path.join(CACHE_DIR, "llm-cache.json");

let memoryCache: Record<string, unknown> = {};

// Load cache from disk if available
try {
  if (fs.existsSync(CACHE_FILE)) {
    const raw = fs.readFileSync(CACHE_FILE, "utf-8");
    memoryCache = JSON.parse(raw);
  }
} catch {
  memoryCache = {};
}

export function computeCacheKey(model: string, systemPrompt: string, input: unknown): string {
  const serialized = JSON.stringify({
    model,
    systemPrompt,
    input,
  });
  return crypto.createHash("sha256").update(serialized).digest("hex");
}

export function getCachedOutput<T>(cacheKey: string): T | null {
  if (cacheKey in memoryCache) {
    return memoryCache[cacheKey] as T;
  }
  return null;
}

export function setCachedOutput(cacheKey: string, output: unknown): void {
  memoryCache[cacheKey] = output;
  try {
    if (!fs.existsSync(CACHE_DIR)) {
      fs.mkdirSync(CACHE_DIR, { recursive: true });
    }
    fs.writeFileSync(CACHE_FILE, JSON.stringify(memoryCache, null, 2), "utf-8");
  } catch (err) {
    console.warn("Failed to persist LLM cache to disk:", err);
  }
}

