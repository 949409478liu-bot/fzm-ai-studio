import "server-only";

export class ProviderValidationError extends Error {
  status = 400;
}

export class ProviderFatalError extends Error {}

export class ProviderRateLimitError extends Error {
  constructor(message: string, public retryAfterMs?: number) { super(message); }
}

export class ProviderBusyError extends Error {
  constructor(message: string, public retryAfterMs?: number) { super(message); }
}

export class ProviderAmbiguousSubmitError extends Error {}

export class ProviderPollError extends Error {}

export function redactProviderError(error: unknown) {
  const raw = error instanceof Error ? error.message : String(error);
  return raw
    .replace(/Bearer\s+[^\s,;"']+/gi, "Bearer [REDACTED]")
    .replace(/(api[-_ ]?key|authorization|access[-_ ]?token|password|secret)(["'\s]*[:=]["'\s]*)[^\s,;"']+/gi, "$1$2[REDACTED]")
    .replace(/sk-[A-Za-z0-9_-]{8,}/g, "sk-[REDACTED]")
    .replace(/https?:\/\/[^\s]+/gi, "[REDACTED_URL]")
    .replace(/(?:^|\s)[^\s]*[?&](?:token|signature|key)=[^\s]+/gi, " [REDACTED_URL]")
    .slice(0, 500);
}
