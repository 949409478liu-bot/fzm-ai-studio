import { expect, test } from "@playwright/test";

test("V2 canvas shell supports core Phase 1 interactions", async ({ page }) => {
  await page.goto("/v2");
  await expect(page.getByLabel("FZM AI Studio 2.0 canvas")).toBeVisible();
  await expect(page.getByText("Double-click the canvas to start creating")).toBeVisible();
  await page.waitForTimeout(1000);

  await page.getByRole("button", { name: "Text" }).click();
  await expect(page.locator(".react-flow__node")).toHaveCount(1);

  await page.getByLabel("Add").click();
  await page.getByRole("button", { name: "Image" }).click();
  await page.getByLabel("Add").click();
  await page.getByRole("button", { name: "Video" }).click();
  await expect(page.locator(".react-flow__node")).toHaveCount(3);

  await page.getByLabel("FZM AI Studio 2.0 canvas").focus();
  await page.keyboard.press("h");
  await expect(page.getByRole("button", { name: /Hand/ })).toHaveAttribute("data-active", "true");
  await page.keyboard.press("c");
  await expect(page.getByRole("button", { name: /Connect/ })).toHaveAttribute("data-active", "true");
  await page.keyboard.press("v");
  await expect(page.getByRole("button", { name: /Select/ })).toHaveAttribute("data-active", "true");

  await page.locator(".react-flow__node").last().click({ button: "right" });
  await page.getByRole("button", { name: "Duplicate" }).click();
  await expect(page.locator(".react-flow__node")).toHaveCount(4);

  await page.getByLabel("FZM AI Studio 2.0 canvas").focus();
  await page.keyboard.press(process.platform === "darwin" ? "Meta+Z" : "Control+Z");
  await expect(page.locator(".react-flow__node")).toHaveCount(3);
  await page.keyboard.press(process.platform === "darwin" ? "Meta+Shift+Z" : "Control+Y");
  await expect(page.locator(".react-flow__node")).toHaveCount(4);

  await page.locator(".react-flow__node").last().click();
  await page.getByLabel("FZM AI Studio 2.0 canvas").focus();
  await page.keyboard.press("Delete");
  await expect(page.locator(".react-flow__node")).toHaveCount(3);

  await page.locator(".react-flow__pane").click({ button: "right", position: { x: 700, y: 420 } });
  await expect(page.getByRole("menu")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menu")).toHaveCount(0);

  await page.getByRole("button", { name: "Seed 100" }).click();
  await expect(page.locator(".react-flow__node")).toHaveCount(100);
});
