"use client";

const messages: Record<string, string> = {
  provider_disabled: "Provider 已停用，请重新选择。",
  capability_not_supported: "当前模型不支持此操作，请选择兼容模型。",
  image_edit_requires_reference: "请添加参考图后再生成。",
  ambiguous_submit: "提交结果不确定。为避免重复扣费，系统没有自动重发。请先查看任务记录，确认后再重试或重新生成。",
  job_deadline_exceeded: "生成超时，请稍后重新生成。",
  retry_exhausted: "服务繁忙，多次重试后仍未成功。",
  provider_model_required: "请选择 Provider 和 Model。",
  submit_in_progress: "正在提交，请勿重复点击。",
  request_failed: "请求失败，请稍后重试。",
};

export function humanGenerationError(error: unknown) {
  const bodyError = (error as { body?: { error?: string } })?.body?.error;
  const message = error instanceof Error ? error.message : String(error ?? "request_failed");
  const code = bodyError || message;
  return messages[code] ?? (process.env.NODE_ENV === "production" ? "生成失败，请稍后重试。" : code);
}

export function jobStatusMessage(status?: string, error?: string | null) {
  if (error === "ambiguous_submit") return messages.ambiguous_submit;
  if (error && messages[error]) return messages[error];
  switch (status) {
    case "failed": return "生成失败，可重新生成。";
    case "interrupted": return "任务中断，可重新生成。";
    case "canceled": return "已取消。";
    default: return null;
  }
}
