import "server-only";

export interface ProviderDiagnostic {
  safeMessage: string;
  errorCode: string | null;
  httpStatus: number | null;
}

const codePattern = /^[a-z][a-z0-9_]{0,63}$/;
const suffixPattern = /_(400|401|403|404|429|500|502|503|504)$/;

function status(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 100 && value <= 599 ? value : null;
}

/** Only a standalone safe code is trusted; arbitrary provider bodies never leave the server. */
export function extractProviderDiagnostic(error: unknown): ProviderDiagnostic {
  const value = error && typeof error === "object" ? error as Record<string, unknown> : null;
  const response = value?.response && typeof value.response === "object" ? value.response as Record<string, unknown> : null;
  const raw = error instanceof Error ? error.message : typeof value?.message === "string" ? value.message : "";
  const safeCode = codePattern.test(raw) && !raw.includes("secret") && !raw.includes("token") && !raw.includes("key") && (!/_\d{3}$/.test(raw) || suffixPattern.test(raw)) ? raw : null;
  const code = typeof value?.code === "string" && codePattern.test(value.code) && !/secret|token|key/i.test(value.code) && (!/_\d{3}$/.test(value.code) || suffixPattern.test(value.code)) ? value.code : safeCode;
  const fromSuffix = code?.match(suffixPattern)?.[1];
  const httpStatus = status(value?.status) ?? status(value?.statusCode) ?? status(response?.status) ?? (fromSuffix ? Number(fromSuffix) : null);
  return { safeMessage: code ?? "provider_error", errorCode: code, httpStatus };
}

/** Historical rows have no diagnostic columns; parse only full, safe legacy codes. */
export function legacyProviderDiagnostic(error: string | null): Pick<ProviderDiagnostic, "errorCode" | "httpStatus"> {
  if (!error || !codePattern.test(error) || /secret|token|key/i.test(error)) return { errorCode: null, httpStatus: null };
  const suffix = error.match(suffixPattern)?.[1];
  return suffix ? { errorCode: error, httpStatus: Number(suffix) } : { errorCode: null, httpStatus: null };
}
