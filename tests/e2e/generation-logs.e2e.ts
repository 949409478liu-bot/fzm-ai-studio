import { expect, test, type Page } from "@playwright/test";

async function project(page: Page) {
  await page.goto("/v2");
  await page.getByRole("button", { name: /新建画布/ }).click();
  await expect(page.getByLabel("FZM AI Studio 2.0 canvas")).toBeVisible();
  await expect.poll(() => new URL(page.url()).searchParams.get("project")).not.toBeNull();
  return new URL(page.url()).searchParams.get("project")!;
}

async function fake(page: Page, id: string, options: { fail?: boolean; async?: boolean } = {}) {
  const response = await page.evaluate(async ({ id, options }) => fetch("/api/v2/providers", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, name: id, kind: "custom", fake: true, enabled: true, ...options,
      models: [{ id: "fake-image", label: "Fake Image", capabilities: ["image.generate"] }] }),
  }).then((r) => r.status), { id, options });
  expect(response).toBeLessThan(400);
}

async function generate(page: Page, provider: string) {
  await page.getByLabel("Add").click();
  await page.getByRole("menu").getByRole("button", { name: "Image" }).click();
  await page.getByLabel("Provider").selectOption(provider);
  await page.getByRole("textbox", { name: "Prompt" }).fill("fake only diagnostics");
  await page.getByRole("button", { name: "生成", exact: true }).click();
}

async function jobs(page: Page, id: string) {
  return page.evaluate(async (projectId) => (await (await fetch(`/api/v2/projects/${projectId}/jobs`, { cache: "no-store" })).json()).jobs as Array<{ id: string; status: string; error?: string }>, id);
}

test("failed job is Chinese, persists after reload, and node opens exact entry without secrets", async ({ page }) => {
  const id = await project(page);
  await fake(page, "fake-log-failure", { fail: true });
  await generate(page, "fake-log-failure");
  await expect.poll(async () => (await jobs(page, id))[0]?.status).toBe("failed");
  const failed = (await jobs(page, id))[0];
  await expect(page.getByText(/生成失败：/)).toBeVisible();
  await page.getByRole("button", { name: "生成日志" }).click();
  const drawer = page.getByRole("complementary", { name: "生成日志" });
  await expect(drawer).toBeVisible();
  await expect(drawer.getByText("生成失败", { exact: true })).toBeVisible();
  await expect(drawer.locator(`[data-job-id="${failed.id}"]`)).toContainText("错误原因：");
  await expect(drawer).not.toContainText("provider_error");
  await expect(drawer).not.toContainText("Authorization");
  await expect(drawer).not.toContainText("Bearer ");
  await page.reload();
  await page.getByRole("button", { name: "生成日志" }).click();
  await expect(page.getByRole("complementary", { name: "生成日志" }).getByText("生成失败", { exact: true })).toBeVisible();
  await page.getByLabel("关闭生成日志").click();
  await page.getByRole("button", { name: "查看原因" }).click();
  await expect(page.getByRole("complementary", { name: "生成日志" }).locator(`[data-job-id="${failed.id}"] .fzm-generation-log__details`).first()).toBeVisible();
});

test("successful job appears in history and survives refresh", async ({ page }) => {
  const id = await project(page);
  await fake(page, "fake-log-success");
  await generate(page, "fake-log-success");
  await expect.poll(async () => (await jobs(page, id))[0]?.status).toBe("succeeded");
  await page.getByRole("button", { name: "生成日志" }).click();
  await expect(page.getByRole("complementary", { name: "生成日志" }).getByText("已完成", { exact: true }).last()).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "生成日志" }).click();
  await expect(page.getByRole("complementary", { name: "生成日志" }).getByText("已完成", { exact: true }).last()).toBeVisible();
});

test("running job updates from existing jobs API without another paid submit", async ({ page }) => {
  const id = await project(page);
  await fake(page, "fake-log-running", { async: true });
  await generate(page, "fake-log-running");
  await page.getByRole("button", { name: "生成日志" }).click();
  await expect.poll(async () => (await jobs(page, id))[0]?.status).toBe("succeeded");
  await expect(page.getByRole("complementary", { name: "生成日志" }).getByText("已完成", { exact: true }).last()).toBeVisible({ timeout: 15000 });
});
