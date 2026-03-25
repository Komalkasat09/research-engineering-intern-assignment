type RotationTask<T> = (apiKey: string, keyIndex: number) => Promise<T>;

function parseSuffix(envName: string): number {
  if (envName === "GROQ_API_KEY") return 1;
  const match = envName.match(/^GROQ_API_KEY_(\d+)$/);
  return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
}

export function getGroqApiKeys(): string[] {
  const fromCsv = (process.env.GROQ_API_KEYS ?? "")
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);

  const fromIndexed = Object.keys(process.env)
    .filter((k) => /^GROQ_API_KEY(?:_\d+)?$/.test(k))
    .sort((a, b) => parseSuffix(a) - parseSuffix(b))
    .map((k) => process.env[k]?.trim() ?? "")
    .filter(Boolean);

  const deduped = [...fromCsv, ...fromIndexed].filter(
    (key, idx, arr) => arr.indexOf(key) === idx,
  );

  return deduped;
}

export function isGroqRateLimitError(err: unknown): boolean {
  const text = err instanceof Error ? err.message : String(err ?? "");
  const normalized = text.toLowerCase();
  return (
    normalized.includes(" 429") ||
    normalized.includes("status: 429") ||
    normalized.includes("rate limit") ||
    normalized.includes("rate_limit") ||
    normalized.includes("too many requests")
  );
}

export async function withGroqKeyRotation<T>(task: RotationTask<T>): Promise<T> {
  const keys = getGroqApiKeys();
  if (!keys.length) {
    throw new Error("No GROQ_API_KEY configured");
  }

  let lastError: unknown;

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i]!;
    try {
      return await task(key, i);
    } catch (err) {
      lastError = err;
      const canRetry = i < keys.length - 1;
      if (!canRetry || !isGroqRateLimitError(err)) {
        throw err;
      }
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("All GROQ_API_KEY candidates failed");
}
