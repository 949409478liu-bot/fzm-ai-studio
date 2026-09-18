import { describe, expect, it } from "vitest";
import { formatJobError, humanGenerationError, jobStatusMessage, redactSensitiveDiagnostics, translateJobPhase, translateJobStatus } from "./errorMessages";

describe("generation diagnostics", () => {
  it("maps common HTTP and provider codes to readable Chinese", () => {
    const cases: Record<string, string> = {
      "401": "API 密钥无效、过期或没有权限。", unauthorized: "API 密钥无效、过期或没有权限。", invalid_api_key: "API 密钥无效、过期或没有权限。", authentication_failed: "API 密钥无效、过期或没有权限。",
      "403": "中转站拒绝了请求，请检查账户权限、模型权限或余额。", forbidden: "中转站拒绝了请求，请检查账户权限、模型权限或余额。",
      "404": "没有找到请求的模型或接口地址，请检查模型 ID 和接口地址。", model_not_found: "没有找到请求的模型或接口地址，请检查模型 ID 和接口地址。", endpoint_not_found: "没有找到请求的模型或接口地址，请检查模型 ID 和接口地址。",
      "429": "请求过于频繁，或当前账户额度受限。", rate_limit: "请求过于频繁，或当前账户额度受限。",
      insufficient_balance: "账户余额或额度不足。", insufficient_quota: "账户余额或额度不足。", quota_exceeded: "账户余额或额度不足。",
      model_not_supported: "当前中转站不支持这个模型。", capability_not_supported: "当前模型不支持这个操作。",
      provider_no_outputs: "中转站返回成功，但没有返回可用图片。", timeout: "请求超时，中转站长时间没有返回结果。",
      ambiguous_submit: "提交结果不确定。为避免重复扣费，系统没有自动再次提交。", adapter_poll_missing: "当前接口配置与异步任务协议不匹配。",
    };
    for (const [code, reason] of Object.entries(cases)) expect(formatJobError(code)).toBe(reason);
    expect(formatJobError("HTTP 401 unauthorized")).toBe(cases["401"]);
    expect(formatJobError("openai_compatible_submit_failed_400")).toContain("中转站拒绝了当前请求（HTTP 400）");
    expect(formatJobError("400")).toContain("接口协议、模型 ID 或请求参数");
    expect(formatJobError("openai_compatible_submit_failed_400", { detailed: true })).toContain("Base URL");
    expect(formatJobError({ errorCode: "rate_limit", httpStatus: 429 })).toBe(cases.rate_limit);
    expect(formatJobError({ httpStatus: 403 })).toBe(cases["403"]);
  });
  it("translates every job status and phase without leaking raw unknown values", () => {
    const status = { queued: "排队中", preparing: "准备中", submitting: "正在提交", polling: "正在生成", downloading: "正在获取结果", finalizing: "正在保存结果", succeeded: "已完成", failed: "生成失败", interrupted: "任务中断", canceled: "已取消", rate_limited: "请求过于频繁", provider_busy: "服务繁忙" };
    for (const [key, value] of Object.entries(status)) expect(translateJobStatus(key)).toBe(value);
    for (const [key, value] of Object.entries({ submitting: "提交请求", polling: "等待模型生成", downloading: "下载生成结果", finalizing: "保存生成结果" })) expect(translateJobPhase(key)).toBe(value);
    expect(translateJobStatus("unrecognized")).toBe("处理中");
    expect(translateJobPhase("unrecognized")).toBe("处理中");
  });
  it("returns safe fallback for unknown errors and sanitizes diagnostic content", () => {
    expect(formatJobError("unknown_provider_bomb")).toContain("查看生成日志");
    expect(humanGenerationError({ body: { code: "provider_no_outputs" } })).toContain("没有返回可用图片");
    expect(jobStatusMessage("failed", "401")).toContain("API 密钥");
    const details = redactSensitiveDiagnostics("Authorization: Bearer abc sk-secret signed?token=xyz");
    expect(details).not.toContain("abc");
    expect(details).not.toContain("sk-secret");
    expect(details).not.toContain("xyz");
  });
});
