"use client";

const messages: Record<string, string> = {
  "401": "API 密钥无效、过期或没有权限。",
  unauthorized: "API 密钥无效、过期或没有权限。",
  invalid_api_key: "API 密钥无效、过期或没有权限。",
  authentication_failed: "API 密钥无效、过期或没有权限。",
  "403": "中转站拒绝了请求，请检查账户权限、模型权限或余额。",
  forbidden: "中转站拒绝了请求，请检查账户权限、模型权限或余额。",
  "404": "没有找到请求的模型或接口地址，请检查模型 ID 和接口地址。",
  model_not_found: "没有找到请求的模型或接口地址，请检查模型 ID 和接口地址。",
  endpoint_not_found: "没有找到请求的模型或接口地址，请检查模型 ID 和接口地址。",
  "429": "请求过于频繁，或当前账户额度受限。",
  rate_limit: "请求过于频繁，或当前账户额度受限。",
  rate_limited: "请求过于频繁，或当前账户额度受限。",
  insufficient_balance: "账户余额或额度不足。",
  insufficient_quota: "账户余额或额度不足。",
  quota_exceeded: "账户余额或额度不足。",
  model_not_supported: "当前中转站不支持这个模型。",
  capability_not_supported: "当前模型不支持这个操作。",
  provider_no_outputs: "中转站返回成功，但没有返回可用图片。",
  timeout: "请求超时，中转站长时间没有返回结果。",
  job_deadline_exceeded: "请求超时，中转站长时间没有返回结果。",
  ambiguous_submit: "提交结果不确定。为避免重复扣费，系统没有自动再次提交。",
  adapter_poll_missing: "当前接口配置与异步任务协议不匹配。",
  provider_busy: "中转站服务繁忙，请稍后再试。",
  provider_disabled: "中转站已停用，请重新选择。",
  image_edit_requires_reference: "请添加参考图后再生成。",
  retry_exhausted: "服务繁忙，多次重试后仍未成功。",
  provider_model_required: "请选择中转站和模型。",
  submit_in_progress: "正在提交，请勿重复点击。",
  request_failed: "请求失败，请稍后重试。",
};
const statuses: Record<string, string> = {
  queued: "排队中", preparing: "准备中", submitting: "正在提交", polling: "正在生成",
  downloading: "正在获取结果", finalizing: "正在保存结果", succeeded: "已完成", completed: "已完成",
  failed: "生成失败", interrupted: "任务中断", canceled: "已取消", cancelled: "已取消",
  rate_limited: "请求过于频繁", provider_busy: "服务繁忙", running: "正在生成", processing: "正在生成",
};
const phases: Record<string, string> = {
  ...statuses, submitting: "提交请求", polling: "等待模型生成", downloading: "下载生成结果", finalizing: "保存生成结果",
};
const UNKNOWN_ERROR = "生成失败，查看生成日志获取详细信息。";
const BAD_REQUEST_REASON = "中转站拒绝了当前请求（HTTP 400）。通常表示接口协议、模型 ID 或请求参数与服务商要求不一致。";
const BAD_REQUEST_CHECKS = "请检查：\n1. 接口类型是否选对\n2. Base URL 是否正确\n3. Model ID 是否为服务商真实模型 ID\n4. 当前模型是否支持文生图/图生图\n5. 服务商是否要求不同的请求参数";
const UNKNOWN_STATUS = "处理中";

function extract(error: unknown): string {
  if (typeof error === "string") return error;
  if (!error || typeof error !== "object") return "";
  const value = error as { error?: unknown; code?: unknown; errorCode?: unknown; httpStatus?: unknown; body?: { error?: unknown; code?: unknown } };
  const candidate = value.errorCode ?? value.body?.code ?? value.body?.error ?? value.code ?? value.error ?? value.httpStatus;
  return typeof candidate === "string" || typeof candidate === "number" ? String(candidate) : "";
}

export function formatJobError(error: unknown, options: { detailed?: boolean; brief?: boolean } = {}): string {
  const code = extract(error).trim().toLowerCase();
  if (code === "400" || code === "openai_compatible_submit_failed_400" || /(?:^|[^a-z0-9])http\s*400(?:$|[^0-9])/.test(code)) return options.detailed ? `${BAD_REQUEST_REASON}\n${BAD_REQUEST_CHECKS}` : options.brief ? "中转站拒绝了当前请求（HTTP 400）。" : BAD_REQUEST_REASON;
  if (messages[code]) return messages[code];
  const status = code.match(/(?:http\s*)?\b(401|403|404|429)\b/i)?.[1];
  if (status) return messages[status];
  for (const key of Object.keys(messages)) {
    if (key.length > 3 && new RegExp(`(?:^|[^a-z_])${key}(?:$|[^a-z_])`, "i").test(code)) return messages[key];
  }
  return UNKNOWN_ERROR;
}
export function translateJobStatus(status?: unknown): string {
  return typeof status === "string" ? statuses[status] ?? UNKNOWN_STATUS : UNKNOWN_STATUS;
}
export function translateJobPhase(phase?: unknown): string {
  return typeof phase === "string" ? phases[phase] ?? UNKNOWN_STATUS : UNKNOWN_STATUS;
}
export function humanGenerationError(error: unknown): string { return formatJobError(error instanceof Error && !extract(error) ? error.message : error); }
export function jobStatusMessage(status?: string, error?: string | null): string | null {
  return error ? formatJobError(error) : status ? translateJobStatus(status) : null;
}
/** Allow only recognized diagnostic fields. Never render raw provider objects or URLs. */
export function redactSensitiveDiagnostics(input: unknown): string {
  if (input && typeof input === "object") {
    const value = input as Record<string, unknown>;
    return [typeof value.status === "number" ? `HTTP ${value.status}` : "", typeof value.code === "string" && /^[a-z0-9_]{1,64}$/i.test(value.code) ? value.code : ""].filter(Boolean).join(" · ");
  }
  if (typeof input !== "string") return "";
  const code = input.match(/\b(?:401|403|404|429)\b/)?.[0] ?? input.match(/^[a-z][a-z0-9_]{0,63}$/i)?.[0];
  return code ?? "";
}
